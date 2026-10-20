from django.contrib import admin

from .models import (
    ClienteComercial,
    ClienteComercialProduto,
    GeneralidadeComercial,
    HomologacaoProdutoEvento,
    MatrizIcmsUf,
    ParametrosComercial,
    ProdutoComercial,
    PropostaComercial,
    PropostaComercialDraft,
    PropostaFreteLinha,
    TabelaFrete,
    TabelaFreteLinha,
    VeiculoComercial,
    VeiculoRotuloCliente,
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


@admin.register(PropostaComercialDraft)
class PropostaComercialDraftAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'updated_at')
    search_fields = ('usuario__username', 'usuario__name')


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
    list_display = ('nome', 'tipo_produto', 'classe_risco', 'numero_onu', 'fispq_consulta', 'ativo')
    list_filter = ('tipo_produto', 'classe_risco', 'ativo')
    search_fields = ('nome', 'numero_onu')
    inlines = [ClienteVinculoInline]


@admin.register(HomologacaoProdutoEvento)
class HomologacaoProdutoEventoAdmin(admin.ModelAdmin):
    list_display = ('cliente', 'status', 'usuario', 'data_criacao')
    list_filter = ('status',)
    search_fields = ('cliente__razao_social', 'justificativa')


@admin.register(ClienteComercialProduto)
class ClienteComercialProdutoAdmin(admin.ModelAdmin):
    list_display = ('cliente', 'nome', 'produto', 'classe_risco', 'numero_onu', 'grupo_embalagem', 'ordem')
    list_filter = ('classe_risco', 'grupo_embalagem')
    search_fields = ('nome', 'numero_onu', 'cliente__razao_social', 'produto__nome')


@admin.register(PropostaFreteLinha)
class PropostaFreteLinhaAdmin(admin.ModelAdmin):
    list_display = ('proposta', 'ordem', 'origem', 'entrega', 'veiculo', 'modalidade', 'tarifa_frete', 'total_estimado')
    list_filter = ('modalidade',)
    search_fields = ('origem', 'entrega', 'veiculo', 'proposta__titulo', 'proposta__cliente_nome')


class VeiculoRotuloClienteInline(admin.TabularInline):
    model = VeiculoRotuloCliente
    extra = 0


@admin.register(VeiculoComercial)
class VeiculoComercialAdmin(admin.ModelAdmin):
    list_display = ('nome', 'codigo', 'antt_fixo', 'antt_por_km', 'capacidade_kg', 'ativo', 'ordem')
    list_filter = ('ativo',)
    search_fields = ('nome', 'codigo')
    inlines = [VeiculoRotuloClienteInline]


@admin.register(VeiculoRotuloCliente)
class VeiculoRotuloClienteAdmin(admin.ModelAdmin):
    list_display = ('veiculo', 'cliente', 'rotulo')
    search_fields = ('rotulo', 'veiculo__nome', 'cliente__razao_social')


@admin.register(MatrizIcmsUf)
class MatrizIcmsUfAdmin(admin.ModelAdmin):
    list_display = ('id', 'atualizado_em')
    readonly_fields = ('atualizado_em',)


@admin.register(ParametrosComercial)
class ParametrosComercialAdmin(admin.ModelAdmin):
    list_display = ('id', 'validade_padrao', 'faturamento_padrao', 'vigencia_padrao', 'atualizado_em')
    readonly_fields = ('atualizado_em',)
