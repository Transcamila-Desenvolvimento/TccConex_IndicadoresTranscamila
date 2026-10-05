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
