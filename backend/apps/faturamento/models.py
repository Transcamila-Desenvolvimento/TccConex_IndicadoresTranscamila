from django.conf import settings
from django.db import models


class ClienteProtocolo(models.Model):
    nome = models.CharField(max_length=200)
    cnpj = models.CharField(max_length=20, blank=True, null=True)
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

    class Meta:
        ordering = ['nome']
        verbose_name = 'Cliente de protocolo'
        verbose_name_plural = 'Clientes de protocolo'

    def __str__(self):
        return self.nome


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
