from django.conf import settings
from django.db import models


class Notificacao(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notificacoes',
    )
    ambiente = models.CharField(max_length=40, blank=True, default='')
    tipo = models.CharField(max_length=80, db_index=True)
    titulo = models.CharField(max_length=200)
    mensagem = models.TextField(blank=True, default='')
    link = models.CharField(max_length=300, blank=True, default='', verbose_name='Rota no ERP')
    lida_em = models.DateTimeField(null=True, blank=True)
    criada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-criada_em', '-id']
        verbose_name = 'Notificação'
        verbose_name_plural = 'Notificações'
        indexes = [
            models.Index(fields=['usuario', 'lida_em'], name='notif_usuario_lida_idx'),
            models.Index(fields=['criada_em'], name='notif_criada_idx'),
        ]

    def __str__(self):
        return f'{self.tipo} → {self.usuario_id}'


class PushInscricao(models.Model):
    """Navegador autorizado pelo usuário a receber avisos do sistema operacional (Web Push)."""

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='push_inscricoes',
    )
    endpoint = models.CharField(max_length=1000, unique=True)
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=100)
    user_agent = models.CharField(max_length=300, blank=True, default='')
    criada_em = models.DateTimeField(auto_now_add=True)
    atualizada_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-atualizada_em', '-id']
        verbose_name = 'Inscrição de Web Push'
        verbose_name_plural = 'Inscrições de Web Push'

    def __str__(self):
        return f'{self.usuario_id} · {self.user_agent[:40]}'
