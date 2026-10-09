import uuid

from django.conf import settings
from django.db import models


class Agente(models.Model):
    """Agente do CamiloIA, com recorte de leitura do que o dono pode ver."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='agentes_camilo',
    )
    nome = models.CharField(max_length=80)
    instrucao = models.TextField(blank=True, default='')
    escopos = models.JSONField(default=list, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-criado_em']
        verbose_name = 'Agente CamiloIA'
        verbose_name_plural = 'Agentes CamiloIA'

    def __str__(self):
        return self.nome


NOME_CHAT_PADRAO = 'Camilo'
INSTRUCAO_CHAT_PADRAO = 'Responda em português, de forma direta e curta.'


class ChatPadrao(models.Model):
    """Configuração única do chat padrão do CamiloIA."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    nome = models.CharField(max_length=80, default=NOME_CHAT_PADRAO)
    instrucao = models.TextField(blank=True, default='')

    class Meta:
        verbose_name = 'Chat padrão CamiloIA'
        verbose_name_plural = 'Chat padrão CamiloIA'

    def __str__(self):
        return self.nome_efetivo

    @classmethod
    def atual(cls) -> 'ChatPadrao':
        config, _ = cls.objects.get_or_create(pk=1)
        return config

    @property
    def nome_efetivo(self) -> str:
        return (self.nome or '').strip() or NOME_CHAT_PADRAO

    @property
    def instrucao_efetiva(self) -> str:
        return (self.instrucao or '').strip() or INSTRUCAO_CHAT_PADRAO


class TermoVersao(models.Model):
    """Versão vigente do termo de uso do CamiloIA."""

    numero = models.PositiveIntegerField(unique=True)
    titulo = models.CharField(max_length=120)
    introducao = models.TextField()
    assinatura = models.CharField(max_length=240)
    declaracao = models.CharField(max_length=240)
    secoes = models.JSONField(default=list)
    vigente = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='termos_camilo_publicados',
    )

    class Meta:
        ordering = ['-numero']
        verbose_name = 'Versão do termo CamiloIA'
        verbose_name_plural = 'Versões do termo CamiloIA'

    def __str__(self):
        return self.codigo

    @property
    def codigo(self) -> str:
        return f'v{self.numero}'

    def como_texto(self) -> dict:
        return {
            'titulo': self.titulo,
            'introducao': self.introducao,
            'assinatura': self.assinatura,
            'declaracao': self.declaracao,
            'secoes': self.secoes or [],
        }


class TermoAceite(models.Model):
    """Registro do aceite do termo de uso do CamiloIA por um usuário."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='termos_camilo',
    )
    versao = models.CharField(max_length=16)
    nome = models.CharField(max_length=255)
    username = models.CharField(max_length=150)
    cpf = models.CharField(max_length=14, blank=True, default='')
    texto = models.JSONField(default=dict)
    ip = models.CharField(max_length=64, blank=True, default='')
    aceito_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-aceito_em']
        verbose_name = 'Aceite do termo CamiloIA'
        verbose_name_plural = 'Aceites do termo CamiloIA'
        constraints = [
            models.UniqueConstraint(fields=['usuario', 'versao'], name='camilo_termo_usuario_versao'),
        ]

    def __str__(self):
        return f'{self.username} · {self.versao}'


def documento_matriz_empresarial_upload_path(instance, filename):
    from pathlib import Path
    ext = Path(filename).suffix.lower()[:10]
    return f'camilo/matriz-empresarial/{uuid.uuid4().hex}{ext}'


class PastaMatrizEmpresarial(models.Model):
    """Pasta da Matriz empresarial, consultada só pelo chat padrão."""

    nome = models.CharField(max_length=120)
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subpastas',
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nome', 'pk']
        verbose_name = 'Pasta da Matriz empresarial'
        verbose_name_plural = 'Pastas da Matriz empresarial'

    def __str__(self):
        return self.nome


class DocumentoMatrizEmpresarial(models.Model):
    """Documento padrão da Matriz empresarial. O chat padrão lê o texto extraído."""

    titulo = models.CharField(max_length=160)
    arquivo = models.FileField(upload_to=documento_matriz_empresarial_upload_path, blank=True)
    drive_file_id = models.CharField(max_length=128, blank=True, default='')
    link_externo = models.CharField(max_length=500, blank=True, default='')
    nome_original = models.CharField(max_length=180)
    tamanho = models.PositiveIntegerField(default=0)
    texto = models.TextField(blank=True, default='')
    texto_extraido = models.BooleanField(default=False)
    incluido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='documentos_matriz_empresarial',
    )
    pasta = models.ForeignKey(
        PastaMatrizEmpresarial,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='documentos',
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-criado_em']
        verbose_name = 'Documento da Matriz empresarial'
        verbose_name_plural = 'Documentos da Matriz empresarial'

    def __str__(self):
        return self.titulo
