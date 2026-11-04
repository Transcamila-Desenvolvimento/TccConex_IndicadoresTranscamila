from django.conf import settings
from django.db import models

from apps.accounts.constants import branches_for_module


FILIAL_CHOICES = [(nome, nome) for nome in branches_for_module('Frota')]


class RespostaOlhoVivo(models.Model):
    PERIODICIDADE_MENSAL = 'mensal'
    PERIODICIDADE_ANUAL = 'anual'
    PERIODICIDADE_CHOICES = [
        (PERIODICIDADE_MENSAL, 'Mensal'),
        (PERIODICIDADE_ANUAL, 'Anual'),
    ]

    filial = models.CharField(max_length=80, choices=FILIAL_CHOICES, verbose_name='Filial')
    periodicidade = models.CharField(max_length=10, choices=PERIODICIDADE_CHOICES)
    ano = models.PositiveSmallIntegerField()
    mes = models.PositiveSmallIntegerField(null=True, blank=True)
    period_key = models.CharField(max_length=7)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='respostas_olho_vivo',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-ano', '-mes']
        unique_together = [('filial', 'period_key')]
        verbose_name = 'Resposta Olho vivo na estrada'
        verbose_name_plural = 'Respostas Olho vivo na estrada'

    def __str__(self):
        return f'{self.filial} {self.period_key}'


class ItemRespostaOlhoVivo(models.Model):
    resposta = models.ForeignKey(RespostaOlhoVivo, on_delete=models.CASCADE, related_name='itens')
    comportamento = models.CharField(max_length=40)
    recorrencia = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [('resposta', 'comportamento')]
        ordering = ['comportamento']
