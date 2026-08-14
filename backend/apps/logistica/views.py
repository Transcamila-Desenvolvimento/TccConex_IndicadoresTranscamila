from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.audit.services import record_audit


class LogisticaSummaryView(ModuleScopedViewMixin, APIView):
    """Resumo inicial do ambiente Logística."""

    permission_module = 'Logística'

    def get(self, request):
        return Response({
            'environment': 'Logística',
            'message': 'Ambiente Logística ativo.',
        })


class MetaFaturamentoConfigView(ModuleScopedViewMixin, APIView):
    """CRUD das metas mensais usadas pelo indicador Meta de Faturamento."""

    permission_module = 'Logística'
    permission_requires_filial = False

    def get(self, request):
        from apps.financeiro.meta_faturamento_config import _parse_ano, build_metas_ano_payload

        try:
            ano = _parse_ano(request.query_params.get('ano'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(build_metas_ano_payload(ano))

    def put(self, request):
        from apps.financeiro.meta_faturamento_config import _parse_ano, save_metas_ano

        try:
            ano = _parse_ano(request.data.get('ano'))
            payload = save_metas_ano(ano, request.data.get('meses'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        total = payload['total']
        record_audit(
            request.user,
            'logistica.meta_faturamento.atualizado',
            f'Metas de faturamento {ano} atualizadas — total anual R$ {total:.2f}.',
        )
        return Response(payload)
