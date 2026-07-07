from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import date


class Colaborador(models.Model):
    cpf = models.CharField(max_length=14, unique=True, verbose_name="C.P.F.")
    matricula = models.CharField(max_length=20, verbose_name="Matrícula")
    nome_completo = models.CharField(max_length=255, verbose_name="Nome Completo")
    empresa = models.CharField(max_length=100, null=True, blank=True)
    filial = models.CharField(max_length=100, null=True, blank=True)
    departamento = models.CharField(max_length=100, null=True, blank=True)
    cargo = models.CharField(max_length=100, null=True, blank=True)
    situacao = models.CharField(max_length=50, null=True, blank=True, verbose_name="Situação")
    data_admissao = models.DateField(null=True, blank=True, verbose_name="Data Adm.")
    data_demissao = models.DateField(null=True, blank=True, verbose_name="Data Dem.")
    telefone = models.CharField(max_length=50, null=True, blank=True)
    nome_lider = models.CharField(max_length=255, null=True, blank=True, verbose_name="Nome do Líder")
    data_nascimento = models.DateField(null=True, blank=True, verbose_name="Data Nasc.")
    escolaridade = models.CharField(max_length=255, null=True, blank=True)
    sexo = models.CharField(max_length=1, choices=[('M', 'Masculino'), ('F', 'Feminino')], null=True, blank=True, verbose_name="Sexo")
    
    REGIME_CHOICES = [('CLT', 'CLT'), ('PJ', 'PJ')]
    regime = models.CharField(max_length=10, choices=REGIME_CHOICES, default='CLT', verbose_name="Regime")
    
    CATEGORIA_CHOICES = [
        ('ADMINISTRATIVO', 'Administrativo'),
        ('OPERACIONAL', 'Operacional'),
        ('MOTORISTA', 'Motorista'),
    ]
    categoria = models.CharField(max_length=50, choices=CATEGORIA_CHOICES, null=True, blank=True, verbose_name="Categoria")
    
    data_atualizacao = models.DateTimeField(auto_now=True)
    desconsiderado = models.BooleanField(default=False, verbose_name="Desconsiderar em Indicadores")

    def __str__(self):
        return f"{self.matricula} - {self.nome_completo}"

    class Meta:
        verbose_name = "Colaborador"
        verbose_name_plural = "Colaboradores"
        ordering = ['nome_completo']


class LoteMovimentacaoRH(models.Model):
    mes = models.IntegerField(verbose_name="Mês")
    ano = models.IntegerField(verbose_name="Ano")
    data_importacao = models.DateTimeField(default=timezone.now, verbose_name="Data de Importação")
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, verbose_name="Usuário")
    arquivo = models.FileField(upload_to='rh/movimentacoes/%Y/%m/', null=True, blank=True, verbose_name="Arquivo Excel")

    class Meta:
        verbose_name = "Lote de Movimentação RH"
        verbose_name_plural = "Lotes de Movimentação RH"
        ordering = ['-ano', '-mes']
        unique_together = ['mes', 'ano']

    def __str__(self):
        return f"Movimentação {self.mes:02d}/{self.ano}"


