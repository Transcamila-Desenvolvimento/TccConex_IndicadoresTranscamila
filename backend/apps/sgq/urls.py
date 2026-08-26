from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import EscopoAnaliseOpcaoViewSet, EscopoAnaliseViewSet, PesquisaSatisfacaoViewSet

router = DefaultRouter()
router.register('pesquisas-satisfacao', PesquisaSatisfacaoViewSet, basename='sgq-pesquisas-satisfacao')
router.register('escopos-analise', EscopoAnaliseViewSet, basename='sgq-escopos-analise')
router.register('escopos-analise-opcoes', EscopoAnaliseOpcaoViewSet, basename='sgq-escopos-analise-opcoes')

urlpatterns = [
    path('', include(router.urls)),
]
