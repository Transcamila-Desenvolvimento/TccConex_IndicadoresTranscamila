from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .drive_views import RHDriveBrowseView, RHDriveStatusView
from .views import (
    LoteMovimentacaoRHViewSet,
    MovimentacaoColaboradorViewSet,
    ColaboradorPJViewSet,
    CargoMappingViewSet,
    ColaboradorViewSet,
    HistoricoSalarialViewSet,
    InconsistenciaColaboradorViewSet,
    DocumentoRHViewSet,
)

router = DefaultRouter()
router.register('lotes', LoteMovimentacaoRHViewSet, basename='lotes')
router.register('movimentacoes', MovimentacaoColaboradorViewSet, basename='movimentacoes')
router.register('pjs', ColaboradorPJViewSet, basename='pjs')
router.register('cargos', CargoMappingViewSet, basename='cargos')
router.register('colaboradores', ColaboradorViewSet, basename='colaboradores')
router.register('historico-salarial', HistoricoSalarialViewSet, basename='historico-salarial')
router.register('alteracoes', InconsistenciaColaboradorViewSet, basename='alteracoes')
router.register('documentos', DocumentoRHViewSet, basename='documentos')

urlpatterns = [
    path('drive/status/', RHDriveStatusView.as_view(), name='rh-drive-status'),
    path('drive/browse/', RHDriveBrowseView.as_view(), name='rh-drive-browse'),
    path('', include(router.urls)),
]
