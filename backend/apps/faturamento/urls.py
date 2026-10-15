from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .bipagem_views import BipagemBaseView, BipagemDocumentoView, BipagemImportarView
from .nd_views import NdPagadoresView, NdTitulosView
from .views import ClienteProtocoloViewSet, FilialClienteProtocoloViewSet, ProtocoloEnvioViewSet

router = DefaultRouter()
router.register('protocolo-clientes', ClienteProtocoloViewSet, basename='faturamento-protocolo-clientes')
router.register('protocolos', ProtocoloEnvioViewSet, basename='faturamento-protocolos')

urlpatterns = [
    path('bipagem/base/', BipagemBaseView.as_view(), name='faturamento-bipagem-base'),
    path('bipagem/importar/', BipagemImportarView.as_view(), name='faturamento-bipagem-importar'),
    path('bipagem/documento/', BipagemDocumentoView.as_view(), name='faturamento-bipagem-documento'),
    path('nds/pagadores/', NdPagadoresView.as_view(), name='faturamento-nds-pagadores'),
    path('nds/titulos/', NdTitulosView.as_view(), name='faturamento-nds-titulos'),
    path('', include(router.urls)),
    path(
        'protocolo-clientes/<int:cliente_pk>/filiais/',
        FilialClienteProtocoloViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='faturamento-filiais-list',
    ),
    path(
        'protocolo-clientes/<int:cliente_pk>/filiais/<int:pk>/',
        FilialClienteProtocoloViewSet.as_view({'delete': 'destroy'}),
        name='faturamento-filiais-detail',
    ),
]
