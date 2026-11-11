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


class UsuarioMotorista(models.Model):
    """Acesso do aplicativo de motoristas, ligado a um funcionário do quadro."""

    funcionario = models.OneToOneField(
        'rh.FuncionarioQuadro',
        on_delete=models.PROTECT,
        related_name='usuario_motorista',
        verbose_name='Funcionário',
    )
    username = models.CharField(max_length=80, unique=True, verbose_name='Usuário')
    password = models.CharField(max_length=128, verbose_name='Senha')
    criado_em = models.DateTimeField(auto_now_add=True)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='usuarios_motorista_criados',
    )

    class Meta:
        ordering = ['funcionario__nome']
        verbose_name = 'Usuário motorista'
        verbose_name_plural = 'Usuários motoristas'

    def __str__(self):
        return self.username


class ParametroBonificacao(models.Model):
    """Regra geral da nota mensal. Existe um único registro."""

    nota_inicial = models.DecimalField(max_digits=6, decimal_places=2, default=100)
    valor_bonus = models.DecimalField(max_digits=12, decimal_places=2, default=500)
    limitar_por_grupo = models.BooleanField(
        default=True,
        help_text='O desconto de um grupo não passa do teto dele.',
    )

    class Meta:
        verbose_name = 'Parâmetro de bonificação'
        verbose_name_plural = 'Parâmetros de bonificação'


class FaixaBonificacao(models.Model):
    INTEGRAL = 'integral'
    PROPORCIONAL = 'proporcional'
    PERCENTUAL = 'percentual'
    ZERO = 'zero'
    MODO_CHOICES = [
        (INTEGRAL, '100% do bônus'),
        (PROPORCIONAL, 'Proporcional à nota'),
        (PERCENTUAL, 'Percentual fixo'),
        (ZERO, 'Sem bônus'),
    ]

    nota_min = models.DecimalField(max_digits=6, decimal_places=2)
    nota_max = models.DecimalField(max_digits=6, decimal_places=2)
    modo = models.CharField(max_length=20, choices=MODO_CHOICES)
    percentual = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    ordem = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['-nota_min', 'ordem']
        verbose_name = 'Faixa de bonificação'
        verbose_name_plural = 'Faixas de bonificação'


class GrupoCriterioDesempenho(models.Model):
    nome = models.CharField(max_length=80)
    pontos_maximos = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    ordem = models.PositiveSmallIntegerField(default=0)
    ativo = models.BooleanField(default=True)

    class Meta:
        ordering = ['ordem', 'id']
        verbose_name = 'Grupo de critério'
        verbose_name_plural = 'Grupos de critério'

    def __str__(self):
        return self.nome


class CriterioDesempenho(models.Model):
    grupo = models.ForeignKey(
        GrupoCriterioDesempenho,
        on_delete=models.CASCADE,
        related_name='criterios',
    )
    nome = models.CharField(max_length=120)
    descricao = models.TextField(blank=True, default='')
    pontos = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    zera_bonus = models.BooleanField(default=False)
    ativo = models.BooleanField(default=True)
    ordem = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['grupo__ordem', 'ordem', 'id']
        verbose_name = 'Critério de desempenho'
        verbose_name_plural = 'Critérios de desempenho'

    def __str__(self):
        return self.nome


class OcorrenciaDesempenho(models.Model):
    funcionario = models.ForeignKey(
        'rh.FuncionarioQuadro',
        on_delete=models.PROTECT,
        related_name='ocorrencias_desempenho',
    )
    criterio = models.ForeignKey(
        CriterioDesempenho,
        on_delete=models.PROTECT,
        related_name='ocorrencias',
    )
    filial = models.CharField(max_length=100)
    data = models.DateField()
    quantidade = models.PositiveSmallIntegerField(default=1)
    observacao = models.CharField(max_length=240, blank=True, default='')
    criado_em = models.DateTimeField(auto_now_add=True)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='ocorrencias_desempenho_criadas',
    )

    class Meta:
        ordering = ['-data', '-id']
        verbose_name = 'Ocorrência de desempenho'
        verbose_name_plural = 'Ocorrências de desempenho'


class ItemRespostaOlhoVivo(models.Model):
    resposta = models.ForeignKey(RespostaOlhoVivo, on_delete=models.CASCADE, related_name='itens')
    comportamento = models.CharField(max_length=40)
    recorrencia = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [('resposta', 'comportamento')]
        ordering = ['comportamento']
