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
admin.site.register(Colaborador)
admin.site.register(Fornecedor)
admin.site.register(ItemEstoque)
admin.site.register(EntradaEstoque)
admin.site.register(SaidaEstoque)
