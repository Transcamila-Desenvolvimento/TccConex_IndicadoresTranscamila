from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'username', 'action')
    list_filter = ('action',)
    search_fields = ('username', 'action', 'details')
    readonly_fields = ('created_at',)
