from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import PesquisaSatisfacaoViewSet

router = DefaultRouter()
router.register('pesquisas-satisfacao', PesquisaSatisfacaoViewSet, basename='sgq-pesquisas-satisfacao')

urlpatterns = [
    path('', include(router.urls)),
]
