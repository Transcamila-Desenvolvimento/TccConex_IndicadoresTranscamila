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


def documento_sgq_upload_path(instance, filename):
    import uuid
    from pathlib import Path
    ext = Path(filename).suffix.lower()[:10]
    return f'sgq/documentos/{uuid.uuid4().hex}{ext}'


class DocumentoSGQ(models.Model):
    """Arquivo da matriz de conhecimento do SGQ. O Drive guarda o arquivo; o servidor, o texto."""

    titulo = models.CharField(max_length=160, verbose_name='Título')
    arquivo = models.FileField(upload_to=documento_sgq_upload_path, blank=True, verbose_name='Arquivo')
    drive_file_id = models.CharField(max_length=128, blank=True, default='', verbose_name='ID no Google Drive')
    link_externo = models.CharField(max_length=500, blank=True, default='', verbose_name='Link no Google Drive')
    nome_original = models.CharField(max_length=180, verbose_name='Nome do arquivo')
    tamanho = models.PositiveIntegerField(default=0, verbose_name='Tamanho em bytes')
    texto = models.TextField(blank=True, default='', verbose_name='Texto para consulta')
    texto_extraido = models.BooleanField(default=False, verbose_name='Texto já extraído')
    incluido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='documentos_sgq',
        verbose_name='Incluído por',
    )
    pasta = models.ForeignKey(
        'PastaMatrizSGQ',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='documentos',
        verbose_name='Pasta',
    )
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Incluído em')

    class Meta:
        verbose_name = 'Documento do SGQ'
        verbose_name_plural = 'Documentos do SGQ'
        ordering = ['-criado_em']

    def __str__(self):
        return self.titulo


AUDITORIA_STATUS_CHOICES = [
    ('planejamento', 'Em planejamento'),
    ('execucao', 'Em execução'),
    ('concluida', 'Concluída'),
]


class AuditoriaSGQ(models.Model):
    """Auditoria do SGQ. O código segue o padrão AA-NNNNN, sequencial por ano."""

    filial = models.CharField(max_length=100, verbose_name='Filial')
    ano = models.PositiveSmallIntegerField(verbose_name='Ano do código')
    sequencia = models.PositiveIntegerField(verbose_name='Sequência no ano')
    codigo = models.CharField(max_length=12, unique=True, verbose_name='Código')
    categoria = models.CharField(max_length=120, verbose_name='Categoria')
    titulo = models.CharField(max_length=200, verbose_name='Título')
    data_inicio = models.DateField(verbose_name='Data de início')
    data_termino = models.DateField(verbose_name='Data de término')
    normas = models.ManyToManyField('NormaSGQ', blank=True, related_name='auditorias', verbose_name='Normas')
    auditor_lider = models.CharField(max_length=150, verbose_name='Auditor líder')
    auditores = models.JSONField(default=list, blank=True, verbose_name='Auditores')
    status = models.CharField(max_length=20, choices=AUDITORIA_STATUS_CHOICES, default='planejamento', verbose_name='Status')
    escopo = models.TextField(blank=True, default='', verbose_name='Escopo / objetivo')
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='auditorias_sgq',
        verbose_name='Criado por',
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Auditoria do SGQ'
        verbose_name_plural = 'Auditorias do SGQ'
        ordering = ['-data_inicio', '-sequencia']
        constraints = [
            models.UniqueConstraint(fields=['ano', 'sequencia'], name='uniq_sgq_auditoria_ano_sequencia'),
        ]

    def __str__(self):
        return f'{self.codigo} — {self.titulo}'


