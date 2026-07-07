from django.db.models import Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AuditLog
from .pagination import AuditLogPagination
from .serializers import AuditLogSerializer


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


class AuditLogFacetsAPIView(AdminOnlyMixin, APIView):
    """Valores distintos de ação registrados, para popular o filtro da UI."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        actions = list(
            AuditLog.objects.order_by('action').values_list('action', flat=True).distinct()
        )
        return Response({'actions': actions})
