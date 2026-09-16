from datetime import timedelta
import re

from django.conf import settings
from django.db import models, transaction
from django.db.models import Max, Q
from django.db.models.functions import Lower
from django.utils import timezone

from apps.faturamento.cnpj_service import format_documento, only_digits
from apps.faturamento.models import (
    TIPO_PESSOA_JURIDICA,
    format_municipio_cadastro,
    format_nome_cadastro,
)

SITUACAO_POTENCIAL = 'potencial'
SITUACAO_CLIENTE = 'cliente'
SITUACAO_INATIVO = 'inativo'
SITUACAO_CHOICES = [
    (SITUACAO_POTENCIAL, 'Potencial cliente'),
    (SITUACAO_CLIENTE, 'Cliente'),
    (SITUACAO_INATIVO, 'Inativo'),
]
SITUACAO_VALORES = {choice[0] for choice in SITUACAO_CHOICES}

COMPATIBILIDADE_NAO_ANALISADO = 'nao_analisado'
COMPATIBILIDADE_PENDENTE_VALIDACAO = 'pendente_validacao'
COMPATIBILIDADE_HOMOLOGADO = 'homologado'
COMPATIBILIDADE_REPROVADO = 'reprovado'
COMPATIBILIDADE_COMPATIVEL = COMPATIBILIDADE_HOMOLOGADO
COMPATIBILIDADE_INCOMPATIVEL = COMPATIBILIDADE_REPROVADO
COMPATIBILIDADE_CHOICES = [
    (COMPATIBILIDADE_NAO_ANALISADO, 'Pendente de validação'),
    (COMPATIBILIDADE_PENDENTE_VALIDACAO, 'Pendente de validação'),
    (COMPATIBILIDADE_HOMOLOGADO, 'Homologado'),
    (COMPATIBILIDADE_REPROVADO, 'Reprovado'),
]
COMPATIBILIDADE_LEGADO = {
    'compativel': COMPATIBILIDADE_HOMOLOGADO,
    'incompativel': COMPATIBILIDADE_REPROVADO,
}
COMPATIBILIDADE_VALORES = {choice[0] for choice in COMPATIBILIDADE_CHOICES} | set(COMPATIBILIDADE_LEGADO)


def normalizar_homologacao(value: str) -> str:
    raw = (value or '').strip()
    if raw in COMPATIBILIDADE_LEGADO:
        return COMPATIBILIDADE_LEGADO[raw]
    if raw in {choice[0] for choice in COMPATIBILIDADE_CHOICES}:
        return raw
    return COMPATIBILIDADE_NAO_ANALISADO

EMBALAGENS_PADRAO = [
    'Bombona',
    'Bag',
    'Big bag',
    'Caixa',
    'Tambor',
    'IBC',
    'Palletizado',
]
POSICOES_PALLETS_PADRAO = ['14', '24', '26', '28']
PREVISAO_VOLUMES_PADRAO = ['Mensal', 'Semanal', 'Por embarque']

CLASSE_RISCO_NAO_CLASSIFICADO = 'nao_classificado'
CLASSE_RISCO_CHOICES = [
    (CLASSE_RISCO_NAO_CLASSIFICADO, 'Não classificado / não perigoso'),
    ('1', '1 — Explosivos'),
    ('2', '2 — Gases'),
    ('2.1', '2.1 — Gases inflamáveis'),
    ('2.2', '2.2 — Gases não inflamáveis'),
    ('2.3', '2.3 — Gases tóxicos'),
    ('3', '3 — Líquidos inflamáveis'),
    ('4.1', '4.1 — Sólidos inflamáveis'),
    ('4.2', '4.2 — Combustão espontânea'),
    ('4.3', '4.3 — Perigosos quando molhados'),
    ('5.1', '5.1 — Oxidantes'),
    ('5.2', '5.2 — Peróxidos orgânicos'),
    ('6.1', '6.1 — Substâncias tóxicas'),
    ('6.2', '6.2 — Substâncias infectantes'),
    ('8', '8 — Corrosivos'),
    ('9', '9 — Substâncias e artigos perigosos diversos'),
]
CLASSE_RISCO_VALORES = {item[0] for item in CLASSE_RISCO_CHOICES}

FISPQ_LEGADO = {
    'pendente',
    'portal_fabricante',
    'arquivo_interno',
    'disponivel_embarque',
    'nao_se_aplica',
    'portal do fabricante',
    'arquivo interno',
    'disponível no embarque',
    'disponivel no embarque',
}


def normalizar_fispq(value: str) -> str:
    raw = (value or '').strip()
    if not raw or raw.casefold() in FISPQ_LEGADO:
        return ''
    if raw.startswith(('http://', 'https://')):
        return raw[:500]
    if raw.startswith('www.'):
        return f'https://{raw}'[:500]
    return raw[:500]


def fispq_tem_link(value: str) -> bool:
    return bool(normalizar_fispq(value))

GRUPO_EMBALAGEM_NAO_APLICAVEL = 'nao_aplicavel'
GRUPO_EMBALAGEM_CHOICES = [
    (GRUPO_EMBALAGEM_NAO_APLICAVEL, 'Não se aplica'),
    ('I', 'Grupo I'),
    ('II', 'Grupo II'),
    ('III', 'Grupo III'),
]
GRUPO_EMBALAGEM_VALORES = {item[0] for item in GRUPO_EMBALAGEM_CHOICES}

ONU_PARA_CLASSE = {
    '1203': '3',
    '1263': '3',
    '1993': '3',
    '1759': '8',
    '1760': '8',
    '2922': '8',
    '2810': '6.1',
    '2811': '6.1',
    '3077': '9',
    '3082': '9',
}


def normalizar_numero_onu(value: str) -> str:
    return re.sub(r'\D', '', value or '')[:4]


def normalizar_classe_risco(value: str) -> str:
    raw = (value or '').strip()
    if raw in CLASSE_RISCO_VALORES:
        return raw
    token = raw.split('—')[0].split('-')[0].strip()
    if token in CLASSE_RISCO_VALORES:
        return token
    return CLASSE_RISCO_NAO_CLASSIFICADO


def normalizar_grupo_embalagem(value: str) -> str:
    raw = (value or '').strip().upper()
    if raw in GRUPO_EMBALAGEM_VALORES:
        return raw
    if raw in {'1', 'I'}:
        return 'I'
    if raw in {'2', 'II'}:
        return 'II'
    if raw in {'3', 'III'}:
        return 'III'
    return GRUPO_EMBALAGEM_NAO_APLICAVEL


def _valores_unicos(*grupos):
    seen = set()
    result = []
    for grupo in grupos:
        for item in grupo:
            value = str(item or '').strip()
            if not value:
                continue
            key = value.casefold()
            if key in seen:
                continue
            seen.add(key)
            result.append(value)
    return result


