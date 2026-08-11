import mimetypes

from django.utils import timezone
from rest_framework import serializers

from .models import InstagramConnection, InstagramPost, InstagramPostSlide


def detect_media_type(uploaded_file) -> str:
    content_type = getattr(uploaded_file, 'content_type', '') or ''
    if content_type.startswith('video/'):
        return 'video'
    if content_type.startswith('image/'):
        return 'image'
    guessed, _ = mimetypes.guess_type(getattr(uploaded_file, 'name', '') or '')
    if guessed and guessed.startswith('video/'):
        return 'video'
    if guessed and guessed.startswith('image/'):
        return 'image'
    return 'image'


class InstagramConnectionSerializer(serializers.ModelSerializer):
    configured = serializers.SerializerMethodField()
    oauthAvailable = serializers.SerializerMethodField()
    instagramUsername = serializers.CharField(source='instagram_username', read_only=True)
    pageName = serializers.CharField(source='page_name', read_only=True)
    linkedAt = serializers.DateTimeField(source='linked_at', read_only=True)
    linkedBy = serializers.CharField(source='linked_by', read_only=True)
    tokenExpiresAt = serializers.DateTimeField(source='token_expires_at', read_only=True)

    class Meta:
        model = InstagramConnection
        fields = [
            'configured',
            'oauthAvailable',
            'instagramUsername',
            'pageName',
            'linkedAt',
            'linkedBy',
            'tokenExpiresAt',
        ]

    def get_configured(self, obj) -> bool:
        from django.conf import settings
        return bool(
            (obj.access_token and obj.instagram_account_id)
            or (settings.INSTAGRAM_ACCESS_TOKEN and settings.INSTAGRAM_ACCOUNT_ID)
        )

    def get_oauthAvailable(self, _obj) -> bool:
        from .instagram_oauth import meta_oauth_configured
        return meta_oauth_configured()


def _build_media_file_url(obj, request) -> str:
    if not obj.media_file:
        return ''
    if request:
        return request.build_absolute_uri(obj.media_file.url)
    from django.conf import settings
    return f'{settings.PUBLIC_BASE_URL.rstrip("/")}{obj.media_file.url}'


class InstagramPostSlideSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    mediaUrl = serializers.URLField(source='media_url', required=False, allow_blank=True)
    mediaFileUrl = serializers.SerializerMethodField()
    mediaType = serializers.CharField(source='media_type', read_only=True)

    class Meta:
        model = InstagramPostSlide
        fields = ['id', 'position', 'mediaUrl', 'mediaFileUrl', 'mediaType']

    def get_mediaFileUrl(self, obj) -> str:
        return _build_media_file_url(obj, self.context.get('request'))


class InstagramPostSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    mediaUrl = serializers.URLField(source='media_url', required=False, allow_blank=True)
    mediaFileUrl = serializers.SerializerMethodField()
    mediaType = serializers.CharField(source='media_type', read_only=True)
    postFormat = serializers.CharField(source='post_format', required=False)
    feedAspect = serializers.CharField(source='feed_aspect', required=False)
    scheduledAt = serializers.DateTimeField(source='scheduled_at', required=False, allow_null=True)
    publishedAt = serializers.DateTimeField(source='published_at', read_only=True)
    instagramPostId = serializers.CharField(source='instagram_post_id', read_only=True)
    publishError = serializers.CharField(source='publish_error', read_only=True)
    criadoPor = serializers.CharField(source='criado_por', read_only=True)
    carouselSlides = InstagramPostSlideSerializer(source='slides', many=True, read_only=True)
    slideCount = serializers.SerializerMethodField()

    class Meta:
        model = InstagramPost
        fields = [
            'id',
            'title',
            'caption',
            'hashtags',
            'mediaUrl',
            'mediaFileUrl',
            'mediaType',
            'postFormat',
            'feedAspect',
            'carouselSlides',
            'slideCount',
            'status',
            'scheduledAt',
            'publishedAt',
            'instagramPostId',
            'publishError',
            'criadoPor',
        ]

    def get_mediaFileUrl(self, obj) -> str:
        if obj.post_format == 'carousel':
            first = obj.slides.order_by('position', 'id').first()
            if first:
                return _build_media_file_url(first, self.context.get('request'))
        return _build_media_file_url(obj, self.context.get('request'))

    def get_slideCount(self, obj) -> int:
        if obj.post_format != 'carousel':
            return 0
        return obj.slides.count()

    def validate(self, attrs):
        status = attrs.get('status')
        if status is None and self.instance is not None:
            status = self.instance.status

        scheduled_at = attrs.get('scheduled_at')
        if scheduled_at is None and self.instance is not None:
            scheduled_at = self.instance.scheduled_at

        if status == 'scheduled' and not scheduled_at:
            raise serializers.ValidationError({
                'scheduledAt': ['Informe data e hora para postagens programadas.'],
            })

        if status == 'published':
            if not attrs.get('published_at'):
                if self.instance is None or not self.instance.published_at:
                    attrs['published_at'] = timezone.now()

        post_format = attrs.get('post_format')
        if post_format is None and self.instance is not None:
            post_format = self.instance.post_format

        media_type = attrs.get('media_type')
        if media_type is None and self.instance is not None:
            media_type = self.instance.media_type

        if post_format == 'reels' and media_type == 'image':
            raise serializers.ValidationError({
                'postFormat': ['Reels exige arquivo de vídeo (MP4).'],
            })

        if post_format == 'carousel' and self.instance is None:
            pass

        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user and user.is_authenticated:
            validated_data.setdefault('criado_por', user.name or user.get_full_name() or user.username)
        return super().create(validated_data)


