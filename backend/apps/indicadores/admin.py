from django.contrib import admin

from .models import GerencialSnapshot, IndicadorFilial, IndicadorKpi, MetaFaturamentoMensal


@admin.register(IndicadorKpi)
class IndicadorKpiAdmin(admin.ModelAdmin):
    list_display = ('label', 'value', 'change', 'up', 'sort_order')


@admin.register(IndicadorFilial)
class IndicadorFilialAdmin(admin.ModelAdmin):
    list_display = ('filial', 'receita', 'fretes', 'toneladas', 'meta', 'sort_order')


@admin.register(MetaFaturamentoMensal)
class MetaFaturamentoMensalAdmin(admin.ModelAdmin):
    list_display = ('ano', 'mes', 'valor')
    list_filter = ('ano',)
    ordering = ('ano', 'mes')


@admin.register(GerencialSnapshot)
class GerencialSnapshotAdmin(admin.ModelAdmin):
    list_display = ('reference_date', 'batch_label', 'fat_dia', 'fat_mes', 'saldo_banco', 'posicao_gerencial', 'sent_by', 'sent_at')
    search_fields = ('batch_label', 'sent_by')
    date_hierarchy = 'reference_date'
    readonly_fields = ('sent_at',)
