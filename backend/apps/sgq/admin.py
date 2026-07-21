from django.contrib import admin

from .models import PesquisaSatisfacao


@admin.register(PesquisaSatisfacao)
class PesquisaSatisfacaoAdmin(admin.ModelAdmin):
    list_display = ('id', 'data', 'cliente', 'motorista', 'cte', 'nota_fiscal')
    list_filter = ('cliente', 'prazo_entrega')
    search_fields = ('motorista', 'cte', 'nota_fiscal')
