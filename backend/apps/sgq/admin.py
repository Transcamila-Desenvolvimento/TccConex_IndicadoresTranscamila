from django.contrib import admin

from .models import EscopoAnalise, EscopoAnaliseOpcao, PesquisaSatisfacao, PesquisaSatisfacaoFormDraft, PesquisaSatisfacaoLoteDraft


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


@admin.register(PesquisaSatisfacaoFormDraft)
class PesquisaSatisfacaoFormDraftAdmin(admin.ModelAdmin):
    list_display = ('id', 'usuario', 'filial', 'updated_at')
    list_filter = ('filial',)
    search_fields = ('usuario__username', 'filial')
    readonly_fields = ('updated_at',)


class EscopoAnaliseOpcaoInline(admin.TabularInline):
    model = EscopoAnaliseOpcao
    extra = 0


@admin.register(EscopoAnalise)
class EscopoAnaliseAdmin(admin.ModelAdmin):
    list_display = ('chave', 'label', 'ordem', 'ativo')
    list_filter = ('ativo',)
    search_fields = ('chave', 'label')
    inlines = [EscopoAnaliseOpcaoInline]
