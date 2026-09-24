from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ClienteComercialViewSet,
    ComercialSummaryView,
    EnderecoBuscaView,
    EnderecoReversoView,
    MapsConfigView,
    GeneralidadesCatalogoView,
    IcmsFreteView,
    MatrizIcmsUfView,
    ParametrosComercialView,
    ProdutoComercialViewSet,
    PropostaComercialViewSet,
    RotaDistanciaView,
    TabelaFreteViewSet,
    TabelaFreteLinhaViewSet,
)

router = DefaultRouter()
router.register('clientes', ClienteComercialViewSet, basename='comercial-clientes')
router.register('produtos', ProdutoComercialViewSet, basename='comercial-produtos')
router.register('propostas', PropostaComercialViewSet, basename='comercial-propostas')
router.register('tabela-frete', TabelaFreteViewSet, basename='comercial-tabela-frete')
router.register('tabela-frete-linhas', TabelaFreteLinhaViewSet, basename='comercial-tabela-frete-linhas')

urlpatterns = [
    path('summary/', ComercialSummaryView.as_view(), name='comercial-summary'),
    path('generalidades/', GeneralidadesCatalogoView.as_view(), name='comercial-generalidades'),
    path('icms-ufs/', MatrizIcmsUfView.as_view(), name='comercial-icms-ufs'),
    path('parametros/', ParametrosComercialView.as_view(), name='comercial-parametros'),
    path('icms-frete/', IcmsFreteView.as_view(), name='comercial-icms-frete'),
    path('enderecos/buscar/', EnderecoBuscaView.as_view(), name='comercial-enderecos-buscar'),
    path('enderecos/reverso/', EnderecoReversoView.as_view(), name='comercial-enderecos-reverso'),
    path('maps-config/', MapsConfigView.as_view(), name='comercial-maps-config'),
    path('rota-distancia/', RotaDistanciaView.as_view(), name='comercial-rota-distancia'),
    path('', include(router.urls)),
]
