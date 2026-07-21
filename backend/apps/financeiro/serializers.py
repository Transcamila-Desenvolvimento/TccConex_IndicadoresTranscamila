from rest_framework import serializers

from .billing_import_service import BILLING_BRANCHES
from .models import (
    AgingTitulo,
    BalanceHistoryEntry,
    BankAccount,
    BillingRecord,
    CalendarioEvento,
    CashAdjustment,
    PagarTitulo,
    ReceberTitulo,
    ReportBatch,
)


class ReportBatchSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    date = serializers.DateField(source='reference_date', format='%d/%m/%Y', read_only=True)
    updatedBy = serializers.SerializerMethodField()
    importedReports = serializers.SerializerMethodField()
    isActive = serializers.BooleanField(source='is_active')

    class Meta:
        model = ReportBatch
        fields = ['id', 'label', 'date', 'updatedBy', 'importedReports', 'isActive']

    def get_updatedBy(self, obj):
        return obj.updated_by.name if obj.updated_by else 'Sistema'

    def get_importedReports(self, obj):
        return {
            'pagar': obj.imported_pagar,
            'receber': obj.imported_receber,
            'aging': obj.imported_aging,
        }


class PagarTituloSerializer(serializers.ModelSerializer):
    codForn = serializers.CharField(source='cod_forn')
    vencimentoReal = serializers.CharField(source='vencimento_real')

    class Meta:
        model = PagarTitulo
        fields = [
            'id', 'filial', 'codForn', 'fornecedor', 'titulo', 'tipo',
            'emissao', 'vencimento', 'vencimentoReal', 'valor', 'saldo', 'historico',
        ]


class ReceberTituloSerializer(serializers.ModelSerializer):
    codCliente = serializers.CharField(source='cod_cliente')
    vencimentoReal = serializers.CharField(source='vencimento_real')

    class Meta:
        model = ReceberTitulo
        fields = [
            'id', 'filial', 'codCliente', 'cliente', 'titulo', 'natureza',
            'emissao', 'vencimento', 'vencimentoReal', 'valor', 'saldo', 'historico',
        ]


class AgingTituloSerializer(serializers.ModelSerializer):
    codCliente = serializers.CharField(source='cod_cliente')

    class Meta:
        model = AgingTitulo
        fields = [
            'id', 'origem', 'codCliente', 'cliente', 'loja', 'docto', 'serie',
            'tipo', 'emissao', 'vencimento', 'regiao', 'total',
        ]


class BillingRecordSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)
    date = serializers.DateField(source='reference_date', format='%Y-%m-%d')
    notesCount = serializers.IntegerField(source='notes_count', min_value=0)
    trend = serializers.SerializerMethodField()

    class Meta:
        model = BillingRecord
        fields = ['id', 'date', 'branch', 'value', 'notesCount', 'trend']

    def get_trend(self, obj):
        from .list_filters import billing_trend
        return billing_trend(obj)

    def validate(self, attrs):
        ref_date = attrs.get('reference_date') or getattr(self.instance, 'reference_date', None)
        branch = attrs.get('branch') or getattr(self.instance, 'branch', None)
        if branch and branch not in BILLING_BRANCHES:
            raise serializers.ValidationError(
                {'branch': f'Filial inválida. Use uma de: {", ".join(BILLING_BRANCHES)}.'}
            )
        if ref_date and branch:
            qs = BillingRecord.objects.filter(reference_date=ref_date, branch=branch)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    'Já existe faturamento registrado para esta filial nesta data.'
                )
        return attrs


class CashAdjustmentSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)
    date = serializers.DateField(source='reference_date', format='%Y-%m-%d')
    type = serializers.CharField(source='adjustment_type')
    user = serializers.CharField(source='created_by')
    observation = serializers.CharField(required=False, allow_blank=True, default='')

    class Meta:
        model = CashAdjustment
        fields = ['id', 'date', 'type', 'value', 'observation', 'user']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user.username
        return super().create(validated_data)


class BankAccountSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)
    type = serializers.CharField(source='account_type')
    lastUpdated = serializers.CharField(source='last_updated', required=False, default='--/--/----')
    creditLimit = serializers.DecimalField(
        source='credit_limit', max_digits=14, decimal_places=2, required=False, default=0,
    )
    balance = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = BankAccount
        fields = ['id', 'bank', 'agency', 'number', 'type', 'balance', 'creditLimit', 'lastUpdated']


class CalendarioEventoSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)
    date = serializers.DateField(source='data', format='%Y-%m-%d')
    title = serializers.CharField(source='titulo', max_length=200)
    description = serializers.CharField(source='descricao', required=False, allow_blank=True, default='')
    color = serializers.CharField(source='cor', required=False, default='azul')

    class Meta:
        model = CalendarioEvento
        fields = ['id', 'date', 'title', 'description', 'color']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['usuario'] = request.user
        return super().create(validated_data)


class BalanceHistoryEntrySerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)
    accountId = serializers.PrimaryKeyRelatedField(
        source='account', queryset=BankAccount.objects.all()
    )
    date = serializers.DateField(source='reference_date', format='%Y-%m-%d')
    type = serializers.CharField(source='entry_type')

    class Meta:
        model = BalanceHistoryEntry
        fields = ['id', 'accountId', 'date', 'bank', 'number', 'type', 'value']
