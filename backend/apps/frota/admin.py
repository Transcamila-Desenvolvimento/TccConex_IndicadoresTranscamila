from django.contrib import admin

from .models import ItemRespostaOlhoVivo, RespostaOlhoVivo


class ItemRespostaOlhoVivoInline(admin.TabularInline):
    model = ItemRespostaOlhoVivo
    extra = 0


@admin.register(RespostaOlhoVivo)
class RespostaOlhoVivoAdmin(admin.ModelAdmin):
    list_display = ('filial', 'periodicidade', 'ano', 'mes', 'period_key', 'updated_by', 'updated_at')
    list_filter = ('filial', 'periodicidade', 'ano')
    search_fields = ('filial', 'period_key')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [ItemRespostaOlhoVivoInline]


@admin.register(ItemRespostaOlhoVivo)
class ItemRespostaOlhoVivoAdmin(admin.ModelAdmin):
    list_display = ('resposta', 'comportamento', 'recorrencia')
    list_filter = ('comportamento',)
    search_fields = ('comportamento',)
