import re

from datetime import date, timedelta

from django.db import transaction
from django.utils import timezone
from django.db.models import Case, CharField, Count, DateField, DurationField, ExpressionWrapper, F, IntegerField, Q, Value, When, Window
from django.db.models.functions import Cast, Coalesce, Concat, Lower, NullIf, Replace, RowNumber, Trim, TruncDate, TruncMonth
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.audit.models import AuditLog
from apps.audit.services import record_audit
from apps.faturamento.cnpj_service import CnpjLookupError, consultar_cnpj, only_digits

from .models import (
    ClienteComercial,
    GeneralidadeComercial,
    HomologacaoProdutoEvento,
    MatrizIcmsUf,
    ParametrosComercial,
    ProdutoComercial,
    PropostaComercial,
    PropostaComercialDraft,
    SITUACAO_CLIENTE,
    SITUACAO_INATIVO,
    SITUACAO_POTENCIAL,
    STATUS_PROPOSTA_APROVADA,
    STATUS_PROPOSTA_ENVIADA,
    STATUS_PROPOSTA_RASCUNHO,
    STATUS_PROPOSTA_RECUSADA,
    STATUS_TABELA_ARQUIVADA,
    STATUS_TABELA_PUBLICADA,
    TIPOS_GENERALIDADE,
    TIPO_PROPOSTA_CHOICES,
    TIPO_PROPOSTA_ARMAZENAGEM,
    TIPO_PROPOSTA_TRANSPORTE_RODOVIARIO,
    TIPO_TABELA_DISTRIBUICAO,
    TabelaFrete,
    TabelaFreteLinha,
    FATURAMENTO_PROPOSTA_DEFAULT,
    PRAZOS_FATURAMENTO_PADRAO,
    VALIDADE_PROPOSTA_DEFAULT,
    VALIDADES_PROPOSTA_PADRAO,
    VIGENCIA_CONTRATO_DEFAULT,
    VIGENCIAS_CONTRATO_PADRAO,
    ensure_generalidades,
    ensure_matriz_icms,
    ensure_parametros_comercial,
    _lista_opcoes,
    aplicar_padrao_generalidades,
    gravar_catalogo_generalidades,
    normalizar_homologacao,
    sugestoes_produtos_atividade,
)
from .simulacao_icms import anexar_icms_simulacao, montar_icms_simulacao
from .tabela_frete_export import build_tabela_frete_xlsx
from .distancia_rota import RotaDistanciaError, buscar_cidades, buscar_enderecos, calcular_distancia_enderecos, calcular_distancia_km, reverso_geocodificar
from .homologacao import q_produto_com_impeditivo
from .icms_uf import REGIOES_BR, UFS_BRASIL, aliquotas_por_uf_padrao, normalizar_aliquotas
from .pagination import ClienteComercialPagination
from .proposta_draft import draft_payload, has_meaningful_draft, sanitize_draft_payload
from .proposta_email_service import (
    read_proposta_pdf,
    read_proposta_pdfs,
    request_email_list,
    request_proposta_ids,
    send_proposta_comercial_email,
    send_propostas_comerciais_email,
    validar_envio_conjunto,
)
from .tabela_distribuicao import gerar_faixas_distribuicao, merge_config, preset_config_albaugh, preset_config_ccab, simular_cotacao_distribuicao
from .serializers import (
    ClienteComercialSerializer,
    ClienteHistoricoPropostaSerializer,
    GeneralidadeComercialSerializer,
    HomologacaoProdutoEventoSerializer,
    ProdutoComercialSerializer,
    PropostaComercialSerializer,
    TabelaFreteLinhaSerializer,
    TabelaFreteSerializer,
)

_PROPOSTA_ORDERING_DEFAULT = 'data_criacao_desc'


def _annotate_proposta_vencimento(qs):
    numero = Replace(
        Replace(
            Replace(
                Replace(Lower('validade'), Value(' dias'), Value('')),
                Value(' dia'), Value(''),
            ),
            Value(' meses'), Value(''),
        ),
        Value(' mes'), Value(''),
    )
    dias_base = Cast(NullIf(numero, Value('')), IntegerField())
    dias = Case(
        When(validade__icontains='mes', then=dias_base * Value(30)),
        default=dias_base,
        output_field=IntegerField(),
    )
    base = Coalesce('data_proposta', TruncDate('data_criacao'))
    offset = ExpressionWrapper(dias * Value(timedelta(days=1)), output_field=DurationField())
    return qs.annotate(_vencimento=ExpressionWrapper(base + offset, output_field=DateField()))


_MESES_PT = ('Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez')


def _avancar_mes(inicio, quantidade=1):
    mes = inicio.month - 1 + quantidade
    ano = inicio.year + mes // 12
    return date(ano, mes % 12 + 1, 1)


def _serie_mensal_propostas(qs, meses=6):
    hoje = timezone.localdate().replace(day=1)
    inicio = _avancar_mes(hoje, 1 - meses)
    eixo = []
    cursor = inicio
    for _ in range(meses):
        eixo.append(cursor)
        cursor = _avancar_mes(cursor, 1)
    agrupado = (
        qs.annotate(ref=Coalesce('data_proposta', TruncDate('data_criacao')))
        .filter(ref__gte=inicio)
        .annotate(mes=TruncMonth('ref'))
        .values('mes', 'status')
        .annotate(total=Count('id'))
    )
    por_mes = {}
    for row in agrupado:
        chave = row['mes'].date() if hasattr(row['mes'], 'date') else row['mes']
        if chave is None:
            continue
        chave = chave.replace(day=1)
        bucket = por_mes.setdefault(chave, {'criadas': 0, 'aceitas': 0, 'recusadas': 0})
        total = row['total']
        bucket['criadas'] += total
        if row['status'] == STATUS_PROPOSTA_APROVADA:
            bucket['aceitas'] += total
        elif row['status'] == STATUS_PROPOSTA_RECUSADA:
            bucket['recusadas'] += total
    return [
        {
            'mes': item.isoformat(),
            'label': _MESES_PT[item.month - 1],
            'criadas': por_mes.get(item, {}).get('criadas', 0),
            'aceitas': por_mes.get(item, {}).get('aceitas', 0),
            'recusadas': por_mes.get(item, {}).get('recusadas', 0),
        }
        for item in eixo
    ]


_GERENCIAR_CLIENTES_DETAIL = (
    'Acesso negado. Solicite ao administrador a função "Cadastrar e editar" de Clientes.'
)
_GERENCIAR_PRODUTOS_DETAIL = (
    'Acesso negado. Solicite ao administrador a função "Cadastrar e editar" de Produtos.'
)
_VALIDAR_CLIENTES_DETAIL = (
    'Acesso negado. Solicite ao administrador a função "Homologar produtos" em Validação clientes.'
)
_GERENCIAR_PROPOSTAS_DETAIL = (
    'Acesso negado. Solicite ao administrador a função "Cadastrar e editar" de Propostas comerciais.'
)
_GERENCIAR_TABELA_FRETE_DETAIL = (
    'Acesso negado. Solicite ao administrador a função "Cadastrar e editar" de Tabela frete.'
)
_GERENCIAR_GENERALIDADES_DETAIL = (
    'Acesso negado. Solicite ao administrador a função "Cadastrar e editar" de Generalidades.'
)
_GERENCIAR_ICMS_UF_DETAIL = (
    'Acesso negado. Solicite ao administrador a função "Cadastrar e editar" de ICMS por UF.'
)
_GERENCIAR_PARAMETROS_DETAIL = (
    'Acesso negado. Solicite ao administrador a função "Cadastrar e editar" de Parâmetros do Comercial.'
)


def _funcao_required_response(request, funcao: str, detail: str):
    if request.user.has_funcao('Comercial', funcao):
        return None
    return Response({'detail': detail}, status=status.HTTP_403_FORBIDDEN)


def _usuario_display(user):
    if not user:
        return None
    nome = (getattr(user, 'name', '') or '').strip()
    return nome or user.username


