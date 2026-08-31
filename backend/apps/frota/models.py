import re
from datetime import date

from django.conf import settings
from django.db import models

from apps.accounts.constants import ALL_BRANCHES


CATEGORIA_TANQUE = 'tanque'
CATEGORIA_TESTE = 'teste'
CATEGORIA_TOCO = 'toco'
CATEGORIA_TRAFIC = 'trafic'
CATEGORIA_TRUCK = 'truck'
CATEGORIA_VAN = 'van'
CATEGORIA_VAN_01_EIXOS = 'van-01-eixos'
CATEGORIA_VUC = 'vuc'

CATEGORIA_CHOICES = [
    (CATEGORIA_TANQUE, 'Tanque'),
    (CATEGORIA_TESTE, 'Teste'),
    (CATEGORIA_TOCO, 'Toco'),
    (CATEGORIA_TRAFIC, 'Trafic'),
    (CATEGORIA_TRUCK, 'Truck'),
    (CATEGORIA_VAN, 'Van'),
    (CATEGORIA_VAN_01_EIXOS, 'Van 01 eixos'),
    (CATEGORIA_VUC, 'VUC'),
]

COMBUSTIVEL_ARLA_32 = 'arla-32'
COMBUSTIVEL_DIESEL_BS_500 = 'diesel-bs-500'
COMBUSTIVEL_DIESEL_BS_500_ITAPEVI = 'diesel-bs-500-itapevi'
COMBUSTIVEL_DIESEL_S10 = 'diesel-s10'
COMBUSTIVEL_ELETRICA = 'eletrica'
COMBUSTIVEL_ETANOL = 'etanol'
COMBUSTIVEL_FLEX = 'flex'
COMBUSTIVEL_GASOLINA = 'gasolina'

COMBUSTIVEL_CHOICES = [
    (COMBUSTIVEL_ARLA_32, 'Arla 32'),
    (COMBUSTIVEL_DIESEL_BS_500, 'Diesel BS 500'),
    (COMBUSTIVEL_DIESEL_BS_500_ITAPEVI, 'Diesel BS 500 Itapevi'),
    (COMBUSTIVEL_DIESEL_S10, 'Diesel S-10'),
    (COMBUSTIVEL_ELETRICA, 'Elétrica'),
    (COMBUSTIVEL_ETANOL, 'Etanol'),
    (COMBUSTIVEL_FLEX, 'Flex'),
    (COMBUSTIVEL_GASOLINA, 'Gasolina'),
]

CARROCERIA_BAU = 'bau'
CARROCERIA_BITREM = 'bitrem'
CARROCERIA_CARRETA = 'carreta'
CARROCERIA_FECHADA = 'carroceria-fechada'
CARROCERIA_CAVALO = 'cavalo-mecanico'
CARROCERIA_DOLLY = 'dolly'
CARROCERIA_EMPILHADEIRA_ELETRICA = 'empilhadeira-eletrica'
CARROCERIA_EMPILHADEIRA_GLP = 'empilhadeira-glp'

CARROCERIA_CHOICES = [
    (CARROCERIA_BAU, 'Baú'),
    (CARROCERIA_BITREM, 'Bitrem'),
    (CARROCERIA_CARRETA, 'Carreta'),
    (CARROCERIA_FECHADA, 'Carroceria fechada'),
    (CARROCERIA_CAVALO, 'Cavalo mecânico'),
    (CARROCERIA_DOLLY, 'Dolly'),
    (CARROCERIA_EMPILHADEIRA_ELETRICA, 'Empilhadeira elétrica'),
    (CARROCERIA_EMPILHADEIRA_GLP, 'Empilhadeira GLP'),
]

STATUS_ATIVO = 'ativo'
STATUS_INATIVO = 'inativo'
STATUS_CHOICES = [
    (STATUS_ATIVO, 'Ativo'),
    (STATUS_INATIVO, 'Inativo'),
]

FILIAL_CHOICES = [(nome, nome) for nome in ALL_BRANCHES]

_PLACA_RE = re.compile(r'^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$')


def normalize_placa(value: str) -> str:
    return re.sub(r'[^A-Za-z0-9]', '', value or '').upper()


def format_placa(value: str) -> str:
    placa = normalize_placa(value)
    if len(placa) == 7:
        return f'{placa[:3]}-{placa[3:]}'
    return placa


def placa_valida(value: str) -> bool:
    return bool(_PLACA_RE.fullmatch(normalize_placa(value)))


def ano_valido(value: int | None) -> bool:
    if value is None:
        return True
    return 1950 <= value <= date.today().year + 1


