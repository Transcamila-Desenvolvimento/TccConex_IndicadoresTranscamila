import re
import unicodedata

from django.conf import settings
from django.db import models


TIPO_PESSOA_FISICA = 'F'
TIPO_PESSOA_JURIDICA = 'J'
TIPO_PESSOA_CHOICES = [
    (TIPO_PESSOA_JURIDICA, 'Pessoa jurídica'),
    (TIPO_PESSOA_FISICA, 'Pessoa física'),
]


def format_nome_cadastro(value: str) -> str:
    """Razão social, fantasia e nome interno em maiúsculas."""
    return ' '.join((value or '').split()).upper()


def format_municipio_cadastro(value: str) -> str:
    """Município com a primeira letra de cada palavra maiúscula."""
    return ' '.join(word[:1].upper() + word[1:].lower() for word in (value or '').split())


def chave_texto_sem_acento(value: str) -> str:
    nfd = unicodedata.normalize('NFD', (value or '').strip().casefold())
    return ''.join(ch for ch in nfd if unicodedata.category(ch) != 'Mn')


def chave_nome_cliente(value: str) -> str:
    """Compara nomes de cliente ignorando caixa, acento e pontuação (Ltda. vs LTDA)."""
    return re.sub(r'[^a-z0-9]+', '', chave_texto_sem_acento(value))


def chave_cadastro_cliente(codigo: str, loja: str) -> str:
    return f'{(codigo or "").strip()}|{(loja or "").strip()}'


class ClienteProtocolo(models.Model):
    codigo = models.CharField(max_length=20, blank=True, default='', verbose_name='Código do cliente')
    loja = models.CharField(max_length=10, blank=True, default='01', verbose_name='Loja')
    tipo_pessoa = models.CharField(
        max_length=1,
        choices=TIPO_PESSOA_CHOICES,
        default=TIPO_PESSOA_JURIDICA,
        verbose_name='Tipo de pessoa',
    )
    nome = models.CharField(max_length=200, verbose_name='Nome interno')
    razao_social = models.CharField(max_length=200, blank=True, default='', verbose_name='Razão social')
    nome_fantasia = models.CharField(max_length=200, blank=True, default='', verbose_name='Nome fantasia')
    nome_interno = models.CharField(max_length=200, blank=True, default='', verbose_name='Nome interno')
    municipio = models.CharField(max_length=150, blank=True, default='', verbose_name='Município')
    cnpj = models.CharField(max_length=20, blank=True, null=True, verbose_name='CNPJ/CPF')
    padrao_protocolo = models.BooleanField(
        default=False,
        verbose_name='Filial padrão para protocolos',
        help_text='CNPJ/CPF deste cadastro aparece no PDF do protocolo.',
    )
    emitir_protocolo_canhotos = models.BooleanField(
        default=True,
        verbose_name='Emitir protocolo de canhotos?',
    )
    considerar_pesquisa_satisfacao = models.BooleanField(
        default=False,
        verbose_name='Considerar pesquisa de satisfação?',
    )
    requer_expedicao = models.BooleanField(default=False, verbose_name='Requer expedição?')
    exige_filial = models.BooleanField(default=False, verbose_name='Exigir filial do cliente?')
    ultimo_numero_protocolo = models.PositiveIntegerField(
        default=0,
        verbose_name='Último número de protocolo utilizado',
        help_text='Controla a sequência numérica de protocolos deste cliente (cada cliente tem a sua).',
    )
    emails_envio = models.TextField(blank=True, null=True, verbose_name='E-mails para envio')
    emails_copia = models.TextField(blank=True, null=True, verbose_name='E-mails em cópia')
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['codigo', 'loja', 'nome']
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clientes'
        constraints = [
            models.UniqueConstraint(
                fields=['codigo', 'loja'],
                name='faturamento_cliente_codigo_loja_uniq',
                condition=~models.Q(codigo=''),
            ),
        ]

    def cadastros_do_grupo(self):
        if not self.codigo:
            return ClienteProtocolo.objects.filter(pk=self.pk)
        return ClienteProtocolo.objects.filter(codigo=self.codigo)

    def _rotulos_do_cadastro(self) -> set[str]:
        return {
            valor.strip().casefold()
            for valor in (
                self.nome_interno,
                self.nome,
                self.razao_social,
                self.nome_fantasia,
            )
            if (valor or '').strip()
        }

    def municipios_do_grupo(self) -> list[str]:
        seen: dict[str, int] = {}
        ordered: list[str] = []
        cadastros = self.cadastros_do_grupo().order_by('loja', 'pk')
        for cadastro in cadastros:
            aliases = cadastro._rotulos_do_cadastro()
            nome = format_municipio_cadastro((cadastro.municipio or '').strip())
            if not nome:
                continue
            key = chave_texto_sem_acento(nome)
            if not key or key in aliases or nome.casefold() in aliases:
                continue
            if key in seen:
                idx = seen[key]
                atual = ordered[idx]
                atual_nfd = unicodedata.normalize('NFD', atual)
                novo_nfd = unicodedata.normalize('NFD', nome)
                atual_tem_acento = any(unicodedata.category(ch) == 'Mn' for ch in atual_nfd)
                novo_tem_acento = any(unicodedata.category(ch) == 'Mn' for ch in novo_nfd)
                if novo_tem_acento and not atual_tem_acento:
                    ordered[idx] = nome
                continue
            seen[key] = len(ordered)
            ordered.append(nome)
        return ordered

    def chave_cadastro(self) -> str:
        return chave_cadastro_cliente(self.codigo, self.loja)

    def save(self, *args, **kwargs):
        razao = format_nome_cadastro(self.razao_social)
        interno = format_nome_cadastro(self.nome_interno) or razao or format_nome_cadastro(self.nome)
        self.razao_social = razao
        self.nome_fantasia = format_nome_cadastro(self.nome_fantasia)
        self.nome_interno = interno
        self.nome = interno or self.nome
        self.municipio = format_municipio_cadastro(self.municipio)
        self.codigo = (self.codigo or '').strip()
        self.loja = (self.loja or '01').strip() or '01'
        if self.tipo_pessoa not in {TIPO_PESSOA_FISICA, TIPO_PESSOA_JURIDICA}:
            self.tipo_pessoa = TIPO_PESSOA_JURIDICA
        self.padrao_protocolo = bool(self.emitir_protocolo_canhotos)
        super().save(*args, **kwargs)
        if not self.codigo:
            self.codigo = f'CLI-{self.pk:04d}'
            super().save(update_fields=['codigo'])

    def __str__(self):
        base = self.nome_interno or self.nome
        if self.codigo and self.loja:
            return f'{base} ({self.codigo}-{self.loja})'
        return base