class InstagramPostMediaUploadSerializer(serializers.Serializer):
    mediaFile = serializers.FileField()

    def validate_mediaFile(self, uploaded):
        content_type = getattr(uploaded, 'content_type', '') or ''
        if content_type.startswith('image/') or content_type.startswith('video/'):
            return uploaded
        guessed, _ = mimetypes.guess_type(getattr(uploaded, 'name', '') or '')
        if guessed and (guessed.startswith('image/') or guessed.startswith('video/')):
            return uploaded
        raise serializers.ValidationError('Envie uma imagem (JPG, PNG) ou vídeo (MP4).')

    def validate(self, attrs):
        uploaded = attrs.get('mediaFile')
        post = self.context.get('post')
        if post and post.post_format == 'reels':
            content_type = getattr(uploaded, 'content_type', '') or ''
            if not content_type.startswith('video/'):
                guessed, _ = mimetypes.guess_type(getattr(uploaded, 'name', '') or '')
                if not (guessed and guessed.startswith('video/')):
                    raise serializers.ValidationError({
                        'mediaFile': ['Reels aceita apenas vídeo MP4.'],
                    })
        return attrs

    def save(self, post: InstagramPost):
        uploaded = self.validated_data['mediaFile']
        if post.media_file:
            post.media_file.delete(save=False)
        post.media_file = uploaded
        post.media_type = detect_media_type(uploaded)
        post.media_url = ''
        post.save(update_fields=['media_file', 'media_type', 'media_url', 'data_atualizacao'])
        return post


class InstagramCarouselSlideUploadSerializer(serializers.Serializer):
    mediaFile = serializers.FileField()

    def validate_mediaFile(self, uploaded):
        content_type = getattr(uploaded, 'content_type', '') or ''
        if content_type.startswith('image/'):
            return uploaded
        guessed, _ = mimetypes.guess_type(getattr(uploaded, 'name', '') or '')
        if guessed and guessed.startswith('image/'):
            return uploaded
        raise serializers.ValidationError('Carrossel aceita apenas imagens (JPG, PNG).')

    def save(self, post: InstagramPost) -> InstagramPostSlide:
        from .models import CAROUSEL_MAX_SLIDES

        if post.post_format != 'carousel':
            raise serializers.ValidationError({'detail': 'Este post não é um carrossel.'})
        if post.slides.count() >= CAROUSEL_MAX_SLIDES:
            raise serializers.ValidationError({
                'mediaFile': [f'Máximo de {CAROUSEL_MAX_SLIDES} imagens no carrossel.'],
            })
        uploaded = self.validated_data['mediaFile']
        next_position = post.slides.count()
        return InstagramPostSlide.objects.create(
            post=post,
            position=next_position,
            media_file=uploaded,
            media_type='image',
        )


class InstagramCarouselSlideReorderSerializer(serializers.Serializer):
    slideIds = serializers.ListField(child=serializers.CharField(), allow_empty=False)

    def validate_slideIds(self, slide_ids):
        post = self.context['post']
        if post.post_format != 'carousel':
            raise serializers.ValidationError('Este post não é um carrossel.')
        existing_ids = {str(slide.id) for slide in post.slides.all()}
        received_ids = {str(slide_id) for slide_id in slide_ids}
        if received_ids != existing_ids:
            raise serializers.ValidationError(
                'Informe todos os slides do carrossel na ordem desejada.',
            )
        if len(slide_ids) != len(set(slide_ids)):
            raise serializers.ValidationError('IDs de slide duplicados.')
        return slide_ids

    def save(self, post: InstagramPost) -> InstagramPost:
        slides_by_id = {str(slide.id): slide for slide in post.slides.all()}
        for index, slide_id in enumerate(self.validated_data['slideIds']):
            slide = slides_by_id[str(slide_id)]
            if slide.position != index:
                slide.position = index
                slide.save(update_fields=['position'])
        post.refresh_from_db()
        return post