class ClienteComercial(models.Model):
    tipo_pessoa = models.CharField(
        max_length=1,
        default=TIPO_PESSOA_JURIDICA,
        verbose_name='Tipo de pessoa',
    )
    cnpj = models.CharField(max_length=20, blank=True, default='', verbose_name='CNPJ')
    cnpj_digits = models.CharField(max_length=14, blank=True, default='', db_index=True)
    razao_social = models.CharField(max_length=200, verbose_name='Razão social')
    nome_fantasia = models.CharField(max_length=200, blank=True, default='', verbose_name='Nome fantasia')
    municipio = models.CharField(max_length=150, blank=True, default='', verbose_name='Município')
    uf = models.CharField(max_length=2, blank=True, default='', verbose_name='UF')
    logradouro = models.CharField(max_length=200, blank=True, default='')
    numero = models.CharField(max_length=20, blank=True, default='')
    complemento = models.CharField(max_length=80, blank=True, default='')
    bairro = models.CharField(max_length=120, blank=True, default='')
    cep = models.CharField(max_length=10, blank=True, default='')
    telefone = models.CharField(max_length=30, blank=True, default='')
    email = models.CharField(max_length=254, blank=True, default='')
    inscricao_estadual = models.CharField(max_length=20, blank=True, default='', verbose_name='Inscrição estadual')
    responsavel = models.CharField(max_length=150, blank=True, default='', verbose_name='Responsável')
    observacoes = models.TextField(blank=True, default='')
    situacao = models.CharField(
        max_length=20,
        choices=SITUACAO_CHOICES,
        default=SITUACAO_POTENCIAL,
        verbose_name='Situação',
    )
    compatibilidade = models.CharField(
        max_length=20,
        choices=COMPATIBILIDADE_CHOICES,
        default=COMPATIBILIDADE_NAO_ANALISADO,
        verbose_name='Homologação de produtos',
    )
    previsao_volumes = models.CharField(max_length=200, blank=True, default='', verbose_name='Previsão de volumes')
    tipos_embalagens = models.CharField(max_length=200, blank=True, default='', verbose_name='Tipos de embalagens')
    quantidade_volumes = models.CharField(max_length=80, blank=True, default='', verbose_name='Quantidade')
    posicoes_pallets = models.CharField(max_length=80, blank=True, default='', verbose_name='Posições pallets')
    cliente_desde = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Cliente desde',
    )
    homologado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='clientes_homologados',
        verbose_name='Homologado por',
    )
    homologado_em = models.DateTimeField(null=True, blank=True)
    homologacao_justificativa = models.TextField(blank=True, default='')
    homologacao_revisao = models.PositiveIntegerField(default=0)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['razao_social', 'cnpj']
        verbose_name = 'Cliente comercial'
        verbose_name_plural = 'Clientes comerciais'
        constraints = [
            models.UniqueConstraint(
                fields=['cnpj_digits'],
                name='comercial_cliente_cnpj_digits_uniq',
                condition=~models.Q(cnpj_digits=''),
            ),
        ]

    def save(self, *args, **kwargs):
        self.tipo_pessoa = TIPO_PESSOA_JURIDICA
        digits = only_digits(self.cnpj or '', 14)
        self.cnpj_digits = digits
        self.cnpj = format_documento(digits, TIPO_PESSOA_JURIDICA) if digits else ''
        self.razao_social = format_nome_cadastro(self.razao_social)
        self.nome_fantasia = format_nome_cadastro(self.nome_fantasia)
        self.municipio = format_municipio_cadastro(self.municipio)
        self.uf = (self.uf or '').strip().upper()[:2]
        self.logradouro = (self.logradouro or '').strip()
        self.numero = (self.numero or '').strip()
        self.complemento = (self.complemento or '').strip()
        self.bairro = (self.bairro or '').strip()
        self.cep = (self.cep or '').strip()
        self.telefone = (self.telefone or '').strip()
        self.email = (self.email or '').strip().lower()
        self.inscricao_estadual = (self.inscricao_estadual or '').strip().upper()
        self.responsavel = (self.responsavel or '').strip()
        self.previsao_volumes = (self.previsao_volumes or '').strip()
        self.tipos_embalagens = (self.tipos_embalagens or '').strip()
        self.quantidade_volumes = (self.quantidade_volumes or '').strip()
        self.posicoes_pallets = (self.posicoes_pallets or '').strip()
        if self.situacao not in SITUACAO_VALORES:
            self.situacao = SITUACAO_POTENCIAL
        if self.compatibilidade not in {choice[0] for choice in COMPATIBILIDADE_CHOICES}:
            self.compatibilidade = normalizar_homologacao(self.compatibilidade)
        if self.situacao == SITUACAO_CLIENTE and self.cliente_desde is None:
            self.cliente_desde = timezone.now()
        super().save(*args, **kwargs)

    def tornar_cliente(self, quando=None) -> bool:
        agora = quando or timezone.now()
        campos = []
        if self.situacao != SITUACAO_CLIENTE:
            self.situacao = SITUACAO_CLIENTE
            campos.append('situacao')
        if self.cliente_desde is None:
            self.cliente_desde = agora
            campos.append('cliente_desde')
        if not campos:
            return False
        campos.append('data_atualizacao')
        self.save(update_fields=campos)
        return True

    def __str__(self):
        return self.razao_social or self.cnpj or f'Cliente {self.pk}'


class ProdutoComercial(models.Model):
    nome = models.CharField(max_length=200, verbose_name='Produto')
    classe_risco = models.CharField(
        max_length=20,
        choices=CLASSE_RISCO_CHOICES,
        default=CLASSE_RISCO_NAO_CLASSIFICADO,
        verbose_name='Classe de risco',
    )
    numero_onu = models.CharField(max_length=4, blank=True, default='', verbose_name='Nº de ONU')
    grupo_embalagem = models.CharField(
        max_length=20,
        choices=GRUPO_EMBALAGEM_CHOICES,
        default=GRUPO_EMBALAGEM_NAO_APLICAVEL,
        verbose_name='Grupo de embalagem',
    )
    fispq_consulta = models.CharField(
        max_length=500,
        blank=True,
        default='',
        verbose_name='Link da FISPQ/FDS',
    )
    ativo = models.BooleanField(default=True)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='produtos_comerciais_criados',
    )
    atualizado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='produtos_comerciais_atualizados',
    )
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['nome']
        verbose_name = 'Produto comercial'
        verbose_name_plural = 'Produtos comerciais'
        constraints = [
            models.UniqueConstraint(Lower('nome'), name='comercial_produto_nome_ci_uniq'),
        ]

    def save(self, *args, **kwargs):
        self.nome = format_nome_cadastro(self.nome)
        self.numero_onu = normalizar_numero_onu(self.numero_onu)
        self.classe_risco = normalizar_classe_risco(self.classe_risco)
        self.grupo_embalagem = normalizar_grupo_embalagem(self.grupo_embalagem)
        self.fispq_consulta = normalizar_fispq(self.fispq_consulta)
        if self.numero_onu in ONU_PARA_CLASSE and self.classe_risco == CLASSE_RISCO_NAO_CLASSIFICADO:
            self.classe_risco = ONU_PARA_CLASSE[self.numero_onu]
        if self.classe_risco == CLASSE_RISCO_NAO_CLASSIFICADO:
            self.grupo_embalagem = GRUPO_EMBALAGEM_NAO_APLICAVEL
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nome or f'Produto {self.pk}'


