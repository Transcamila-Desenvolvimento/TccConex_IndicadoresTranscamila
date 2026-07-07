from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    UnidadeMedidaViewSet,
    SetorViewSet,
    ColaboradorViewSet,
    FornecedorViewSet,
    ItemEstoqueViewSet,
    EntradaEstoqueViewSet,
    SaidaEstoqueViewSet,
)

router = DefaultRouter()
router.register('unidades', UnidadeMedidaViewSet, basename='compras-unidades')
router.register('setores', SetorViewSet, basename='compras-setores')
router.register('colaboradores', ColaboradorViewSet, basename='compras-colaboradores')
router.register('fornecedores', FornecedorViewSet, basename='compras-fornecedores')
router.register('itens', ItemEstoqueViewSet, basename='compras-itens')
router.register('entradas', EntradaEstoqueViewSet, basename='compras-entradas')
router.register('saidas', SaidaEstoqueViewSet, basename='compras-saidas')

urlpatterns = [
    path('', include(router.urls)),
]
