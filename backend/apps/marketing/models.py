from django.conf import settings
from django.db import models

CAMPANHA_STATUS_CHOICES = [
    ('planejamento', 'Planejamento'),
    ('producao', 'Produção'),
    ('veiculacao', 'Aguardando'),
    ('concluida', 'Publicado'),
    ('cancelada', 'Cancelado'),
]

CAMPANHA_CANAL_CHOICES = [
    ('evento', 'Evento'),
    ('transcamila_news', 'Transcamila News'),
    ('instagram', 'Instagram'),
    ('outro', 'Outro'),
    ('email', 'E-mail marketing'),
]

KANBAN_STATUSES = ('planejamento', 'producao', 'veiculacao', 'concluida')

CAMPANHA_CANAL_VALUES = [choice[0] for choice in CAMPANHA_CANAL_CHOICES]


def _default_canais():
    return []


class CampanhaMarketing(models.Model):
    """Campanha de marketing — calendário e kanban organizacional."""

    titulo = models.CharField(max_length=200, verbose_name='Título')
    descricao = models.TextField(blank=True, default='', verbose_name='Descrição')
    data_inicio = models.DateField(verbose_name='Data início')
    data_fim = models.DateField(verbose_name='Data fim')
    status = models.CharField(
        max_length=20,
        choices=CAMPANHA_STATUS_CHOICES,
        default='planejamento',
        verbose_name='Status',
    )
    canais = models.JSONField(
        default=_default_canais,
        blank=True,
        verbose_name='Canais de comunicação',
    )
    responsavel = models.CharField(max_length=150, blank=True, default='', verbose_name='Responsável')
    responsavel_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='campanhas_responsavel',
        verbose_name='Responsável (usuário)',
    )
    cor = models.CharField(max_length=20, default='azul', verbose_name='Cor no calendário')
    ordem_kanban = models.PositiveIntegerField(default=0, verbose_name='Ordem no kanban')
    criado_por = models.CharField(max_length=150, blank=True, default='', verbose_name='Criado por')
    criado_por_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='campanhas_criadas',
        verbose_name='Criado por (usuário)',
    )
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Campanha de marketing'
        verbose_name_plural = 'Campanhas de marketing'
        ordering = ['ordem_kanban', '-data_inicio', '-data_criacao']

    def __str__(self):
        return self.titulo


class CampanhaComentario(models.Model):
    """Comentário colaborativo em uma campanha."""

    campanha = models.ForeignKey(
        CampanhaMarketing,
        related_name='comentarios',
        on_delete=models.CASCADE,
        verbose_name='Campanha',
    )
    autor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='campanha_comentarios',
        verbose_name='Autor',
    )
    autor_nome = models.CharField(max_length=150, blank=True, default='')
    texto = models.TextField(verbose_name='Comentário')
    mencoes = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='campanha_comentario_mencoes',
        verbose_name='Menções',
    )
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Comentário de campanha'
        verbose_name_plural = 'Comentários de campanha'
        ordering = ['data_criacao']

    def __str__(self):
        return f'Comentário #{self.pk} — {self.campanha_id}'



class CampanhaMembro(models.Model):
    """Colaborador vinculado à campanha."""

    campanha = models.ForeignKey(
        CampanhaMarketing,
        related_name='membros',
        on_delete=models.CASCADE,
        verbose_name='Campanha',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='campanhas_participando',
        verbose_name='Usuário',
    )
    adicionado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='campanhas_membros_adicionados',
        verbose_name='Adicionado por',
    )
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Membro da campanha'
        verbose_name_plural = 'Membros da campanha'
        ordering = ['data_criacao']
        constraints = [
            models.UniqueConstraint(fields=['campanha', 'user'], name='uniq_campanha_membro'),
        ]

    def __str__(self):
        return f'{self.user_id} em {self.campanha_id}'


class CampanhaMidia(models.Model):
    """Arquivo do Google Drive vinculado a uma campanha."""

    campanha = models.ForeignKey(
        CampanhaMarketing,
        on_delete=models.CASCADE,
        related_name='midias',
        verbose_name='Campanha',
    )
    drive_file_id = models.CharField(max_length=128, db_index=True, verbose_name='ID no Drive')
    adicionado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='campanha_midias_adicionadas',
        verbose_name='Adicionado por',
    )
    ordem = models.PositiveIntegerField(default=0, verbose_name='Ordem')
    data_criacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Arquivo da campanha'
        verbose_name_plural = 'Arquivos da campanha'
        ordering = ['ordem', 'data_criacao']
        constraints = [
            models.UniqueConstraint(
                fields=['campanha', 'drive_file_id'],
                name='uniq_campanha_midia',
            ),
        ]

    def __str__(self):
        return f'{self.drive_file_id} em {self.campanha_id}'
