from django.db import models

INSTAGRAM_POST_STATUS_CHOICES = [
    ('draft', 'Rascunho'),
    ('scheduled', 'Programada'),
    ('published', 'Publicada'),
    ('cancelled', 'Cancelada'),
]

INSTAGRAM_MEDIA_TYPE_CHOICES = [
    ('image', 'Imagem'),
    ('video', 'Vídeo'),
    ('none', 'Sem mídia'),
]

INSTAGRAM_POST_FORMAT_CHOICES = [
    ('feed', 'Feed'),
    ('carousel', 'Carrossel'),
    ('reels', 'Reels'),
    ('story', 'Story'),
]

CAROUSEL_MIN_SLIDES = 2
CAROUSEL_MAX_SLIDES = 10

INSTAGRAM_FEED_ASPECT_CHOICES = [
    ('square', 'Quadrado 1:1'),
    ('portrait', 'Retrato 4:5'),
]


class InstagramConnection(models.Model):
    """Conexão única da empresa com a conta Instagram Business (Graph API)."""

    access_token = models.TextField(blank=True, default='')
    instagram_account_id = models.CharField(max_length=64, blank=True, default='')
    instagram_username = models.CharField(max_length=150, blank=True, default='')
    page_name = models.CharField(max_length=200, blank=True, default='')
    linked_at = models.DateTimeField(null=True, blank=True)
    linked_by = models.CharField(max_length=150, blank=True, default='')
    token_expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Conexão Instagram'
        verbose_name_plural = 'Conexões Instagram'

    def __str__(self):
        return self.instagram_username or self.page_name or 'Instagram'


class InstagramPost(models.Model):
    """Postagem do Instagram — módulo Marketing."""

    title = models.CharField(max_length=200, verbose_name='Título interno')
    caption = models.TextField(blank=True, default='', verbose_name='Legenda')
    hashtags = models.CharField(max_length=500, blank=True, default='', verbose_name='Hashtags')
    media_url = models.URLField(max_length=500, blank=True, default='', verbose_name='URL externa da mídia')
    media_file = models.FileField(
        upload_to='marketing/instagram/%Y/%m/',
        null=True,
        blank=True,
        verbose_name='Arquivo de mídia',
    )
    media_type = models.CharField(
        max_length=10,
        choices=INSTAGRAM_MEDIA_TYPE_CHOICES,
        default='none',
        verbose_name='Tipo de mídia',
    )
    post_format = models.CharField(
        max_length=10,
        choices=INSTAGRAM_POST_FORMAT_CHOICES,
        default='feed',
        verbose_name='Formato',
    )
    feed_aspect = models.CharField(
        max_length=10,
        choices=INSTAGRAM_FEED_ASPECT_CHOICES,
        default='square',
        verbose_name='Proporção do feed',
    )
    status = models.CharField(
        max_length=20,
        choices=INSTAGRAM_POST_STATUS_CHOICES,
        default='draft',
        verbose_name='Status',
    )
    scheduled_at = models.DateTimeField(null=True, blank=True, verbose_name='Programado para')
    published_at = models.DateTimeField(null=True, blank=True, verbose_name='Publicado em')
    instagram_media_id = models.CharField(max_length=64, blank=True, default='', verbose_name='ID container IG')
    instagram_post_id = models.CharField(max_length=64, blank=True, default='', verbose_name='ID publicação IG')
    publish_error = models.TextField(blank=True, default='', verbose_name='Último erro de publicação')
    criado_por = models.CharField(max_length=150, blank=True, default='', verbose_name='Criado por')
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Post Instagram'
        verbose_name_plural = 'Posts Instagram'
        ordering = ['-scheduled_at', '-data_criacao']

    def __str__(self):
        return self.title

    @property
    def full_caption(self) -> str:
        caption = (self.caption or '').strip()
        tags = (self.hashtags or '').strip()
        if caption and tags:
            return f'{caption}\n\n{tags}'
        return caption or tags


class InstagramPostSlide(models.Model):
    """Slide de carrossel (2–10 imagens) vinculado a um post."""

    post = models.ForeignKey(
        InstagramPost,
        related_name='slides',
        on_delete=models.CASCADE,
        verbose_name='Post',
    )
    position = models.PositiveSmallIntegerField(default=0, verbose_name='Ordem')
    media_url = models.URLField(max_length=500, blank=True, default='', verbose_name='URL externa')
    media_file = models.FileField(
        upload_to='marketing/instagram/carousel/%Y/%m/',
        null=True,
        blank=True,
        verbose_name='Arquivo',
    )
    media_type = models.CharField(
        max_length=10,
        choices=INSTAGRAM_MEDIA_TYPE_CHOICES,
        default='image',
        verbose_name='Tipo',
    )

    class Meta:
        verbose_name = 'Slide carrossel'
        verbose_name_plural = 'Slides carrossel'
        ordering = ['position', 'id']

    def __str__(self):
        return f'Slide {self.position} — {self.post_id}'
