from django.contrib import admin

from .models import (
    UnidadeMedida,
    Setor,
    Colaborador,
    Fornecedor,
    ItemEstoque,
    EntradaEstoque,
    SaidaEstoque,
    Uniforme,
    EntregaUniforme,
    EntregaUniformeItem,
    MovimentacaoUniforme,
)

admin.site.register(UnidadeMedida)
admin.site.register(Setor)


@admin.register(Colaborador)
class ColaboradorAdmin(admin.ModelAdmin):
    list_display = ('nome', 'cargo', 'cpf', 'setor')
    list_filter = ('setor',)
    search_fields = ('nome', 'cargo', 'cpf', 'setor__nome')


admin.site.register(Fornecedor)
admin.site.register(ItemEstoque)
admin.site.register(EntradaEstoque)
admin.site.register(SaidaEstoque)


@admin.register(Uniforme)
class UniformeAdmin(admin.ModelAdmin):
    list_display = ('nome', 'tamanho', 'codigo', 'qtd_nova', 'qtd_usada', 'estoque_minimo')
    search_fields = ('nome', 'codigo')
    readonly_fields = ('qtd_nova', 'qtd_usada')


class EntregaUniformeItemInline(admin.TabularInline):
    model = EntregaUniformeItem
    extra = 0
    can_delete = False
    readonly_fields = [f.name for f in EntregaUniformeItem._meta.fields]


@admin.register(EntregaUniforme)
class EntregaUniformeAdmin(admin.ModelAdmin):
    list_display = ('numero', 'colaborador_nome', 'data_entrega', 'usuario_nome')
    search_fields = ('colaborador_nome', 'colaborador_cpf')
    inlines = [EntregaUniformeItemInline]

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(MovimentacaoUniforme)
class MovimentacaoUniformeAdmin(admin.ModelAdmin):
    list_display = ('criado_em', 'tipo', 'uniforme_nome', 'uniforme_tamanho', 'condicao', 'quantidade', 'colaborador_nome', 'usuario_nome')
    list_filter = ('tipo', 'condicao')
    search_fields = ('uniforme_nome', 'colaborador_nome', 'observacao')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
