from django.contrib import admin

from .models import CampanhaComentario, CampanhaMarketing, CampanhaMembro, CampanhaMidia


class CampanhaMembroInline(admin.TabularInline):
    model = CampanhaMembro
    fk_name = 'campanha'
    extra = 0


class CampanhaMidiaInline(admin.TabularInline):
    model = CampanhaMidia
    extra = 0


@admin.register(CampanhaMarketing)
class CampanhaMarketingAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'status', 'data_inicio', 'data_fim', 'responsavel', 'ordem_kanban', 'data_atualizacao')
    list_filter = ('status',)
    search_fields = ('titulo', 'descricao', 'responsavel', 'criado_por')
    readonly_fields = ('data_criacao', 'data_atualizacao')
    inlines = [CampanhaMembroInline, CampanhaMidiaInline]


@admin.register(CampanhaComentario)
class CampanhaComentarioAdmin(admin.ModelAdmin):
    list_display = ('campanha', 'autor_nome', 'autor_user', 'data_criacao')
    search_fields = ('texto', 'autor_nome', 'campanha__titulo')
    filter_horizontal = ('mencoes',)
    readonly_fields = ('data_criacao',)


@admin.register(CampanhaMembro)
class CampanhaMembroAdmin(admin.ModelAdmin):
    list_display = ('campanha', 'user', 'adicionado_por', 'data_criacao')
    search_fields = ('campanha__titulo', 'user__username', 'user__name')
    readonly_fields = ('data_criacao',)


@admin.register(CampanhaMidia)
class CampanhaMidiaAdmin(admin.ModelAdmin):
    list_display = ('campanha', 'drive_file_id', 'ordem', 'adicionado_por', 'data_criacao')
    search_fields = ('campanha__titulo', 'drive_file_id')
    readonly_fields = ('data_criacao',)
