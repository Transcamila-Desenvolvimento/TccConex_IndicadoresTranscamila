import json
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from django.http import FileResponse, HttpResponse
from django.db.models import Count, IntegerField, Max, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce, Lower
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.accounts.permissions import (
    allowed_filiais_for_module,
    get_request_context,
    resolve_filial_name,
    user_has_filial_access,
    user_has_module_access,
)
from apps.audit.services import record_audit
from apps.financeiro.pagination import ReportPagination
from apps.rh.drive_documento import EXTENSOES

from .models import (
    AUDITORIA_STATUS_CHOICES,
    AnexoRespostaAuditoriaSGQ,
    AuditoriaSGQ,
    CategoriaAuditoriaSGQ,
    ItemNormaSGQ,
    NormaSGQ,
    RespostaAuditoriaSGQ,
    TipoRespostaSGQ,
)
from .norma_itens_import_service import NormaItensImportError, importar_itens_norma, modelo_importacao_itens
from .serializers import (
    AreaNormaSerializer,
    AuditoriaSGQSerializer,
    CategoriaAuditoriaSGQSerializer,
    ClassificacaoNormaSerializer,
    ItemNormaSGQSerializer,
    NormaSGQSerializer,
    ResponderItemAuditoriaSerializer,
    RespostaAuditoriaSGQSerializer,
    TipoRespostaSGQSerializer,
)

_GERENCIAR_DETAIL = 'Acesso negado. Solicite ao administrador a função "Gerenciar auditorias" do SGQ.'
_EXECUTAR_DETAIL = 'Acesso negado. Solicite ao administrador a função "Responder auditorias" do SGQ.'
_AUDITORIA_CONCLUIDA_DETAIL = 'A auditoria está concluída; reabra-a para alterar as respostas.'
_ITEM_RESPONDIDO_DETAIL = 'Há respostas de auditorias neste item ou nos subitens; ele não pode ser excluído.'
_NORMA_RESPONDIDA_DETAIL = 'Há auditorias com respostas nas perguntas desta norma; ela não pode ser excluída.'
_ACOES_EXECUCAO = {'responder', 'anexar', 'anexo'}
ANEXO_MAX_BYTES = 15 * 1024 * 1024
RESPOSTA_MAX_ANEXOS = 20
_GERENCIAR_NORMAS_DETAIL = 'Acesso negado. Solicite ao administrador a função "Gerenciar normas" do SGQ.'
_GERENCIAR_CATEGORIAS_DETAIL = 'Acesso negado. Solicite ao administrador a função "Gerenciar categorias" do SGQ.'
_GERENCIAR_TIPOS_RESPOSTA_DETAIL = (
    'Acesso negado. Solicite ao administrador a função "Gerenciar tipos de resposta" do SGQ.'
)
_TIPO_RESPOSTA_EM_USO_DETAIL = 'Há perguntas de normas usando esse tipo de resposta; troque-o nas perguntas antes de excluir.'
_ORDENACOES_TIPOS_RESPOSTA = {
    'codigo': ('sequencia',),
    '-codigo': ('-sequencia',),
    'nome': (Lower('nome'), 'sequencia'),
    '-nome': (Lower('nome').desc(), '-sequencia'),
    'emissor': (Lower('emissor'), 'sequencia'),
    '-emissor': (Lower('emissor').desc(), '-sequencia'),
    'atualizado_em': ('atualizado_em', 'sequencia'),
    '-atualizado_em': ('-atualizado_em', '-sequencia'),
    'publica': ('publica', 'sequencia'),
    '-publica': ('-publica', '-sequencia'),
}
_ORDENACOES_CATEGORIAS = {
    'nome': (Lower('nome'), 'pk'),
    '-nome': (Lower('nome').desc(), '-pk'),
    'ativa': ('-ativa', Lower('nome')),
    '-ativa': ('ativa', Lower('nome')),
    'emissor': (Lower('emissor'), Lower('nome')),
    '-emissor': (Lower('emissor').desc(), Lower('nome')),
    'atualizado_por': (Lower('atualizado_por'), Lower('nome')),
    '-atualizado_por': (Lower('atualizado_por').desc(), Lower('nome')),
}
_ORDENACOES_NORMAS = {
    'nome': ('nome', 'pk'),
    '-nome': ('-nome', '-pk'),
    'descricao': ('descricao', 'nome'),
    '-descricao': ('-descricao', 'nome'),
    'data_atualizacao': ('data_atualizacao', 'nome'),
    '-data_atualizacao': ('-data_atualizacao', 'nome'),
    'emissor': ('emissor', 'nome'),
    '-emissor': ('-emissor', 'nome'),
}
_ORDENACOES = {
    'data_inicio': ('data_inicio', 'sequencia'),
    '-data_inicio': ('-data_inicio', '-sequencia'),
    'data_termino': ('data_termino', 'sequencia'),
    '-data_termino': ('-data_termino', '-sequencia'),
    'codigo': ('ano', 'sequencia'),
    '-codigo': ('-ano', '-sequencia'),
    'titulo': ('titulo',),
    '-titulo': ('-titulo',),
}
_STATUS_VALIDOS = {valor for valor, _ in AUDITORIA_STATUS_CHOICES}


def _semestre_atual(hoje):
    """Janela e rótulo do semestre civil que contém a data."""
    if hoje.month <= 6:
        inicio = hoje.replace(month=1, day=1)
        fim = hoje.replace(month=6, day=30)
        rotulo = f'1º semestre de {hoje.year}'
    else:
        inicio = hoje.replace(month=7, day=1)
        fim = hoje.replace(month=12, day=31)
        rotulo = f'2º semestre de {hoje.year}'
    return inicio, fim, rotulo


