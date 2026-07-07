from django.db import models


class UnidadeMedida(models.Model):
    nome = models.CharField(max_length=50, unique=True, verbose_name="Nome")

    class Meta:
        verbose_name = "Unidade de Medida"
        verbose_name_plural = "Unidades de Medida"
        ordering = ['nome']

    def __str__(self):
        return self.nome


class Setor(models.Model):
    nome = models.CharField(max_length=100, unique=True, verbose_name="Nome")

    class Meta:
        verbose_name = "Setor"
        verbose_name_plural = "Setores"
        ordering = ['nome']

    def __str__(self):
        return self.nome


class Colaborador(models.Model):
    """Colaborador responsável pela retirada de materiais no Protocolo de Saída.

    Cadastro simples do módulo Compras — independente do model `Colaborador`
    de `apps.rh` (que representa o quadro de funcionários da empresa)."""
    nome = models.CharField(max_length=150, unique=True, verbose_name="Nome")

    class Meta:
        verbose_name = "Colaborador (Compras)"
        verbose_name_plural = "Colaboradores (Compras)"
        ordering = ['nome']

    def __str__(self):
        return self.nome


class Fornecedor(models.Model):
    nome = models.CharField(max_length=150, unique=True, verbose_name="Nome")

    class Meta:
        verbose_name = "Fornecedor"
        verbose_name_plural = "Fornecedores"
        ordering = ['nome']

    def __str__(self):
        return self.nome


class ItemEstoque(models.Model):
    nome = models.CharField(max_length=150, unique=True, verbose_name="Nome")
    unidade = models.CharField(max_length=50, default='Un', verbose_name="Unidade")
    qtd_atual = models.PositiveIntegerField(default=0, verbose_name="Quantidade Atual")
    qtd_minima = models.PositiveIntegerField(default=0, verbose_name="Quantidade Mínima")

    class Meta:
        verbose_name = "Item de Estoque"
        verbose_name_plural = "Itens de Estoque"
        ordering = ['nome']

    def __str__(self):
        return self.nome


class EntradaEstoque(models.Model):
    """Registro de compra (entrada) de um item no estoque.

    `item_nome` e `fornecedor_nome` são snapshots do nome no momento do
    registro, preservando o histórico mesmo se o cadastro for renomeado ou
    excluído depois (por isso as FKs usam SET_NULL)."""
    item = models.ForeignKey(ItemEstoque, on_delete=models.SET_NULL, null=True, related_name='entradas', verbose_name="Item")
    item_nome = models.CharField(max_length=150, verbose_name="Item (snapshot)")
    data = models.DateField(verbose_name="Data da Compra")
    quantidade = models.PositiveIntegerField(verbose_name="Quantidade")
    valor_unitario = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name="Valor Unitário")
    fornecedor = models.ForeignKey(Fornecedor, on_delete=models.SET_NULL, null=True, related_name='entradas', verbose_name="Fornecedor")
    fornecedor_nome = models.CharField(max_length=150, verbose_name="Fornecedor (snapshot)")
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Entrada de Estoque"
        verbose_name_plural = "Entradas de Estoque"
        ordering = ['-data', '-data_criacao']

    def __str__(self):
        return f"{self.item_nome} (+{self.quantidade})"


class SaidaEstoque(models.Model):
    """Registro do protocolo de saída (retirada) de um item do estoque."""
    item = models.ForeignKey(ItemEstoque, on_delete=models.SET_NULL, null=True, related_name='saidas', verbose_name="Item")
    item_nome = models.CharField(max_length=150, verbose_name="Item (snapshot)")
    data = models.DateField(verbose_name="Data da Saída")
    quantidade = models.PositiveIntegerField(verbose_name="Quantidade")
    setor = models.ForeignKey(Setor, on_delete=models.SET_NULL, null=True, related_name='saidas', verbose_name="Setor")
    setor_nome = models.CharField(max_length=100, verbose_name="Setor (snapshot)")
    colaborador = models.ForeignKey(Colaborador, on_delete=models.SET_NULL, null=True, related_name='saidas', verbose_name="Colaborador")
    colaborador_nome = models.CharField(max_length=150, verbose_name="Colaborador (snapshot)")
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Saída de Estoque"
        verbose_name_plural = "Saídas de Estoque"
        ordering = ['-data', '-data_criacao']

    def __str__(self):
        return f"{self.item_nome} (-{self.quantidade})"
