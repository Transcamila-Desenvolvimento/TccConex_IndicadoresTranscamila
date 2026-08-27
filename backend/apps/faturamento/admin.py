from django.contrib import admin

from .models import ClienteProtocolo, ProtocoloEnvio, ProtocoloEnvioDraft


@admin.register(ClienteProtocolo)
class ClienteProtocoloAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'loja', 'nome_interno', 'municipio', 'cnpj', 'padrao_protocolo')
    search_fields = ('codigo', 'loja', 'nome_interno', 'cnpj', 'municipio')
    list_filter = ('tipo_pessoa', 'padrao_protocolo', 'emitir_protocolo_canhotos')


admin.site.register(ProtocoloEnvio)


@admin.register(ProtocoloEnvioDraft)
class ProtocoloEnvioDraftAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'updated_at', 'version')
    search_fields = ('usuario__username', 'usuario__name')
    readonly_fields = ('updated_at',)
