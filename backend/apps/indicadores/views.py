from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.financeiro.pagination import ReportPagination
from apps.accounts.mixins import ModuleScopedViewMixin

from .cashflow_service import build_cashflow_day_detail, build_cashflow_payload, get_financeiro_activity_version
from .gerencial_email_service import _parse_emails, _parse_reference, send_gerencial_email
from .meta_faturamento_service import build_meta_faturamento_payload
from .models import IndicadorFilial, IndicadorKpi
from .rh_indicador_service import (
    build_rh_movimentacao_export,
    build_rh_movimentacao_payload,
    parse_mes_ano_export_params,
)
from .serializers import IndicadorFilialSerializer, IndicadorKpiSerializer
from .sgq_satisfacao_service import (
    build_sgq_satisfacao_payload,
    build_sgq_satisfacao_detalhes_qs,
    get_sgq_activity_version,
    serialize_sgq_satisfacao_detalhe,
)
from apps.sgq.clientes_cadastro import indice_cadastros_pesquisa


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


class RHMovimentacaoIndicadorView(ModuleScopedViewMixin, APIView):
    permission_module = 'Indicadores'
    permission_requires_filial = False

    def get(self, request):
        # dict() evita surpresas com QueryDict mutável entre reloads no Windows.
        payload = build_rh_movimentacao_payload(request.query_params.dict())
        return Response(payload)


class RHMovimentacaoExportView(ModuleScopedViewMixin, APIView):
    permission_module = 'Indicadores'
    permission_requires_filial = False

    def get(self, request):
        try:
            ano, mes = parse_mes_ano_export_params(request.query_params)
            content, filename = build_rh_movimentacao_export(mes, ano)
        except ValueError as exc:
            detail = str(exc)
            status_code = (
                status.HTTP_404_NOT_FOUND
                if 'Nenhum lote encontrado' in detail
                else status.HTTP_400_BAD_REQUEST
            )
            return Response({'detail': detail}, status=status_code)
        except Exception:
            return Response(
                {'detail': 'Não foi possível gerar a planilha. Tente novamente.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        response = HttpResponse(
            content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class MetaFaturamentoIndicadorView(ModuleScopedViewMixin, APIView):
    """Meta de Faturamento — realizado via BillingRecord + metas mensais cadastradas."""

    permission_module = 'Indicadores'
    permission_requires_filial = False

    def get(self, request):
        try:
            payload = build_meta_faturamento_payload(request.query_params)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)


class SgqSatisfacaoActivityView(ModuleScopedViewMixin, APIView):
    """Endpoint leve para polling: informa se pesquisas do SGQ mudaram desde a
    última consulta (ver get_sgq_activity_version)."""

    permission_module = 'Indicadores'
    permission_requires_filial = False

    def get(self, request):
        return Response({'version': get_sgq_activity_version()})


class SgqSatisfacaoIndicadorView(ModuleScopedViewMixin, APIView):
    """Satisfação dos clientes — consolida pesquisas do SGQ (Ibiporã + Rondonópolis)."""

    permission_module = 'Indicadores'
    permission_requires_filial = False

    def get(self, request):
        return Response(build_sgq_satisfacao_payload(request.query_params))


class SgqSatisfacaoDetalhesPagination(ReportPagination):
    page_size = 20


class SgqSatisfacaoDetalhesView(ModuleScopedViewMixin, APIView):
    """Lista cada pesquisa (e a análise) no mesmo recorte do indicador."""

    permission_module = 'Indicadores'
    permission_requires_filial = False

    def get(self, request):
        qs = build_sgq_satisfacao_detalhes_qs(request.query_params)
        paginator = SgqSatisfacaoDetalhesPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        indice = indice_cadastros_pesquisa()
        return paginator.get_paginated_response(
            [serialize_sgq_satisfacao_detalhe(item, indice) for item in page]
        )


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