class NormaSGQ(models.Model):
    """Norma (ou checklist) usada como referência nas auditorias do SGQ."""

    filial = models.CharField(max_length=100, verbose_name='Filial')
    nome = models.CharField(max_length=150, verbose_name='Nome')
    descricao = models.CharField(max_length=500, blank=True, default='', verbose_name='Descrição')
    data_atualizacao = models.DateField(verbose_name='Data da última atualização')
    emissor = models.CharField(max_length=150, verbose_name='Emissor')
    publica = models.BooleanField(default=False, verbose_name='Norma pública')
    ativa = models.BooleanField(default=True, verbose_name='Ativa')
    # Classificações das perguntas (ex.: SASSMAQ M/I/D):
    # [{"sigla", "nome", "critica", "metaPrimeira", "metaReavaliacao"}], metas em % de conformidade.
    classificacoes = models.JSONField(default=list, blank=True, verbose_name='Classificações das perguntas')
    # Áreas / pilares da norma (ex.: SASSMAQ SS, MA, Q): [{"sigla", "nome"}]. Uma pergunta pode ter várias.
    areas = models.JSONField(default=list, blank=True, verbose_name='Áreas das perguntas')
    # Último mapeamento de colunas usado na importação: [{"cabecalho", "papel", "area"}], reaplicado pelo cabeçalho.
    mapeamento_importacao = models.JSONField(default=list, blank=True, verbose_name='Mapeamento da importação')
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='normas_sgq',
        verbose_name='Criado por',
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Norma do SGQ'
        verbose_name_plural = 'Normas do SGQ'
        ordering = ['nome', 'pk']
        constraints = [
            models.UniqueConstraint(fields=['filial', 'nome'], name='uniq_sgq_norma_filial_nome'),
        ]

    def __str__(self):
        return self.nome

    def classificacao_por_sigla(self, sigla: str) -> dict | None:
        return next((item for item in self.classificacoes if item.get('sigla') == sigla), None)

    def siglas_areas(self) -> set[str]:
        return {item.get('sigla') for item in self.areas}


class CategoriaAuditoriaSGQ(models.Model):
    """Categoria das auditorias do SGQ. Suas normas são vinculadas às novas auditorias da categoria."""

    filial = models.CharField(max_length=100, verbose_name='Filial')
    nome = models.CharField(max_length=120, verbose_name='Título')
    normas = models.ManyToManyField('NormaSGQ', blank=True, related_name='categorias', verbose_name='Normas')
    ativa = models.BooleanField(default=True, verbose_name='Ativa')
    emissor = models.CharField(max_length=150, blank=True, default='', verbose_name='Emissor')
    atualizado_por = models.CharField(max_length=150, blank=True, default='', verbose_name='Atualizado por')
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='categorias_auditoria_sgq',
        verbose_name='Criado por',
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Categoria de auditoria do SGQ'
        verbose_name_plural = 'Categorias de auditoria do SGQ'
        ordering = ['nome', 'pk']
        constraints = [
            models.UniqueConstraint(fields=['filial', 'nome'], name='uniq_sgq_categoria_auditoria_filial_nome'),
        ]

    def __str__(self):
        return self.nome


class TipoRespostaSGQ(models.Model):
    """Conjunto de opções de resposta usado nas perguntas das auditorias do SGQ."""

    filial = models.CharField(max_length=100, verbose_name='Filial')
    sequencia = models.PositiveIntegerField(verbose_name='Sequência na filial')
    nome = models.CharField(max_length=120, verbose_name='Nome')
    # [{"codigo", "texto", "valor", "exigeJustificativa"}]: codigo é o que se digita/importa (ex.: 1, 0, X);
    # valor é o % de conformidade (0 a 100) ou null = "não se aplica", que tira a pergunta do cálculo.
    opcoes = models.JSONField(default=list, verbose_name='Opções de resposta')
    publica = models.BooleanField(default=False, verbose_name='Resposta pública')
    emissor = models.CharField(max_length=150, blank=True, default='', verbose_name='Emissor')
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tipos_resposta_sgq',
        verbose_name='Criado por',
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Tipo de resposta do SGQ'
        verbose_name_plural = 'Tipos de resposta do SGQ'
        ordering = ['-sequencia']
        constraints = [
            models.UniqueConstraint(fields=['filial', 'sequencia'], name='uniq_sgq_tipo_resposta_filial_sequencia'),
            models.UniqueConstraint(fields=['filial', 'nome'], name='uniq_sgq_tipo_resposta_filial_nome'),
        ]

    @property
    def codigo(self) -> str:
        return f'{self.sequencia:03d}'

    def __str__(self):
        return f'{self.codigo} — {self.nome}'


ITEM_NORMA_TIPO_CHOICES = [
    ('orientativo', 'Texto orientativo'),
    ('pergunta', 'Pergunta'),
]


