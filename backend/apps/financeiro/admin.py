from django.contrib import admin

from .models import (
    AgingTitulo,
    BalanceHistoryEntry,
    BankAccount,
    BillingRecord,
    CaixinhaDescricao,
    CaixinhaLancamento,
    CalendarioEvento,
    CashAdjustment,
    PagarTitulo,
    ReceberTitulo,
    ReportBatch,
)

admin.site.register(ReportBatch)
admin.site.register(PagarTitulo)
admin.site.register(ReceberTitulo)
admin.site.register(AgingTitulo)


@admin.register(BillingRecord)
class BillingRecordAdmin(admin.ModelAdmin):
    list_display = ('reference_date', 'branch', 'value', 'notes_count')
    list_filter = ('branch',)
    search_fields = ('branch',)
    date_hierarchy = 'reference_date'


@admin.register(CashAdjustment)
class CashAdjustmentAdmin(admin.ModelAdmin):
    list_display = ('reference_date', 'adjustment_type', 'value', 'created_by')
    list_filter = ('adjustment_type',)
    search_fields = ('observation', 'created_by')
    date_hierarchy = 'reference_date'


@admin.register(CaixinhaLancamento)
class CaixinhaLancamentoAdmin(admin.ModelAdmin):
    list_display = ('reference_date', 'movement_type', 'description', 'value', 'created_by')
    list_filter = ('movement_type',)
    search_fields = ('description', 'created_by')
    date_hierarchy = 'reference_date'


@admin.register(CaixinhaDescricao)
class CaixinhaDescricaoAdmin(admin.ModelAdmin):
    list_display = ('description', 'movement_type', 'created_by')
    list_filter = ('movement_type',)
    search_fields = ('description',)


class BalanceHistoryEntryInline(admin.TabularInline):
    model = BalanceHistoryEntry
    extra = 0


@admin.register(BankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    list_display = ('bank', 'agency', 'number', 'account_type', 'balance', 'credit_limit', 'last_updated')
    list_filter = ('bank', 'account_type')
    search_fields = ('bank', 'agency', 'number')
    inlines = [BalanceHistoryEntryInline]


@admin.register(BalanceHistoryEntry)
class BalanceHistoryEntryAdmin(admin.ModelAdmin):
    list_display = ('reference_date', 'bank', 'number', 'entry_type', 'value', 'account')
    list_filter = ('entry_type', 'bank')
    search_fields = ('bank', 'number')
    date_hierarchy = 'reference_date'


@admin.register(CalendarioEvento)
class CalendarioEventoAdmin(admin.ModelAdmin):
    list_display = ('data', 'titulo', 'usuario', 'cor', 'updated_at')
    search_fields = ('titulo', 'descricao', 'usuario__username', 'usuario__name')
    date_hierarchy = 'data'
    readonly_fields = ('created_at', 'updated_at')