class ClienteComercialProduto(models.Model):
    cliente = models.ForeignKey(
        ClienteComercial,
        on_delete=models.CASCADE,
        related_name='produtos',
    )
    produto = models.ForeignKey(
        ProdutoComercial,
        on_delete=models.CASCADE,
        related_name='vinculos',
        null=True,
        blank=True,
    )
    ordem = models.PositiveIntegerField(default=0)
    nome = models.CharField(max_length=200, blank=True, default='', verbose_name='Produto')
    classe_risco = models.CharField(
        max_length=20,
        choices=CLASSE_RISCO_CHOICES,
        default=CLASSE_RISCO_NAO_CLASSIFICADO,
        verbose_name='Classe de risco',
    )
    numero_onu = models.CharField(max_length=4, blank=True, default='', verbose_name='Nº de ONU')
    grupo_embalagem = models.CharField(
        max_length=20,
        choices=GRUPO_EMBALAGEM_CHOICES,
        default=GRUPO_EMBALAGEM_NAO_APLICAVEL,
        verbose_name='Grupo de embalagem',
    )
    fispq_consulta = models.CharField(
        max_length=500,
        blank=True,
        default='',
        verbose_name='Link da FISPQ/FDS',
    )

    class Meta:
        ordering = ['ordem', 'id']
        verbose_name = 'Produto do cliente comercial'
        verbose_name_plural = 'Produtos do cliente comercial'
        constraints = [
            models.UniqueConstraint(
                fields=['cliente', 'produto'],
                name='comercial_cliente_produto_uniq',
                condition=models.Q(produto__isnull=False),
            ),
        ]

    def save(self, *args, **kwargs):
        catalogo = self.produto
        if catalogo is not None:
            self.nome = catalogo.nome
            self.classe_risco = catalogo.classe_risco
            self.numero_onu = catalogo.numero_onu
            self.grupo_embalagem = catalogo.grupo_embalagem
            self.fispq_consulta = catalogo.fispq_consulta
        else:
            self.nome = (self.nome or '').strip()
            self.numero_onu = normalizar_numero_onu(self.numero_onu)
            self.classe_risco = normalizar_classe_risco(self.classe_risco)
            self.grupo_embalagem = normalizar_grupo_embalagem(self.grupo_embalagem)
            self.fispq_consulta = normalizar_fispq(self.fispq_consulta)
            if self.numero_onu in ONU_PARA_CLASSE and self.classe_risco == CLASSE_RISCO_NAO_CLASSIFICADO:
                self.classe_risco = ONU_PARA_CLASSE[self.numero_onu]
            if self.classe_risco == CLASSE_RISCO_NAO_CLASSIFICADO:
                self.grupo_embalagem = GRUPO_EMBALAGEM_NAO_APLICAVEL
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nome or (self.produto.nome if self.produto_id else f'Produto {self.pk}')


class HomologacaoProdutoEvento(models.Model):
    EVENTO_REABERTO = 'reaberto'
    EVENTO_CHOICES = [
        (COMPATIBILIDADE_NAO_ANALISADO, 'Não analisado'),
        (COMPATIBILIDADE_PENDENTE_VALIDACAO, 'Pendente de validação'),
        (COMPATIBILIDADE_HOMOLOGADO, 'Homologado'),
        (COMPATIBILIDADE_REPROVADO, 'Reprovado'),
        (EVENTO_REABERTO, 'Reaberto para validação'),
    ]

    cliente = models.ForeignKey(
        ClienteComercial,
        on_delete=models.CASCADE,
        related_name='homologacao_eventos',
    )
    status = models.CharField(max_length=32, choices=EVENTO_CHOICES)
    justificativa = models.TextField(blank=True, default='')
    produtos_snapshot = models.JSONField(default=list, blank=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='homologacao_eventos',
    )
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-data_criacao', '-id']
        verbose_name = 'Evento de homologação de produtos'
        verbose_name_plural = 'Eventos de homologação de produtos'


def sugestoes_produtos_atividade():
    produtos = ProdutoComercial.objects.filter(ativo=True).order_by('nome')
    catalogo = []
    for produto in produtos[:80]:
        catalogo.append({
            'id': str(produto.pk),
            'nome': produto.nome,
            'fispq': produto.fispq_consulta,
            'numeroOnu': produto.numero_onu,
            'classeRisco': produto.classe_risco,
            'grupoEmbalagem': produto.grupo_embalagem,
        })
    return {
        'classesRisco': [{'value': value, 'label': label} for value, label in CLASSE_RISCO_CHOICES],
        'fispq': [],
        'gruposEmbalagem': [{'value': value, 'label': label} for value, label in GRUPO_EMBALAGEM_CHOICES],
        'onuComuns': [
            {'numeroOnu': numero, 'classeRisco': classe}
            for numero, classe in ONU_PARA_CLASSE.items()
        ],
        'homologacao': [{'value': value, 'label': label} for value, label in COMPATIBILIDADE_CHOICES],
        'produtos': catalogo,
    }


TIPO_PROPOSTA_TRANSPORTE_RODOVIARIO = 'transporte_rodoviario'
TIPO_PROPOSTA_ARMAZENAGEM = 'armazenagem'
TIPO_PROPOSTA_FRETE = TIPO_PROPOSTA_TRANSPORTE_RODOVIARIO
TIPO_PROPOSTA_CHOICES = [
    (TIPO_PROPOSTA_TRANSPORTE_RODOVIARIO, 'Transporte rodoviário'),
    (TIPO_PROPOSTA_ARMAZENAGEM, 'Armazenagem'),
]
SERVICOS_TRANSPORTE = {
    TIPO_PROPOSTA_TRANSPORTE_RODOVIARIO,
    'frete',
    'transporte_container',
}

STATUS_PROPOSTA_RASCUNHO = 'rascunho'
STATUS_PROPOSTA_ENVIADA = 'enviada'
STATUS_PROPOSTA_APROVADA = 'aprovada'
STATUS_PROPOSTA_RECUSADA = 'recusada'
STATUS_PROPOSTA_CHOICES = [
    (STATUS_PROPOSTA_RASCUNHO, 'Rascunho'),
    (STATUS_PROPOSTA_ENVIADA, 'Enviada'),
    (STATUS_PROPOSTA_APROVADA, 'Aceita'),
    (STATUS_PROPOSTA_RECUSADA, 'Recusada'),
]