class FilialClienteProtocolo(models.Model):
    cliente = models.ForeignKey(
        ClienteProtocolo,
        on_delete=models.CASCADE,
        related_name='filiais',
        verbose_name='Cliente',
    )
    nome = models.CharField(max_length=150, verbose_name='Nome da filial')

    class Meta:
        ordering = ['nome']
        unique_together = [('cliente', 'nome')]
        verbose_name = 'Filial de cliente de protocolo'
        verbose_name_plural = 'Filiais de cliente de protocolo'

    def __str__(self):
        return f'{self.cliente.nome} — {self.nome}'


class ProtocoloEnvio(models.Model):
    data = models.DateField(verbose_name='Data de envio')
    cliente = models.ForeignKey(
        ClienteProtocolo,
        on_delete=models.PROTECT,
        related_name='protocolos',
        verbose_name='Cliente',
    )
    nota_fiscal = models.TextField(help_text='Números das NFs separados por vírgula (até 72)')
    numero_sequencial = models.PositiveIntegerField(
        default=0,
        verbose_name='Número sequencial do protocolo',
        help_text='Sequência numérica própria do cliente (não é compartilhada entre clientes).',
    )
    notas_filiais = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='NFs por filial',
        help_text='Mapeamento {número_NF: nome_filial} quando o cliente exige filial',
    )
    expedicao = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name='Expedição',
        help_text='Valor final, podendo combinar até 2 expedições (ex.: "Transcamila Barueri/Ibiporã")',
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='protocolos_envio',
        verbose_name='Indexador',
    )
    usuario_nome = models.CharField(max_length=150, blank=True, default='')
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-data', '-data_criacao']
        verbose_name = 'Protocolo de envio'
        verbose_name_plural = 'Protocolos de envio'

    def __str__(self):
        return f'{self.cliente.nome} — {self.data}'


class ProtocoloEnvioDraft(models.Model):
    """Rascunho de novo protocolo — um por usuário (Faturamento é ambiente global)."""

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='protocolo_envio_draft',
        verbose_name='Usuário',
    )
    version = models.PositiveSmallIntegerField(default=1)
    payload = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Rascunho de protocolo de envio'
        verbose_name_plural = 'Rascunhos de protocolo de envio'

    def __str__(self):
        return f'Rascunho de {self.usuario}'
