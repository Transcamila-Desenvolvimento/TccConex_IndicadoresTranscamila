from rest_framework import serializers

from .billing_import_service import BILLING_BRANCHES
from .constants import NOTA_PAGA_JUSTIFICATIVAS, OCORRENCIA_FILIAIS
from .models import (
    AgingTitulo,
    BalanceHistoryEntry,
    BankAccount,
    BillingRecord,
    CashAdjustment,
    GnreIcmsOcorrencia,
    NotaPagaSemLancamento,
    OpsRecebidaOcorrencia,
    PagarTitulo,
    ReceberTitulo,
    ReportBatch,
)


def _validate_ocorrencia_filial(filial: str | None):
    if filial and filial not in OCORRENCIA_FILIAIS:
        raise serializers.ValidationError(
            {'filial': f'Filial inválida. Use uma de: {", ".join(OCORRENCIA_FILIAIS)}.'}
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


class OpsRecebidaOcorrenciaSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)
    dataPagamento = serializers.DateField(source='data_pagamento', format='%Y-%m-%d')
    mdfeEncerrado = serializers.BooleanField(source='mdfe_encerrado')

    class Meta:
        model = OpsRecebidaOcorrencia
        fields = ['id', 'filial', 'contrato', 'dataPagamento', 'mdfeEncerrado']

    def validate(self, attrs):
        filial = attrs.get('filial') or getattr(self.instance, 'filial', None)
        _validate_ocorrencia_filial(filial)
        return attrs


class GnreIcmsOcorrenciaSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)
    valorGuia = serializers.DecimalField(source='valor_guia', max_digits=14, decimal_places=2)
    periodoReferencia = serializers.CharField(source='periodo_referencia', max_length=20)
    dataPagamento = serializers.DateField(source='data_pagamento', format='%Y-%m-%d')

    class Meta:
        model = GnreIcmsOcorrencia
        fields = [
            'id', 'filial', 'cte', 'valorGuia', 'periodoReferencia',
            'dataPagamento', 'validada',
        ]

    def validate(self, attrs):
        filial = attrs.get('filial') or getattr(self.instance, 'filial', None)
        _validate_ocorrencia_filial(filial)
        periodo = attrs.get('periodo_referencia') or getattr(self.instance, 'periodo_referencia', None)
        if periodo and len(str(periodo).strip()) < 4:
            raise serializers.ValidationError(
                {'periodoReferencia': 'Informe o período de referência (ex.: 2025-08).'}
            )
        return attrs


class NotaPagaSemLancamentoSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)
    dataEmissao = serializers.DateField(source='data_emissao', format='%Y-%m-%d')
    envioProvisaoLuft = serializers.DateField(
        source='envio_provisao_luft', format='%Y-%m-%d', required=False, allow_null=True,
    )
    dataPagamento = serializers.DateField(source='data_pagamento', format='%Y-%m-%d')

    class Meta:
        model = NotaPagaSemLancamento
        fields = [
            'id', 'filial', 'nfs', 'fornecedor', 'valor', 'dataEmissao',
            'envioProvisaoLuft', 'dataPagamento', 'justificativa',
        ]

    def validate(self, attrs):
        filial = attrs.get('filial') or getattr(self.instance, 'filial', None)
        _validate_ocorrencia_filial(filial)
        justificativa = attrs.get('justificativa') or getattr(self.instance, 'justificativa', None)
        if justificativa and justificativa not in NOTA_PAGA_JUSTIFICATIVAS:
            raise serializers.ValidationError(
                {
                    'justificativa': (
                        f'Justificativa inválida. Use uma de: {", ".join(NOTA_PAGA_JUSTIFICATIVAS)}.'
                    )
                }
            )
        return attrs