TIPO_GENERALIDADE_FRETE = 'frete'
TIPO_GENERALIDADE_DISTRIBUICAO = 'distribuicao'
TIPO_GENERALIDADE_ARMAZENAGEM = 'armazenagem'
TIPO_GENERALIDADE_CHOICES = [
    (TIPO_GENERALIDADE_FRETE, 'Transferência'),
    (TIPO_GENERALIDADE_DISTRIBUICAO, 'Distribuição'),
    (TIPO_GENERALIDADE_ARMAZENAGEM, 'Armazenagem'),
]
TIPOS_GENERALIDADE = {key for key, _label in TIPO_GENERALIDADE_CHOICES}


def tipos_servico_generalidade(tipo_proposta, inclui_transferencia=False, inclui_distribuicao=False):
    if tipo_proposta == TIPO_PROPOSTA_ARMAZENAGEM:
        return [TIPO_GENERALIDADE_ARMAZENAGEM]
    tipos = []
    if inclui_distribuicao:
        tipos.append(TIPO_GENERALIDADE_DISTRIBUICAO)
    if inclui_transferencia:
        tipos.append(TIPO_GENERALIDADE_FRETE)
    return tipos


CONDICOES_FRETE_PADRAO = [
    {'rotulo': 'Capacidade dos veículos - Carreta', 'valor': 'Carreta Graneleira (Até 33ton) 26 Pallets'},
    {'rotulo': 'Limite por Embarque', 'valor': 'R$ 2.000.000,00'},
    {'rotulo': 'Custo da Escolta', 'valor': 'Não incluso. Se necessário, mediante negociação.'},
    {'rotulo': 'Cubagem', 'valor': '1.000 kg por palete ou 300 kg por m³'},
    {'rotulo': 'ICMS / ISS', 'valor': 'Não incluso nos valores acima, cobrado conforme legislação vigente'},
    {'rotulo': 'Ad valorem / Griss', 'valor': 'Cobrado sobre o valor das notas fiscais de acordo com percentual descrito na tabela'},
    {'rotulo': 'Pedágios', 'valor': 'Conforme Legislação'},
    {'rotulo': 'Serviços de Ajudantes', 'valor': 'Não incluso. Se necessário, mediante negociação'},
    {'rotulo': 'Devolução', 'valor': 'Mediante a Negociação'},
    {'rotulo': 'Reentrega', 'valor': 'Mediante a Negociação'},
    {'rotulo': 'Carga e Descarga', 'valor': 'Não incluso (em caso de cobrança será repassado comprovante e cobrado o reembolso)'},
    {'rotulo': 'Prazo de entrega', 'valor': 'Em dias úteis, contados à partir do dia seguinte ao carregamento'},
    {'rotulo': 'Diária', 'valor': 'Conforme legislação ANTT'},
    {'rotulo': 'Franquia de Carga e Descarga', 'valor': '5 horas, acima deste período segue conforme legislação ANTT'},
    {'rotulo': 'Faturamento', 'valor': 'Semanal'},
    {'rotulo': 'Prazo de Pagamento', 'valor': '30 DDL'},
    {'rotulo': 'Validade da Proposta', 'valor': '30 dias'},
    {'rotulo': 'Vigência', 'valor': '12 meses'},
    {'rotulo': 'Reajuste', 'valor': 'Anual com base no índice INCT'},
]

CONSIDERACOES_DISTRIBUICAO_PADRAO = [
    {'rotulo': 'Limite de embarque', 'valor': 'R$ 2.000.000,00'},
    {'rotulo': 'Capacidades dos veículos', 'valor': 'Truck (14 ton) 14 pallets — Carreta graneleira / sider (até 32 ton) 24, 26, 28 pallets'},
    {'rotulo': 'Carga e descarga', 'valor': 'Tarifas livres de cargas e descargas'},
    {'rotulo': 'Franquia de carga e descarga', 'valor': '5 horas, acima deste período segue conforme legislação ANTT'},
    {'rotulo': 'Pedágios', 'valor': 'Conforme tabela acima'},
    {'rotulo': 'Diárias', 'valor': 'Conforme legislação ANTT'},
    {'rotulo': 'Balsa', 'valor': 'Não incluído nas tarifas'},
    {'rotulo': 'Escolta', 'valor': 'Não incluído nas tarifas'},
    {'rotulo': 'Prazo de coleta', 'valor': '48 horas após a data do recebimento da NF-e (D+2)'},
    {'rotulo': 'Prazo de entrega', 'valor': 'Em dias úteis, contados a partir do dia seguinte ao carregamento conforme tabela'},
    {'rotulo': 'Devolução e/ou reentrega', 'valor': 'Conforme negociação no ato da ocorrência'},
    {'rotulo': 'ICMS/ISS', 'valor': 'Não incluso nos valores acima, cobrado conforme legislação vigente'},
    {'rotulo': '+ de 1 NF mesmo CNPJ', 'valor': 'Emitimos no mesmo dia 1 único CT-e; datas diferentes, mais de 1 CT-e'},
    {'rotulo': 'Faturamento', 'valor': 'Semanal'},
    {'rotulo': 'Prazo de pagamento', 'valor': '30 DDL'},
    {'rotulo': 'Vigência', 'valor': '12 meses'},
]

OBSERVACOES_ARMAZENAGEM_PADRAO = [
    {'rotulo': '(1)', 'valor': 'Faturamento mínimo considerando 50% da capacidade máxima acordada.'},
    {'rotulo': '(2)', 'valor': 'Cobrado pela quantidade das posições palete no pico da ocupação mensal até o limite de 1.000 posições pallets.'},
    {'rotulo': '(3)', 'valor': 'Cobrada por tonelada movimentada. Cobrado na entrada e/ou saída dos produtos no armazém. (Capacidade diária de 100 toneladas na entrada e 150 toneladas na saída).'},
    {'rotulo': '(4)', 'valor': 'Cobrado sobre o valor da mercadoria armazenada no pico da ocupação mensal. (Propriedade Albaugh)'},
    {'rotulo': '(5)', 'valor': 'Cobrado sobre o valor da mercadoria armazenada no pico da ocupação mensal. (Em regime de AG)'},
    {'rotulo': '(6)', 'valor': 'Custo para um colaborador dedicado a ser cobrado apenas quando a quantidade de clientes AG for superior a 20.'},
    {'rotulo': '(7)', 'valor': 'Custo por tonelada movimentada em horários extraordinários.'},
    {'rotulo': 'a)', 'valor': 'A utilização acima da capacidade máxima acordada será sob disponibilidade.'},
    {'rotulo': 'b)', 'valor': 'Os custos de carga e descarga serão cobrados dos transportadores contratados pelo cliente: R$ 25,00/ton + ISS.'},
    {'rotulo': 'c)', 'valor': 'Essa proposta não contempla custos para reetiquetagem e montagem de kits.'},
    {'rotulo': 'd)', 'valor': 'As notas fiscais consideradas para separação num determinado dia serão as emitidas até as 15 horas deste dia.'},
    {'rotulo': 'e)', 'valor': 'Taxa de inventário será tratada conforme necessidade.'},
    {'rotulo': 'f)', 'valor': 'Faturamento mensal, com prazo de pagamento de 120 DDL.'},
    {'rotulo': 'g)', 'valor': 'ISS por conta da contratante.'},
    {'rotulo': 'h)', 'valor': 'O reajuste nas tarifas é aplicado anualmente através de nova negociação entre as partes.'},
]


