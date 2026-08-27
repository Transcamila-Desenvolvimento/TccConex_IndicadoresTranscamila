from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.mixins import ModuleScopedViewMixin


class FrotaSummaryView(ModuleScopedViewMixin, APIView):
    """Resumo inicial do ambiente Frota."""

    permission_module = 'Frota'

    def get(self, request):
        return Response({
            'environment': 'Frota',
            'message': 'Ambiente Frota ativo.',
        })