class VeiculoFrota(models.Model):
    placa = models.CharField(max_length=8, unique=True, verbose_name='Placa')
    renavam = models.CharField(max_length=20, blank=True, default='', verbose_name='RENAVAM')
    chassi = models.CharField(max_length=30, blank=True, default='', verbose_name='Chassi')
    marca = models.CharField(max_length=80, verbose_name='Marca')
    modelo = models.CharField(max_length=120, verbose_name='Modelo')
    ano_fabricacao = models.PositiveIntegerField(null=True, blank=True, verbose_name='Ano de fabricação')
    ano_modelo = models.PositiveIntegerField(null=True, blank=True, verbose_name='Ano modelo')
    cor = models.CharField(max_length=40, blank=True, default='', verbose_name='Cor')
    combustivel = models.CharField(
        max_length=40,
        choices=COMBUSTIVEL_CHOICES,
        default=COMBUSTIVEL_DIESEL_S10,
        verbose_name='Combustível',
    )
    categoria = models.CharField(
        max_length=40,
        choices=CATEGORIA_CHOICES,
        default=CATEGORIA_TRUCK,
        verbose_name='Tipo de veículo',
    )
    tipo_carroceria = models.CharField(
        max_length=40,
        choices=CARROCERIA_CHOICES,
        default=CARROCERIA_BAU,
        verbose_name='Tipo de carroceria',
    )
    hodometro = models.PositiveIntegerField(default=0, verbose_name='Hodômetro (km)')
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default=STATUS_ATIVO,
        verbose_name='Status',
    )
    filial = models.CharField(max_length=80, choices=FILIAL_CHOICES, verbose_name='Filial')
    observacoes = models.TextField(blank=True, default='', verbose_name='Observações')
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['placa']
        verbose_name = 'Veículo da frota'
        verbose_name_plural = 'Veículos da frota'

    def __str__(self):
        return f'{format_placa(self.placa)} — {self.marca} {self.modelo}'


def normalize_cpf(value: str) -> str:
    return re.sub(r'\D', '', value or '')[:11]


def format_cpf(value: str) -> str:
    digits = normalize_cpf(value)
    if len(digits) != 11:
        return digits
    return f'{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}'


class CondutorFrota(models.Model):
    nome = models.CharField(max_length=150)
    cpf = models.CharField(max_length=11, unique=True, null=True, blank=True)
    filial = models.CharField(max_length=80, choices=FILIAL_CHOICES)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_ATIVO)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['nome']
        verbose_name = 'Condutor'
        verbose_name_plural = 'Condutores'

    def __str__(self):
        if self.cpf:
            return f'{self.nome} ({format_cpf(self.cpf)})'
        return self.nome


class CustoFrotaLote(models.Model):
    label = models.CharField(max_length=40)
    periodo_inicio = models.DateField()
    periodo_fim = models.DateField()
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='lotes_custo_frota',
    )
    is_active = models.BooleanField(default=False)
    imported_manutencao = models.BooleanField(default=False)
    imported_abastecimento = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-periodo_inicio', '-created_at']
        unique_together = [('periodo_inicio', 'periodo_fim')]
        verbose_name = 'Lote de custos da frota'
        verbose_name_plural = 'Lotes de custos da frota'

    def __str__(self):
        return self.label


class CustoManutencaoLinha(models.Model):
    lote = models.ForeignKey(CustoFrotaLote, on_delete=models.CASCADE, related_name='manutencao_linhas')
    veiculo = models.ForeignKey(
        VeiculoFrota,
        on_delete=models.PROTECT,
        related_name='custos_manutencao',
    )
    placa = models.CharField(max_length=8)
    grupo = models.CharField(max_length=120, blank=True, default='')
    item = models.CharField(max_length=200)
    valor_material = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    valor_servicos = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    valor_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        ordering = ['placa', 'item']


class CustoAbastecimentoLinha(models.Model):
    lote = models.ForeignKey(CustoFrotaLote, on_delete=models.CASCADE, related_name='abastecimento_linhas')
    veiculo = models.ForeignKey(
        VeiculoFrota,
        on_delete=models.PROTECT,
        related_name='custos_abastecimento',
    )
    placa = models.CharField(max_length=8)
    transacao = models.CharField(max_length=40, blank=True, default='')
    data = models.DateField(null=True, blank=True)
    hora = models.CharField(max_length=20, blank=True, default='')
    estabelecimento = models.CharField(max_length=200, blank=True, default='')
    cidade = models.CharField(max_length=120, blank=True, default='')
    motorista = models.CharField(max_length=150, blank=True, default='')
    hodometro = models.PositiveIntegerField(null=True, blank=True)
    km_trecho = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='Km no trecho (Tempo em Operação)',
    )
    litragem = models.DecimalField(max_digits=12, decimal_places=3, null=True, blank=True)
    combustivel = models.CharField(max_length=40, blank=True, default='')
    valor_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    numero_nfe = models.CharField(max_length=40, blank=True, default='')

    class Meta:
        ordering = ['-data', 'placa']