def tabela_armazenagem_padrao():
    return {
        'codigo': 'AG',
        'local': 'RONDONÓPOLIS-MT',
        'periodoInicio': '',
        'periodoFim': '',
        'unidade': 'MT',
        'itens': [
            {'rotulo': 'FATURAMENTO MÍNIMO (1)', 'valor': '-', 'formato': 'moeda'},
            {'rotulo': 'VALOR POR POSIÇÃO PALLET ATÉ A CAPACIDADE MÁXIMA ACORDADA (2)', 'valor': '-', 'formato': 'moeda'},
            {'rotulo': 'MOVIMENTAÇÃO (R$/TON) (3)', 'valor': '-', 'formato': 'tonelada'},
            {'rotulo': 'SEGURO (4)', 'valor': '-', 'formato': 'percentual'},
            {'rotulo': 'SEGURO "AG" (5)', 'valor': '-', 'formato': 'percentual'},
            {'rotulo': 'COLABORADOR DEDICADO (6)', 'valor': '-', 'formato': 'moeda'},
            {'rotulo': 'CAPACIDADE MÁXIMA ACORDADA (POSIÇÕES PALETE)', 'valor': '-', 'formato': 'quantidade'},
        ],
        'horaExtraTitulo': 'Hora-extra (7)',
        'horaExtra': [
            {'periodo': 'De segunda a sábado', 'valor': '-', 'formato': 'tonelada'},
            {'periodo': 'Domingos e feriados', 'valor': '-', 'formato': 'tonelada'},
        ],
        'expediente': 'Expediente do CD: de seg a sex das 08:00 às 17:00h',
    }


def erro_valores_tabela_armazenagem(tabela):
    """Exige valor em cada tarifa; o traço (-) vale como sem cotação."""
    if not isinstance(tabela, dict):
        return 'Informe a tabela de armazenagem.'

    def _linhas_ok(linhas, chave_rotulo, chave_valor):
        visiveis = []
        for item in linhas or []:
            if not isinstance(item, dict):
                continue
            rotulo = str(item.get(chave_rotulo) or '').strip()
            valor = str(item.get(chave_valor) or '').strip()
            if not rotulo and not valor:
                continue
            visiveis.append((rotulo, valor))
        if not visiveis:
            return False
        return all(rotulo and valor for rotulo, valor in visiveis)

    if not _linhas_ok(tabela.get('itens'), 'rotulo', 'valor'):
        return 'Informe o valor de cada tarifa de armazenagem ou coloque um traço (-).'
    if not _linhas_ok(tabela.get('horaExtra') or tabela.get('hora_extra'), 'periodo', 'valor'):
        return 'Informe o valor de cada hora-extra ou coloque um traço (-).'
    return ''


def catalogo_generalidades_padrao(tipo_servico):
    if tipo_servico == TIPO_GENERALIDADE_DISTRIBUICAO:
        return CONSIDERACOES_DISTRIBUICAO_PADRAO
    if tipo_servico == TIPO_GENERALIDADE_ARMAZENAGEM:
        return OBSERVACOES_ARMAZENAGEM_PADRAO
    return CONDICOES_FRETE_PADRAO


