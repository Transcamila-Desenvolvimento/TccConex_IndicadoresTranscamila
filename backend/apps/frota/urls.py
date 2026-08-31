from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CondutorFrotaViewSet,
    CustoFrotaLoteViewSet,
    CustoFrotaRelatorioView,
    FrotaSummaryView,
    VeiculoFrotaViewSet,
)

router = DefaultRouter()
router.register('veiculos', VeiculoFrotaViewSet, basename='frota-veiculos')
router.register('condutores', CondutorFrotaViewSet, basename='frota-condutores')
router.register('custos-lotes', CustoFrotaLoteViewSet, basename='frota-custos-lotes')

urlpatterns = [
    path('summary/', FrotaSummaryView.as_view(), name='frota-summary'),
    path('custos/relatorios/<str:report_type>/', CustoFrotaRelatorioView.as_view(), name='frota-custos-relatorio'),
    path('', include(router.urls)),
]