class ItemNormaSGQ(models.Model):
    """Requisito (item raiz) ou subitem de uma norma do SGQ."""

    norma = models.ForeignKey(NormaSGQ, on_delete=models.CASCADE, related_name='itens', verbose_name='Norma')
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subitens',
        verbose_name='Pertence a',
    )
    ordem = models.PositiveIntegerField(default=0, verbose_name='Ordem')
    codigo = models.CharField(max_length=30, blank=True, default='', verbose_name='Código')
    titulo = models.CharField(max_length=500, verbose_name='Título')
    descricao = models.TextField(max_length=4000, blank=True, default='', verbose_name='Descrição')
    tipo = models.CharField(max_length=20, choices=ITEM_NORMA_TIPO_CHOICES, default='orientativo', verbose_name='Tipo')
    tipo_resposta = models.ForeignKey(
        TipoRespostaSGQ,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='itens',
        verbose_name='Tipo de resposta',
    )
    classificacao = models.CharField(max_length=10, blank=True, default='', verbose_name='Classificação (sigla da norma)')
    areas = models.JSONField(default=list, blank=True, verbose_name='Áreas (siglas da norma)')
    peso = models.DecimalField(max_digits=6, decimal_places=2, default=1, verbose_name='Peso')
    obrigatorio = models.BooleanField(default=True, verbose_name='Item obrigatório')
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Item de norma do SGQ'
        verbose_name_plural = 'Itens de normas do SGQ'
        ordering = ['norma', 'ordem', 'pk']

    def __str__(self):
        return self.titulo


RESPOSTA_DESTAQUE_CHOICES = [
    ('', 'Sem destaque'),
    ('forte', 'Ponto forte'),
    ('fraco', 'Ponto fraco'),
]


class RespostaAuditoriaSGQ(models.Model):
    """Resolução de uma pergunta de norma numa auditoria. A opção escolhida é copiada do tipo de resposta."""

    auditoria = models.ForeignKey(AuditoriaSGQ, on_delete=models.CASCADE, related_name='respostas', verbose_name='Auditoria')
    item = models.ForeignKey(ItemNormaSGQ, on_delete=models.PROTECT, related_name='respostas', verbose_name='Pergunta')
    # Vazio = ainda sem resposta (só observações/anexos).
    opcao_codigo = models.CharField(max_length=10, blank=True, default='', verbose_name='Código da opção')
    opcao_texto = models.CharField(max_length=60, blank=True, default='', verbose_name='Opção escolhida')
    # % de conformidade da opção no momento da resposta; null = não se aplica (fora do cálculo).
    valor = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name='Conformidade (%)')
    observacoes = models.TextField(max_length=4000, blank=True, default='', verbose_name='Observações')
    destaque = models.CharField(max_length=10, choices=RESPOSTA_DESTAQUE_CHOICES, blank=True, default='', verbose_name='Destaque')
    respondido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='respostas_auditoria_sgq',
        verbose_name='Respondido por',
    )
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Resposta de auditoria do SGQ'
        verbose_name_plural = 'Respostas de auditorias do SGQ'
        constraints = [
            models.UniqueConstraint(fields=['auditoria', 'item'], name='uniq_sgq_resposta_auditoria_item'),
        ]

    def __str__(self):
        return f'{self.auditoria.codigo} — {self.item.codigo or self.item.titulo}'


def anexo_resposta_upload_path(instance, filename: str) -> str:
    import uuid
    from pathlib import Path
    ext = Path(filename).suffix.lower()[:10]
    return f'sgq/auditorias/{uuid.uuid4().hex}{ext}'


class AnexoRespostaAuditoriaSGQ(models.Model):
    """Evidência anexada à resolução de uma pergunta da auditoria."""

    resposta = models.ForeignKey(RespostaAuditoriaSGQ, on_delete=models.CASCADE, related_name='anexos', verbose_name='Resposta')
    arquivo = models.FileField(upload_to=anexo_resposta_upload_path, verbose_name='Arquivo')
    nome_original = models.CharField(max_length=180, verbose_name='Nome do arquivo')
    tamanho = models.PositiveIntegerField(default=0, verbose_name='Tamanho em bytes')
    incluido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='anexos_auditoria_sgq',
        verbose_name='Incluído por',
    )
    criado_em = models.DateTimeField(auto_now_add=True, verbose_name='Incluído em')

    class Meta:
        verbose_name = 'Anexo de resposta de auditoria do SGQ'
        verbose_name_plural = 'Anexos de respostas de auditorias do SGQ'
        ordering = ['criado_em', 'pk']

    def __str__(self):
        return self.nome_original


class PastaMatrizSGQ(models.Model):
    """Pasta da matriz de conhecimento do SGQ."""

    nome = models.CharField(max_length=120, verbose_name='Nome')
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subpastas',
        verbose_name='Pasta superior',
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Pasta da matriz de conhecimento do SGQ'
        verbose_name_plural = 'Pastas da matriz de conhecimento do SGQ'
        ordering = ['nome', 'pk']

    def __str__(self):
        return self.nome