class PropostaComercial(models.Model):
    tipo = models.CharField(max_length=32, choices=TIPO_PROPOSTA_CHOICES, verbose_name='Serviço')
    status = models.CharField(
        max_length=20,
        choices=STATUS_PROPOSTA_CHOICES,
        default=STATUS_PROPOSTA_RASCUNHO,
        verbose_name='Status',
    )
    cliente = models.ForeignKey(
        ClienteComercial,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='propostas',
        verbose_name='Cliente',
    )
    titulo = models.CharField(max_length=200, verbose_name='Título')
    subtitulo = models.CharField(max_length=240, blank=True, default='', verbose_name='Subtítulo')
    revisao = models.CharField(max_length=10, blank=True, default='01', verbose_name='Revisão')
    data_proposta = models.DateField(null=True, blank=True, verbose_name='Data da proposta')
    proposta_referente = models.CharField(max_length=200, blank=True, default='')
    responsavel = models.CharField(max_length=150, blank=True, default='', verbose_name='Responsável')
    reajuste = models.CharField(max_length=200, blank=True, default='Anual com base no índice INCT')
    cliente_nome = models.CharField(max_length=200, blank=True, default='', verbose_name='Cliente (proposta)')
    att = models.CharField(max_length=150, blank=True, default='', verbose_name='Responsável do cliente')
    validade = models.CharField(max_length=80, blank=True, default='30 dias')
    vigencia = models.CharField(max_length=80, blank=True, default='12 meses', verbose_name='Vigência do contrato')
    faturamento = models.CharField(max_length=120, blank=True, default='Semanal / 30 DDL')
    local_emissao = models.CharField(max_length=120, blank=True, default='')
    valor_estimado = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Valor estimado',
    )
    observacoes = models.TextField(blank=True, default='')
    inclui_transferencia = models.BooleanField(default=False, verbose_name='Transferência')
    inclui_distribuicao = models.BooleanField(default=False, verbose_name='Distribuição')
    condicoes = models.JSONField(default=list, blank=True, verbose_name='Generalidades e condições')
    tabela_armazenagem = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Tabela de armazenagem',
    )
    ano = models.PositiveIntegerField(null=True, blank=True, db_index=True, verbose_name='Ano da numeração')
    numero = models.PositiveIntegerField(null=True, blank=True, verbose_name='Número da proposta')
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-data_criacao']
        verbose_name = 'Proposta comercial'
        verbose_name_plural = 'Propostas comerciais'
        constraints = [
            models.UniqueConstraint(
                fields=['ano', 'numero'],
                name='comercial_proposta_numero_ano_uniq',
                condition=models.Q(ano__isnull=False, numero__isnull=False),
            ),
        ]

    @property
    def numero_identificacao(self):
        if self.numero and self.ano:
            return f'{self.numero:03d}-{self.ano}'
        return ''

    def _ano_numeracao(self):
        if self.data_proposta:
            return self.data_proposta.year
        if self.data_criacao:
            return self.data_criacao.year
        return timezone.localdate().year

    def _atribuir_numero(self):
        if self.numero and self.ano:
            return
        ano = self._ano_numeracao()
        ultimo = (
            PropostaComercial.objects.select_for_update()
            .filter(ano=ano)
            .aggregate(ultimo=Max('numero'))
            .get('ultimo')
            or 0
        )
        self.ano = ano
        self.numero = ultimo + 1

    def save(self, *args, **kwargs):
        if self.tipo in {'frete', 'transporte_container'}:
            self.tipo = TIPO_PROPOSTA_TRANSPORTE_RODOVIARIO
        self.titulo = ' '.join((self.titulo or '').split())
        if not self.titulo:
            servico = dict(TIPO_PROPOSTA_CHOICES).get(self.tipo, 'Proposta')
            nome = (self.cliente_nome or '').strip()
            self.titulo = f'{servico} — {nome}' if nome else servico
        if not self.condicoes:
            self.condicoes = default_condicoes(
                cliente=self.cliente,
                tipos_servico=tipos_servico_generalidade(
                    self.tipo,
                    self.inclui_transferencia,
                    self.inclui_distribuicao,
                ),
            )
        if self.cliente_id:
            razao = (getattr(self.cliente, 'razao_social', '') or '').strip()
            if razao:
                self.cliente_nome = razao
        if self.numero and self.ano:
            super().save(*args, **kwargs)
            self._promover_cliente_se_aceita()
            return
        with transaction.atomic():
            self._atribuir_numero()
            super().save(*args, **kwargs)
        self._promover_cliente_se_aceita()

    def _promover_cliente_se_aceita(self):
        if self.status != STATUS_PROPOSTA_APROVADA or not self.cliente_id:
            return
        cliente = ClienteComercial.objects.filter(pk=self.cliente_id).first()
        if cliente:
            cliente.tornar_cliente()

    def __str__(self):
        return self.titulo or f'Proposta {self.pk}'

    def validade_em_dias(self):
        match = re.search(r'(\d+)', self.validade or '')
        if not match:
            return None
        texto = (self.validade or '').lower()
        dias = int(match.group(1))
        if 'mes' in texto:
            return dias * 30
        return dias

    def data_base_vigencia(self):
        if self.data_proposta:
            return self.data_proposta
        if self.data_criacao:
            return self.data_criacao.date()
        return None

    def data_vencimento(self):
        base = self.data_base_vigencia()
        dias = self.validade_em_dias()
        if not base or dias is None:
            return None
        return base + timedelta(days=dias)


class PropostaComercialDraft(models.Model):
    """Rascunho de nova proposta — um por usuário autenticado."""

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='proposta_comercial_draft',
        verbose_name='Usuário',
    )
    version = models.PositiveSmallIntegerField(default=1)
    payload = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Rascunho de proposta comercial'
        verbose_name_plural = 'Rascunhos de proposta comercial'

    def __str__(self):
        return f'Rascunho de proposta de {self.usuario}'


class PropostaFreteLinha(models.Model):
    proposta = models.ForeignKey(
        PropostaComercial,
        on_delete=models.CASCADE,
        related_name='linhas',
    )
    ordem = models.PositiveIntegerField(default=0)
    origem = models.CharField(max_length=120, blank=True, default='')
    entrega = models.CharField(max_length=120, blank=True, default='', verbose_name='Destino')
    veiculo = models.CharField(max_length=80, blank=True, default='', verbose_name='Veículo')
    devolucao_container = models.CharField(max_length=120, blank=True, default='', verbose_name='Dev. CTNR')
    observacoes = models.CharField(max_length=200, blank=True, default='')
    peso = models.CharField(max_length=40, blank=True, default='')
    tarifa_frete = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    pedagio = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    ad_valorem = models.CharField(max_length=20, blank=True, default='', verbose_name='Ad-VL')
    gris = models.CharField(max_length=20, blank=True, default='', verbose_name='GRIS')
    icms = models.CharField(max_length=40, blank=True, default='Não incluso')
    prazo_dias = models.CharField(max_length=20, blank=True, default='')
    total_estimado = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ['ordem', 'pk']
        verbose_name = 'Linha de frete'
        verbose_name_plural = 'Linhas de frete'

    def save(self, *args, **kwargs):
        tarifa = self.tarifa_frete or 0
        pedagio = self.pedagio or 0
        if self.tarifa_frete is not None or self.pedagio is not None:
            self.total_estimado = tarifa + pedagio
        super().save(*args, **kwargs)


TIPO_TABELA_TRANSFERENCIA = 'transferencia'
TIPO_TABELA_DISTRIBUICAO = 'distribuicao'
TIPO_TABELA_FRETE_CHOICES = [
    (TIPO_TABELA_TRANSFERENCIA, 'Transferência'),
    (TIPO_TABELA_DISTRIBUICAO, 'Distribuição'),
]

STATUS_TABELA_RASCUNHO = 'rascunho'
STATUS_TABELA_PUBLICADA = 'publicada'
STATUS_TABELA_EXPIRADA = 'expirada'
STATUS_TABELA_ARQUIVADA = 'arquivada'
STATUS_TABELA_FRETE_CHOICES = [
    (STATUS_TABELA_RASCUNHO, 'Rascunho'),
    (STATUS_TABELA_PUBLICADA, 'Publicada'),
    (STATUS_TABELA_EXPIRADA, 'Expirada'),
    (STATUS_TABELA_ARQUIVADA, 'Arquivada'),
]


def default_tabela_frete_config():
    from .tabela_distribuicao import default_config_distribuicao

    return default_config_distribuicao()


def nome_base_tabela_frete(nome: str) -> str:
    cleaned = re.sub(r'\s*rev\.?\s*\d+\s*$', '', nome or '', flags=re.I).strip()
    return cleaned or (nome or '').strip()


