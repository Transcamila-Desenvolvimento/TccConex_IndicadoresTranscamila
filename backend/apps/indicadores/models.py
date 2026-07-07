from django.db import models


class IndicadorKpi(models.Model):
    label = models.CharField(max_length=100)
    value = models.CharField(max_length=50)
    change = models.CharField(max_length=20)
    up = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.label


class IndicadorFilial(models.Model):
    filial = models.CharField(max_length=100)
    receita = models.CharField(max_length=50)
    fretes = models.PositiveIntegerField()
    toneladas = models.CharField(max_length=20)
    meta = models.CharField(max_length=20)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.filial


class GerencialSnapshot(models.Model):
    """Snapshot congelado no envio do e-mail gerencial (não muda com reimportação de lote)."""

    reference_date = models.DateField(unique=True, verbose_name='Data de referência')
    batch_label = models.CharField(max_length=20, blank=True)

    fat_dia = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    fat_mes = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    fat_ano = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    saldo_banco = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    duplicatas_a_receber = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    ctas_rec_atrasadas = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    ctes_emitidos = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    a_disponibilizar = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    contas_pagar_ate_corte = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    pagar_cutoff_date = models.DateField(null=True, blank=True)
    ctas_pag_atrasadas = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    saidas_previstas = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    posicao_gerencial = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    caixa_positivo_ate = models.CharField(max_length=20, blank=True)
    sent_by = models.CharField(max_length=100, blank=True)
    sent_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-reference_date']
        verbose_name = 'Snapshot gerencial'
        verbose_name_plural = 'Snapshots gerenciais'

    def __str__(self):
        return f'Gerencial {self.reference_date:%d/%m/%Y}'
