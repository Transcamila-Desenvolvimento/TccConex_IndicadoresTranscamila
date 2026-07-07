from django.contrib import admin

from .models import IndicadorFilial, IndicadorKpi


@admin.register(IndicadorKpi)
class IndicadorKpiAdmin(admin.ModelAdmin):
    list_display = ('label', 'value', 'change', 'up', 'sort_order')


@admin.register(IndicadorFilial)
class IndicadorFilialAdmin(admin.ModelAdmin):
    list_display = ('filial', 'receita', 'fretes', 'toneladas', 'meta', 'sort_order')
