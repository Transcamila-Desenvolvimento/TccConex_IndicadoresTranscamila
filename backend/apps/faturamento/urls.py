from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ClienteProtocoloViewSet, FilialClienteProtocoloViewSet, ProtocoloEnvioViewSet

router = DefaultRouter()
router.register('protocolo-clientes', ClienteProtocoloViewSet, basename='faturamento-protocolo-clientes')
router.register('protocolos', ProtocoloEnvioViewSet, basename='faturamento-protocolos')

urlpatterns = [
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
