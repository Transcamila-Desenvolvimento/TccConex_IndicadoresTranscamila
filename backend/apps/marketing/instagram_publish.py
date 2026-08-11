"""Publicação de posts via Instagram Graph API."""

from django.conf import settings
from django.utils import timezone

from .instagram_oauth import _graph_request
from .models import CAROUSEL_MAX_SLIDES, CAROUSEL_MIN_SLIDES, InstagramConnection, InstagramPost, InstagramPostSlide


def _connection_credentials() -> tuple[str, str]:
    conn = InstagramConnection.objects.filter(pk=1).first()
    token = (conn.access_token if conn else '') or settings.INSTAGRAM_ACCESS_TOKEN
    account_id = (conn.instagram_account_id if conn else '') or settings.INSTAGRAM_ACCOUNT_ID
    if not token or not account_id:
        raise ValueError(
            'Conta Instagram não configurada. Vincule pelo Marketing ou defina '
            'INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_ACCOUNT_ID no servidor.'
        )
    return token, account_id


def resolve_media_public_url(post: InstagramPost) -> str:
    if post.media_file:
        base = settings.PUBLIC_BASE_URL.rstrip('/')
        return f'{base}{post.media_file.url}'
    if post.media_url:
        return post.media_url.strip()
    raise ValueError('Informe um arquivo de mídia ou URL pública acessível pelo Instagram.')


def resolve_slide_public_url(slide: InstagramPostSlide) -> str:
    if slide.media_file:
        base = settings.PUBLIC_BASE_URL.rstrip('/')
        return f'{base}{slide.media_file.url}'
    if slide.media_url:
        return slide.media_url.strip()
    raise ValueError('Cada slide do carrossel precisa de imagem ou URL pública.')


def _publish_carousel(post: InstagramPost, token: str, account_id: str, caption: str) -> dict:
    slides = list(post.slides.order_by('position', 'id'))
    if len(slides) < CAROUSEL_MIN_SLIDES:
        raise ValueError(f'Carrossel exige pelo menos {CAROUSEL_MIN_SLIDES} imagens.')
    if len(slides) > CAROUSEL_MAX_SLIDES:
        raise ValueError(f'Carrossel aceita no máximo {CAROUSEL_MAX_SLIDES} imagens.')

    child_ids: list[str] = []
    for slide in slides:
        if slide.media_type != 'image':
            raise ValueError('Carrossel aceita apenas imagens (JPG/PNG).')
        media_url = resolve_slide_public_url(slide)
        child = _graph_request(
            f'{account_id}/media',
            method='POST',
            data={
                'access_token': token,
                'image_url': media_url,
                'is_carousel_item': 'true',
            },
        )
        child_id = child.get('id')
        if not child_id:
            raise ValueError(f'Falha ao criar slide do carrossel: {child}')
        child_ids.append(child_id)

    container = _graph_request(
        f'{account_id}/media',
        method='POST',
        data={
            'access_token': token,
            'media_type': 'CAROUSEL',
            'caption': caption,
            'children': ','.join(child_ids),
        },
    )
    creation_id = container.get('id')
    if not creation_id:
        raise ValueError(f'Falha ao montar carrossel: {container}')

    published = _graph_request(
        f'{account_id}/media_publish',
        method='POST',
        data={
            'access_token': token,
            'creation_id': creation_id,
        },
    )
    post_id = published.get('id')
    if not post_id:
        raise ValueError(f'Falha ao publicar carrossel: {published}')

    post.instagram_media_id = creation_id
    post.instagram_post_id = post_id
    post.publish_error = ''
    post.status = 'published'
    post.published_at = timezone.now()
    post.save(update_fields=[
        'instagram_media_id', 'instagram_post_id', 'publish_error',
        'status', 'published_at', 'data_atualizacao',
    ])
    return published


def publish_instagram_post(post: InstagramPost) -> dict:
    token, account_id = _connection_credentials()
    caption = post.full_caption
    if not caption:
        raise ValueError('A legenda (ou hashtags) é obrigatória para publicar no Instagram.')

    if post.post_format == 'carousel':
        return _publish_carousel(post, token, account_id, caption)

    media_url = resolve_media_public_url(post)
    payload = {
        'access_token': token,
        'caption': caption,
    }
    if post.post_format == 'reels' or (post.post_format == 'feed' and post.media_type == 'video'):
        if post.post_format == 'reels':
            payload['media_type'] = 'REELS'
        payload['video_url'] = media_url
    elif post.post_format == 'story':
        payload['media_type'] = 'STORIES'
        if post.media_type == 'video':
            payload['video_url'] = media_url
        else:
            payload['image_url'] = media_url
    else:
        payload['image_url'] = media_url

    container = _graph_request(
        f'{account_id}/media',
        method='POST',
        data=payload,
    )
    creation_id = container.get('id')
    if not creation_id:
        raise ValueError(f'Falha ao criar container de mídia: {container}')

    published = _graph_request(
        f'{account_id}/media_publish',
        method='POST',
        data={
            'access_token': token,
            'creation_id': creation_id,
        },
    )
    post_id = published.get('id')
    if not post_id:
        raise ValueError(f'Falha ao publicar: {published}')

    post.instagram_media_id = creation_id
    post.instagram_post_id = post_id
    post.publish_error = ''
    post.status = 'published'
    post.published_at = timezone.now()
    post.save(update_fields=[
        'instagram_media_id', 'instagram_post_id', 'publish_error',
        'status', 'published_at', 'data_atualizacao',
    ])
    return published


def publish_due_scheduled_posts() -> int:
    """Publica postagens programadas cujo horário já passou."""
    now = timezone.now()
    due = InstagramPost.objects.filter(status='scheduled', scheduled_at__lte=now).prefetch_related('slides')
    count = 0
    for post in due:
        try:
            publish_instagram_post(post)
            count += 1
        except ValueError as exc:
            post.publish_error = str(exc)
            post.save(update_fields=['publish_error', 'data_atualizacao'])
    return count