def _auditoria_liberada(user, aba: str) -> bool:
    """No Azure a rotina nova não entra no 'todas as rotinas'.

    Administrador sempre entra. Os demais só entram se a rotina foi gravada
    no cadastro. SGQ_AUDITORIAS_LIBERADAS=True devolve o acesso antigo.
    """
    if getattr(settings, 'SGQ_AUDITORIAS_LIBERADAS', False):
        return True
    if getattr(user, 'is_admin', False):
        return True
    abas = (getattr(user, 'abas', None) or {}).get('SGQ') or []
    return aba in abas


def _sem_aba(user, aba: str) -> bool:
    if aba.startswith('auditorias') and not _auditoria_liberada(user, aba):
        return True
    if getattr(user, 'is_admin', False):
        return False
    abas = (getattr(user, 'abas', None) or {}).get('SGQ') or []
    return bool(abas) and aba not in abas


def _anotar_progresso_questionario(qs):
    """Perguntas das normas vinculadas e quantas já têm opção escolhida."""
    total = (
        ItemNormaSGQ.objects.filter(norma__auditorias=OuterRef('pk'), tipo='pergunta')
        .order_by()
        .values('norma__auditorias')
        .annotate(total=Count('pk'))
        .values('total')
    )
    respondidas = (
        RespostaAuditoriaSGQ.objects.filter(
            auditoria=OuterRef('pk'),
            item__tipo='pergunta',
            item__norma__auditorias=OuterRef('pk'),
        )
        .exclude(opcao_codigo='')
        .order_by()
        .values('auditoria')
        .annotate(total=Count('pk'))
        .values('total')
    )
    return qs.annotate(
        total_perguntas=Coalesce(Subquery(total[:1]), Value(0), output_field=IntegerField()),
        perguntas_respondidas=Coalesce(Subquery(respondidas[:1]), Value(0), output_field=IntegerField()),
    )


def _flag(valor) -> bool:
    return str(valor or '').strip().lower() in ('1', 'true', 'yes', 'on', 'sim')


def _lista_json(bruto, descricao: str, serializer_class=None) -> list:
    """Lista enviada como JSON num campo multipart; `ValueError` com mensagem para o usuário se inválida."""
    if not bruto:
        return []
    try:
        lista = json.loads(bruto)
    except (TypeError, ValueError):
        lista = None
    if not isinstance(lista, list) or not all(isinstance(item, dict) for item in lista):
        raise ValueError(f'Revise {descricao}.')
    if serializer_class is None:
        return lista
    validacao = serializer_class(data=lista, many=True)
    if not validacao.is_valid():
        raise ValueError(f'Revise {descricao}.')
    return validacao.validated_data


def _filial_da_sessao(request) -> str:
    _, filial = get_request_context(request)
    allowed = allowed_filiais_for_module(request.user, 'SGQ')
    return resolve_filial_name(filial, allowed) or filial


def _usuarios_sgq(filial: str) -> list[dict]:
    """Usuários ativos com o SGQ liberado na filial — candidatos a auditor líder."""
    pessoas: dict[str, str] = {}
    for u in get_user_model().objects.filter(status='ativo', is_active=True):
        if not (user_has_module_access(u, 'SGQ') and user_has_filial_access(u, 'SGQ', filial)):
            continue
        nome = (u.name or u.get_full_name() or u.get_username()).strip()
        pessoas[nome] = pessoas.get(nome) or (u.cargo or '').strip()
    return [{'nome': nome, 'cargo': pessoas[nome]} for nome in sorted(pessoas, key=str.casefold)]


def _dados_atualizacao_norma(user) -> dict:
    """Data da última atualização e emissor de uma norma são sempre definidos pelo servidor."""
    return {
        'data_atualizacao': timezone.localdate(),
        'emissor': (getattr(user, 'name', '') or user.get_username())[:150],
    }


def _marcar_norma_atualizada(norma_id, user) -> None:
    NormaSGQ.objects.filter(pk=norma_id).update(**_dados_atualizacao_norma(user), atualizado_em=timezone.now())


def _proximo_codigo(ano: int) -> tuple[int, str]:
    ultima = AuditoriaSGQ.objects.filter(ano=ano).aggregate(maior=Max('sequencia'))['maior'] or 0
    sequencia = ultima + 1
    return sequencia, f'{ano % 100:02d}-{sequencia:05d}'


class AuditoriaSGQViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'SGQ'
    serializer_class = AuditoriaSGQSerializer
    queryset = AuditoriaSGQ.objects.select_related('criado_por').prefetch_related('normas')
    pagination_class = ReportPagination
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        sem_auditorias = _sem_aba(request.user, 'auditorias')
        sem_questionario = _sem_aba(request.user, 'auditorias-minhas-acoes')
        sem_visao = _sem_aba(request.user, 'auditorias-visao-geral')
        consulta_ou_resposta = request.method in ('GET', 'HEAD', 'OPTIONS') or self.action in _ACOES_EXECUCAO
        if consulta_ou_resposta:
            vê_visao = self.action == 'visao' and not sem_visao
            if sem_auditorias and sem_questionario and not vê_visao:
                self.permission_denied(request, message='Sem acesso às Auditorias.')
        elif sem_auditorias:
            self.permission_denied(request, message='Sem acesso às Auditorias.')
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return
        if self.action in _ACOES_EXECUCAO:
            if not request.user.has_funcao('SGQ', 'executar-auditorias'):
                self.permission_denied(request, message=_EXECUTAR_DETAIL)
        elif not request.user.has_funcao('SGQ', 'gerenciar-auditorias'):
            self.permission_denied(request, message=_GERENCIAR_DETAIL)

    def _escopo(self):
        # Auditorias ficam segregadas por filial, sem visão consolidada — nem para admin.
        return self.scope_queryset(self.queryset, filial_field='filial', admin_bypass=False)

    def _categorias(self):
        return self.scope_queryset(CategoriaAuditoriaSGQ.objects.all(), filial_field='filial', admin_bypass=False)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['filial'] = _filial_da_sessao(self.request)
        return context

    def get_queryset(self):
        qs = _anotar_progresso_questionario(self._escopo())
        if self.action != 'list':
            return qs
        params = self.request.query_params
        search = (params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                Q(codigo__icontains=search)
                | Q(titulo__icontains=search)
                | Q(categoria__icontains=search)
                | Q(normas__nome__icontains=search)
                | Q(auditor_lider__icontains=search)
                | Q(auditores__icontains=search)
            ).distinct()
        situacao = (params.get('status') or '').strip()
        if situacao == 'atrasada':
            qs = qs.exclude(status='concluida').filter(data_termino__lt=timezone.localdate())
        elif situacao in _STATUS_VALIDOS:
            qs = qs.filter(status=situacao)
        categoria = (params.get('categoria') or '').strip()
        if categoria:
            qs = qs.filter(categoria=categoria)
        ordering = _ORDENACOES.get(params.get('ordering') or '', _ORDENACOES['-data_inicio'])
        return qs.order_by(*ordering)

    def perform_create(self, serializer):
        ano = serializer.validated_data['data_inicio'].year
        for _ in range(3):
            try:
                with transaction.atomic():
                    sequencia, codigo = _proximo_codigo(ano)
                    auditoria = serializer.save(
                        ano=ano,
                        sequencia=sequencia,
                        codigo=codigo,
                        filial=_filial_da_sessao(self.request),
                        criado_por=self.request.user,
                    )
                break
            except IntegrityError:
                continue
        else:
            raise IntegrityError('Não foi possível gerar o código da auditoria.')
        record_audit(self.request.user, 'sgq.auditoria.criada', f'Auditoria {auditoria.codigo} ({auditoria.titulo}) criada.')

    def perform_update(self, serializer):
        auditoria = serializer.save()
        record_audit(self.request.user, 'sgq.auditoria.atualizada', f'Auditoria {auditoria.codigo} ({auditoria.titulo}) atualizada.')

    def perform_destroy(self, instance):
        record_audit(self.request.user, 'sgq.auditoria.excluida', f'Auditoria {instance.codigo} ({instance.titulo}) excluída.')
        instance.delete()

    @action(detail=False, methods=['get'])
    def resumo(self, request):
        qs = self._escopo()
        contagem = qs.aggregate(
            total=Count('pk'),
            planejamento=Count('pk', filter=Q(status='planejamento')),
            execucao=Count('pk', filter=Q(status='execucao')),
            concluida=Count('pk', filter=Q(status='concluida')),
            atrasada=Count('pk', filter=~Q(status='concluida') & Q(data_termino__lt=timezone.localdate())),
        )
        return Response(contagem)

    @action(detail=False, methods=['get'])
    def visao(self, request):
        """Painel da aba Visão geral: atraso do semestre, status e não conformidades por auditoria."""
        hoje = timezone.localdate()
        inicio, fim, rotulo = _semestre_atual(hoje)
        qs = self._escopo()
        contagem = qs.aggregate(
            planejamento=Count('pk', filter=Q(status='planejamento')),
            execucao=Count('pk', filter=Q(status='execucao')),
            concluida=Count('pk', filter=Q(status='concluida')),
            atrasadas=Count(
                'pk',
                filter=(
                    ~Q(status='concluida')
                    & Q(data_termino__lt=hoje)
                    & Q(data_termino__gte=inicio)
                    & Q(data_termino__lte=fim)
                ),
            ),
        )
        ocorrencias = (
            RespostaAuditoriaSGQ.objects.filter(auditoria__in=qs, valor=0)
            .exclude(opcao_codigo='')
            .values('auditoria__titulo')
            .annotate(valor=Count('pk'))
            .order_by('-valor', 'auditoria__titulo')[:8]
        )
        return Response({
            'semestre': rotulo,
            'atrasadas': contagem['atrasadas'],
            'planejamento': contagem['planejamento'],
            'execucao': contagem['execucao'],
            'concluida': contagem['concluida'],
            'ocorrencias': [{'label': item['auditoria__titulo'], 'valor': item['valor']} for item in ocorrencias],
        })

    @action(detail=False, methods=['get'])
    def sugestoes(self, request):
        """Opções do formulário: categorias ativas e usuários do SGQ que podem ser auditor líder."""
        categorias = self._categorias().filter(ativa=True).prefetch_related('normas').order_by('nome')
        return Response({
            'categorias': [
                {
                    'nome': c.nome,
                    'normas': [
                        {'id': str(n.pk), 'nome': n.nome}
                        for n in sorted(c.normas.all(), key=lambda n: n.nome.casefold()) if n.ativa
                    ],
                }
                for c in categorias
            ],
            'auditores': _usuarios_sgq(_filial_da_sessao(request)),
        })

    @action(detail=False, methods=['post'], url_path='excluir-lote')
    def excluir_lote(self, request):
        ids = request.data.get('ids') if isinstance(request.data, dict) else None
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'Selecione ao menos uma auditoria.'}, status=status.HTTP_400_BAD_REQUEST)
        alvo = self._escopo().filter(pk__in=[str(i) for i in ids])
        codigos = list(alvo.values_list('codigo', flat=True))
        if not codigos:
            return Response({'detail': 'Nenhuma auditoria encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        alvo.delete()
        record_audit(request.user, 'sgq.auditoria.excluida', f'Auditorias excluídas: {", ".join(codigos)}.')
        return Response({'excluidas': len(codigos)})

    @action(detail=True, methods=['get'])
    def execucao(self, request, pk=None):
        """Perguntas das normas da auditoria (árvore plana, na ordem) com as respostas já dadas."""
        auditoria = self.get_object()
        normas = list(auditoria.normas.order_by('nome', 'pk'))
        itens = ItemNormaSGQ.objects.filter(norma__in=normas).order_by('ordem', 'pk')
        tipos = TipoRespostaSGQ.objects.filter(pk__in=itens.exclude(tipo_resposta=None).values('tipo_resposta'))
        respostas = (
            auditoria.respostas.select_related('respondido_por')
            .prefetch_related('anexos__incluido_por')
        )
        return Response({
            'auditoria': AuditoriaSGQSerializer(auditoria, context=self.get_serializer_context()).data,
            'normas': [
                {'id': str(n.pk), 'nome': n.nome, 'classificacoes': n.classificacoes, 'areas': n.areas}
                for n in normas
            ],
            'tiposResposta': [{'id': str(t.pk), 'nome': t.nome, 'opcoes': t.opcoes} for t in tipos],
            'itens': ItemNormaSGQSerializer(itens, many=True).data,
            'respostas': RespostaAuditoriaSGQSerializer(respostas, many=True).data,
        })

    def _resposta_atualizada(self, resposta) -> Response:
        resposta = (
            RespostaAuditoriaSGQ.objects.select_related('respondido_por')
            .prefetch_related('anexos__incluido_por')
            .get(pk=resposta.pk)
        )
        return Response(RespostaAuditoriaSGQSerializer(resposta).data)

    @staticmethod
    def _iniciar_execucao(auditoria) -> None:
        if auditoria.status == 'planejamento':
            auditoria.status = 'execucao'
            auditoria.save(update_fields=['status', 'atualizado_em'])

    @action(detail=True, methods=['post'])
    def responder(self, request, pk=None):
        auditoria = self.get_object()
        if auditoria.status == 'concluida':
            return Response({'detail': _AUDITORIA_CONCLUIDA_DETAIL}, status=status.HTTP_400_BAD_REQUEST)
        entrada = ResponderItemAuditoriaSerializer(data=request.data, context={'auditoria': auditoria})
        entrada.is_valid(raise_exception=True)
        dados = entrada.validated_data
        opcao = dados['opcao']
        with transaction.atomic():
            resposta, _ = RespostaAuditoriaSGQ.objects.update_or_create(
                auditoria=auditoria,
                item=dados['item'],
                defaults={
                    'opcao_codigo': str(opcao.get('codigo', '')) if opcao else '',
                    'opcao_texto': str(opcao.get('texto', ''))[:60] if opcao else '',
                    'valor': opcao.get('valor') if opcao else None,
                    'observacoes': dados['observacoes'],
                    'destaque': dados['destaque'],
                    'respondido_por': request.user,
                },
            )
            self._iniciar_execucao(auditoria)
        item = dados['item']
        record_audit(
            request.user, 'sgq.auditoria.resposta',
            f'Auditoria {auditoria.codigo}: item {item.codigo or item.titulo[:60]} → {resposta.opcao_texto or "sem resposta"}.',
        )
        return self._resposta_atualizada(resposta)

    @action(detail=True, methods=['post'], url_path='anexos', parser_classes=[MultiPartParser, FormParser])
    def anexar(self, request, pk=None):
        auditoria = self.get_object()
        if auditoria.status == 'concluida':
            return Response({'detail': _AUDITORIA_CONCLUIDA_DETAIL}, status=status.HTTP_400_BAD_REQUEST)
        item_id = str(request.data.get('itemId') or '').strip()
        item = (
            ItemNormaSGQ.objects.filter(pk=int(item_id), norma__in=auditoria.normas.all(), tipo='pergunta').first()
            if item_id.isdigit() else None
        )
        if item is None:
            return Response({'itemId': 'Pergunta não encontrada nas normas desta auditoria.'}, status=status.HTTP_400_BAD_REQUEST)
        arquivo = request.FILES.get('arquivo')
        if not arquivo:
            return Response({'arquivo': 'Escolha o arquivo.'}, status=status.HTTP_400_BAD_REQUEST)
        if Path(arquivo.name).suffix.lower() not in EXTENSOES:
            return Response(
                {'arquivo': 'Tipo de arquivo não aceito. Use PDF, Word, Excel, PowerPoint, texto ou imagem.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if arquivo.size > ANEXO_MAX_BYTES:
            return Response({'arquivo': 'O arquivo passou de 15 MB.'}, status=status.HTTP_400_BAD_REQUEST)
        if AnexoRespostaAuditoriaSGQ.objects.filter(resposta__auditoria=auditoria, resposta__item=item).count() >= RESPOSTA_MAX_ANEXOS:
            return Response(
                {'arquivo': f'Cada pergunta aceita até {RESPOSTA_MAX_ANEXOS} anexos.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            resposta, _ = RespostaAuditoriaSGQ.objects.get_or_create(
                auditoria=auditoria, item=item, defaults={'respondido_por': request.user},
            )
            AnexoRespostaAuditoriaSGQ.objects.create(
                resposta=resposta,
                arquivo=arquivo,
                nome_original=Path(arquivo.name).name[:180],
                tamanho=arquivo.size,
                incluido_por=request.user,
            )
            self._iniciar_execucao(auditoria)
        record_audit(
            request.user, 'sgq.auditoria.anexo',
            f'Auditoria {auditoria.codigo}: anexo "{arquivo.name}" no item {item.codigo or item.titulo[:60]}.',
        )
        return self._resposta_atualizada(resposta)

    @action(detail=True, methods=['get', 'delete'], url_path=r'anexos/(?P<anexo_id>\d+)')
    def anexo(self, request, pk=None, anexo_id=None):
        auditoria = self.get_object()
        anexo = AnexoRespostaAuditoriaSGQ.objects.filter(pk=anexo_id, resposta__auditoria=auditoria).first()
        if anexo is None:
            return Response({'detail': 'Anexo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        if request.method == 'GET':
            if not anexo.arquivo:
                return Response({'detail': 'Arquivo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
            return FileResponse(anexo.arquivo.open('rb'), as_attachment=True, filename=anexo.nome_original or 'anexo')
        if auditoria.status == 'concluida':
            return Response({'detail': _AUDITORIA_CONCLUIDA_DETAIL}, status=status.HTTP_400_BAD_REQUEST)
        resposta = anexo.resposta
        nome = anexo.nome_original
        anexo.arquivo.delete(save=False)
        anexo.delete()
        record_audit(request.user, 'sgq.auditoria.anexo.excluido', f'Auditoria {auditoria.codigo}: anexo "{nome}" excluído.')
        return self._resposta_atualizada(resposta)


class NormaSGQViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'SGQ'
    serializer_class = NormaSGQSerializer
    queryset = NormaSGQ.objects.select_related('criado_por')
    pagination_class = ReportPagination
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if _sem_aba(request.user, 'auditorias-normas'):
            self.permission_denied(request, message='Sem acesso às Normas.')
        if request.method not in ('GET', 'HEAD', 'OPTIONS') and not request.user.has_funcao('SGQ', 'gerenciar-normas'):
            self.permission_denied(request, message=_GERENCIAR_NORMAS_DETAIL)

    def _escopo(self):
        return self.scope_queryset(self.queryset, filial_field='filial', admin_bypass=False)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['filial'] = _filial_da_sessao(self.request)
        return context

    def get_queryset(self):
        qs = self._escopo()
        if self.action != 'list':
            return qs
        params = self.request.query_params
        search = (params.get('search') or '').strip()
        if search:
            qs = qs.filter(Q(nome__icontains=search) | Q(descricao__icontains=search) | Q(emissor__icontains=search))
        situacao = (params.get('situacao') or '').strip()
        if situacao in ('ativa', 'inativa'):
            qs = qs.filter(ativa=situacao == 'ativa')
        publica = (params.get('publica') or '').strip()
        if publica in ('sim', 'nao'):
            qs = qs.filter(publica=publica == 'sim')
        ordering = _ORDENACOES_NORMAS.get(params.get('ordering') or '', _ORDENACOES_NORMAS['nome'])
        return qs.order_by(*ordering)

    def perform_create(self, serializer):
        norma = serializer.save(
            filial=_filial_da_sessao(self.request),
            criado_por=self.request.user,
            **_dados_atualizacao_norma(self.request.user),
        )
        record_audit(self.request.user, 'sgq.norma.criada', f'Norma {norma.nome} criada.')

    def perform_update(self, serializer):
        norma = serializer.save(**_dados_atualizacao_norma(self.request.user))
        record_audit(self.request.user, 'sgq.norma.atualizada', f'Norma {norma.nome} atualizada.')

    def destroy(self, request, *args, **kwargs):
        if RespostaAuditoriaSGQ.objects.filter(item__norma=self.get_object()).exists():
            return Response({'detail': _NORMA_RESPONDIDA_DETAIL}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        record_audit(self.request.user, 'sgq.norma.excluida', f'Norma {instance.nome} excluída.')
        instance.delete()

    @action(detail=False, methods=['get'])
    def resumo(self, request):
        contagem = self._escopo().aggregate(
            total=Count('pk'),
            n_ativas=Count('pk', filter=Q(ativa=True)),
            n_inativas=Count('pk', filter=Q(ativa=False)),
        )
        return Response({'total': contagem['total'], 'ativa': contagem['n_ativas'], 'inativa': contagem['n_inativas']})

    @action(detail=False, methods=['post'], url_path='excluir-lote')
    def excluir_lote(self, request):
        ids = request.data.get('ids') if isinstance(request.data, dict) else None
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'Selecione ao menos uma norma.'}, status=status.HTTP_400_BAD_REQUEST)
        alvo = self._escopo().filter(pk__in=[str(i) for i in ids])
        nomes = list(alvo.values_list('nome', flat=True))
        if not nomes:
            return Response({'detail': 'Nenhuma norma encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        if RespostaAuditoriaSGQ.objects.filter(item__norma__in=alvo).exists():
            return Response({'detail': _NORMA_RESPONDIDA_DETAIL}, status=status.HTTP_400_BAD_REQUEST)
        alvo.delete()
        record_audit(request.user, 'sgq.norma.excluida', f'Normas excluídas: {", ".join(nomes)}.')
        return Response({'excluidas': len(nomes)})

    @action(detail=True, methods=['get'], url_path='tipos-resposta')
    def tipos_resposta(self, request, pk=None):
        """Tipos de resposta da unidade da norma, para as perguntas (não exige acesso ao cadastro de tipos)."""
        norma = self.get_object()
        tipos = TipoRespostaSGQ.objects.filter(filial=norma.filial).order_by('nome')
        return Response([
            {'id': str(tipo.pk), 'codigo': tipo.codigo, 'nome': tipo.nome, 'opcoes': tipo.opcoes}
            for tipo in tipos
        ])

    @action(detail=False, methods=['get'], url_path='exportar-modelo-itens')
    def exportar_modelo_itens(self, request):
        """Planilha padrão dos requisitos, válida para ISO 9001, SASSMAQ e outras normas."""
        if not request.user.has_funcao('SGQ', 'gerenciar-normas'):
            self.permission_denied(request, message=_GERENCIAR_NORMAS_DETAIL)
        content = modelo_importacao_itens()
        response = HttpResponse(
            content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename="modelo_requisitos_sgq.xlsx"'
        response['Content-Length'] = str(len(content))
        return response

    @action(detail=True, methods=['post'], url_path='importar-itens', parser_classes=[MultiPartParser, FormParser])
    def importar_itens(self, request, pk=None):
        """Importa requisitos/subitens de uma lista de verificação (.xlsx). `dryRun=true` só analisa."""
        norma = self.get_object()
        arquivo = request.FILES.get('file') or request.FILES.get('arquivo')
        if not arquivo:
            return Response({'detail': 'Arquivo Excel (.xlsx) não fornecido.'}, status=status.HTTP_400_BAD_REQUEST)
        tipo_resposta = TipoRespostaSGQ.objects.filter(
            filial=norma.filial, pk=str(request.data.get('tipoRespostaId') or '').strip() or None,
        ).first()
        if tipo_resposta is None:
            return Response({'detail': 'Selecione o tipo de resposta das perguntas.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            mapeamento = _lista_json(request.data.get('mapeamento'), 'o mapeamento das colunas')
            novas_classificacoes = _lista_json(
                request.data.get('classificacoes'), 'as novas classificações (sigla, nome e metas de 0 a 100)',
                ClassificacaoNormaSerializer,
            )
            novas_areas = _lista_json(request.data.get('areas'), 'as novas áreas (sigla e nome)', AreaNormaSerializer)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        dry_run = _flag(request.data.get('dryRun'))
        substituir = _flag(request.data.get('substituir'))
        try:
            resumo = importar_itens_norma(
                norma,
                arquivo.read(),
                tipo_resposta=tipo_resposta,
                substituir=substituir,
                dry_run=dry_run,
                mapeamento=mapeamento,
                novas_classificacoes=novas_classificacoes,
                novas_areas=novas_areas,
            )
        except NormaItensImportError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if not dry_run:
            _marcar_norma_atualizada(norma.pk, request.user)
            acao = 'substituindo os itens existentes' if substituir else 'adicionando aos itens existentes'
            record_audit(
                request.user, 'sgq.norma.itens.importados',
                f'{resumo["total"]} itens importados na norma {norma.nome} ({acao}) a partir de {arquivo.name}.',
            )
        return Response(resumo)


def _nome_usuario(user) -> str:
    return (getattr(user, 'name', '') or user.get_username())[:150]


class CategoriaAuditoriaSGQViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    """Cadastro de categorias das auditorias. Categorias em uso não podem ser excluídas — só inativadas."""

    permission_module = 'SGQ'
    serializer_class = CategoriaAuditoriaSGQSerializer
    pagination_class = ReportPagination
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if _sem_aba(request.user, 'auditorias-categorias'):
            self.permission_denied(request, message='Sem acesso às Categorias.')
        if request.method not in ('GET', 'HEAD', 'OPTIONS') and not request.user.has_funcao('SGQ', 'gerenciar-categorias'):
            self.permission_denied(request, message=_GERENCIAR_CATEGORIAS_DETAIL)

    def _escopo(self):
        uso = (
            AuditoriaSGQ.objects.filter(filial=OuterRef('filial'), categoria=OuterRef('nome'))
            .order_by().values('categoria').annotate(total=Count('pk')).values('total')
        )
        qs = CategoriaAuditoriaSGQ.objects.prefetch_related('normas').annotate(
            total_auditorias=Coalesce(Subquery(uso, output_field=IntegerField()), Value(0)),
        )
        return self.scope_queryset(qs, filial_field='filial', admin_bypass=False)

    def _normas(self):
        return self.scope_queryset(NormaSGQ.objects.all(), filial_field='filial', admin_bypass=False)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['filial'] = _filial_da_sessao(self.request)
        context['normas'] = self._normas()
        return context

    def get_queryset(self):
        qs = self._escopo()
        if self.action != 'list':
            return qs
        params = self.request.query_params
        search = (params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                Q(nome__icontains=search)
                | Q(emissor__icontains=search)
                | Q(atualizado_por__icontains=search)
                | Q(pk__in=CategoriaAuditoriaSGQ.objects.filter(normas__nome__icontains=search).values('pk'))
            )
        situacao = (params.get('situacao') or '').strip()
        if situacao in ('ativa', 'inativa'):
            qs = qs.filter(ativa=situacao == 'ativa')
        ordering = _ORDENACOES_CATEGORIAS.get(params.get('ordering') or '', _ORDENACOES_CATEGORIAS['nome'])
        return qs.order_by(*ordering)

    def perform_create(self, serializer):
        nome = _nome_usuario(self.request.user)
        categoria = serializer.save(
            filial=_filial_da_sessao(self.request),
            criado_por=self.request.user,
            emissor=nome,
            atualizado_por=nome,
        )
        record_audit(self.request.user, 'sgq.categoria.criada', f'Categoria de auditoria {categoria.nome} criada.')

    def perform_update(self, serializer):
        nome_anterior = serializer.instance.nome
        with transaction.atomic():
            categoria = serializer.save(atualizado_por=_nome_usuario(self.request.user))
            if categoria.nome != nome_anterior:
                AuditoriaSGQ.objects.filter(filial=categoria.filial, categoria=nome_anterior).update(categoria=categoria.nome)
        record_audit(self.request.user, 'sgq.categoria.atualizada', f'Categoria de auditoria {categoria.nome} atualizada.')

    def perform_destroy(self, instance):
        record_audit(self.request.user, 'sgq.categoria.excluida', f'Categoria de auditoria {instance.nome} excluída.')
        instance.delete()

    def destroy(self, request, *args, **kwargs):
        categoria = self.get_object()
        if categoria.total_auditorias:
            return Response(
                {'detail': f'A categoria {categoria.nome} está em uso por auditorias. Inative-a em vez de excluir.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def resumo(self, request):
        contagem = self._escopo().aggregate(
            total=Count('pk'),
            n_ativas=Count('pk', filter=Q(ativa=True)),
            n_inativas=Count('pk', filter=Q(ativa=False)),
        )
        return Response({'total': contagem['total'], 'ativa': contagem['n_ativas'], 'inativa': contagem['n_inativas']})

    @action(detail=False, methods=['get'])
    def sugestoes(self, request):
        """Normas ativas da filial que podem ser vinculadas à categoria."""
        normas = self._normas().filter(ativa=True).order_by('nome')
        return Response({'normas': [{'id': str(n.pk), 'nome': n.nome, 'descricao': n.descricao} for n in normas]})

    @action(detail=False, methods=['post'], url_path='excluir-lote')
    def excluir_lote(self, request):
        ids = request.data.get('ids') if isinstance(request.data, dict) else None
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'Selecione ao menos uma categoria.'}, status=status.HTTP_400_BAD_REQUEST)
        alvo = list(self._escopo().filter(pk__in=[str(i) for i in ids]))
        if not alvo:
            return Response({'detail': 'Nenhuma categoria encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        em_uso = [c.nome for c in alvo if c.total_auditorias]
        if em_uso:
            return Response(
                {'detail': f'Categorias em uso por auditorias não podem ser excluídas (inative-as): {", ".join(em_uso)}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        nomes = [c.nome for c in alvo]
        CategoriaAuditoriaSGQ.objects.filter(pk__in=[c.pk for c in alvo]).delete()
        record_audit(request.user, 'sgq.categoria.excluida', f'Categorias de auditoria excluídas: {", ".join(nomes)}.')
        return Response({'excluidas': len(nomes)})


class TipoRespostaSGQViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    """Cadastro dos tipos de resposta (conjuntos de opções) das perguntas das auditorias."""

    permission_module = 'SGQ'
    serializer_class = TipoRespostaSGQSerializer
    queryset = TipoRespostaSGQ.objects.all()
    pagination_class = ReportPagination
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if _sem_aba(request.user, 'auditorias-tipos-resposta'):
            self.permission_denied(request, message='Sem acesso aos Tipos de respostas.')
        if request.method not in ('GET', 'HEAD', 'OPTIONS') and not request.user.has_funcao('SGQ', 'gerenciar-tipos-resposta'):
            self.permission_denied(request, message=_GERENCIAR_TIPOS_RESPOSTA_DETAIL)

    def _escopo(self):
        return self.scope_queryset(self.queryset, filial_field='filial', admin_bypass=False)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['filial'] = _filial_da_sessao(self.request)
        return context

    def get_queryset(self):
        qs = self._escopo()
        if self.action != 'list':
            return qs
        params = self.request.query_params
        search = (params.get('search') or '').strip()
        if search:
            # A busca em `opcoes` compara o JSON serializado: no SQLite os acentos ficam escapados (\uXXXX).
            qs = qs.filter(Q(nome__icontains=search) | Q(emissor__icontains=search) | Q(opcoes__icontains=search))
        publica = (params.get('publica') or '').strip()
        if publica in ('sim', 'nao'):
            qs = qs.filter(publica=publica == 'sim')
        ordering = _ORDENACOES_TIPOS_RESPOSTA.get(params.get('ordering') or '', _ORDENACOES_TIPOS_RESPOSTA['-codigo'])
        return qs.order_by(*ordering)

    def perform_create(self, serializer):
        filial = _filial_da_sessao(self.request)
        for _ in range(3):
            try:
                with transaction.atomic():
                    ultima = TipoRespostaSGQ.objects.filter(filial=filial).aggregate(maior=Max('sequencia'))['maior'] or 0
                    tipo = serializer.save(
                        filial=filial,
                        sequencia=ultima + 1,
                        criado_por=self.request.user,
                        emissor=_nome_usuario(self.request.user),
                    )
                break
            except IntegrityError:
                continue
        else:
            raise IntegrityError('Não foi possível gerar o código do tipo de resposta.')
        record_audit(self.request.user, 'sgq.tipo_resposta.criado', f'Tipo de resposta {tipo.codigo} ({tipo.nome}) criado.')

    def perform_update(self, serializer):
        tipo = serializer.save()
        record_audit(self.request.user, 'sgq.tipo_resposta.atualizado', f'Tipo de resposta {tipo.codigo} ({tipo.nome}) atualizado.')

    def destroy(self, request, *args, **kwargs):
        if self.get_object().itens.exists():
            return Response({'detail': _TIPO_RESPOSTA_EM_USO_DETAIL}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        record_audit(self.request.user, 'sgq.tipo_resposta.excluido', f'Tipo de resposta {instance.codigo} ({instance.nome}) excluído.')
        instance.delete()

    @action(detail=False, methods=['get'])
    def resumo(self, request):
        contagem = self._escopo().aggregate(
            total=Count('pk'),
            n_publicas=Count('pk', filter=Q(publica=True)),
            n_privadas=Count('pk', filter=Q(publica=False)),
        )
        return Response({'total': contagem['total'], 'sim': contagem['n_publicas'], 'nao': contagem['n_privadas']})

    @action(detail=False, methods=['post'], url_path='excluir-lote')
    def excluir_lote(self, request):
        ids = request.data.get('ids') if isinstance(request.data, dict) else None
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'Selecione ao menos um tipo de resposta.'}, status=status.HTTP_400_BAD_REQUEST)
        alvo = self._escopo().filter(pk__in=[str(i) for i in ids])
        nomes = [f'{tipo.codigo} ({tipo.nome})' for tipo in alvo]
        if not nomes:
            return Response({'detail': 'Nenhum tipo de resposta encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        if ItemNormaSGQ.objects.filter(tipo_resposta__in=alvo).exists():
            return Response({'detail': _TIPO_RESPOSTA_EM_USO_DETAIL}, status=status.HTTP_400_BAD_REQUEST)
        alvo.delete()
        record_audit(request.user, 'sgq.tipo_resposta.excluido', f'Tipos de resposta excluídos: {", ".join(nomes)}.')
        return Response({'excluidos': len(nomes)})


def _proxima_ordem(norma_id, parent_id) -> int:
    ultima = ItemNormaSGQ.objects.filter(norma_id=norma_id, parent_id=parent_id).aggregate(maior=Max('ordem'))['maior']
    return 0 if ultima is None else ultima + 1


class ItemNormaSGQViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    """Requisitos e subitens de uma norma. A lista traz a árvore inteira (`?norma=<id>`), sem paginação."""

    permission_module = 'SGQ'
    serializer_class = ItemNormaSGQSerializer
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if _sem_aba(request.user, 'auditorias-normas'):
            self.permission_denied(request, message='Sem acesso às Normas.')
        if request.method not in ('GET', 'HEAD', 'OPTIONS') and not request.user.has_funcao('SGQ', 'gerenciar-normas'):
            self.permission_denied(request, message=_GERENCIAR_NORMAS_DETAIL)

    def _normas(self):
        return self.scope_queryset(NormaSGQ.objects.all(), filial_field='filial', admin_bypass=False)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['normas'] = self._normas()
        return context

    def get_queryset(self):
        qs = ItemNormaSGQ.objects.filter(norma__in=self._normas())
        if self.action == 'list':
            norma = (self.request.query_params.get('norma') or '').strip()
            if not norma.isdigit():
                return qs.none()
            qs = qs.filter(norma_id=int(norma))
        return qs.order_by('ordem', 'pk')

    def perform_create(self, serializer):
        norma = serializer.validated_data['norma']
        parent = serializer.validated_data.get('parent')
        item = serializer.save(ordem=_proxima_ordem(norma.pk, parent.pk if parent else None))
        _marcar_norma_atualizada(norma.pk, self.request.user)
        record_audit(self.request.user, 'sgq.norma.item.criado', f'Item "{item.titulo}" criado na norma {norma.nome}.')

    def perform_update(self, serializer):
        anterior = serializer.instance.parent_id
        novo_parent = serializer.validated_data.get('parent', serializer.instance.parent)
        extra = {}
        if (novo_parent.pk if novo_parent else None) != anterior:
            extra['ordem'] = _proxima_ordem(serializer.instance.norma_id, novo_parent.pk if novo_parent else None)
        item = serializer.save(**extra)
        _marcar_norma_atualizada(item.norma_id, self.request.user)
        record_audit(self.request.user, 'sgq.norma.item.atualizado', f'Item "{item.titulo}" da norma {item.norma.nome} atualizado.')

    def perform_destroy(self, instance):
        record_audit(
            self.request.user, 'sgq.norma.item.excluido',
            f'Item "{instance.titulo}" (e subitens) excluído da norma {instance.norma.nome}.',
        )
        norma_id = instance.norma_id
        instance.delete()
        _marcar_norma_atualizada(norma_id, self.request.user)

    def destroy(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response({'detail': _ITEM_RESPONDIDO_DETAIL}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def mover(self, request, pk=None):
        item = self.get_object()
        direcao = request.data.get('direcao') if isinstance(request.data, dict) else None
        if direcao not in ('cima', 'baixo'):
            return Response({'detail': 'Direção inválida.'}, status=status.HTTP_400_BAD_REQUEST)
        irmaos = list(ItemNormaSGQ.objects.filter(norma_id=item.norma_id, parent_id=item.parent_id).order_by('ordem', 'pk'))
        posicao = next(i for i, irmao in enumerate(irmaos) if irmao.pk == item.pk)
        destino = posicao - 1 if direcao == 'cima' else posicao + 1
        if 0 <= destino < len(irmaos):
            irmaos[posicao], irmaos[destino] = irmaos[destino], irmaos[posicao]
            with transaction.atomic():
                for ordem, irmao in enumerate(irmaos):
                    if irmao.ordem != ordem:
                        ItemNormaSGQ.objects.filter(pk=irmao.pk).update(ordem=ordem)
            _marcar_norma_atualizada(item.norma_id, request.user)
        return Response({'ok': True})
