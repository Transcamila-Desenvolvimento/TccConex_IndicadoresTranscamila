from django.conf import settings
from django.db import models


def format_nome_cadastro(value: str) -> str:
    """Primeira letra de cada palavra maiúscula, demais minúsculas."""
    return ' '.join(word[:1].upper() + word[1:].lower() for word in (value or '').split())


class ClienteProtocolo(models.Model):
    codigo = models.CharField(max_length=20, unique=True, blank=True, default='', verbose_name='Código do cliente')
    nome = models.CharField(max_length=200, verbose_name='Nome interno')
    razao_social = models.CharField(max_length=200, blank=True, default='', verbose_name='Razão social')
    nome_fantasia = models.CharField(max_length=200, blank=True, default='', verbose_name='Nome fantasia')
    nome_interno = models.CharField(max_length=200, blank=True, default='', verbose_name='Nome interno')
    cnpj = models.CharField(max_length=20, blank=True, null=True)
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
        ordering = ['nome']
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clientes'

    def save(self, *args, **kwargs):
        razao = format_nome_cadastro(self.razao_social)
        interno = format_nome_cadastro(self.nome_interno) or razao or format_nome_cadastro(self.nome)
        self.razao_social = razao
        self.nome_fantasia = format_nome_cadastro(self.nome_fantasia)
        self.nome_interno = interno
        self.nome = interno or self.nome
        super().save(*args, **kwargs)
        if not self.codigo:
            self.codigo = f'CLI-{self.pk:04d}'
            super().save(update_fields=['codigo'])

    def __str__(self):
        return self.nome_interno or self.nome


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