class MovimentacaoColaborador(models.Model):
    lote = models.ForeignKey(LoteMovimentacaoRH, on_delete=models.CASCADE, related_name='colaboradores', verbose_name="Lote")
    filial = models.CharField(max_length=100, null=True, blank=True, verbose_name="Filial")
    nome = models.CharField(max_length=255, verbose_name="Funcionário/Nome")
    situacao = models.CharField(max_length=50, null=True, blank=True, verbose_name="Status do Funcionário")
    uf_estado = models.CharField(max_length=50, null=True, blank=True, verbose_name="UF/Estado")
    funcao = models.CharField(max_length=100, null=True, blank=True, verbose_name="Função")
    data_admissao = models.DateField(null=True, blank=True, verbose_name="Admissão")
    data_nascimento = models.DateField(null=True, blank=True, verbose_name="Nascimento")
    cpf = models.CharField(max_length=14, verbose_name="CPF")
    pis_pasep = models.CharField(max_length=20, null=True, blank=True, verbose_name="PIS/PASEP")
    rg = models.CharField(max_length=20, null=True, blank=True, verbose_name="RG")
    salario = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name="Salário")
    categoria = models.CharField(max_length=50, null=True, blank=True, verbose_name="Categoria")

    class Meta:
        verbose_name = "Movimentação de Colaborador"
        verbose_name_plural = "Movimentações de Colaboradores"
        indexes = [
            models.Index(fields=['cpf']),
            models.Index(fields=['lote']),
        ]

    def __str__(self):
        return f"{self.nome} ({self.lote})"

    @property
    def idade(self):
        if not self.data_nascimento:
            return "-"
        ref = date(self.lote.ano, self.lote.mes, 1)
        delta = ref.year - self.data_nascimento.year - ((ref.month, ref.day) < (self.data_nascimento.month, self.data_nascimento.day))
        return f"{delta} anos"

    @property
    def tempo_empresa(self):
        if not self.data_admissao:
            return "-"
        ref = date(self.lote.ano, self.lote.mes, 1)
        diff = (ref.year - self.data_admissao.year) * 12 + ref.month - self.data_admissao.month
        anos = diff // 12
        meses = diff % 12
        if anos > 0:
            return f"{anos}a {meses}m" if meses > 0 else f"{anos}a"
        return f"{meses} meses" if meses > 0 else "Novo"


class InconsistenciaColaborador(models.Model):
    TIPO_CHOICES = [
        ('salario', 'Aumento de Salário'),
        ('cargo', 'Alteração de Cargo'),
        ('outros', 'Outros'),
    ]
    lote = models.ForeignKey(LoteMovimentacaoRH, on_delete=models.CASCADE, related_name='inconsistencias', verbose_name="Lote")
    cpf = models.CharField(max_length=14, verbose_name="CPF")
    nome = models.CharField(max_length=255, verbose_name="Nome")
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='salario', verbose_name="Tipo")
    valor_anterior = models.CharField(max_length=100, null=True, blank=True, verbose_name="Valor Anterior")
    valor_atual = models.CharField(max_length=100, null=True, blank=True, verbose_name="Valor Atual")
    justificativa = models.TextField(null=True, blank=True, verbose_name="Justificativa")
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Alteração de Colaborador"
        verbose_name_plural = "Alterações de Colaboradores"

    def __str__(self):
        return f"Alteração: {self.nome} - {self.get_tipo_display()}"


class CargoMapping(models.Model):
    cargo = models.CharField(max_length=255, unique=True, verbose_name="Cargo")
    categoria = models.CharField(max_length=50, choices=Colaborador.CATEGORIA_CHOICES, null=True, blank=True, verbose_name="Categoria")
    data_criacao = models.DateTimeField(auto_now_add=True)
    ultima_atualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Mapeamento de Cargo"
        verbose_name_plural = "Mapeamentos de Cargos"
        ordering = ['cargo']

    def __str__(self):
        return f"{self.cargo} -> {self.get_categoria_display() or 'Pendente'}"


class ColaboradorPJ(models.Model):
    nome = models.CharField(max_length=255, verbose_name="Nome")
    cpf = models.CharField(max_length=14, unique=True, verbose_name="CPF")
    salario = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Salário")
    filial = models.CharField(max_length=100, null=True, blank=True, verbose_name="Filial")
    cargo = models.CharField(max_length=100, null=True, blank=True, verbose_name="Cargo")
    data_admissao = models.DateField(null=True, blank=True, verbose_name="Data Adm.")
    data_nascimento = models.DateField(null=True, blank=True, verbose_name="Data Nasc.")
    ativo = models.BooleanField(default=True, verbose_name="Ativo")
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "PJ Cadastrado"
        verbose_name_plural = "PJs Cadastrados"
        ordering = ['nome']

    def __str__(self):
        return self.nome
