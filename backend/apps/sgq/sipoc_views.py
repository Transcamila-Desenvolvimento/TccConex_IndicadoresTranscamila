from django.conf import settings
from django.db.models import Count, Q
from rest_framework import serializers, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.accounts.permissions import allowed_filiais_for_module, get_request_context, resolve_filial_name
from apps.audit.services import record_audit

from .models import ProcedimentoSipocSGQ, SetorSipocSGQ

TIPOS_NO = {'fornecedor', 'entrada', 'inicio', 'etapa', 'fim', 'saida', 'cliente', 'base'}


def _filial(request) -> str:
    _, filial = get_request_context(request)
    allowed = allowed_filiais_for_module(request.user, 'SGQ')
    return resolve_filial_name(filial, allowed) or ''


def _nome(valor, campo, limite):
    nome = str(valor or '').strip()
    if not nome:
        return None, Response({campo: 'Informe o nome.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(nome) > limite:
        return None, Response({campo: f'O nome passou de {limite} caracteres.'}, status=status.HTTP_400_BAD_REQUEST)
    return nome, None


def esquema_inicial():
    return {'nos': [], 'ligacoes': []}


def _numero(valor):
    try:
        numero = float(valor)
    except (TypeError, ValueError):
        return None
    if numero < -8000 or numero > 20000:
        return None
    return round(numero, 1)


def validar_esquema(valor):
    if not isinstance(valor, dict):
        return None, Response({'esquema': 'O esquema SIPOC é inválido.'}, status=status.HTTP_400_BAD_REQUEST)
    nos = valor.get('nos')
    ligacoes = valor.get('ligacoes')
    if not isinstance(nos, list) or not isinstance(ligacoes, list):
        return None, Response({'esquema': 'Informe os elementos e as ligações.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(nos) > 200 or len(ligacoes) > 400:
        return None, Response({'esquema': 'O esquema passou do limite de elementos.'}, status=status.HTTP_400_BAD_REQUEST)
    limpos = []
    ids = set()
    for item in nos:
        if not isinstance(item, dict):
            return None, Response({'esquema': 'Há um elemento inválido na lousa.'}, status=status.HTTP_400_BAD_REQUEST)
        identificador = str(item.get('id') or '').strip()[:40]
        tipo = str(item.get('tipo') or '')
        texto = str(item.get('texto') or '').strip()[:220]
        x = _numero(item.get('x'))
        y = _numero(item.get('y'))
        if not identificador or identificador in ids or tipo not in TIPOS_NO or x is None or y is None:
            return None, Response({'esquema': 'Há um elemento inválido na lousa.'}, status=status.HTTP_400_BAD_REQUEST)
        if not texto:
            texto = 'Sem título'
        ids.add(identificador)
        limpos.append({'id': identificador, 'tipo': tipo, 'texto': texto, 'x': x, 'y': y})
    saida = []
    vistos = set()
    for item in ligacoes:
        if not isinstance(item, dict):
            return None, Response({'esquema': 'Há uma ligação inválida na lousa.'}, status=status.HTTP_400_BAD_REQUEST)
        identificador = str(item.get('id') or '').strip()[:40]
        origem = str(item.get('de') or '')
        destino = str(item.get('para') or '')
        if not identificador or identificador in vistos or origem not in ids or destino not in ids or origem == destino:
            return None, Response({'esquema': 'Há uma ligação inválida na lousa.'}, status=status.HTTP_400_BAD_REQUEST)
        vistos.add(identificador)
        saida.append({'id': identificador, 'de': origem, 'para': destino})
    return {'nos': limpos, 'ligacoes': saida}, None


def _setor_payload(setor, total=None):
    return {
        'id': setor.id,
        'nome': setor.nome,
        'totalProcedimentos': setor.procedimentos.count() if total is None else total,
    }


def _nome_usuario(usuario):
    if usuario is None:
        return ''
    return (usuario.name or usuario.username or '').strip()


def _procedimento_payload(item, completo=False):
    autor = item.criado_por
    dados = {
        'id': item.id,
        'nome': item.nome,
        'descricao': item.descricao,
        'setorId': item.setor_id,
        'setorNome': item.setor.nome,
        'criadoPor': _nome_usuario(autor),
        'criadoPorFoto': (autor.google_picture_url or '') if autor is not None else '',
        'atualizadoEm': item.atualizado_em.isoformat(),
    }
    if completo:
        dados['esquema'] = item.esquema or {'nos': [], 'ligacoes': []}
    return dados


def _sipoc_liberado(user) -> bool:
    """No Azure a rotina não entra no 'todas as rotinas', nem para administrador.

    Só entra quem teve o SIPOC gravado no cadastro. SGQ_SIPOC_LIBERADO=True
    devolve o acesso para quem já tem o SGQ.
    """
    if getattr(settings, 'SGQ_SIPOC_LIBERADO', False):
        return True
    abas = (getattr(user, 'abas', None) or {}).get('SGQ') or []
    return 'sipoc' in abas


class _SipocBase(ModuleScopedViewMixin):
    permission_module = 'SGQ'
    permission_aba = 'sipoc'
    serializer_class = serializers.Serializer

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not _sipoc_liberado(request.user):
            raise PermissionDenied('O SIPOC ainda não está liberado para este usuário.')

    def _filial_ou_erro(self):
        filial = _filial(self.request)
        if not filial:
            return None, Response({'detail': 'Selecione a filial do SGQ.'}, status=status.HTTP_400_BAD_REQUEST)
        return filial, None


class SetorSipocSGQViewSet(_SipocBase, viewsets.ModelViewSet):
    queryset = SetorSipocSGQ.objects.all()
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return self.scope_queryset(self.queryset, filial_field='filial', admin_bypass=False).annotate(
            total=Count('procedimentos'),
        )

    def list(self, request, *args, **kwargs):
        setores = list(self.get_queryset())
        return Response({
            'count': len(setores),
            'results': [_setor_payload(item, item.total) for item in setores],
        })

    def create(self, request, *args, **kwargs):
        filial, erro = self._filial_ou_erro()
        if erro:
            return erro
        nome, erro = _nome(request.data.get('nome'), 'nome', 80)
        if erro:
            return erro
        if SetorSipocSGQ.objects.filter(filial=filial, nome__iexact=nome).exists():
            return Response({'nome': 'Já existe um setor com esse nome.'}, status=status.HTTP_400_BAD_REQUEST)
        setor = SetorSipocSGQ.objects.create(filial=filial, nome=nome)
        record_audit(request.user, 'sgq.sipoc.setor_criado', f'Setor SIPOC {nome} criado ({filial}).')
        return Response(_setor_payload(setor, 0), status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        setor = self.get_object()
        nome, erro = _nome(request.data.get('nome'), 'nome', 80)
        if erro:
            return erro
        if SetorSipocSGQ.objects.filter(filial=setor.filial, nome__iexact=nome).exclude(pk=setor.pk).exists():
            return Response({'nome': 'Já existe um setor com esse nome.'}, status=status.HTTP_400_BAD_REQUEST)
        setor.nome = nome
        setor.save(update_fields=['nome'])
        record_audit(request.user, 'sgq.sipoc.setor_atualizado', f'Setor SIPOC {nome} atualizado ({setor.filial}).')
        return Response(_setor_payload(setor))

    def destroy(self, request, *args, **kwargs):
        setor = self.get_object()
        if setor.procedimentos.exists():
            return Response(
                {'detail': 'O setor tem procedimentos. Mova ou exclua os procedimentos antes.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        nome = setor.nome
        filial = setor.filial
        setor.delete()
        record_audit(request.user, 'sgq.sipoc.setor_excluido', f'Setor SIPOC {nome} excluído ({filial}).')
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProcedimentoSipocSGQViewSet(_SipocBase, viewsets.ModelViewSet):
    queryset = ProcedimentoSipocSGQ.objects.select_related('setor', 'criado_por')
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = self.scope_queryset(self.queryset, filial_field='filial', admin_bypass=False)
        params = self.request.query_params
        setor = (params.get('setor') or '').strip()
        search = (params.get('search') or '').strip()
        if setor:
            qs = qs.filter(setor_id=setor)
        if search:
            qs = qs.filter(Q(nome__icontains=search) | Q(descricao__icontains=search) | Q(setor__nome__icontains=search))
        return qs

    def list(self, request, *args, **kwargs):
        itens = list(self.get_queryset())
        return Response({'count': len(itens), 'results': [_procedimento_payload(item) for item in itens]})

    def retrieve(self, request, *args, **kwargs):
        return Response(_procedimento_payload(self.get_object(), completo=True))

    def create(self, request, *args, **kwargs):
        filial, erro = self._filial_ou_erro()
        if erro:
            return erro
        nome, erro = _nome(request.data.get('nome'), 'nome', 140)
        if erro:
            return erro
        setor = SetorSipocSGQ.objects.filter(pk=request.data.get('setorId'), filial=filial).first()
        if setor is None:
            return Response({'setorId': 'Escolha o setor do procedimento.'}, status=status.HTTP_400_BAD_REQUEST)
        descricao = str(request.data.get('descricao') or '').strip()[:300]
        item = ProcedimentoSipocSGQ.objects.create(
            filial=filial,
            setor=setor,
            nome=nome,
            descricao=descricao,
            esquema=esquema_inicial(),
            criado_por=request.user,
        )
        record_audit(request.user, 'sgq.sipoc.procedimento_criado', f'Procedimento SIPOC {nome} criado ({filial}).')
        return Response(_procedimento_payload(item, completo=True), status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        item = self.get_object()
        campos = []
        if 'nome' in request.data:
            nome, erro = _nome(request.data.get('nome'), 'nome', 140)
            if erro:
                return erro
            item.nome = nome
            campos.append('nome')
        if 'descricao' in request.data:
            item.descricao = str(request.data.get('descricao') or '').strip()[:300]
            campos.append('descricao')
        if 'setorId' in request.data:
            setor = SetorSipocSGQ.objects.filter(pk=request.data.get('setorId'), filial=item.filial).first()
            if setor is None:
                return Response({'setorId': 'Escolha o setor do procedimento.'}, status=status.HTTP_400_BAD_REQUEST)
            item.setor = setor
            campos.append('setor')
        if 'esquema' in request.data:
            esquema, erro = validar_esquema(request.data.get('esquema'))
            if erro:
                return erro
            item.esquema = esquema
            campos.append('esquema')
        if not campos:
            return Response({'detail': 'Nada para atualizar.'}, status=status.HTTP_400_BAD_REQUEST)
        item.save(update_fields=[*campos, 'atualizado_em'])
        record_audit(request.user, 'sgq.sipoc.procedimento_atualizado', f'Procedimento SIPOC {item.nome} atualizado ({item.filial}).')
        return Response(_procedimento_payload(item, completo=True))

    def destroy(self, request, *args, **kwargs):
        item = self.get_object()
        nome = item.nome
        filial = item.filial
        item.delete()
        record_audit(request.user, 'sgq.sipoc.procedimento_excluido', f'Procedimento SIPOC {nome} excluído ({filial}).')
        return Response(status=status.HTTP_204_NO_CONTENT)