class TabelaFrete(models.Model):
    nome = models.CharField(max_length=160)
    codigo = models.CharField(max_length=40, blank=True, default='')
    revisao = models.PositiveIntegerField(default=1)
    vigencia_inicio = models.DateField(null=True, blank=True)
    vigencia_fim = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_TABELA_FRETE_CHOICES,
        default=STATUS_TABELA_RASCUNHO,
    )
    observacoes = models.TextField(blank=True, default='')
    clientes = models.ManyToManyField(
        ClienteComercial,
        blank=True,
        related_name='tabelas_frete',
    )
    clientes_vinculo_key = models.CharField(max_length=500, blank=True, default='')
    tipo = models.CharField(
        max_length=20,
        choices=TIPO_TABELA_FRETE_CHOICES,
        default=TIPO_TABELA_TRANSFERENCIA,
    )
    config = models.JSONField(default=default_tabela_frete_config, blank=True)
    faixas = models.JSONField(default=list, blank=True)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tabelas_frete_criadas',
    )
    atualizado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tabelas_frete_atualizadas',
    )
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-data_atualizacao', 'nome']
        verbose_name = 'Tabela de frete'
        verbose_name_plural = 'Tabelas de frete'

    def __str__(self):
        if self.codigo:
            return f'{self.codigo} rev.{self.revisao} — {self.nome}'
        return self.nome

    def nome_base(self):
        return nome_base_tabela_frete(self.nome)

    def sync_clientes_vinculo_key(self):
        if not self.pk:
            return
        key = ','.join(
            str(pk) for pk in self.clientes.order_by('pk').values_list('pk', flat=True)
        )
        if self.clientes_vinculo_key != key:
            self.clientes_vinculo_key = key
            TabelaFrete.objects.filter(pk=self.pk).update(clientes_vinculo_key=key)

    def sincronizar_status_vigencia(self):
        from django.utils import timezone

        if self.status == STATUS_TABELA_ARQUIVADA:
            return
        hoje = timezone.localdate()
        if self.vigencia_fim and self.vigencia_fim < hoje and self.status == STATUS_TABELA_PUBLICADA:
            self.status = STATUS_TABELA_EXPIRADA

    def publicar(self):
        if self.status not in (STATUS_TABELA_RASCUNHO, STATUS_TABELA_EXPIRADA):
            raise ValueError('Somente tabelas em rascunho ou expiradas podem ser publicadas.')
        self.status = STATUS_TABELA_PUBLICADA
        self.sincronizar_status_vigencia()

    def arquivar(self):
        self.status = STATUS_TABELA_ARQUIVADA

    def reativar(self):
        if self.status != STATUS_TABELA_ARQUIVADA:
            raise ValueError('Somente tabelas arquivadas podem ser reativadas.')
        with transaction.atomic():
            self.status = STATUS_TABELA_RASCUNHO
            self.clientes.clear()
            self.clientes_vinculo_key = ''
            self.save(update_fields=['status', 'clientes_vinculo_key', 'data_atualizacao'])

    def duplicar_revisao(self, criado_por=None):
        from copy import deepcopy

        with transaction.atomic():
            codigo = (self.codigo or '').strip()
            if not codigo:
                codigo = f'TAB-{self.pk}'
                type(self).objects.filter(pk=self.pk).update(codigo=codigo)
                self.codigo = codigo
            nova = TabelaFrete(
                nome=self.nome_base(),
                codigo=codigo,
                revisao=self.revisao + 1,
                vigencia_inicio=None,
                vigencia_fim=None,
                status=STATUS_TABELA_RASCUNHO,
                observacoes=self.observacoes,
                tipo=self.tipo,
                config=deepcopy(self.config or {}),
                faixas=deepcopy(self.faixas or []),
                criado_por=criado_por,
                atualizado_por=criado_por,
                clientes_vinculo_key=self.clientes_vinculo_key,
            )
            nova.regenerar_faixas()
            nova.save()
            nova.clientes.set(self.clientes.all())
            for linha in self.linhas.all():
                TabelaFreteLinha.objects.create(
                    tabela=nova,
                    ordem=linha.ordem,
                    origem=linha.origem,
                    entrega=linha.entrega,
                    veiculo=linha.veiculo,
                    tarifa_frete=linha.tarifa_frete,
                    pedagio=linha.pedagio,
                    ad_valorem=linha.ad_valorem,
                    gris=linha.gris,
                    icms=linha.icms,
                    prazo_dias=linha.prazo_dias,
                )
            if self.status != STATUS_TABELA_ARQUIVADA:
                self.arquivar()
                self.save(update_fields=['status', 'data_atualizacao'])
            return nova

    def descartar_revisao(self):
        if self.status != STATUS_TABELA_RASCUNHO:
            raise ValueError('Somente uma revisão em rascunho pode ser descartada.')
        codigo = (self.codigo or '').strip()
        with transaction.atomic():
            if codigo:
                anteriores = (
                    TabelaFrete.objects
                    .filter(tipo=self.tipo, codigo=codigo)
                    .exclude(pk=self.pk)
                    .order_by('-revisao', '-data_criacao')
                )
            else:
                anteriores = TabelaFrete.objects.none()
            anterior = anteriores.first()
            if anterior is None:
                raise ValueError('Não há revisão anterior para restaurar.')
            anterior_id = anterior.pk
            self.delete()
            restaurada = TabelaFrete.objects.get(pk=anterior_id)
            if restaurada.status == STATUS_TABELA_ARQUIVADA:
                restaurada.status = STATUS_TABELA_PUBLICADA
                restaurada.sincronizar_status_vigencia()
                restaurada.save(update_fields=['status', 'data_atualizacao'])
            return restaurada

    def regenerar_faixas(self):
        from .tabela_distribuicao import gerar_faixas_distribuicao, merge_config

        if self.tipo != TIPO_TABELA_DISTRIBUICAO:
            self.faixas = []
            return
        self.config = merge_config(self.config or {})
        self.faixas = gerar_faixas_distribuicao(self.config)


def cliente_tem_tabela_distribuicao_vigente(cliente_id) -> bool:
    if not cliente_id:
        return False
    hoje = timezone.localdate()
    return TabelaFrete.objects.filter(
        tipo=TIPO_TABELA_DISTRIBUICAO,
        clientes__pk=cliente_id,
        status=STATUS_TABELA_PUBLICADA,
    ).filter(
        Q(vigencia_inicio__isnull=True) | Q(vigencia_inicio__lte=hoje),
    ).filter(
        Q(vigencia_fim__isnull=True) | Q(vigencia_fim__gte=hoje),
    ).exists()


class TabelaFreteLinha(models.Model):
    tabela = models.ForeignKey(
        TabelaFrete,
        on_delete=models.CASCADE,
        related_name='linhas',
    )
    ordem = models.PositiveIntegerField(default=0)
    origem = models.CharField(max_length=120, blank=True, default='')
    entrega = models.CharField(max_length=120, blank=True, default='', verbose_name='Destino')
    veiculo = models.CharField(max_length=80, blank=True, default='', verbose_name='Veículo')
    tarifa_frete = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    pedagio = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    ad_valorem = models.CharField(max_length=20, blank=True, default='', verbose_name='Ad-VL')
    gris = models.CharField(max_length=20, blank=True, default='', verbose_name='GRIS')
    icms = models.CharField(max_length=40, blank=True, default='Não incluso')
    prazo_dias = models.CharField(max_length=20, blank=True, default='')
    total_estimado = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['ordem', 'pk']
        verbose_name = 'Linha da tabela de frete'
        verbose_name_plural = 'Tabela de frete'

    def save(self, *args, **kwargs):
        tarifa = self.tarifa_frete or 0
        pedagio = self.pedagio or 0
        if self.tarifa_frete is not None or self.pedagio is not None:
            self.total_estimado = tarifa + pedagio
        super().save(*args, **kwargs)

    def __str__(self):
        trecho = ' → '.join(part for part in (self.origem, self.entrega) if part) or 'Linha de frete'
        return f'{trecho} ({self.veiculo})' if self.veiculo else trecho


