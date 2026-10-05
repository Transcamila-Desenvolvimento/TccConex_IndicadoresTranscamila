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
