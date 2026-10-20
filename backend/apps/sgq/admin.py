from django.contrib import admin

from .models import (
    DocumentoSGQ,
    EscopoAnalise,
    EscopoAnaliseOpcao,
    PastaMatrizSGQ,
    PesquisaSatisfacao,
    PesquisaSatisfacaoFormDraft,
    PesquisaSatisfacaoLoteDraft,
)


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


@admin.register(EscopoAnaliseOpcao)
class EscopoAnaliseOpcaoAdmin(admin.ModelAdmin):
    list_display = ('label', 'chave', 'escopo', 'ordem', 'ativo')
    list_filter = ('ativo', 'escopo')
    search_fields = ('label', 'chave')


@admin.register(PastaMatrizSGQ)
class PastaMatrizSGQAdmin(admin.ModelAdmin):
    list_display = ('nome', 'parent', 'criado_em')
    search_fields = ('nome',)
    readonly_fields = ('criado_em',)


@admin.register(DocumentoSGQ)
class DocumentoSGQAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'pasta', 'nome_original', 'tamanho', 'texto_extraido', 'incluido_por', 'criado_em')
    list_filter = ('texto_extraido', 'pasta')
    search_fields = ('titulo', 'nome_original')
    readonly_fields = ('criado_em',)
