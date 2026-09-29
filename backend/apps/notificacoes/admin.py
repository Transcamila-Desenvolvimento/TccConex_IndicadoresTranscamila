from django.contrib import admin

from .models import Notificacao, PushInscricao


@admin.register(Notificacao)
class NotificacaoAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'usuario', 'tipo', 'ambiente', 'criada_em', 'lida_em')
    list_filter = ('tipo', 'ambiente')
    search_fields = ('titulo', 'mensagem', 'usuario__username', 'usuario__name')


@admin.register(PushInscricao)
class PushInscricaoAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'user_agent', 'criada_em', 'atualizada_em')
    search_fields = ('usuario__username', 'usuario__name', 'user_agent')
