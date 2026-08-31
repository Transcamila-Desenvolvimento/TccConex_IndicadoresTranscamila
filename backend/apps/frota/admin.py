from django.contrib import admin

from .models import (
    CondutorFrota,
    CustoAbastecimentoLinha,
    CustoFrotaLote,
    CustoManutencaoLinha,
    VeiculoFrota,
)


@admin.register(VeiculoFrota)
class VeiculoFrotaAdmin(admin.ModelAdmin):
    list_display = ('placa', 'marca', 'modelo', 'categoria', 'tipo_carroceria', 'combustivel', 'filial', 'status')
    list_filter = ('status', 'categoria', 'tipo_carroceria', 'combustivel', 'filial')
    search_fields = ('placa', 'marca', 'modelo', 'chassi', 'renavam')


@admin.register(CondutorFrota)
class CondutorFrotaAdmin(admin.ModelAdmin):
    list_display = ('nome', 'cpf', 'filial', 'status')
    list_filter = ('filial', 'status')
    search_fields = ('nome', 'cpf')


@admin.register(CustoFrotaLote)
class CustoFrotaLoteAdmin(admin.ModelAdmin):
    list_display = ('label', 'periodo_inicio', 'periodo_fim', 'is_active', 'imported_manutencao', 'imported_abastecimento')
    list_filter = ('is_active',)


@admin.register(CustoManutencaoLinha)
class CustoManutencaoLinhaAdmin(admin.ModelAdmin):
    list_display = ('placa', 'item', 'valor_total', 'lote')
    search_fields = ('placa', 'item')


@admin.register(CustoAbastecimentoLinha)
class CustoAbastecimentoLinhaAdmin(admin.ModelAdmin):
    list_display = ('placa', 'data', 'hodometro', 'km_trecho', 'litragem', 'valor_total', 'lote')
    search_fields = ('placa', 'estabelecimento', 'motorista')
