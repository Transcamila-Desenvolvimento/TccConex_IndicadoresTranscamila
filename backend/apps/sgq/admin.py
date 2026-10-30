from django.contrib import admin

from .models import (
    AuditoriaFormDraft,
    AuditoriaSGQ,
    CategoriaAuditoriaSGQ,
    DocumentoSGQ,
    EscopoAnalise,
    EscopoAnaliseOpcao,
    ItemNormaSGQ,
    NormaSGQ,
    PastaMatrizSGQ,
    PesquisaSatisfacao,
    PesquisaSatisfacaoFormDraft,
    PesquisaSatisfacaoLoteDraft,
    TipoRespostaSGQ,
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


@admin.register(AuditoriaFormDraft)
class AuditoriaFormDraftAdmin(admin.ModelAdmin):
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


@admin.register(AuditoriaSGQ)
class AuditoriaSGQAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'titulo', 'categoria', 'filial', 'data_inicio', 'data_termino', 'auditor_lider', 'status')
    list_filter = ('status', 'filial', 'categoria')
    search_fields = ('codigo', 'titulo', 'normas', 'auditor_lider')
    readonly_fields = ('codigo', 'ano', 'sequencia', 'criado_em', 'atualizado_em')


@admin.register(NormaSGQ)
class NormaSGQAdmin(admin.ModelAdmin):
    list_display = ('nome', 'descricao', 'filial', 'data_atualizacao', 'emissor', 'publica', 'ativa')
    list_filter = ('ativa', 'publica', 'filial')
    search_fields = ('nome', 'descricao', 'emissor')
    readonly_fields = ('criado_em', 'atualizado_em')


@admin.register(CategoriaAuditoriaSGQ)
class CategoriaAuditoriaSGQAdmin(admin.ModelAdmin):
    list_display = ('nome', 'filial', 'ativa', 'emissor', 'atualizado_por')
    list_filter = ('ativa', 'filial')
    search_fields = ('nome', 'emissor', 'atualizado_por')
    filter_horizontal = ('normas',)
    readonly_fields = ('criado_em', 'atualizado_em')


@admin.register(TipoRespostaSGQ)
class TipoRespostaSGQAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'nome', 'filial', 'publica', 'emissor', 'atualizado_em')
    list_filter = ('publica', 'filial')
    search_fields = ('nome', 'emissor')
    readonly_fields = ('sequencia', 'criado_em', 'atualizado_em')


@admin.register(ItemNormaSGQ)
class ItemNormaSGQAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'norma', 'parent', 'tipo', 'tipo_resposta', 'classificacao', 'areas', 'peso', 'obrigatorio', 'ordem')
    list_filter = ('tipo', 'classificacao', 'obrigatorio')
    search_fields = ('titulo', 'descricao', 'norma__nome')
    readonly_fields = ('criado_em', 'atualizado_em')


@admin.register(DocumentoSGQ)
class DocumentoSGQAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'pasta', 'nome_original', 'tamanho', 'texto_extraido', 'incluido_por', 'criado_em')
    list_filter = ('texto_extraido', 'pasta')
    search_fields = ('titulo', 'nome_original')
    readonly_fields = ('criado_em',)
