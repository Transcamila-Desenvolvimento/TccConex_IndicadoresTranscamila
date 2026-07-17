from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.mixins import ModuleScopedViewMixin

from .cashflow_service import build_cashflow_day_detail, build_cashflow_payload, get_financeiro_activity_version
from .gerencial_email_service import _parse_emails, _parse_reference, send_gerencial_email
from .models import IndicadorFilial, IndicadorKpi
from .ocorrencias_indicadores_service import (
    build_gnre_guias_list,
    build_gnre_indicadores,
    build_ops_indicadores,
)
from .serializers import IndicadorFilialSerializer, IndicadorKpiSerializer


class SendGerencialEmailView(ModuleScopedViewMixin, APIView):
    permission_module = 'Financeiro'

    def post(self, request):
        data = request.data
        try:
            reference = _parse_reference(data.get('gerencialDate'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        to_emails = _parse_emails(data.get('to') or data.get('email_destinatario'))
        cc_emails = _parse_emails(data.get('cc') or data.get('email_copia'))

        try:
            snapshot = send_gerencial_email(
                request.user,
                request,
                reference=reference,
                to_emails=to_emails,
                cc_emails=cc_emails,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response(
                {'detail': f'Falha ao enviar e-mail: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({
            'message': 'Relatório gerencial enviado com sucesso.',
            'snapshot': {
                'referenceDate': snapshot.reference_date.isoformat(),
                'batchLabel': snapshot.batch_label,
                'posicaoGerencial': float(snapshot.posicao_gerencial),
                'sentAt': snapshot.sent_at.isoformat(),
            },
        })


class CashFlowDayDetailView(ModuleScopedViewMixin, APIView):
    permission_module = 'Indicadores'
    permission_requires_filial = False

    def get(self, request):
        try:
            payload = build_cashflow_day_detail(request.user, request, request.query_params)
        except PermissionError:
            return Response({'detail': 'Filial não autorizada.'}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)


class CashFlowActivityView(ModuleScopedViewMixin, APIView):
    """Endpoint leve para polling: informa se dados do Financeiro que afetam o
    Fluxo de Caixa mudaram desde a última consulta (ver get_financeiro_activity_version).
    """

    permission_module = 'Indicadores'
    permission_requires_filial = False

    def get(self, request):
        return Response({'version': get_financeiro_activity_version()})


class CashFlowView(ModuleScopedViewMixin, APIView):
    permission_module = 'Indicadores'
    permission_requires_filial = False

    def get(self, request):
        try:
            payload = build_cashflow_payload(request.user, request, request.query_params)
        except PermissionError:
            return Response({'detail': 'Filial não autorizada.'}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)


class OpsOcorrenciasIndicadoresView(ModuleScopedViewMixin, APIView):
    permission_module = 'Indicadores'
    permission_requires_filial = False

    def get(self, request):
        return Response(build_ops_indicadores(request.query_params))


class GnreOcorrenciasIndicadoresView(ModuleScopedViewMixin, APIView):
    permission_module = 'Indicadores'
    permission_requires_filial = False

    def get(self, request):
        return Response(build_gnre_indicadores(request.query_params))


class GnreOcorrenciasGuiasView(ModuleScopedViewMixin, APIView):
    permission_module = 'Indicadores'
    permission_requires_filial = False

    def get(self, request):
        return Response(build_gnre_guias_list(request.query_params))


class IndicadorKpiViewSet(ModuleScopedViewMixin, viewsets.ReadOnlyModelViewSet):
    permission_module = 'Indicadores'
    serializer_class = IndicadorKpiSerializer
    queryset = IndicadorKpi.objects.all()

    def get_queryset(self):
        # KPIs são consolidados — acesso controlado só pelo módulo/filial da sessão.
        return self.scope_queryset(IndicadorKpi.objects.all(), filial_field=None)


class IndicadorFilialViewSet(ModuleScopedViewMixin, viewsets.ReadOnlyModelViewSet):
    permission_module = 'Indicadores'
    serializer_class = IndicadorFilialSerializer
    queryset = IndicadorFilial.objects.all()

    def get_queryset(self):
        return self.scope_queryset(IndicadorFilial.objects.all(), filial_field='filial')
