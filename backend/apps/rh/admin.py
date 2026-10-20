from django.contrib import admin

from .models import (
    CargoMapping,
    Colaborador,
    ColaboradorPJ,
    ColaboradorPJHistorico,
    DocumentoRH,
    InconsistenciaColaborador,
    LoteMovimentacaoRH,
    MovimentacaoColaborador,
    PastaMatrizRH,
)


@admin.register(Colaborador)
class ColaboradorAdmin(admin.ModelAdmin):
    list_display = ('nome_completo', 'cpf', 'matricula', 'filial', 'departamento', 'cargo', 'situacao', 'regime', 'desconsiderado')
    list_filter = ('situacao', 'regime', 'categoria', 'filial', 'desconsiderado')
    search_fields = ('nome_completo', 'cpf', 'matricula', 'cargo')
    readonly_fields = ('data_atualizacao',)


@admin.register(LoteMovimentacaoRH)
class LoteMovimentacaoRHAdmin(admin.ModelAdmin):
    list_display = ('mes', 'ano', 'data_importacao', 'usuario', 'arquivo')
    list_filter = ('ano',)
    ordering = ('-ano', '-mes')


@admin.register(MovimentacaoColaborador)
class MovimentacaoColaboradorAdmin(admin.ModelAdmin):
    list_display = ('nome', 'cpf', 'filial', 'funcao', 'situacao', 'categoria', 'salario', 'lote')
    list_filter = ('situacao', 'categoria', 'filial')
    search_fields = ('nome', 'cpf', 'funcao')


@admin.register(InconsistenciaColaborador)
class InconsistenciaColaboradorAdmin(admin.ModelAdmin):
    list_display = ('nome', 'cpf', 'tipo', 'valor_anterior', 'valor_atual', 'lote', 'data_criacao')
    list_filter = ('tipo',)
    search_fields = ('nome', 'cpf', 'justificativa')
    readonly_fields = ('data_criacao',)


@admin.register(CargoMapping)
class CargoMappingAdmin(admin.ModelAdmin):
    list_display = ('cargo', 'categoria', 'ultima_atualizacao')
    list_filter = ('categoria',)
    search_fields = ('cargo',)
    readonly_fields = ('data_criacao', 'ultima_atualizacao')


class ColaboradorPJHistoricoInline(admin.TabularInline):
    model = ColaboradorPJHistorico
    extra = 0


@admin.register(ColaboradorPJ)
class ColaboradorPJAdmin(admin.ModelAdmin):
    list_display = ('nome', 'cpf', 'filial', 'cargo', 'salario', 'data_admissao', 'ativo')
    list_filter = ('ativo', 'filial')
    search_fields = ('nome', 'cpf', 'cargo')
    readonly_fields = ('data_criacao',)
    inlines = [ColaboradorPJHistoricoInline]


@admin.register(ColaboradorPJHistorico)
class ColaboradorPJHistoricoAdmin(admin.ModelAdmin):
    list_display = ('pj', 'ano', 'mes', 'salario', 'cargo', 'filial', 'motivo')
    list_filter = ('ano',)
    search_fields = ('pj__nome', 'pj__cpf', 'motivo')
    readonly_fields = ('data_criacao',)


@admin.register(PastaMatrizRH)
class PastaMatrizRHAdmin(admin.ModelAdmin):
    list_display = ('nome', 'parent', 'criado_em')
    search_fields = ('nome',)
    readonly_fields = ('criado_em',)


@admin.register(DocumentoRH)
class DocumentoRHAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'pasta', 'nome_original', 'tamanho', 'texto_extraido', 'incluido_por', 'criado_em')
    list_filter = ('texto_extraido', 'pasta')
    search_fields = ('titulo', 'nome_original')
    readonly_fields = ('criado_em',)
