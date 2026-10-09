from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.constants import AGENTE_CAMILO_ENVIRONMENT
from apps.accounts.cpf import formatar_cpf, somente_digitos
from apps.accounts.permissions import user_has_module_access
from apps.audit.services import record_audit
from apps.camilo.catalogo import grupos_do_usuario
from apps.camilo.comprovante import comprovante_pdf
from apps.camilo.conversa import historico_valido, responder_agente, responder_camilo
from apps.camilo.gemini import GeminiErro
from apps.camilo.models import Agente, ChatPadrao, TermoAceite
from apps.camilo.serializers import AgenteSerializer, ChatPadraoSerializer
from apps.camilo.termo import publicar_versao, termo_publico, texto_da_versao, versao_vigente


class CamiloAccessMixin:
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not user_has_module_access(request.user, AGENTE_CAMILO_ENVIRONMENT):
            self.permission_denied(request, message='Sem acesso ao CamiloIA.')


class PartesDisponiveisView(CamiloAccessMixin, APIView):
    def get(self, request):
        return Response({'grupos': grupos_do_usuario(request.user)})


class AgenteListCreateView(CamiloAccessMixin, APIView):
    def get(self, request):
        agentes = Agente.objects.filter(usuario=request.user)
        return Response(AgenteSerializer(agentes, many=True, context={'request': request}).data)

    def post(self, request):
        serializer = AgenteSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        agente = serializer.save()
        record_audit(
            request.user,
            'camilo.agente.criar',
            f'{agente.nome} ({len(agente.escopos)} partes)',
        )
        return Response(AgenteSerializer(agente, context={'request': request}).data, status=status.HTTP_201_CREATED)