class GeneralidadeComercial(models.Model):
    cliente = models.ForeignKey(
        ClienteComercial,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='generalidades',
        verbose_name='Cliente',
    )
    tipo_servico = models.CharField(
        max_length=40,
        choices=TIPO_GENERALIDADE_CHOICES,
        default=TIPO_GENERALIDADE_FRETE,
        verbose_name='Tipo de serviço',
    )
    ordem = models.PositiveIntegerField(default=0)
    rotulo = models.CharField(max_length=120)
    valor = models.CharField(max_length=800, blank=True, default='')

    class Meta:
        ordering = ['ordem', 'pk']
        verbose_name = 'Generalidade comercial'
        verbose_name_plural = 'Generalidades comerciais'
        indexes = [
            models.Index(fields=['cliente', 'tipo_servico', 'ordem']),
        ]

    def __str__(self):
        escopo = self.cliente.razao_social if self.cliente_id else 'Padrão'
        return f'{escopo} / {self.get_tipo_servico_display()} — {self.rotulo}'


def gravar_catalogo_generalidades(cliente, tipo_servico, items):
    if tipo_servico not in TIPOS_GENERALIDADE:
        return
    cleaned = []
    for item in items or []:
        rotulo = str((item.get('rotulo') if isinstance(item, dict) else '') or '').strip()
        valor = str((item.get('valor') if isinstance(item, dict) else '') or '').strip()
        if not rotulo and not valor:
            continue
        cleaned.append((rotulo, valor))
    qs = GeneralidadeComercial.objects.filter(tipo_servico=tipo_servico)
    qs = qs.filter(cliente__isnull=True) if cliente is None else qs.filter(cliente=cliente)
    qs.delete()
    GeneralidadeComercial.objects.bulk_create([
        GeneralidadeComercial(
            cliente=cliente,
            tipo_servico=tipo_servico,
            ordem=index,
            rotulo=rotulo,
            valor=valor,
        )
        for index, (rotulo, valor) in enumerate(cleaned)
    ])


def aplicar_padrao_generalidades(tipo_servico, items, modo='novos'):
    """Atualiza o catálogo padrão.

    novos: clientes atuais sem catálogo próprio ficam com o padrão anterior;
           o novo padrão vale só para clientes cadastrados depois.
    todos: o novo padrão substitui o de todos os clientes deste tipo.
    """
    modo = 'todos' if str(modo or '').strip().lower() == 'todos' else 'novos'
    if tipo_servico not in TIPOS_GENERALIDADE:
        return modo
    if modo == 'novos':
        atual = list(
            GeneralidadeComercial.objects.filter(cliente__isnull=True, tipo_servico=tipo_servico)
            .order_by('ordem', 'pk')
            .values('rotulo', 'valor')
        )
        if atual:
            com_catalogo = set(
                GeneralidadeComercial.objects.filter(cliente__isnull=False, tipo_servico=tipo_servico)
                .values_list('cliente_id', flat=True)
                .distinct()
            )
            for cliente in ClienteComercial.objects.exclude(pk__in=com_catalogo).iterator():
                gravar_catalogo_generalidades(cliente, tipo_servico, atual)
    else:
        GeneralidadeComercial.objects.filter(cliente__isnull=False, tipo_servico=tipo_servico).delete()
    gravar_catalogo_generalidades(None, tipo_servico, items)
    return modo


class MatrizIcmsUf(models.Model):
    matriz = models.JSONField(default=dict, blank=True, verbose_name='Matriz ICMS por UF')
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Matriz ICMS por UF'
        verbose_name_plural = 'Matriz ICMS por UF'

    def __str__(self):
        return 'Matriz ICMS por UF'


def ensure_matriz_icms():
    from .icms_uf import aliquotas_por_uf_padrao, normalizar_aliquotas

    registro = MatrizIcmsUf.objects.first()
    if registro:
        normalizado = normalizar_aliquotas(registro.matriz)
        if normalizado != registro.matriz:
            registro.matriz = normalizado
            registro.save(update_fields=['matriz', 'atualizado_em'])
        return registro
    return MatrizIcmsUf.objects.create(matriz=aliquotas_por_uf_padrao())


def _itens_generalidade(cliente=None, tipo_servico=None):
    qs = GeneralidadeComercial.objects.all()
    if cliente is None:
        qs = qs.filter(cliente__isnull=True)
    else:
        qs = qs.filter(cliente=cliente)
    if tipo_servico:
        qs = qs.filter(tipo_servico=tipo_servico)
    return list(qs.order_by('ordem', 'pk').values('rotulo', 'valor'))


def default_condicoes(cliente=None, tipos_servico=None):
    tipos = [tipo for tipo in (tipos_servico or []) if tipo in TIPOS_GENERALIDADE]
    merged = []
    seen = set()

    def _acrescentar(items):
        for item in items:
            key = (item.get('rotulo') or '', item.get('valor') or '')
            if not key[0] and not key[1]:
                continue
            if key in seen:
                continue
            seen.add(key)
            merged.append({'rotulo': item['rotulo'], 'valor': item.get('valor') or '', 'tipo': tipo})

    for tipo in tipos:
        itens_cliente = _itens_generalidade(cliente=cliente, tipo_servico=tipo) if cliente is not None else []
        if itens_cliente:
            _acrescentar(itens_cliente)
        else:
            _acrescentar(_itens_generalidade(cliente=None, tipo_servico=tipo))
    if merged:
        return merged
    tipo_padrao = tipos[0] if tipos else TIPO_GENERALIDADE_FRETE
    return [
        {**dict(item), 'tipo': tipo_padrao}
        for item in catalogo_generalidades_padrao(tipo_padrao)
    ]


def ensure_generalidades():
    for tipo in TIPOS_GENERALIDADE:
        if GeneralidadeComercial.objects.filter(cliente__isnull=True, tipo_servico=tipo).exists():
            continue
        padrao = catalogo_generalidades_padrao(tipo)
        GeneralidadeComercial.objects.bulk_create([
            GeneralidadeComercial(
                cliente=None,
                tipo_servico=tipo,
                ordem=index,
                rotulo=item['rotulo'],
                valor=item['valor'],
            )
            for index, item in enumerate(padrao)
        ])


