from django.conf import settings
from django.db import models


class ReportBatch(models.Model):
    label = models.CharField(max_length=20)
    reference_date = models.DateField()
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='report_batches',
    )
    is_active = models.BooleanField(default=False)
    imported_pagar = models.BooleanField(default=False)
    imported_receber = models.BooleanField(default=False)
    imported_aging = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-reference_date', '-created_at']

    def __str__(self):
        return self.label


class PagarTitulo(models.Model):
    batch = models.ForeignKey(ReportBatch, on_delete=models.CASCADE, related_name='pagar_rows')
    filial = models.CharField(max_length=100)
    cod_forn = models.CharField(max_length=50)
    fornecedor = models.CharField(max_length=200)
    titulo = models.CharField(max_length=50)
    tipo = models.CharField(max_length=20)
    emissao = models.CharField(max_length=20)
    vencimento = models.CharField(max_length=20)
    vencimento_real = models.CharField(max_length=20)
    valor = models.DecimalField(max_digits=14, decimal_places=2)
    saldo = models.DecimalField(max_digits=14, decimal_places=2)
    historico = models.CharField(max_length=500, blank=True)
    pr_desconsiderada = models.BooleanField(default=False, verbose_name='PR desconsiderada')

    class Meta:
        ordering = ['filial', 'titulo']


class ReceberTitulo(models.Model):
    batch = models.ForeignKey(ReportBatch, on_delete=models.CASCADE, related_name='receber_rows')
    filial = models.CharField(max_length=100)
    cod_cliente = models.CharField(max_length=50)
    cliente = models.CharField(max_length=200)
    titulo = models.CharField(max_length=50)
    natureza = models.CharField(max_length=20)
    emissao = models.CharField(max_length=20)
    vencimento = models.CharField(max_length=20)
    vencimento_real = models.CharField(max_length=20)
    valor = models.DecimalField(max_digits=14, decimal_places=2)
    saldo = models.DecimalField(max_digits=14, decimal_places=2)
    historico = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ['filial', 'titulo']


class AgingTitulo(models.Model):
    batch = models.ForeignKey(ReportBatch, on_delete=models.CASCADE, related_name='aging_rows')
    origem = models.CharField(max_length=100)
    cod_cliente = models.CharField(max_length=50)
    cliente = models.CharField(max_length=200)
    loja = models.CharField(max_length=20)
    docto = models.CharField(max_length=50)
    serie = models.CharField(max_length=20)
    tipo = models.CharField(max_length=20)
    emissao = models.CharField(max_length=20)
    vencimento = models.CharField(max_length=20)
    regiao = models.CharField(max_length=50)
    total = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        ordering = ['origem', 'docto']


class BillingRecord(models.Model):
    reference_date = models.DateField()
    branch = models.CharField(max_length=50)
    value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    notes_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-reference_date', 'branch']
        unique_together = [('reference_date', 'branch')]


class CashAdjustment(models.Model):
    reference_date = models.DateField()
    adjustment_type = models.CharField(max_length=20)
    value = models.DecimalField(max_digits=14, decimal_places=2)
    observation = models.TextField()
    created_by = models.CharField(max_length=100)

    class Meta:
        ordering = ['-reference_date', '-id']


class BankAccount(models.Model):
    bank = models.CharField(max_length=100)
    agency = models.CharField(max_length=30)
    number = models.CharField(max_length=30)
    account_type = models.CharField(max_length=30)
    balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    credit_limit = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    last_updated = models.CharField(max_length=30, default='--/--/----')

    class Meta:
        ordering = ['bank', 'number']


class BalanceHistoryEntry(models.Model):
    account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name='history_entries')
    reference_date = models.DateField()
    bank = models.CharField(max_length=100)
    number = models.CharField(max_length=30)
    entry_type = models.CharField(max_length=30)
    value = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        ordering = ['-reference_date', '-id']


class OpsRecebidaOcorrencia(models.Model):
    filial = models.CharField(max_length=50)
    contrato = models.CharField(max_length=50)
    data_pagamento = models.DateField()
    mdfe_encerrado = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-data_pagamento', '-id']
        verbose_name = 'OP recebida (ocorrência)'
        verbose_name_plural = 'OPs recebidas (ocorrências)'

    def __str__(self):
        return f'{self.filial} / {self.contrato}'


class GnreIcmsOcorrencia(models.Model):
    filial = models.CharField(max_length=50)
    cte = models.CharField(max_length=50)
    valor_guia = models.DecimalField(max_digits=14, decimal_places=2)
    periodo_referencia = models.CharField(max_length=20)
    data_pagamento = models.DateField()
    validada = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-data_pagamento', '-id']
        verbose_name = 'GNRE-ICMS (ocorrência)'
        verbose_name_plural = 'GNRE-ICMS (ocorrências)'

    def __str__(self):
        return f'{self.filial} / CT-e {self.cte}'


class NotaPagaSemLancamento(models.Model):
    filial = models.CharField(max_length=50)
    nfs = models.CharField(max_length=50)
    fornecedor = models.CharField(max_length=200)
    valor = models.DecimalField(max_digits=14, decimal_places=2)
    data_emissao = models.DateField()
    envio_provisao_luft = models.DateField(null=True, blank=True)
    data_pagamento = models.DateField()
    justificativa = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-data_pagamento', '-id']
        verbose_name = 'Nota paga sem lançamento'
        verbose_name_plural = 'Notas pagas sem lançamento'

    def __str__(self):
        return f'{self.filial} / NFS {self.nfs}'
