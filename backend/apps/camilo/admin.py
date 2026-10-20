from django.contrib import admin

from .models import (
    Agente,
    ChatPadrao,
    DocumentoMatrizEmpresarial,
    PastaMatrizEmpresarial,
    TermoAceite,
    TermoVersao,
)


@admin.register(Agente)
class AgenteAdmin(admin.ModelAdmin):
    list_display = ('nome', 'usuario', 'criado_em', 'atualizado_em')
    search_fields = ('nome', 'usuario__username', 'usuario__name')
    readonly_fields = ('criado_em', 'atualizado_em')


@admin.register(ChatPadrao)
class ChatPadraoAdmin(admin.ModelAdmin):
    list_display = ('id', 'nome')


@admin.register(TermoVersao)
class TermoVersaoAdmin(admin.ModelAdmin):
    list_display = ('numero', 'titulo', 'vigente', 'criado_por', 'criado_em')
    list_filter = ('vigente',)
    search_fields = ('titulo',)
    readonly_fields = ('criado_em',)


@admin.register(TermoAceite)
class TermoAceiteAdmin(admin.ModelAdmin):
    list_display = ('username', 'nome', 'cpf', 'versao', 'ip', 'aceito_em')
    list_filter = ('versao',)
    search_fields = ('username', 'nome', 'cpf')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PastaMatrizEmpresarial)
class PastaMatrizEmpresarialAdmin(admin.ModelAdmin):
    list_display = ('nome', 'parent', 'criado_em')
    search_fields = ('nome',)
    readonly_fields = ('criado_em',)


@admin.register(DocumentoMatrizEmpresarial)
class DocumentoMatrizEmpresarialAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'pasta', 'nome_original', 'tamanho', 'texto_extraido', 'incluido_por', 'criado_em')
    list_filter = ('texto_extraido', 'pasta')
    search_fields = ('titulo', 'nome_original')
    readonly_fields = ('criado_em',)
