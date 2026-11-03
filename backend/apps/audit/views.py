from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AuditLog
from .pagination import AuditLogPagination
from .serializers import AuditLogSerializer
from .services import record_audit

DIAS_DE_RECICLAGEM = (30, 90, 180, 365)


class AdminOnlyMixin:
    """Restringe o acesso a usuários administradores do ambiente Administração."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not request.user.is_admin:
            self.permission_denied(
                request,
                message='Acesso negado. Apenas administradores possuem acesso a este recurso.',
            )


class AuditLogViewSet(AdminOnlyMixin, viewsets.ReadOnlyModelViewSet):
    """Lista paginada de logs de auditoria — somente administradores."""
    queryset = AuditLog.objects.select_related('user').all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = AuditLogPagination

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        search = (params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(action__icontains=search)
                | Q(details__icontains=search)
            )

        action = (params.get('action') or '').strip()
        if action:
            qs = qs.filter(action=action)

        date_from = (params.get('dateFrom') or '').strip()
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)

        date_to = (params.get('dateTo') or '').strip()
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        return qs

    @action(detail=False, methods=['post'], url_path='reciclar')
    def reciclar(self, request):
        """Apaga logs antigos ou todos. O próprio ato fica registrado depois da exclusão."""
        apagar_tudo = request.data.get('all') is True
        if apagar_tudo:
            consulta = AuditLog.objects.all()
            detalhes = None
        else:
            try:
                dias = int(request.data.get('olderThanDays'))
            except (TypeError, ValueError):
                dias = None
            if dias not in DIAS_DE_RECICLAGEM:
                return Response(
                    {'detail': 'Informe 30, 90, 180 ou 365 dias, ou all para excluir todos os logs.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            consulta = AuditLog.objects.filter(created_at__lt=timezone.now() - timedelta(days=dias))
            detalhes = dias

        removidos, _ = consulta.delete()
        if removidos == 1:
            texto = '1 log excluído (todos).' if apagar_tudo else f'1 log com mais de {detalhes} dias excluído.'
        elif apagar_tudo:
            texto = f'{removidos} logs excluídos (todos).'
        else:
            texto = f'{removidos} logs com mais de {detalhes} dias excluídos.'
        record_audit(request.user, 'logs.reciclados', texto)
        return Response({'removed': removidos})


class AuditLogFacetsAPIView(AdminOnlyMixin, APIView):
    """Valores distintos de ação registrados, para popular o filtro da UI."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        actions = list(
            AuditLog.objects.order_by('action').values_list('action', flat=True).distinct()
        )
        return Response({'actions': actions})
