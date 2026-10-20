from django.conf import settings
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

    Cadastro do módulo Compras — independente do model `Colaborador` de `apps.rh`."""
    setor = models.ForeignKey(
        Setor,
        on_delete=models.PROTECT,
        related_name='colaboradores',
        verbose_name="Setor",
    )
    nome = models.CharField(max_length=150, verbose_name="Nome")
    cargo = models.CharField(max_length=100, blank=True, default='', verbose_name="Cargo")
    cpf = models.CharField(max_length=11, blank=True, default='', verbose_name="CPF")

    class Meta:
        verbose_name = "Colaborador (Compras)"
        verbose_name_plural = "Colaboradores (Compras)"
        ordering = ['setor__nome', 'nome']
        constraints = [
            models.UniqueConstraint(fields=['setor', 'nome'], name='compras_colaborador_setor_nome_unique'),
        ]

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


# ─── Controle de Uniformes ───────────────────────────────────────────────────

CONDICAO_NOVO = 'novo'
CONDICAO_USADO = 'usado'
CONDICAO_CHOICES = [
    (CONDICAO_NOVO, 'Novo'),
    (CONDICAO_USADO, 'Usado'),
]


class Uniforme(models.Model):
    """Modelo de uniforme em um tamanho. Os saldos novo e usado são independentes
    e só mudam por meio de `MovimentacaoUniforme` (ver `uniformes_service`)."""
    nome = models.CharField(max_length=100, verbose_name="Nome")
    codigo = models.CharField(max_length=50, blank=True, default='', verbose_name="Código/Referência")
    tamanho = models.CharField(max_length=20, verbose_name="Tamanho")
    qtd_nova = models.PositiveIntegerField(default=0, verbose_name="Saldo novo")
    qtd_usada = models.PositiveIntegerField(default=0, verbose_name="Saldo usado")
    estoque_minimo = models.PositiveIntegerField(default=0, verbose_name="Estoque mínimo")
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Uniforme"
        verbose_name_plural = "Uniformes"
        ordering = ['nome', 'tamanho']
        constraints = [
            models.UniqueConstraint(fields=['nome', 'tamanho'], name='compras_uniforme_nome_tamanho_unique'),
        ]

    def __str__(self):
        return f"{self.nome} ({self.tamanho})"


class EntregaUniforme(models.Model):
    """Destinação de uniformes a um colaborador. Gera o termo de recebimento
    (número `TRU-000001`). Os dados do colaborador são snapshots do momento da entrega."""
    colaborador = models.ForeignKey(
        Colaborador, on_delete=models.SET_NULL, null=True, related_name='entregas_uniforme', verbose_name="Colaborador",
    )
    colaborador_nome = models.CharField(max_length=150, verbose_name="Colaborador (snapshot)")
    colaborador_cpf = models.CharField(max_length=11, blank=True, default='', verbose_name="CPF (snapshot)")
    colaborador_cargo = models.CharField(max_length=100, blank=True, default='', verbose_name="Cargo (snapshot)")
    colaborador_setor = models.CharField(max_length=100, blank=True, default='', verbose_name="Setor (snapshot)")
    data_entrega = models.DateField(verbose_name="Data da entrega")
    observacoes = models.TextField(blank=True, default='', verbose_name="Observações")
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    usuario_nome = models.CharField(max_length=150, blank=True, default='', verbose_name="Responsável")
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Entrega de Uniforme"
        verbose_name_plural = "Entregas de Uniforme"
        ordering = ['-data_entrega', '-criado_em']

    @property
    def numero(self) -> str:
        return f"TRU-{self.pk:06d}"

    def __str__(self):
        return f"{self.numero} — {self.colaborador_nome}"


class EntregaUniformeItem(models.Model):
    """Item entregue. Os contadores de devolução/descarte/perda são atualizados a
    cada devolução; o detalhe de cada evento fica em `DevolucaoUniformeItem`."""
    entrega = models.ForeignKey(EntregaUniforme, on_delete=models.PROTECT, related_name='itens')
    uniforme = models.ForeignKey(Uniforme, on_delete=models.SET_NULL, null=True, related_name='itens_entregues')
    uniforme_nome = models.CharField(max_length=100, verbose_name="Uniforme (snapshot)")
    uniforme_codigo = models.CharField(max_length=50, blank=True, default='', verbose_name="Código (snapshot)")
    uniforme_tamanho = models.CharField(max_length=20, verbose_name="Tamanho (snapshot)")
    condicao = models.CharField(max_length=10, choices=CONDICAO_CHOICES, verbose_name="Condição na entrega")
    quantidade = models.PositiveIntegerField(verbose_name="Quantidade entregue")
    qtd_devolvida = models.PositiveIntegerField(default=0, verbose_name="Devolvida em boas condições")
    qtd_descartada = models.PositiveIntegerField(default=0, verbose_name="Devolvida e descartada")
    qtd_perdida = models.PositiveIntegerField(default=0, verbose_name="Perdida / não devolvida")

    class Meta:
        verbose_name = "Item de Entrega de Uniforme"
        verbose_name_plural = "Itens de Entrega de Uniforme"
        ordering = ['uniforme_nome', 'uniforme_tamanho']

    @property
    def pendente(self) -> int:
        return self.quantidade - self.qtd_devolvida - self.qtd_descartada - self.qtd_perdida

    def __str__(self):
        return f"{self.uniforme_nome} ({self.uniforme_tamanho}) x{self.quantidade}"


class DevolucaoUniforme(models.Model):
    entrega = models.ForeignKey(EntregaUniforme, on_delete=models.PROTECT, related_name='devolucoes')
    data_devolucao = models.DateField(verbose_name="Data da devolução")
    observacoes = models.TextField(blank=True, default='', verbose_name="Observações")
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    usuario_nome = models.CharField(max_length=150, blank=True, default='', verbose_name="Responsável")
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Devolução de Uniforme"
        verbose_name_plural = "Devoluções de Uniforme"
        ordering = ['-data_devolucao', '-criado_em']

    def __str__(self):
        return f"Devolução {self.entrega.numero} em {self.data_devolucao}"


class DevolucaoUniformeItem(models.Model):
    devolucao = models.ForeignKey(DevolucaoUniforme, on_delete=models.PROTECT, related_name='itens')
    entrega_item = models.ForeignKey(EntregaUniformeItem, on_delete=models.PROTECT, related_name='devolucoes')
    qtd_boa = models.PositiveIntegerField(default=0, verbose_name="Usada em boas condições")
    qtd_danificada = models.PositiveIntegerField(default=0, verbose_name="Danificada")
    qtd_sem_condicoes = models.PositiveIntegerField(default=0, verbose_name="Sem condições de uso")
    qtd_perdida = models.PositiveIntegerField(default=0, verbose_name="Perdida / não devolvida")

    class Meta:
        verbose_name = "Item de Devolução de Uniforme"
        verbose_name_plural = "Itens de Devolução de Uniforme"


MOV_ENTRADA = 'entrada'
MOV_AJUSTE = 'ajuste'
MOV_ENTREGA = 'entrega'
MOV_DEVOLUCAO = 'devolucao'
MOV_DESCARTE = 'descarte'
MOV_PERDA = 'perda'
MOV_TIPO_CHOICES = [
    (MOV_ENTRADA, 'Entrada'),
    (MOV_AJUSTE, 'Ajuste'),
    (MOV_ENTREGA, 'Entrega'),
    (MOV_DEVOLUCAO, 'Devolução'),
    (MOV_DESCARTE, 'Descarte'),
    (MOV_PERDA, 'Perda'),
]


class MovimentacaoUniforme(models.Model):
    """Histórico imutável de tudo que acontece com os uniformes.

    `quantidade` é sempre positiva (peças envolvidas); `variacao_estoque` é o efeito
    com sinal no saldo da `condicao` (0 quando não mexe no estoque, ex.: perda)."""
    tipo = models.CharField(max_length=12, choices=MOV_TIPO_CHOICES, verbose_name="Tipo")
    uniforme = models.ForeignKey(Uniforme, on_delete=models.SET_NULL, null=True, related_name='movimentacoes')
    uniforme_nome = models.CharField(max_length=100, verbose_name="Uniforme (snapshot)")
    uniforme_tamanho = models.CharField(max_length=20, verbose_name="Tamanho (snapshot)")
    condicao = models.CharField(max_length=10, choices=CONDICAO_CHOICES, verbose_name="Condição")
    quantidade = models.PositiveIntegerField(verbose_name="Quantidade")
    variacao_estoque = models.IntegerField(default=0, verbose_name="Variação no estoque")
    saldo_novo = models.PositiveIntegerField(verbose_name="Saldo novo após")
    saldo_usado = models.PositiveIntegerField(verbose_name="Saldo usado após")
    data = models.DateField(verbose_name="Data")
    colaborador = models.ForeignKey(Colaborador, on_delete=models.SET_NULL, null=True, related_name='+')
    colaborador_nome = models.CharField(max_length=150, blank=True, default='', verbose_name="Colaborador (snapshot)")
    entrega = models.ForeignKey(EntregaUniforme, on_delete=models.SET_NULL, null=True, related_name='movimentacoes')
    devolucao = models.ForeignKey(DevolucaoUniforme, on_delete=models.SET_NULL, null=True, related_name='movimentacoes')
    observacao = models.TextField(blank=True, default='', verbose_name="Observação")
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    usuario_nome = models.CharField(max_length=150, blank=True, default='', verbose_name="Responsável")
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Movimentação de Uniforme"
        verbose_name_plural = "Movimentações de Uniforme"
        ordering = ['-criado_em', '-id']

    def __str__(self):
        return f"{self.get_tipo_display()} — {self.uniforme_nome} ({self.uniforme_tamanho}) x{self.quantidade}"
