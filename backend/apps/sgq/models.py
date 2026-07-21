from django.db import models

AVALIACAO_CHOICES = [
    ('otimo', 'Ótimo'),
    ('bom', 'Bom'),
    ('regular', 'Regular'),
    ('ruim', 'Ruim'),
]

CLIENTE_CHOICES = [
    ('CCAB', 'CCAB'),
    ('PRENTISS', 'PRENTISS'),
    ('ALBAUGH', 'ALBAUGH'),
    ('UPL', 'UPL'),
    ('OUTROS', 'OUTROS'),
]

# Campos de avaliação da pesquisa (chave do model → rótulo exibido).
CRITERIOS_AVALIACAO = [
    ('prazo_entrega', 'Prazo de Entrega'),
    ('condicoes_mercadoria', 'Condições da Mercadoria'),
    ('condicoes_veiculo', 'Condições do Veículo'),
    ('apresentacao_motorista', 'Apresentação do Motorista'),
    ('atendimento_dispensado', 'Atendimento Dispensado'),
]


class PesquisaSatisfacao(models.Model):
    """Pesquisa de satisfação por entrega — módulo Gestão da Qualidade (SGQ)."""

    motorista = models.CharField(max_length=255, verbose_name='Motorista')
    cte = models.CharField(max_length=50, verbose_name='CT-e')
    data = models.DateField(verbose_name='Data')
    nota_fiscal = models.CharField(max_length=50, verbose_name='Nota Fiscal')
    cliente = models.CharField(max_length=20, choices=CLIENTE_CHOICES, default='OUTROS', verbose_name='Cliente')

    prazo_entrega = models.CharField(max_length=10, choices=AVALIACAO_CHOICES, verbose_name='Prazo de Entrega')
    condicoes_mercadoria = models.CharField(max_length=10, choices=AVALIACAO_CHOICES, verbose_name='Condições da Mercadoria')
    condicoes_veiculo = models.CharField(max_length=10, choices=AVALIACAO_CHOICES, verbose_name='Condições do Veículo')
    apresentacao_motorista = models.CharField(max_length=10, choices=AVALIACAO_CHOICES, verbose_name='Apresentação do Motorista')
    atendimento_dispensado = models.CharField(max_length=10, choices=AVALIACAO_CHOICES, verbose_name='Atendimento Dispensado')

    analise = models.TextField(blank=True, default='', verbose_name='Análise')
    tratativa_justificativa = models.TextField(blank=True, default='', verbose_name='Tratativa e Justificativa')

    criado_por = models.CharField(max_length=150, blank=True, default='', verbose_name='Criado por')
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Pesquisa de Satisfação'
        verbose_name_plural = 'Pesquisas de Satisfação'
        ordering = ['-data', '-id']

    def __str__(self):
        return f'{self.cliente} — CT-e {self.cte} ({self.data})'
