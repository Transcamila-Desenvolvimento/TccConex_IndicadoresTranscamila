from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoteMovimentacaoRHViewSet,
    MovimentacaoColaboradorViewSet,
    ColaboradorPJViewSet,
    CargoMappingViewSet,
    ColaboradorViewSet,
    HistoricoSalarialViewSet,
    InconsistenciaColaboradorViewSet,
)

router = DefaultRouter()
router.register('lotes', LoteMovimentacaoRHViewSet, basename='lotes')
router.register('movimentacoes', MovimentacaoColaboradorViewSet, basename='movimentacoes')
router.register('pjs', ColaboradorPJViewSet, basename='pjs')
router.register('cargos', CargoMappingViewSet, basename='cargos')
router.register('colaboradores', ColaboradorViewSet, basename='colaboradores')
router.register('historico-salarial', HistoricoSalarialViewSet, basename='historico-salarial')
router.register('alteracoes', InconsistenciaColaboradorViewSet, basename='alteracoes')

urlpatterns = [
    path('', include(router.urls)),
]
