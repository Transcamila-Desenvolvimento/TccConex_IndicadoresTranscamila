from django.contrib import admin

from .models import (
    ClienteComercial,
    ClienteComercialProduto,
    GeneralidadeComercial,
    HomologacaoProdutoEvento,
    ProdutoComercial,
    PropostaComercial,
    PropostaFreteLinha,
    TabelaFrete,
    TabelaFreteLinha,
)


class ClienteComercialProdutoInline(admin.TabularInline):
    model = ClienteComercialProduto
    extra = 0


@admin.register(ClienteComercial)
class ClienteComercialAdmin(admin.ModelAdmin):
    list_display = ('razao_social', 'cnpj', 'responsavel', 'municipio', 'uf', 'situacao', 'compatibilidade')
    list_filter = ('situacao', 'compatibilidade', 'uf')
    search_fields = ('razao_social', 'nome_fantasia', 'cnpj', 'municipio', 'email')
    inlines = [ClienteComercialProdutoInline]


class PropostaFreteLinhaInline(admin.TabularInline):
    model = PropostaFreteLinha
    extra = 0


@admin.register(PropostaComercial)
class PropostaComercialAdmin(admin.ModelAdmin):
    list_display = ('numero_identificacao', 'titulo', 'tipo', 'status', 'cliente_nome', 'cliente', 'vigencia', 'valor_estimado', 'data_criacao')
    list_filter = ('tipo', 'status', 'ano')
    search_fields = ('titulo', 'subtitulo', 'cliente_nome', 'observacoes', 'cliente__razao_social')
    inlines = [PropostaFreteLinhaInline]


class TabelaFreteLinhaInline(admin.TabularInline):
    model = TabelaFreteLinha
    extra = 0


@admin.register(TabelaFrete)
class TabelaFreteAdmin(admin.ModelAdmin):
    list_display = ('nome', 'tipo', 'data_atualizacao')
    list_filter = ('tipo',)
    search_fields = ('nome', 'clientes__razao_social')
    filter_horizontal = ('clientes',)
    inlines = [TabelaFreteLinhaInline]


@admin.register(TabelaFreteLinha)
class TabelaFreteLinhaAdmin(admin.ModelAdmin):
    list_display = ('tabela', 'origem', 'entrega', 'veiculo', 'tarifa_frete', 'prazo_dias')
    search_fields = ('origem', 'entrega', 'veiculo', 'tabela__nome')


@admin.register(GeneralidadeComercial)
class GeneralidadeComercialAdmin(admin.ModelAdmin):
    list_display = ('cliente', 'tipo_servico', 'ordem', 'rotulo', 'valor')
    list_filter = ('tipo_servico',)
    search_fields = ('rotulo', 'valor', 'cliente__razao_social')
    ordering = ('cliente', 'tipo_servico', 'ordem', 'pk')


class ClienteVinculoInline(admin.TabularInline):
    model = ClienteComercialProduto
    extra = 0
    fk_name = 'produto'


@admin.register(ProdutoComercial)
class ProdutoComercialAdmin(admin.ModelAdmin):
    list_display = ('nome', 'classe_risco', 'numero_onu', 'fispq_consulta', 'ativo')
    list_filter = ('classe_risco', 'ativo')
    search_fields = ('nome', 'numero_onu')
    inlines = [ClienteVinculoInline]


@admin.register(HomologacaoProdutoEvento)
class HomologacaoProdutoEventoAdmin(admin.ModelAdmin):
    list_display = ('cliente', 'status', 'usuario', 'data_criacao')
    list_filter = ('status',)
    search_fields = ('cliente__razao_social', 'justificativa')
