from django.contrib import admin

from .models import ClienteProtocolo, ProtocoloEnvio, ProtocoloEnvioDraft

admin.site.register(ClienteProtocolo)
admin.site.register(ProtocoloEnvio)


@admin.register(ProtocoloEnvioDraft)
class ProtocoloEnvioDraftAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'updated_at', 'version')
    search_fields = ('usuario__username', 'usuario__name')
    readonly_fields = ('updated_at',)
