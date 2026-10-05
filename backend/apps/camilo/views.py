from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.constants import AGENTE_CAMILO_ENVIRONMENT
from apps.accounts.permissions import user_has_module_access
from apps.audit.services import record_audit
from apps.camilo.catalogo import grupos_do_usuario
from apps.camilo.conversa import historico_valido, responder_agente, responder_camilo
from apps.camilo.gemini import GeminiErro
from apps.camilo.models import Agente, ChatPadrao
from apps.camilo.serializers import AgenteSerializer, ChatPadraoSerializer


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
