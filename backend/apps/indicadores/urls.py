from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CashFlowActivityView,
    CashFlowDayDetailView,
    CashFlowView,
    IndicadorFilialViewSet,
    IndicadorKpiViewSet,
    MetaFaturamentoIndicadorView,
    RHMovimentacaoIndicadorView,
    SendGerencialEmailView,
    SgqSatisfacaoActivityView,
    SgqSatisfacaoIndicadorView,
)

router = DefaultRouter()
router.register('kpis', IndicadorKpiViewSet, basename='indicador-kpi')
router.register('filiais', IndicadorFilialViewSet, basename='indicador-filial')

urlpatterns = [
    path('fluxo-caixa/enviar-gerencial/', SendGerencialEmailView.as_view(), name='indicador-fluxo-caixa-enviar-gerencial'),
    path('fluxo-caixa/dia/', CashFlowDayDetailView.as_view(), name='indicador-fluxo-caixa-dia'),
    path('fluxo-caixa/atividade/', CashFlowActivityView.as_view(), name='indicador-fluxo-caixa-atividade'),
    path('fluxo-caixa/', CashFlowView.as_view(), name='indicador-fluxo-caixa'),
    path('rh/movimentacao/', RHMovimentacaoIndicadorView.as_view(), name='indicador-rh-movimentacao'),
    path('logistica/meta-faturamento/', MetaFaturamentoIndicadorView.as_view(), name='indicador-meta-faturamento'),
    path('sgq/satisfacao/atividade/', SgqSatisfacaoActivityView.as_view(), name='indicador-sgq-satisfacao-atividade'),
    path('sgq/satisfacao/', SgqSatisfacaoIndicadorView.as_view(), name='indicador-sgq-satisfacao'),
    path('', include(router.urls)),
]
