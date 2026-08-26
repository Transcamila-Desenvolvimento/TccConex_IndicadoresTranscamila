from django.conf import settings
from django.db import models

AVALIACAO_CHOICES = [
    ('otimo', 'Ótimo'),
    ('bom', 'Bom'),
    ('regular', 'Regular'),
    ('ruim', 'Ruim'),
]

# Valores legados ainda válidos em pesquisas já lançadas. Novas opções vêm do
# cadastro de clientes (flag "Considerar pesquisa de satisfação").
CLIENTE_FALLBACK = ['CCAB', 'PRENTISS', 'ALBAUGH', 'OUTROS']
CLIENTE_CHOICES = [(value, value) for value in CLIENTE_FALLBACK]

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

    filial = models.CharField(max_length=100, default='Ibiporã (Matriz)', verbose_name='Filial')
    # Preenchida automaticamente na inclusão (hoje). Registros antigos mantêm
    # o valor já gravado; indicadores usam sempre data_entrega.
    data_inclusao = models.DateField(null=True, blank=True, verbose_name='Data de Inclusão')
    motorista = models.CharField(max_length=255, verbose_name='Motorista')
    cte = models.CharField(max_length=500, verbose_name='CT-e')
    data_entrega = models.DateField(verbose_name='Data Entrega')
    nota_fiscal = models.CharField(max_length=500, verbose_name='Nota Fiscal')
    cliente = models.CharField(max_length=200, default='OUTROS', verbose_name='Cliente')

    # Quando o cliente se recusa a assinar a pesquisa, os critérios abaixo ficam
    # em branco — por isso permitem string vazia (validação de obrigatoriedade
    # condicional fica no serializer, não no model).
    cliente_recusou_assinar = models.BooleanField(default=False, verbose_name='Cliente recusou assinar')

    prazo_entrega = models.CharField(max_length=10, choices=AVALIACAO_CHOICES, blank=True, default='', verbose_name='Prazo de Entrega')
    condicoes_mercadoria = models.CharField(max_length=10, choices=AVALIACAO_CHOICES, blank=True, default='', verbose_name='Condições da Mercadoria')
    condicoes_veiculo = models.CharField(max_length=10, choices=AVALIACAO_CHOICES, blank=True, default='', verbose_name='Condições do Veículo')
    apresentacao_motorista = models.CharField(max_length=10, choices=AVALIACAO_CHOICES, blank=True, default='', verbose_name='Apresentação do Motorista')
    atendimento_dispensado = models.CharField(max_length=10, choices=AVALIACAO_CHOICES, blank=True, default='', verbose_name='Atendimento Dispensado')

    analise = models.TextField(blank=True, default='', verbose_name='Análise, Tratativa e Justificativa')
    escopo_analise = models.JSONField(default=dict, blank=True, verbose_name='Escopo da análise')

    criado_por = models.CharField(max_length=150, blank=True, default='', verbose_name='Criado por')
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Pesquisa de Satisfação'
        verbose_name_plural = 'Pesquisas de Satisfação'
        ordering = ['-data_entrega', '-id']

    def __str__(self):
        return f'{self.cliente} — CT-e {self.cte} ({self.data_entrega})'


class PesquisaSatisfacaoLoteDraft(models.Model):
    """Rascunho de inclusão em tabela — um por usuário e filial da sessão.

    Isola o trabalho incompleto entre usuários (e entre filiais do mesmo
    usuário). As linhas ficam em JSON camelCase alinhado ao frontend; a
    validação completa só ocorre no bulk_create.
    """

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sgq_lote_drafts',
    )
    filial = models.CharField(max_length=100)
    version = models.PositiveSmallIntegerField(default=1)
    rows = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Rascunho de Inclusão em Tabela'
        verbose_name_plural = 'Rascunhos de Inclusão em Tabela'
        constraints = [
            models.UniqueConstraint(
                fields=['usuario', 'filial'],
                name='uniq_sgq_lote_draft_usuario_filial',
            ),
        ]

    def __str__(self):
        return f'Rascunho SGQ — {self.usuario_id} / {self.filial}'


class PesquisaSatisfacaoFormDraft(models.Model):
    """Rascunho do formulário de lançamento — um por usuário e filial da sessão.

    Isolado do rascunho de inclusão em tabela. O payload JSON é camelCase
    (mesmo formato de uma linha de lote); a validação completa só ocorre no POST.
    """

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sgq_form_drafts',
    )
    filial = models.CharField(max_length=100)
    version = models.PositiveSmallIntegerField(default=1)
    payload = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Rascunho de Lançamento de Pesquisa'
        verbose_name_plural = 'Rascunhos de Lançamento de Pesquisa'
        constraints = [
            models.UniqueConstraint(
                fields=['usuario', 'filial'],
                name='uniq_sgq_form_draft_usuario_filial',
            ),
        ]

    def __str__(self):
        return f'Rascunho formulário SGQ — {self.usuario_id} / {self.filial}'


class EscopoAnalise(models.Model):
    """Categoria do escopo da análise — catálogo global (todas as filiais SGQ)."""

    chave = models.SlugField(max_length=80, unique=True)
    label = models.CharField(max_length=120)
    ordem = models.PositiveSmallIntegerField(default=0)
    ativo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Escopo da análise'
        verbose_name_plural = 'Escopos da análise'
        ordering = ['ordem', 'id']

    def __str__(self):
        return self.label


class EscopoAnaliseOpcao(models.Model):
    """Opção selecionável dentro de um escopo da análise."""

    escopo = models.ForeignKey(EscopoAnalise, on_delete=models.CASCADE, related_name='opcoes')
    chave = models.SlugField(max_length=80)
    label = models.CharField(max_length=255)
    ordem = models.PositiveSmallIntegerField(default=0)
    ativo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Opção de escopo da análise'
        verbose_name_plural = 'Opções de escopo da análise'
        ordering = ['ordem', 'id']
        constraints = [
            models.UniqueConstraint(fields=['escopo', 'chave'], name='uniq_sgq_escopo_opcao_chave'),
        ]

    def __str__(self):
        return f'{self.escopo.label} — {self.label}'
