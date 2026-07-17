from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CashFlowActivityView,
    CashFlowDayDetailView,
    CashFlowView,
    GnreOcorrenciasGuiasView,
    GnreOcorrenciasIndicadoresView,
    IndicadorFilialViewSet,
    IndicadorKpiViewSet,
    OpsOcorrenciasIndicadoresView,
    SendGerencialEmailView,
)

router = DefaultRouter()
router.register('kpis', IndicadorKpiViewSet, basename='indicador-kpi')
router.register('filiais', IndicadorFilialViewSet, basename='indicador-filial')

urlpatterns = [
    path('fluxo-caixa/enviar-gerencial/', SendGerencialEmailView.as_view(), name='indicador-fluxo-caixa-enviar-gerencial'),
    path('fluxo-caixa/dia/', CashFlowDayDetailView.as_view(), name='indicador-fluxo-caixa-dia'),
    path('fluxo-caixa/atividade/', CashFlowActivityView.as_view(), name='indicador-fluxo-caixa-atividade'),
    path('fluxo-caixa/', CashFlowView.as_view(), name='indicador-fluxo-caixa'),
    path('ocorrencias/ops/', OpsOcorrenciasIndicadoresView.as_view(), name='indicador-ocorrencias-ops'),
    path('ocorrencias/gnre/guias/', GnreOcorrenciasGuiasView.as_view(), name='indicador-ocorrencias-gnre-guias'),
    path('ocorrencias/gnre/', GnreOcorrenciasIndicadoresView.as_view(), name='indicador-ocorrencias-gnre'),
    path('', include(router.urls)),
]