def _resolver_usuario_tabela_frete(tabela):
    if tabela.criado_por_id:
        return _usuario_display(tabela.criado_por)
    log = AuditLog.objects.filter(
        action='comercial.tabela_frete.revisao',
        details__icontains=f'revisão {tabela.revisao}',
    ).order_by('-created_at').first()
    if not log:
        log = AuditLog.objects.filter(
            action='comercial.tabela_frete.criada',
            details__icontains=str(tabela),
        ).order_by('-created_at').first()
    if log:
        return (log.username or '').strip() or None
    return None


def _query_revisoes_tabela_frete(tabela):
    qs = TabelaFrete.objects.select_related('criado_por').filter(tipo=tabela.tipo)
    codigo = (tabela.codigo or '').strip()
    if codigo:
        return qs.filter(codigo=codigo).order_by('-revisao', '-data_criacao')
    base = tabela.nome_base()
    candidatos = qs.filter(Q(codigo='') | Q(codigo__isnull=True), clientes_vinculo_key=tabela.clientes_vinculo_key)
    ids = [item.pk for item in candidatos if item.nome_base() == base]
    if tabela.pk not in ids:
        ids.append(tabela.pk)
    return TabelaFrete.objects.select_related('criado_por').filter(pk__in=ids).order_by('-revisao', '-data_criacao')


def _grupo_revisao_tabela_frete():
    codigo_grupo = Concat(Value('c:'), Trim('codigo'), Value('|'), F('tipo'), output_field=CharField())
    nome_grupo = Concat(
        Value('n:'),
        F('tipo'),
        Value('|'),
        Lower(Trim('nome')),
        Value('|'),
        Coalesce(NullIf(Trim('clientes_vinculo_key'), Value('')), Value('-')),
        output_field=CharField(),
    )
    return Case(
        When(~Q(codigo='') & Q(codigo__isnull=False), then=codigo_grupo),
        default=nome_grupo,
        output_field=CharField(),
    )


def _queryset_ultima_revisao_listagem(qs):
    return qs.annotate(
        _grupo_revisao=_grupo_revisao_tabela_frete(),
    ).annotate(
        _revisao_ordem=Window(
            expression=RowNumber(),
            partition_by=[F('_grupo_revisao')],
            order_by=[F('revisao').desc(), F('data_criacao').desc(), F('pk').desc()],
        ),
    ).filter(_revisao_ordem=1)


class ComercialSummaryView(ModuleScopedViewMixin, APIView):
    permission_module = 'Comercial'

    def get(self, request):
        return Response({
            'environment': 'Comercial',
            'message': 'Ambiente Comercial ativo.',
        })


class ClienteComercialViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Comercial'
    permission_requires_filial = False
    serializer_class = ClienteComercialSerializer
    queryset = ClienteComercial.objects.all()
    pagination_class = ClienteComercialPagination
    http_method_names = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = super().get_queryset().select_related('homologado_por').prefetch_related(
            'produtos__produto',
            'homologacao_eventos',
        ).annotate(
            produtos_count=Count('produtos', filter=Q(produtos__produto__isnull=False), distinct=True),
        ).order_by('razao_social', 'cnpj')
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            query = (
                Q(razao_social__icontains=search)
                | Q(nome_fantasia__icontains=search)
                | Q(cnpj__icontains=search)
                | Q(municipio__icontains=search)
                | Q(email__icontains=search)
            )
            digits = only_digits(search, 14)
            if digits:
                query |= Q(cnpj_digits__icontains=digits)
            qs = qs.filter(query)
        situacao = (self.request.query_params.get('situacao') or '').strip().lower()
        if situacao in {SITUACAO_POTENCIAL, SITUACAO_CLIENTE, SITUACAO_INATIVO}:
            qs = qs.filter(situacao=situacao)
        ativos = (self.request.query_params.get('ativos') or '').strip().lower()
        if ativos in {'1', 'true', 'sim'}:
            qs = qs.exclude(situacao=SITUACAO_INATIVO)
        raw_homologacao = (self.request.query_params.get('homologacao') or '').strip().lower()
        if raw_homologacao in {'pendente', 'pendentes'}:
            qs = qs.filter(compatibilidade__in=['nao_analisado', 'pendente_validacao'])
        elif raw_homologacao:
            qs = qs.filter(compatibilidade=normalizar_homologacao(raw_homologacao))
        fila = (self.request.query_params.get('fila') or '').strip().lower()
        if fila in {'validacao', 'pendente'}:
            qs = qs.filter(
                compatibilidade__in=['pendente_validacao', 'nao_analisado'],
                produtos_count__gte=1,
            )
        com_produtos = (self.request.query_params.get('com_produtos') or '').strip().lower()
        if com_produtos in {'1', 'true', 'sim'}:
            qs = qs.filter(produtos_count__gte=1)
        pendencia = (self.request.query_params.get('pendencia') or '').strip().lower()
        if pendencia in {'impeditivo', 'bloqueado', '1', 'true'}:
            qs = qs.filter(q_produto_com_impeditivo()).distinct()
        return qs

    @action(detail=False, methods=['get'], url_path='validacao-resumo')
    def validacao_resumo(self, request):
        qs = super().get_queryset().annotate(
            produtos_count=Count('produtos', filter=Q(produtos__produto__isnull=False), distinct=True),
        )
        search = (request.query_params.get('search') or '').strip()
        if search:
            query = (
                Q(razao_social__icontains=search)
                | Q(nome_fantasia__icontains=search)
                | Q(cnpj__icontains=search)
                | Q(municipio__icontains=search)
                | Q(email__icontains=search)
            )
            digits = only_digits(search, 14)
            if digits:
                query |= Q(cnpj_digits__icontains=digits)
            qs = qs.filter(query)
        qs = qs.filter(produtos_count__gte=1)
        pendentes = qs.filter(compatibilidade__in=['pendente_validacao', 'nao_analisado'])
        return Response({
            'comProdutos': qs.count(),
            'pendentes': pendentes.count(),
            'comImpeditivo': pendentes.filter(q_produto_com_impeditivo()).distinct().count(),
            'homologados': qs.filter(compatibilidade='homologado').count(),
            'reprovados': qs.filter(compatibilidade='reprovado').count(),
        })

    @action(detail=False, methods=['get'], url_path='consultar-cnpj')
    def consultar_cnpj_action(self, request):
        denied = _funcao_required_response(request, 'gerenciar-clientes', _GERENCIAR_CLIENTES_DETAIL)
        if denied:
            return denied
        cnpj = only_digits(request.query_params.get('cnpj') or '')
        try:
            return Response(consultar_cnpj(cnpj))
        except CnpjLookupError as exc:
            return Response({'detail': str(exc)}, status=exc.status)

    @action(detail=False, methods=['get'], url_path='produtos-sugestoes')
    def produtos_sugestoes(self, request):
        return Response(sugestoes_produtos_atividade())

    def create(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-clientes', _GERENCIAR_CLIENTES_DETAIL)
        if denied:
            return denied
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-clientes', _GERENCIAR_CLIENTES_DETAIL)
        if denied:
            return denied
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-clientes', _GERENCIAR_CLIENTES_DETAIL)
        if denied:
            return denied
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        cliente = serializer.save()
        record_audit(
            self.request.user,
            'comercial.cliente.criado',
            f'Cliente comercial "{cliente.razao_social}" cadastrado.',
        )

    def perform_update(self, serializer):
        cliente = serializer.save()
        record_audit(
            self.request.user,
            'comercial.cliente.atualizado',
            f'Cliente comercial "{cliente.razao_social}" atualizado.',
        )

    def perform_destroy(self, instance):
        nome = instance.razao_social
        super().perform_destroy(instance)
        record_audit(
            self.request.user,
            'comercial.cliente.excluido',
            f'Cliente comercial "{nome}" excluído.',
        )

    @action(detail=True, methods=['post'], url_path='homologar')
    def homologar(self, request, pk=None):
        denied = _funcao_required_response(request, 'validar-clientes', _VALIDAR_CLIENTES_DETAIL)
        if denied:
            return denied
        from .homologacao import decidir_homologacao

        cliente = self.get_object()
        cliente = decidir_homologacao(
            cliente,
            request.user,
            request.data.get('decisao') or request.data.get('status') or '',
            request.data.get('justificativa') or '',
        )
        record_audit(
            request.user,
            'comercial.cliente.homologacao',
            f'Homologação de produtos do cliente "{cliente.razao_social}": {cliente.compatibilidade}.',
        )
        return Response(self.get_serializer(cliente).data)

    @action(detail=True, methods=['get'], url_path='homologacao-historico')
    def homologacao_historico(self, request, pk=None):
        cliente = self.get_object()
        eventos = HomologacaoProdutoEvento.objects.filter(cliente=cliente).select_related('usuario')[:50]
        return Response(HomologacaoProdutoEventoSerializer(eventos, many=True).data)

    @action(detail=True, methods=['get'], url_path='historico')
    def historico(self, request, pk=None):
        cliente = self.get_object()
        propostas_qs = PropostaComercial.objects.filter(cliente=cliente)
        aceitas_qs = propostas_qs.filter(status=STATUS_PROPOSTA_APROVADA).order_by('-data_atualizacao', '-pk')
        totais = propostas_qs.aggregate(
            total=Count('id'),
            aceitas=Count('id', filter=Q(status=STATUS_PROPOSTA_APROVADA)),
            recusadas=Count('id', filter=Q(status=STATUS_PROPOSTA_RECUSADA)),
        )
        total = int(totais['total'] or 0)
        aceitas = int(totais['aceitas'] or 0)
        recusadas = int(totais['recusadas'] or 0)
        indice = round((aceitas / total) * 100, 1) if total else None
        return Response({
            'id': str(cliente.pk),
            'razaoSocial': cliente.razao_social,
            'situacao': cliente.situacao,
            'clienteDesde': cliente.cliente_desde.isoformat() if cliente.cliente_desde else None,
            'totalPropostas': total,
            'propostasAceitasCount': aceitas,
            'propostasRecusadasCount': recusadas,
            'indiceAceitacao': indice,
            'propostasAceitas': ClienteHistoricoPropostaSerializer(aceitas_qs, many=True).data,
        })


class ProdutoComercialViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Comercial'
    permission_requires_filial = False
    serializer_class = ProdutoComercialSerializer
    queryset = ProdutoComercial.objects.all()
    pagination_class = ClienteComercialPagination
    http_method_names = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = super().get_queryset().annotate(clientes_count=Count('vinculos', distinct=True)).order_by('nome')
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                Q(nome__icontains=search)
                | Q(numero_onu__icontains=search)
                | Q(classe_risco__icontains=search)
            )
        ativo = (self.request.query_params.get('ativo') or '').strip().lower()
        if ativo in {'true', '1'}:
            qs = qs.filter(ativo=True)
        if ativo in {'false', '0'}:
            qs = qs.filter(ativo=False)
        cliente = (self.request.query_params.get('cliente') or '').strip()
        if cliente:
            qs = qs.filter(vinculos__cliente_id=cliente).distinct()
        return qs

    def create(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-produtos', _GERENCIAR_PRODUTOS_DETAIL)
        if denied:
            return denied
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=['post'], url_path='lote')
    def lote(self, request):
        denied = _funcao_required_response(request, 'gerenciar-produtos', _GERENCIAR_PRODUTOS_DETAIL)
        if denied:
            return denied
        cliente_id = str(request.data.get('clienteId') or '').strip()
        itens = request.data.get('produtos')
        if not cliente_id:
            return Response({'clienteId': ['Selecione o cliente dos produtos.']}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(itens, list) or not itens:
            return Response({'produtos': ['Informe ao menos um produto.']}, status=status.HTTP_400_BAD_REQUEST)
        if len(itens) > 50:
            return Response({'produtos': ['Cadastre no máximo 50 produtos por vez.']}, status=status.HTTP_400_BAD_REQUEST)
        try:
            cliente_pk = int(cliente_id)
        except (TypeError, ValueError):
            return Response({'clienteId': ['Cliente inválido.']}, status=status.HTTP_400_BAD_REQUEST)
        if not ClienteComercial.objects.filter(pk=cliente_pk).exists():
            return Response({'clienteId': ['Cliente não encontrado.']}, status=status.HTTP_400_BAD_REQUEST)

        from .homologacao import sincronizar_homologacao_por_produtos

        serializers_validos = []
        nomes_lote = []
        for index, item in enumerate(itens):
            data = dict(item) if isinstance(item, dict) else {}
            data['clienteIds'] = [str(cliente_pk)]
            serializer = self.get_serializer(data=data)
            serializer.context['defer_homologacao'] = True
            if not serializer.is_valid():
                return Response(
                    {'produtos': {str(index): serializer.errors}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            nome = (serializer.validated_data.get('nome') or '').strip().casefold()
            if nome in nomes_lote:
                return Response(
                    {'produtos': {str(index): {'nome': ['Nome repetido neste cadastro.']}}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            nomes_lote.append(nome)
            serializers_validos.append(serializer)

        with transaction.atomic():
            criados = [
                serializer.save(criado_por=request.user, atualizado_por=request.user)
                for serializer in serializers_validos
            ]
            cliente = ClienteComercial.objects.get(pk=cliente_pk)
            sincronizar_homologacao_por_produtos(cliente, request.user)

        record_audit(
            request.user,
            'comercial.produto.lote',
            f'{len(criados)} produto(s) comercial(is) cadastrado(s) para o cliente "{cliente.razao_social}".',
        )
        return Response(
            {'count': len(criados), 'results': self.get_serializer(criados, many=True).data},
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-produtos', _GERENCIAR_PRODUTOS_DETAIL)
        if denied:
            return denied
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-produtos', _GERENCIAR_PRODUTOS_DETAIL)
        if denied:
            return denied
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        produto = serializer.save(criado_por=self.request.user, atualizado_por=self.request.user)
        record_audit(
            self.request.user,
            'comercial.produto.criado',
            f'Produto comercial "{produto.nome}" cadastrado.',
        )

    def perform_update(self, serializer):
        produto = serializer.save(atualizado_por=self.request.user)
        record_audit(
            self.request.user,
            'comercial.produto.atualizado',
            f'Produto comercial "{produto.nome}" atualizado.',
        )

    def perform_destroy(self, instance):
        from .homologacao import sincronizar_homologacao_por_produtos

        nome = instance.nome
        clientes = list(ClienteComercial.objects.filter(produtos__produto=instance).distinct())
        super().perform_destroy(instance)
        for cliente in clientes:
            sincronizar_homologacao_por_produtos(cliente, self.request.user, f'Produto "{nome}" removido do catálogo.')
        record_audit(
            self.request.user,
            'comercial.produto.excluido',
            f'Produto comercial "{nome}" excluído.',
        )


class PropostaComercialViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Comercial'
    permission_requires_filial = False
    serializer_class = PropostaComercialSerializer
    queryset = PropostaComercial.objects.select_related('cliente').prefetch_related('linhas').all()
    pagination_class = ClienteComercialPagination
    http_method_names = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = super().get_queryset()
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            ident = re.fullmatch(r'0*(\d+)-(\d{4})', search)
            busca = (
                Q(titulo__icontains=search)
                | Q(subtitulo__icontains=search)
                | Q(cliente_nome__icontains=search)
                | Q(proposta_referente__icontains=search)
                | Q(observacoes__icontains=search)
                | Q(cliente__razao_social__icontains=search)
                | Q(cliente__nome_fantasia__icontains=search)
            )
            if ident:
                busca |= Q(numero=int(ident.group(1)), ano=int(ident.group(2)))
            elif search.isdigit():
                busca |= Q(numero=int(search))
            qs = qs.filter(busca)
        tipo = (self.request.query_params.get('tipo') or '').strip().lower()
        if tipo in {'frete', 'transporte_container'}:
            tipo = TIPO_PROPOSTA_TRANSPORTE_RODOVIARIO
        tipos_validos = {c[0] for c in TIPO_PROPOSTA_CHOICES}
        if tipo in tipos_validos:
            qs = qs.filter(tipo=tipo)
        status_filtro = (self.request.query_params.get('status') or '').strip().lower()
        if status_filtro:
            qs = qs.filter(status=status_filtro)
        ordering = (self.request.query_params.get('ordering') or _PROPOSTA_ORDERING_DEFAULT).strip()
        if ordering in {'vencimento_asc', 'vencimento_desc'}:
            qs = _annotate_proposta_vencimento(qs)
            vencimento = (
                F('_vencimento').asc(nulls_last=True)
                if ordering == 'vencimento_asc'
                else F('_vencimento').desc(nulls_last=True)
            )
            return qs.order_by(vencimento, 'pk' if ordering.endswith('asc') else '-pk')
        if ordering == 'data_criacao_asc':
            return qs.order_by('data_criacao', 'pk')
        return qs.order_by('-data_criacao', '-pk')

    def create(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-propostas', _GERENCIAR_PROPOSTAS_DETAIL)
        if denied:
            return denied
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-propostas', _GERENCIAR_PROPOSTAS_DETAIL)
        if denied:
            return denied
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-propostas', _GERENCIAR_PROPOSTAS_DETAIL)
        if denied:
            return denied
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        proposta = serializer.save()
        record_audit(self.request.user, 'comercial.proposta.criada', f'Proposta "{proposta.titulo}" cadastrada.')

    def perform_update(self, serializer):
        proposta = serializer.save()
        record_audit(self.request.user, 'comercial.proposta.atualizada', f'Proposta "{proposta.titulo}" atualizada.')

    def perform_destroy(self, instance):
        titulo = instance.titulo
        super().perform_destroy(instance)
        record_audit(self.request.user, 'comercial.proposta.excluida', f'Proposta "{titulo}" excluída.')

    @action(detail=False, methods=['post'], url_path='calcular-trecho')
    def calcular_trecho(self, request):
        from .proposta_tarifas import calcular_trecho
        resultado = calcular_trecho(
            cliente_id=request.data.get('clienteId') or request.data.get('cliente_id'),
            origem=request.data.get('origem') or '',
            destino=request.data.get('destino') or request.data.get('entrega') or '',
            veiculo_key=request.data.get('veiculoKey') or request.data.get('veiculo') or '',
            km=request.data.get('km'),
            margens=request.data.get('margensVeiculo') or request.data.get('margens'),
        )
        if resultado.get('erro'):
            return Response({'detail': resultado['erro']}, status=status.HTTP_400_BAD_REQUEST)
        return Response(resultado)

    @action(detail=False, methods=['post'], url_path='preview-distribuicao')
    def preview_distribuicao(self, request):
        from .proposta_tarifas import snapshot_distribuicao
        snap = snapshot_distribuicao(
            request.data.get('clienteId') or request.data.get('cliente_id'),
            request.data.get('margensVeiculo') or request.data.get('margens'),
        )
        if not snap:
            return Response(
                {'detail': 'Nenhuma tabela de distribuição vigente vinculada a este cliente.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(snap)

    @action(detail=True, methods=['post'], url_path='nova-revisao')
    def nova_revisao(self, request, pk=None):
        """Compatibilidade: não incrementa revisão.

        A revisão sobe só ao salvar alterações com modoEnvio=revisao.
        """
        denied = _funcao_required_response(request, 'gerenciar-propostas', _GERENCIAR_PROPOSTAS_DETAIL)
        if denied:
            return denied
        proposta = self.get_object()
        return Response(self.get_serializer(proposta).data)

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        qs = super().get_queryset()
        cliente = (request.query_params.get('cliente') or '').strip()
        if cliente:
            qs = qs.filter(cliente_id=cliente)
        por_status = {
            row['status']: row['total']
            for row in qs.values('status').annotate(total=Count('id'))
        }
        por_tipo = {
            row['tipo']: row['total']
            for row in qs.values('tipo').annotate(total=Count('id'))
        }
        recentes = qs.order_by('-data_criacao', '-pk')[:6]
        clientes_ids = list(
            super().get_queryset().filter(cliente_id__isnull=False).values_list('cliente_id', flat=True).distinct()
        )
        clientes_com_proposta = [
            {
                'id': str(item.pk),
                'nome': (item.nome_fantasia or item.razao_social or '').strip() or f'Cliente {item.pk}',
            }
            for item in ClienteComercial.objects.filter(pk__in=clientes_ids).order_by('razao_social', 'nome_fantasia')
        ]
        return Response({
            'total': qs.count(),
            'porStatus': {
                'rascunho': por_status.get(STATUS_PROPOSTA_RASCUNHO, 0),
                'enviada': por_status.get(STATUS_PROPOSTA_ENVIADA, 0),
                'aprovada': por_status.get(STATUS_PROPOSTA_APROVADA, 0),
                'recusada': por_status.get(STATUS_PROPOSTA_RECUSADA, 0),
            },
            'porTipo': {
                'transporte_rodoviario': por_tipo.get(TIPO_PROPOSTA_TRANSPORTE_RODOVIARIO, 0),
                'armazenagem': por_tipo.get(TIPO_PROPOSTA_ARMAZENAGEM, 0),
            },
            'porMes': _serie_mensal_propostas(qs),
            'clientesComProposta': clientes_com_proposta,
            'recentes': [
                {
                    'id': str(item.pk),
                    'numeroIdentificacao': item.numero_identificacao,
                    'clienteNome': item.cliente_nome or (item.cliente.razao_social if item.cliente_id else '') or '',
                    'tipo': item.tipo,
                    'status': item.status,
                    'dataProposta': item.data_proposta.isoformat() if item.data_proposta else None,
                }
                for item in recentes
            ],
        })

    @action(detail=False, methods=['get', 'put', 'delete'], url_path='draft')
    def draft(self, request):
        draft = PropostaComercialDraft.objects.filter(usuario=request.user).first()
        if request.method == 'GET':
            return Response(draft_payload(draft))
        denied = _funcao_required_response(request, 'gerenciar-propostas', _GERENCIAR_PROPOSTAS_DETAIL)
        if denied:
            return denied
        if request.method == 'DELETE':
            if draft:
                draft.delete()
                record_audit(
                    request.user,
                    'comercial.proposta.draft_descartado',
                    'Rascunho de nova proposta descartado.',
                )
            return Response(status=status.HTTP_204_NO_CONTENT)
        payload = sanitize_draft_payload(request.data)
        if not has_meaningful_draft(payload):
            if draft:
                draft.delete()
                record_audit(
                    request.user,
                    'comercial.proposta.draft_descartado',
                    'Rascunho de nova proposta limpo.',
                )
            return Response(draft_payload(None))
        draft, _created = PropostaComercialDraft.objects.update_or_create(
            usuario=request.user,
            defaults={'version': 1, 'payload': payload},
        )
        record_audit(request.user, 'comercial.proposta.draft_salvo', 'Rascunho de nova proposta salvo.')
        return Response(draft_payload(draft))

    @action(detail=True, methods=['post'], url_path='enviar-email')
    def enviar_email(self, request, pk=None):
        proposta = self.get_object()
        try:
            resultado = send_proposta_comercial_email(
                request.user,
                proposta,
                to_emails=request_email_list(request.data, 'to', 'email'),
                cc_emails=request_email_list(request.data, 'cc', 'emailCopia'),
                pdf_bytes=read_proposta_pdf(request),
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response(
                {'detail': f'Falha ao enviar e-mail: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        record_audit(
            request.user,
            'comercial.proposta.email_enviado',
            f'Proposta {resultado["numero"]} enviada para {", ".join(resultado["to"])}.',
        )
        return Response({
            'success': True,
            'message': f'Proposta {resultado["numero"]} enviada para {", ".join(resultado["to"])}.',
            'to': resultado['to'],
            'cc': resultado['cc'],
        })

    @action(detail=False, methods=['post'], url_path='enviar-email-lote')
    def enviar_email_lote(self, request):
        ids = request_proposta_ids(request.data)
        if not ids:
            return Response({'detail': 'Selecione ao menos uma proposta para enviar.'}, status=status.HTTP_400_BAD_REQUEST)
        queryset = self.filter_queryset(self.get_queryset())
        encontradas = {str(item.pk): item for item in queryset.filter(pk__in=ids).select_related('cliente')}
        propostas = []
        for item_id in ids:
            proposta = encontradas.get(item_id)
            if not proposta:
                return Response({'detail': 'Uma das propostas selecionadas não foi encontrada.'}, status=status.HTTP_404_NOT_FOUND)
            propostas.append(proposta)
        try:
            validar_envio_conjunto(propostas)
            pdfs = read_proposta_pdfs(request)
            if len(pdfs) != len(propostas):
                raise ValueError('Não foi possível receber o PDF da proposta gerado na tela. Tente novamente.')
            resultado = send_propostas_comerciais_email(
                request.user,
                list(zip(propostas, pdfs)),
                to_emails=request_email_list(request.data, 'to', 'email'),
                cc_emails=request_email_list(request.data, 'cc', 'emailCopia'),
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response(
                {'detail': f'Falha ao enviar e-mail: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        record_audit(
            request.user,
            'comercial.proposta.email_enviado',
            f'Proposta {resultado["numero"]} enviada para {", ".join(resultado["to"])}.',
        )
        return Response({
            'success': True,
            'message': f'Proposta {resultado["numero"]} enviada para {", ".join(resultado["to"])}.',
            'to': resultado['to'],
            'cc': resultado['cc'],
        })


class TabelaFreteViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Comercial'
    permission_requires_filial = False
    serializer_class = TabelaFreteSerializer
    queryset = TabelaFrete.objects.select_related('criado_por', 'atualizado_por').prefetch_related('clientes').all()
    pagination_class = ClienteComercialPagination
    http_method_names = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = super().get_queryset()
        search = (self.request.query_params.get('search') or '').strip()
        tipo = (self.request.query_params.get('tipo') or '').strip()
        cliente = (self.request.query_params.get('cliente') or '').strip()
        status = (self.request.query_params.get('status') or '').strip()
        if search:
            qs = qs.filter(
                Q(nome__icontains=search)
                | Q(codigo__icontains=search)
                | Q(clientes__razao_social__icontains=search)
                | Q(clientes__nome_fantasia__icontains=search)
            ).distinct()
        if tipo:
            qs = qs.filter(tipo=tipo)
        if cliente:
            qs = qs.filter(clientes__id=cliente).distinct()
        if status:
            qs = qs.filter(status=status)
        vigente = (self.request.query_params.get('vigente') or '').strip().lower()
        if vigente in ('1', 'true', 'yes'):
            from django.utils import timezone

            hoje = timezone.localdate()
            qs = qs.filter(status=STATUS_TABELA_PUBLICADA).filter(
                Q(vigencia_inicio__isnull=True) | Q(vigencia_inicio__lte=hoje)
            ).filter(
                Q(vigencia_fim__isnull=True) | Q(vigencia_fim__gte=hoje)
            )
        if getattr(self, 'action', None) == 'list':
            qs = _queryset_ultima_revisao_listagem(qs)
        qs = qs.annotate(linhas_count=Count('linhas', distinct=True)).order_by('-data_atualizacao', 'nome')
        if getattr(self, 'action', None) in ('retrieve', 'update', 'partial_update', 'exportar'):
            qs = qs.prefetch_related('linhas')
        return qs

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action == 'list':
            context['compact'] = True
        return context

    def create(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-tabela-frete', _GERENCIAR_TABELA_FRETE_DETAIL)
        if denied:
            return denied
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-tabela-frete', _GERENCIAR_TABELA_FRETE_DETAIL)
        if denied:
            return denied
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-tabela-frete', _GERENCIAR_TABELA_FRETE_DETAIL)
        if denied:
            return denied
        return super().destroy(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        status_anterior = instance.status
        instance.sincronizar_status_vigencia()
        if instance.status != status_anterior:
            instance.save(update_fields=['status'])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def perform_create(self, serializer):
        tabela = serializer.save(criado_por=self.request.user, atualizado_por=self.request.user)
        record_audit(self.request.user, 'comercial.tabela_frete.criada', f'Tabela de frete "{tabela}" cadastrada.')

    def perform_update(self, serializer):
        tabela = serializer.save(atualizado_por=self.request.user)
        record_audit(self.request.user, 'comercial.tabela_frete.atualizada', f'Tabela de frete "{tabela}" atualizada.')

    def perform_destroy(self, instance):
        descricao = str(instance)
        revisoes = _query_revisoes_tabela_frete(instance)
        qtd = revisoes.count()
        revisoes.delete()
        sufixo = f' ({qtd} revisões)' if qtd > 1 else ''
        record_audit(
            self.request.user,
            'comercial.tabela_frete.excluida',
            f'Tabela de frete "{descricao}" excluída definitivamente{sufixo}.',
        )

    @action(detail=False, methods=['post'])
    def preview(self, request):
        config = merge_config(request.data.get('config') or request.data)
        return Response({'config': config, 'faixas': gerar_faixas_distribuicao(config)})

    @action(detail=False, methods=['get'], url_path='preset-ccab')
    def preset_ccab(self, request):
        config = preset_config_ccab()
        return Response({'config': config, 'faixas': gerar_faixas_distribuicao(config)})

    @action(detail=False, methods=['get'], url_path='preset-albaugh')
    def preset_albaugh(self, request):
        config = preset_config_albaugh()
        return Response({'config': config, 'faixas': gerar_faixas_distribuicao(config)})

    @action(detail=True, methods=['post'])
    def publicar(self, request, pk=None):
        denied = _funcao_required_response(request, 'gerenciar-tabela-frete', _GERENCIAR_TABELA_FRETE_DETAIL)
        if denied:
            return denied
        tabela = self.get_object()
        try:
            tabela.publicar()
            tabela.atualizado_por = request.user
            tabela.save(update_fields=['status', 'atualizado_por'])
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        record_audit(request.user, 'comercial.tabela_frete.publicada', f'Tabela de frete "{tabela}" publicada.')
        return Response(self.get_serializer(tabela).data)

    @action(detail=True, methods=['post'])
    def arquivar(self, request, pk=None):
        denied = _funcao_required_response(request, 'gerenciar-tabela-frete', _GERENCIAR_TABELA_FRETE_DETAIL)
        if denied:
            return denied
        tabela = self.get_object()
        tabela.arquivar()
        tabela.atualizado_por = request.user
        tabela.save(update_fields=['status', 'atualizado_por'])
        record_audit(request.user, 'comercial.tabela_frete.arquivada', f'Tabela de frete "{tabela}" arquivada.')
        return Response(self.get_serializer(tabela).data)

    @action(detail=True, methods=['post'])
    def reativar(self, request, pk=None):
        denied = _funcao_required_response(request, 'gerenciar-tabela-frete', _GERENCIAR_TABELA_FRETE_DETAIL)
        if denied:
            return denied
        tabela = self.get_object()
        try:
            tabela.reativar()
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        tabela.atualizado_por = request.user
        tabela.save(update_fields=['atualizado_por'])
        record_audit(
            request.user,
            'comercial.tabela_frete.reativada',
            f'Tabela de frete "{tabela}" reativada como rascunho, sem clientes vinculados.',
        )
        return Response(self.get_serializer(tabela).data)

    @action(detail=True, methods=['post'], url_path='nova-revisao')
    def nova_revisao(self, request, pk=None):
        denied = _funcao_required_response(request, 'gerenciar-tabela-frete', _GERENCIAR_TABELA_FRETE_DETAIL)
        if denied:
            return denied
        tabela = self.get_object()
        nova = tabela.duplicar_revisao(criado_por=request.user)
        TabelaFrete.objects.filter(pk=tabela.pk).update(atualizado_por=request.user)
        record_audit(
            request.user,
            'comercial.tabela_frete.revisao',
            f'Nova revisão {nova.revisao} criada a partir de "{tabela}". Revisão anterior arquivada.',
        )
        if tabela.status == STATUS_TABELA_ARQUIVADA:
            record_audit(request.user, 'comercial.tabela_frete.arquivada', f'Tabela de frete "{tabela}" arquivada.')
        return Response(self.get_serializer(nova).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='descartar-revisao')
    def descartar_revisao(self, request, pk=None):
        denied = _funcao_required_response(request, 'gerenciar-tabela-frete', _GERENCIAR_TABELA_FRETE_DETAIL)
        if denied:
            return denied
        tabela = self.get_object()
        rotulo = str(tabela)
        try:
            restaurada = tabela.descartar_revisao()
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        record_audit(
            request.user,
            'comercial.tabela_frete.revisao_descartada',
            f'Revisão em rascunho "{rotulo}" descartada. Revisão {restaurada.revisao} restaurada.',
        )
        return Response(self.get_serializer(restaurada).data)

    @action(detail=True, methods=['get'], url_path='historico-revisoes')
    def historico_revisoes(self, request, pk=None):
        tabela = self.get_object()
        revisoes = []
        for item in _query_revisoes_tabela_frete(tabela):
            revisoes.append({
                'id': str(item.pk),
                'revisao': item.revisao,
                'status': item.status,
                'dataCriacao': item.data_criacao,
                'dataAtualizacao': item.data_atualizacao,
                'usuarioNome': _resolver_usuario_tabela_frete(item),
                'atual': item.pk == tabela.pk,
            })
        return Response({
            'tabelaAtualId': str(tabela.pk),
            'codigo': tabela.codigo or '',
            'nome': tabela.nome,
            'revisoes': revisoes,
        })

    @action(detail=True, methods=['get'])
    def exportar(self, request, pk=None):
        tabela = self.get_object()
        content, filename = build_tabela_frete_xlsx(tabela)
        response = HttpResponse(
            content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=['post'])
    def simular(self, request, pk=None):
        tabela = self.get_object()
        if tabela.tipo != TIPO_TABELA_DISTRIBUICAO:
            return Response({'detail': 'Simulação disponível apenas para tabelas de distribuição.'}, status=status.HTTP_400_BAD_REQUEST)
        km = request.data.get('km')
        peso_kg = request.data.get('pesoKg')
        if km in (None, '') or peso_kg in (None, ''):
            return Response({'detail': 'Informe km e pesoKg.'}, status=status.HTTP_400_BAD_REQUEST)
        modalidade = (request.data.get('modalidade') or 'fracionado').strip()
        valor_nf = request.data.get('valorNf')
        uf_origem = (request.data.get('ufOrigem') or '').strip().upper()[:2]
        uf_destino = (request.data.get('ufDestino') or '').strip().upper()[:2]
        resultado = simular_cotacao_distribuicao(
            tabela.config, km, peso_kg, modalidade, valor_nf,
        )
        if resultado.get('erro'):
            return Response({'detail': resultado['erro']}, status=status.HTTP_400_BAD_REQUEST)
        anexar_icms_simulacao(resultado, uf_origem, uf_destino)
        return Response(resultado)


class TabelaFreteLinhaViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Comercial'
    permission_requires_filial = False
    serializer_class = TabelaFreteLinhaSerializer
    queryset = TabelaFreteLinha.objects.select_related('tabela').all()
    pagination_class = ClienteComercialPagination
    http_method_names = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = super().get_queryset()
        search = (self.request.query_params.get('search') or '').strip()
        tabela = (self.request.query_params.get('tabela') or '').strip()
        if tabela:
            qs = qs.filter(tabela_id=tabela)
        if search:
            qs = qs.filter(
                Q(origem__icontains=search)
                | Q(entrega__icontains=search)
                | Q(veiculo__icontains=search)
            )
        return qs

    def create(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-tabela-frete', _GERENCIAR_TABELA_FRETE_DETAIL)
        if denied:
            return denied
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-tabela-frete', _GERENCIAR_TABELA_FRETE_DETAIL)
        if denied:
            return denied
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-tabela-frete', _GERENCIAR_TABELA_FRETE_DETAIL)
        if denied:
            return denied
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        linha = serializer.save()
        record_audit(self.request.user, 'comercial.tabela_frete.linha_criada', f'Trecho "{linha}" cadastrado.')

    def perform_update(self, serializer):
        linha = serializer.save()
        record_audit(self.request.user, 'comercial.tabela_frete.linha_atualizada', f'Trecho "{linha}" atualizado.')

    def perform_destroy(self, instance):
        descricao = str(instance)
        super().perform_destroy(instance)
        record_audit(self.request.user, 'comercial.tabela_frete.linha_excluida', f'Trecho "{descricao}" excluído.')


class GeneralidadesCatalogoView(ModuleScopedViewMixin, APIView):
    permission_module = 'Comercial'
    permission_requires_filial = False

    def _resolver_escopo(self, request, require_items=False):
        data = request.data if request.method not in {'GET', 'DELETE'} else {}
        cliente_raw = request.query_params.get('cliente') or data.get('clienteId') or data.get('cliente')
        tipo = (request.query_params.get('tipo') or data.get('tipo') or '').strip()
        if tipo not in TIPOS_GENERALIDADE:
            return None, Response(
                {'detail': 'Informe o tipo de serviço (frete, distribuicao, armazenagem ou op_portuaria).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cliente_id = str(cliente_raw or '').strip()
        if cliente_id in {'', 'padrao', 'null', 'undefined'}:
            cliente = None
        else:
            cliente = ClienteComercial.objects.filter(pk=cliente_id).first()
            if not cliente:
                return None, Response({'detail': 'Cliente não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        if require_items:
            raw = data.get('items', data if isinstance(data, list) else None)
            if not isinstance(raw, list):
                return None, Response({'detail': 'Informe a lista de generalidades.'}, status=status.HTTP_400_BAD_REQUEST)
            return {'cliente': cliente, 'tipo': tipo, 'items': raw}, None
        return {'cliente': cliente, 'tipo': tipo}, None

    def _clientes_com_catalogo(self, tipo):
        rows = (
            GeneralidadeComercial.objects.filter(cliente__isnull=False, tipo_servico=tipo)
            .values('cliente_id', 'cliente__razao_social', 'cliente__nome_fantasia')
            .distinct()
            .order_by('cliente__razao_social')
        )
        return [
            {
                'id': str(row['cliente_id']),
                'nome': (row['cliente__nome_fantasia'] or row['cliente__razao_social'] or '').strip(),
            }
            for row in rows
        ]

    def _payload(self, cliente, tipo, items, origem):
        return {
            'clienteId': str(cliente.pk) if cliente else None,
            'tipo': tipo,
            'origem': origem,
            'items': GeneralidadeComercialSerializer(items, many=True).data,
            'clientesComCatalogo': self._clientes_com_catalogo(tipo),
        }

    def get(self, request):
        escopo, error = self._resolver_escopo(request)
        if error:
            return error
        ensure_generalidades()
        cliente = escopo['cliente']
        tipo = escopo['tipo']
        if cliente is None:
            qs = GeneralidadeComercial.objects.filter(cliente__isnull=True, tipo_servico=tipo).order_by('ordem', 'pk')
            return Response(self._payload(None, tipo, qs, 'padrao'))
        qs = GeneralidadeComercial.objects.filter(cliente=cliente, tipo_servico=tipo).order_by('ordem', 'pk')
        origem = 'cliente'
        if not qs.exists():
            qs = GeneralidadeComercial.objects.filter(cliente__isnull=True, tipo_servico=tipo).order_by('ordem', 'pk')
            origem = 'padrao'
        return Response(self._payload(cliente, tipo, qs, origem))

    def put(self, request):
        denied = _funcao_required_response(request, 'gerenciar-generalidades', _GERENCIAR_GENERALIDADES_DETAIL)
        if denied:
            return denied
        escopo, error = self._resolver_escopo(request, require_items=True)
        if error:
            return error
        serializer = GeneralidadeComercialSerializer(data=escopo['items'], many=True)
        serializer.is_valid(raise_exception=True)
        cliente = escopo['cliente']
        tipo = escopo['tipo']
        if cliente is None:
            aplicar = request.data.get('aplicar') or request.data.get('aplicarClientes') or 'novos'
            modo = aplicar_padrao_generalidades(tipo, serializer.validated_data, aplicar)
            items = GeneralidadeComercial.objects.filter(cliente__isnull=True, tipo_servico=tipo).order_by('ordem', 'pk')
            record_audit(
                request.user,
                'comercial.generalidades.atualizadas',
                f'Generalidades padrão ({tipo}) atualizadas ({modo}).',
            )
            return Response(self._payload(None, tipo, items, 'padrao'))
        gravar_catalogo_generalidades(cliente, tipo, serializer.validated_data)
        items = GeneralidadeComercial.objects.filter(cliente=cliente, tipo_servico=tipo).order_by('ordem', 'pk')
        record_audit(
            request.user,
            'comercial.generalidades.atualizadas',
            f'Generalidades de {cliente.razao_social} ({tipo}) atualizadas.',
        )
        return Response(self._payload(cliente, tipo, items, 'cliente'))

    def delete(self, request):
        denied = _funcao_required_response(request, 'gerenciar-generalidades', _GERENCIAR_GENERALIDADES_DETAIL)
        if denied:
            return denied
        escopo, error = self._resolver_escopo(request)
        if error:
            return error
        cliente = escopo['cliente']
        tipo = escopo['tipo']
        if cliente is None:
            return Response(
                {'detail': 'O catálogo padrão não pode ser excluído. Edite os itens ou restaure o conteúdo de fábrica.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        GeneralidadeComercial.objects.filter(cliente=cliente, tipo_servico=tipo).delete()
        record_audit(
            request.user,
            'comercial.generalidades.restauradas',
            f'Generalidades de {cliente.razao_social} ({tipo}) voltaram ao padrão.',
        )
        ensure_generalidades()
        items = GeneralidadeComercial.objects.filter(cliente__isnull=True, tipo_servico=tipo).order_by('ordem', 'pk')
        return Response(self._payload(cliente, tipo, items, 'padrao'))


class MatrizIcmsUfView(ModuleScopedViewMixin, APIView):
    permission_module = 'Comercial'
    permission_requires_filial = False

    def _payload(self, registro: MatrizIcmsUf):
        aliquotas = normalizar_aliquotas(registro.matriz)
        return {
            'ufs': list(UFS_BRASIL),
            'regioes': [
                {'key': item['key'], 'label': item['label'], 'ufs': list(item['ufs'])}
                for item in REGIOES_BR
            ],
            'aliquotas': aliquotas,
            'atualizadoEm': registro.atualizado_em,
        }

    def get(self, request):
        registro = ensure_matriz_icms()
        return Response(self._payload(registro))

    def put(self, request):
        denied = _funcao_required_response(request, 'gerenciar-icms-ufs', _GERENCIAR_ICMS_UF_DETAIL)
        if denied:
            return denied
        raw = request.data.get('aliquotas', request.data)
        if not isinstance(raw, dict):
            return Response({'detail': 'Informe as alíquotas por UF.'}, status=status.HTTP_400_BAD_REQUEST)
        aliquotas = normalizar_aliquotas(raw)
        registro = ensure_matriz_icms()
        registro.matriz = aliquotas
        registro.save(update_fields=['matriz', 'atualizado_em'])
        record_audit(request.user, 'comercial.icms_ufs.atualizadas', 'Matriz ICMS por UF atualizada.')
        return Response(self._payload(registro))

    def post(self, request):
        denied = _funcao_required_response(request, 'gerenciar-icms-ufs', _GERENCIAR_ICMS_UF_DETAIL)
        if denied:
            return denied
        acao = (request.data.get('acao') or '').strip()
        if acao != 'restaurar-padrao':
            return Response({'detail': 'Ação inválida.'}, status=status.HTTP_400_BAD_REQUEST)
        registro = ensure_matriz_icms()
        registro.matriz = aliquotas_por_uf_padrao()
        registro.save(update_fields=['matriz', 'atualizado_em'])
        record_audit(request.user, 'comercial.icms_ufs.restauradas', 'Matriz ICMS por UF restaurada ao padrão Brasil.')
        return Response(self._payload(registro))


def _logo_data_url(blob, content_type: str) -> str | None:
    if not blob:
        return None
    import base64
    tipo = (content_type or 'image/png').strip() or 'image/png'
    if '/' not in tipo:
        tipo = f'image/{tipo}'
    encoded = base64.b64encode(bytes(blob)).decode('ascii')
    return f'data:{tipo};base64,{encoded}'


def _decode_logo_data_url(raw) -> tuple[bytes | None, str]:
    texto = str(raw or '').strip()
    if not texto:
        return None, ''
    if not texto.startswith('data:') or ';base64,' not in texto:
        raise ValueError('Logo inválido. Envie uma imagem em data URL.')
    header, _, encoded = texto.partition(';base64,')
    tipo = header.replace('data:', '', 1).strip() or 'image/png'
    if not tipo.startswith('image/'):
        raise ValueError('A logo deve ser uma imagem (PNG, JPG ou WEBP).')
    import base64
    try:
        data = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise ValueError('Não foi possível ler a imagem da logo.') from exc
    if not data:
        raise ValueError('A logo está vazia.')
    if len(data) > 2 * 1024 * 1024:
        raise ValueError('A logo deve ter no máximo 2 MB.')
    return data, tipo[:40]


class ParametrosComercialView(ModuleScopedViewMixin, APIView):
    permission_module = 'Comercial'
    permission_requires_filial = False

    def _payload(self, registro: ParametrosComercial):
        return {
            'validades': list(registro.validades or []),
            'validadePadrao': registro.validade_padrao or VALIDADE_PROPOSTA_DEFAULT,
            'vigencias': list(registro.vigencias or []),
            'vigenciaPadrao': registro.vigencia_padrao or VIGENCIA_CONTRATO_DEFAULT,
            'prazosFaturamento': list(registro.prazos_faturamento or []),
            'faturamentoPadrao': registro.faturamento_padrao or FATURAMENTO_PROPOSTA_DEFAULT,
            'logoPdfUrl': _logo_data_url(registro.logo_pdf, registro.logo_pdf_tipo),
            'logoEmailUrl': _logo_data_url(registro.logo_email, registro.logo_email_tipo),
            'atualizadoEm': registro.atualizado_em,
        }

    def get(self, request):
        return Response(self._payload(ensure_parametros_comercial()))

    def put(self, request):
        denied = _funcao_required_response(request, 'gerenciar-parametros', _GERENCIAR_PARAMETROS_DETAIL)
        if denied:
            return denied
        registro = ensure_parametros_comercial()
        data = request.data if isinstance(request.data, dict) else {}

        if 'validades' in data:
            registro.validades = _lista_opcoes(data.get('validades'), VALIDADES_PROPOSTA_PADRAO)
        if 'vigencias' in data:
            registro.vigencias = _lista_opcoes(data.get('vigencias'), VIGENCIAS_CONTRATO_PADRAO)
        if 'prazosFaturamento' in data or 'prazos_faturamento' in data:
            registro.prazos_faturamento = _lista_opcoes(
                data.get('prazosFaturamento', data.get('prazos_faturamento')),
                PRAZOS_FATURAMENTO_PADRAO,
            )

        validade_padrao = str(data.get('validadePadrao') or data.get('validade_padrao') or '').strip()
        if validade_padrao:
            if validade_padrao not in registro.validades:
                registro.validades = [*registro.validades, validade_padrao]
            registro.validade_padrao = validade_padrao[:80]
        elif registro.validade_padrao not in registro.validades:
            registro.validade_padrao = registro.validades[0] if registro.validades else VALIDADE_PROPOSTA_DEFAULT

        vigencia_padrao = str(data.get('vigenciaPadrao') or data.get('vigencia_padrao') or '').strip()
        if vigencia_padrao:
            if vigencia_padrao not in registro.vigencias:
                registro.vigencias = [*registro.vigencias, vigencia_padrao]
            registro.vigencia_padrao = vigencia_padrao[:80]
        elif registro.vigencia_padrao not in registro.vigencias:
            registro.vigencia_padrao = registro.vigencias[0] if registro.vigencias else VIGENCIA_CONTRATO_DEFAULT

        faturamento_padrao = str(data.get('faturamentoPadrao') or data.get('faturamento_padrao') or '').strip()
        if faturamento_padrao:
            if faturamento_padrao not in registro.prazos_faturamento:
                registro.prazos_faturamento = [*registro.prazos_faturamento, faturamento_padrao]
            registro.faturamento_padrao = faturamento_padrao[:120]
        elif registro.faturamento_padrao not in registro.prazos_faturamento:
            registro.faturamento_padrao = (
                registro.prazos_faturamento[0] if registro.prazos_faturamento else FATURAMENTO_PROPOSTA_DEFAULT
            )

        try:
            if 'logoPdfUrl' in data or 'logo_pdf_url' in data:
                raw = data.get('logoPdfUrl', data.get('logo_pdf_url'))
                if raw in (None, ''):
                    registro.logo_pdf = None
                    registro.logo_pdf_tipo = ''
                else:
                    blob, tipo = _decode_logo_data_url(raw)
                    registro.logo_pdf = blob
                    registro.logo_pdf_tipo = tipo
            if 'logoEmailUrl' in data or 'logo_email_url' in data:
                raw = data.get('logoEmailUrl', data.get('logo_email_url'))
                if raw in (None, ''):
                    registro.logo_email = None
                    registro.logo_email_tipo = ''
                else:
                    blob, tipo = _decode_logo_data_url(raw)
                    registro.logo_email = blob
                    registro.logo_email_tipo = tipo
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        registro.save()
        record_audit(request.user, 'comercial.parametros.atualizados', 'Parâmetros do Comercial atualizados.')
        return Response(self._payload(registro))

    def post(self, request):
        denied = _funcao_required_response(request, 'gerenciar-parametros', _GERENCIAR_PARAMETROS_DETAIL)
        if denied:
            return denied
        acao = (request.data.get('acao') or '').strip()
        if acao != 'restaurar-padrao':
            return Response({'detail': 'Ação inválida.'}, status=status.HTTP_400_BAD_REQUEST)
        registro = ensure_parametros_comercial()
        registro.validades = list(VALIDADES_PROPOSTA_PADRAO)
        registro.validade_padrao = VALIDADE_PROPOSTA_DEFAULT
        registro.vigencias = list(VIGENCIAS_CONTRATO_PADRAO)
        registro.vigencia_padrao = VIGENCIA_CONTRATO_DEFAULT
        registro.prazos_faturamento = list(PRAZOS_FATURAMENTO_PADRAO)
        registro.faturamento_padrao = FATURAMENTO_PROPOSTA_DEFAULT
        registro.save(update_fields=[
            'validades', 'validade_padrao', 'vigencias', 'vigencia_padrao',
            'prazos_faturamento', 'faturamento_padrao', 'atualizado_em',
        ])
        record_audit(
            request.user,
            'comercial.parametros.restaurados',
            'Listas de validade, vigência e faturamento restauradas ao padrão.',
        )
        return Response(self._payload(registro))


class IcmsFreteView(ModuleScopedViewMixin, APIView):
    permission_module = 'Comercial'
    permission_requires_filial = False

    def post(self, request):
        total = request.data.get('total')
        uf_origem = (request.data.get('ufOrigem') or '').strip().upper()[:2]
        uf_destino = (request.data.get('ufDestino') or '').strip().upper()[:2]
        subtotal = request.data.get('subtotal')
        pedagio = request.data.get('pedagio')
        if total in (None, '') and (subtotal in (None, '') or pedagio in (None, '')):
            return Response({'detail': 'Informe o total do frete.'}, status=status.HTTP_400_BAD_REQUEST)
        if not uf_origem or not uf_destino:
            return Response({'detail': 'Informe UF de origem e destino.'}, status=status.HTTP_400_BAD_REQUEST)
        if total in (None, ''):
            total = subtotal
        icms = montar_icms_simulacao(
            total,
            uf_origem,
            uf_destino,
            subtotal=None if subtotal in (None, '') else subtotal,
            pedagio=None if pedagio in (None, '') else pedagio,
        )
        if not icms:
            return Response({'detail': 'Não foi possível calcular o ICMS.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(icms)


class EnderecoBuscaView(ModuleScopedViewMixin, APIView):
    permission_module = 'Comercial'
    permission_requires_filial = False

    def get(self, request):
        texto = (request.query_params.get('q') or '').strip()
        tipo = (request.query_params.get('tipo') or '').strip().lower()
        if len(texto) < 3:
            return Response({'results': []})
        try:
            resultados = buscar_cidades(texto) if tipo == 'cidade' else buscar_enderecos(texto)
        except RotaDistanciaError as exc:
            return Response({'detail': str(exc)}, status=exc.status)
        return Response({'results': resultados})


class EnderecoReversoView(ModuleScopedViewMixin, APIView):
    permission_module = 'Comercial'
    permission_requires_filial = False

    def get(self, request):
        try:
            resultado = reverso_geocodificar(request.query_params.get('lat'), request.query_params.get('lon'))
        except RotaDistanciaError as exc:
            return Response({'detail': str(exc)}, status=exc.status)
        return Response(resultado)


class MapsConfigView(ModuleScopedViewMixin, APIView):
    permission_module = 'Comercial'
    permission_requires_filial = False

    def get(self, request):
        from django.conf import settings
        chave = (getattr(settings, 'GOOGLE_MAPS_API_KEY', '') or '').strip()
        return Response({
            'enabled': bool(chave),
            'apiKey': chave or None,
        })


class RotaDistanciaView(ModuleScopedViewMixin, APIView):
    permission_module = 'Comercial'
    permission_requires_filial = False

    def post(self, request):
        modo = (request.data.get('modo') or 'cidade').strip().lower()
        if modo not in {'cidade', 'endereco'}:
            return Response({'detail': 'Modo inválido. Use "cidade" ou "endereco".'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if modo == 'endereco':
                endereco_origem = (request.data.get('enderecoOrigem') or '').strip()
                endereco_destino = (request.data.get('enderecoDestino') or '').strip()
                if not endereco_origem or not endereco_destino:
                    return Response({'detail': 'Informe endereço de origem e destino.'}, status=status.HTTP_400_BAD_REQUEST)
                resultado = calcular_distancia_enderecos(
                    endereco_origem,
                    endereco_destino,
                    origem_lat=request.data.get('origemLat'),
                    origem_lon=request.data.get('origemLon'),
                    destino_lat=request.data.get('destinoLat'),
                    destino_lon=request.data.get('destinoLon'),
                )
            else:
                cidade_origem = (request.data.get('cidadeOrigem') or '').strip()
                cidade_destino = (request.data.get('cidadeDestino') or '').strip()
                uf_origem = (request.data.get('ufOrigem') or '').strip().upper()[:2]
                uf_destino = (request.data.get('ufDestino') or '').strip().upper()[:2]
                if not cidade_origem or not cidade_destino:
                    return Response({'detail': 'Informe cidade de origem e destino.'}, status=status.HTTP_400_BAD_REQUEST)
                resultado = calcular_distancia_km(cidade_origem, cidade_destino, uf_origem, uf_destino)
        except RotaDistanciaError as exc:
            return Response({'detail': str(exc)}, status=exc.status)
        return Response(resultado)

