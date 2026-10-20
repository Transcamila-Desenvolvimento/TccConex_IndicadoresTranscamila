from django.contrib import admin

from .models import (
    ClienteProtocolo,
    FilialClienteProtocolo,
    PagadorNd,
    ProtocoloEnvio,
    ProtocoloEnvioDraft,
    TituloNd,
)


class FilialClienteProtocoloInline(admin.TabularInline):
    model = FilialClienteProtocolo
    extra = 0


@admin.register(ClienteProtocolo)
class ClienteProtocoloAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'loja', 'nome_interno', 'municipio', 'cnpj', 'padrao_protocolo')
    search_fields = ('codigo', 'loja', 'nome_interno', 'cnpj', 'municipio')
    list_filter = ('tipo_pessoa', 'padrao_protocolo', 'emitir_protocolo_canhotos')
    inlines = [FilialClienteProtocoloInline]


@admin.register(FilialClienteProtocolo)
class FilialClienteProtocoloAdmin(admin.ModelAdmin):
    list_display = ('nome', 'cliente')
    search_fields = ('nome', 'cliente__codigo', 'cliente__nome_interno')


admin.site.register(ProtocoloEnvio)


@admin.register(ProtocoloEnvioDraft)
class ProtocoloEnvioDraftAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'updated_at', 'version')
    search_fields = ('usuario__username', 'usuario__name')
    readonly_fields = ('updated_at',)


@admin.register(PagadorNd)
class PagadorNdAdmin(admin.ModelAdmin):
    list_display = ('cod_cliente', 'nome', 'criado_por', 'criado_em')
    search_fields = ('cod_cliente', 'nome')
    readonly_fields = ('criado_em',)


@admin.register(TituloNd)
class TituloNdAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'cod_cliente', 'cliente', 'filial', 'natureza', 'vencimento_real', 'saldo', 'baixado')
    list_filter = ('baixado', 'natureza', 'filial')
    search_fields = ('titulo', 'cod_cliente', 'cliente', 'historico', 'chave')
    readonly_fields = ('atualizado_em',)