class AgenteDetailView(CamiloAccessMixin, APIView):
    def _agente(self, request, agente_id):
        return Agente.objects.filter(usuario=request.user, pk=agente_id).first()

    def get(self, request, agente_id):
        agente = self._agente(request, agente_id)
        if not agente:
            return Response({'detail': 'Agente não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AgenteSerializer(agente, context={'request': request}).data)

    def patch(self, request, agente_id):
        agente = self._agente(request, agente_id)
        if not agente:
            return Response({'detail': 'Agente não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = AgenteSerializer(agente, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        record_audit(
            request.user,
            'camilo.agente.editar',
            f'{agente.nome} ({len(agente.escopos)} partes)',
        )
        return Response(serializer.data)

    def delete(self, request, agente_id):
        agente = self._agente(request, agente_id)
        if not agente:
            return Response({'detail': 'Agente não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        nome = agente.nome
        agente.delete()
        record_audit(request.user, 'camilo.agente.excluir', nome)
        return Response(status=status.HTTP_204_NO_CONTENT)


def _pergunta(request):
    pergunta = str(request.data.get('pergunta') or '').strip()
    if not pergunta:
        return None, Response({'detail': 'Escreva a pergunta.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(pergunta) > 2000:
        return None, Response({'detail': 'A pergunta passou de 2000 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)
    return pergunta, None


class CamiloConversarView(CamiloAccessMixin, APIView):
    def post(self, request):
        pergunta, erro = _pergunta(request)
        if erro:
            return erro
        try:
            resultado = responder_camilo(pergunta, historico_valido(request.data.get('historico')))
        except GeminiErro as exc:
            return Response({'detail': str(exc)}, status=exc.status)
        record_audit(request.user, 'camilo.conversar', pergunta[:160])
        return Response(resultado)


class AgenteConsultarView(CamiloAccessMixin, APIView):
    def post(self, request, agente_id):
        agente = Agente.objects.filter(usuario=request.user, pk=agente_id).first()
        if not agente:
            return Response({'detail': 'Agente não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        pergunta, erro = _pergunta(request)
        if erro:
            return erro
        try:
            resultado = responder_agente(
                request.user,
                agente,
                pergunta,
                historico_valido(request.data.get('historico')),
            )
        except GeminiErro as exc:
            return Response({'detail': str(exc)}, status=exc.status)
        record_audit(
            request.user,
            'camilo.agente.consultar',
            f'{agente.nome}: {len(resultado["fontes"])} fontes',
        )
        return Response(resultado)


class ChatPadraoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_admin and not user_has_module_access(request.user, AGENTE_CAMILO_ENVIRONMENT):
            return Response({'detail': 'Sem acesso ao CamiloIA.'}, status=status.HTTP_403_FORBIDDEN)
        config = ChatPadrao.atual()
        return Response(ChatPadraoSerializer.publico(config, completo=request.user.is_admin))

    def put(self, request):
        if not request.user.is_admin:
            return Response(
                {'detail': 'Só a administração altera o chat padrão.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = ChatPadraoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        config = serializer.save()
        record_audit(request.user, 'camilo.chat_padrao.editar', config.nome_efetivo)
        return Response(ChatPadraoSerializer.publico(config, completo=True))


def _ip_do_pedido(request) -> str:
    forwarded = str(request.META.get('HTTP_X_FORWARDED_FOR') or '')
    if forwarded.strip():
        return forwarded.split(',')[0].strip()[:64]
    return str(request.META.get('REMOTE_ADDR') or '')[:64]


def _termo_publico(aceite: TermoAceite) -> dict:
    return {
        'id': str(aceite.id),
        'nome': aceite.nome,
        'username': aceite.username,
        'versao': aceite.versao,
        'aceitoEm': aceite.aceito_em.isoformat(),
    }


def _resposta_termo(aceite, vigente, aceito: bool) -> dict:
    data = termo_publico(vigente)
    data['aceito'] = aceito
    if aceite:
        data['id'] = str(aceite.id)
        data['nome'] = aceite.nome
        data['username'] = aceite.username
        data['aceitoEm'] = aceite.aceito_em.isoformat()
    return data


class MeuTermoView(CamiloAccessMixin, APIView):
    def get(self, request):
        vigente = versao_vigente()
        aceite = TermoAceite.objects.filter(usuario=request.user, versao=vigente.codigo).first()
        return Response(_resposta_termo(aceite, vigente, bool(aceite)))

    def post(self, request):
        vigente = versao_vigente()
        texto = texto_da_versao(vigente.codigo)
        if not texto:
            return Response({'detail': 'Termo de uso indisponível.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        usuario = request.user
        existente = TermoAceite.objects.filter(usuario=usuario, versao=vigente.codigo).first()
        if existente:
            return Response(_resposta_termo(existente, vigente, True))
        try:
            with transaction.atomic():
                aceite = TermoAceite.objects.create(
                    usuario=usuario,
                    versao=vigente.codigo,
                    nome=(usuario.name or usuario.username or '').strip(),
                    username=usuario.username,
                    cpf=formatar_cpf(somente_digitos(getattr(usuario, 'cpf', '') or '')),
                    texto=texto,
                    ip=_ip_do_pedido(request),
                )
        except IntegrityError:
            aceite = TermoAceite.objects.get(usuario=usuario, versao=vigente.codigo)
            return Response(_resposta_termo(aceite, vigente, True))
        record_audit(usuario, 'camilo.termo.aceitar', f'{aceite.versao} · {aceite.username}')
        return Response(_resposta_termo(aceite, vigente, True), status=status.HTTP_201_CREATED)


def _secoes_validas(valor):
    if not isinstance(valor, list) or not valor:
        return None
    secoes = []
    for item in valor:
        if not isinstance(item, dict):
            return None
        titulo = str(item.get('titulo') or '').strip()
        texto = str(item.get('texto') or '').strip()
        if not titulo or not texto:
            return None
        secoes.append({'titulo': titulo[:120], 'texto': texto[:4000]})
    return secoes


class TermoVigenteView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_admin:
            return Response(
                {'detail': 'Só a administração consulta a versão vigente.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(termo_publico(versao_vigente()))

    def post(self, request):
        if not request.user.is_admin:
            return Response(
                {'detail': 'Só a administração publica uma nova versão.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        declaracao = str(request.data.get('declaracao') or '').strip()
        secoes = _secoes_validas(request.data.get('secoes'))
        if not declaracao or secoes is None:
            return Response(
                {'detail': 'Preencha a declaração e ao menos uma seção.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        registro = publicar_versao(request.user, {
            'declaracao': declaracao[:240],
            'secoes': secoes,
        })
        record_audit(request.user, 'camilo.termo.publicar', registro.codigo)
        return Response(termo_publico(registro), status=status.HTTP_201_CREATED)


class TermoAceitePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class TermosAceitosView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class = TermoAceitePagination

    def get(self, request):
        if not request.user.is_admin:
            return Response(
                {'detail': 'Só a administração consulta os termos aceitos.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        busca = str(request.query_params.get('search') or '').strip()
        ordem = {
            'data_asc': 'aceito_em',
            'data_desc': '-aceito_em',
        }.get(str(request.query_params.get('ordering') or '').strip(), '-aceito_em')
        aceites = TermoAceite.objects.all().order_by(ordem, '-id')
        if busca:
            aceites = aceites.filter(Q(nome__icontains=busca) | Q(username__icontains=busca))
        paginator = self.pagination_class()
        pagina = paginator.paginate_queryset(aceites, request, view=self)
        return paginator.get_paginated_response([_termo_publico(item) for item in pagina])


class TermoComprovanteView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, aceite_id):
        if not request.user.is_admin:
            return Response(
                {'detail': 'Só a administração extrai o comprovante.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        aceite = TermoAceite.objects.filter(pk=aceite_id).first()
        if not aceite:
            return Response({'detail': 'Aceite não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        pdf = comprovante_pdf(aceite)
        response = HttpResponse(pdf, content_type='application/pdf')
        nome = f'comprovante-termo-camilo-{aceite.username}.pdf'
        response['Content-Disposition'] = f'attachment; filename="{nome}"'
        record_audit(request.user, 'camilo.termo.comprovante', f'{aceite.username} · {aceite.versao}')
        return response
