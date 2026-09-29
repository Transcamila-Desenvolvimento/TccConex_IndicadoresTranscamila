from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notificacao, PushInscricao
from .serializers import NotificacaoSerializer, PushInscricaoSerializer
from .reciclagem import reciclar_se_devido
from .web_push import chave_publica, push_habilitado


class NotificacaoPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class NotificacaoViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Notificações do próprio usuário — independem do ambiente ativo na sessão."""
    serializer_class = NotificacaoSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NotificacaoPagination

    def get_queryset(self):
        qs = Notificacao.objects.filter(usuario=self.request.user)
        if (self.request.query_params.get('nao_lidas') or '').strip().lower() in {'1', 'true', 'sim'}:
            qs = qs.filter(lida_em__isnull=True)
        return qs

    @action(detail=False, methods=['get'], url_path='nao-lidas')
    def nao_lidas(self, request):
        reciclar_se_devido()
        total = Notificacao.objects.filter(usuario=request.user, lida_em__isnull=True).count()
        return Response({'total': total})

    @action(detail=True, methods=['post'], url_path='lida')
    def lida(self, request, pk=None):
        notificacao = self.get_object()
        if notificacao.lida_em is None:
            notificacao.lida_em = timezone.now()
            notificacao.save(update_fields=['lida_em'])
        return Response(self.get_serializer(notificacao).data)

    @action(detail=False, methods=['post'], url_path='marcar-todas-lidas')
    def marcar_todas_lidas(self, request):
        total = Notificacao.objects.filter(usuario=request.user, lida_em__isnull=True).update(lida_em=timezone.now())
        return Response({'atualizadas': total})

    @action(detail=False, methods=['get'], url_path='push/config')
    def push_config(self, request):
        return Response({
            'habilitado': push_habilitado(),
            'publicKey': chave_publica() if push_habilitado() else '',
        })

    @action(detail=False, methods=['post'], url_path='push/inscrever')
    def push_inscrever(self, request):
        if not push_habilitado():
            return Response(
                {'detail': 'Avisos no Windows ainda não foram configurados no servidor.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        serializer = PushInscricaoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data
        PushInscricao.objects.update_or_create(
            endpoint=dados['endpoint'],
            defaults={
                'usuario': request.user,
                'p256dh': dados['keys']['p256dh'],
                'auth': dados['keys']['auth'],
                'user_agent': (request.META.get('HTTP_USER_AGENT') or '')[:300],
            },
        )
        return Response({'inscrito': True}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='push/cancelar')
    def push_cancelar(self, request):
        endpoint = str(request.data.get('endpoint') or '').strip()
        removidas = 0
        if endpoint:
            removidas, _ = PushInscricao.objects.filter(usuario=request.user, endpoint=endpoint).delete()
        return Response({'removidas': removidas})
