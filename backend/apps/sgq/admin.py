from django.contrib import admin

from .models import PesquisaSatisfacao, PesquisaSatisfacaoLoteDraft


@admin.register(PesquisaSatisfacao)
class PesquisaSatisfacaoAdmin(admin.ModelAdmin):
    list_display = ('id', 'filial', 'data_inclusao', 'data_entrega', 'cliente', 'motorista', 'cte', 'nota_fiscal', 'cliente_recusou_assinar')
    list_filter = ('filial', 'cliente', 'prazo_entrega', 'cliente_recusou_assinar')
    search_fields = ('motorista', 'cte', 'nota_fiscal')


@admin.register(PesquisaSatisfacaoLoteDraft)
class PesquisaSatisfacaoLoteDraftAdmin(admin.ModelAdmin):
    list_display = ('id', 'usuario', 'filial', 'updated_at')
    list_filter = ('filial',)
    search_fields = ('usuario__username', 'filial')
    readonly_fields = ('updated_at',)
