from django.contrib import admin

from .models import (
    UnidadeMedida,
    Setor,
    Colaborador,
    Fornecedor,
    ItemEstoque,
    EntradaEstoque,
    SaidaEstoque,
)

admin.site.register(UnidadeMedida)
admin.site.register(Setor)


@admin.register(Colaborador)
class ColaboradorAdmin(admin.ModelAdmin):
    list_display = ('nome', 'setor')
    list_filter = ('setor',)
    search_fields = ('nome', 'setor__nome')


admin.site.register(Fornecedor)
admin.site.register(ItemEstoque)
admin.site.register(EntradaEstoque)
admin.site.register(SaidaEstoque)
