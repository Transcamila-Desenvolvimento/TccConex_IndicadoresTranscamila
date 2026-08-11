import datetime

import jwt
from django.conf import settings
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.accounts.permissions import ModuleAccessPermission
from apps.financeiro.pagination import ReportPagination

from django.db.models import Q

from .instagram_oauth import (
    build_meta_auth_url,
    exchange_code_for_token,
    meta_oauth_configured,
    resolve_instagram_business_account,
)
from .instagram_publish import publish_instagram_post
from .models import InstagramConnection, InstagramPost, InstagramPostSlide
from .serializers import (
    InstagramCarouselSlideReorderSerializer,
    InstagramCarouselSlideUploadSerializer,
    InstagramConnectionSerializer,
    InstagramPostMediaUploadSerializer,
    InstagramPostSerializer,
)


def _funcao_required_response(request, funcao: str, detail: str):
    if request.user.has_funcao('Marketing', funcao):
        return None
    return Response({'detail': detail}, status=status.HTTP_403_FORBIDDEN)


_CRIAR_POSTS_DETAIL = 'Acesso negado. Solicite ao administrador a função "Criar postagens" do Marketing.'
_EDITAR_POSTS_DETAIL = 'Acesso negado. Solicite ao administrador a função "Editar postagens" do Marketing.'
_EXCLUIR_POSTS_DETAIL = 'Acesso negado. Solicite ao administrador a função "Excluir postagens" do Marketing.'
_PUBLICAR_POSTS_DETAIL = 'Acesso negado. Solicite ao administrador a função "Publicar postagens" do Marketing.'


def _usuario_display(user) -> str:
    if not user or not user.is_authenticated:
        return ''
    return user.name or user.get_full_name() or user.username


def _build_oauth_state(user_id: int) -> str:
    payload = {
        'purpose': 'meta_instagram_link',
        'user_id': user_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(minutes=15),
    }
    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.JWT_SETTINGS.get('ALGORITHM', 'HS256'),
    )


def _validate_oauth_state(state: str, user_id: int) -> bool:
    try:
        payload = jwt.decode(
            state,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_SETTINGS.get('ALGORITHM', 'HS256')],
        )
    except jwt.PyJWTError:
        return False
    return payload.get('purpose') == 'meta_instagram_link' and payload.get('user_id') == user_id


class MarketingAPIView(APIView):
    permission_module = 'Marketing'
    permission_classes = [IsAuthenticated, ModuleAccessPermission]


class InstagramConnectionView(MarketingAPIView):
    def get(self, request):
        conn, _ = InstagramConnection.objects.get_or_create(pk=1)
        return Response(InstagramConnectionSerializer(conn).data)


class InstagramConnectionLinkView(MarketingAPIView):
    def get(self, request):
        denied = _funcao_required_response(request, 'publicar-posts', _PUBLICAR_POSTS_DETAIL)
        if denied:
            return denied
        if not meta_oauth_configured():
            return Response(
                {'detail': 'OAuth Meta não configurado no servidor (META_APP_ID / META_APP_SECRET).'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        state = _build_oauth_state(request.user.id)
        return Response({'authUrl': build_meta_auth_url(state)})


class InstagramConnectionCallbackView(MarketingAPIView):
    def post(self, request):
        denied = _funcao_required_response(request, 'publicar-posts', _PUBLICAR_POSTS_DETAIL)
        if denied:
            return denied
        code = (request.data.get('code') or '').strip()
        state = (request.data.get('state') or '').strip()
        if not code or not state:
            return Response({'detail': 'Parâmetros OAuth inválidos.'}, status=status.HTTP_400_BAD_REQUEST)
        if not _validate_oauth_state(state, request.user.id):
            return Response({'detail': 'State OAuth inválido ou expirado.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token_data = exchange_code_for_token(code)
            ig_data = resolve_instagram_business_account(token_data['access_token'])
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        expires_in = token_data.get('expires_in')
        expires_at = None
        if expires_in:
            expires_at = timezone.now() + timezone.timedelta(seconds=int(expires_in))

        conn, _ = InstagramConnection.objects.get_or_create(pk=1)
        conn.access_token = ig_data['access_token']
        conn.instagram_account_id = ig_data['instagram_account_id']
        conn.instagram_username = ig_data['instagram_username']
        conn.page_name = ig_data['page_name']
        conn.linked_at = timezone.now()
        conn.linked_by = _usuario_display(request.user)
        conn.token_expires_at = expires_at
        conn.save()

        return Response(InstagramConnectionSerializer(conn).data)


class InstagramConnectionDisconnectView(MarketingAPIView):
    def post(self, request):
        denied = _funcao_required_response(request, 'publicar-posts', _PUBLICAR_POSTS_DETAIL)
        if denied:
            return denied
        conn, _ = InstagramConnection.objects.get_or_create(pk=1)
        conn.access_token = ''
        conn.instagram_account_id = ''
        conn.instagram_username = ''
        conn.page_name = ''
        conn.linked_at = None
        conn.linked_by = ''
        conn.token_expires_at = None
        conn.save()
        return Response(InstagramConnectionSerializer(conn).data)


class InstagramPostViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Marketing'
    permission_requires_filial = False
    serializer_class = InstagramPostSerializer
    queryset = InstagramPost.objects.all()
    pagination_class = ReportPagination
    http_method_names = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = self.queryset.prefetch_related('slides')
        params = self.request.query_params

        status_filter = (params.get('status') or '').strip()
        if status_filter and status_filter != 'Todos':
            qs = qs.filter(status=status_filter)

        search = (params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(caption__icontains=search)
                | Q(hashtags__icontains=search)
            )

        ordering = (params.get('ordering') or '-scheduled_at').strip()
        allowed = {
            'scheduled_at', '-scheduled_at', 'title', '-title',
            'status', '-status', 'data_criacao', '-data_criacao',
        }
        if ordering in allowed:
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by('-scheduled_at', '-data_criacao')

        return qs

    def create(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'criar-posts', _CRIAR_POSTS_DETAIL)
        if denied:
            return denied
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'editar-posts', _EDITAR_POSTS_DETAIL)
        if denied:
            return denied
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'editar-posts', _EDITAR_POSTS_DETAIL)
        if denied:
            return denied
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'excluir-posts', _EXCLUIR_POSTS_DETAIL)
        if denied:
            return denied
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='upload-media')
    def upload_media(self, request, pk=None):
        denied = _funcao_required_response(request, 'editar-posts', _EDITAR_POSTS_DETAIL)
        if denied:
            return denied
        post = self.get_object()
        serializer = InstagramPostMediaUploadSerializer(
            data=request.data,
            context={'post': post},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(post)
        return Response(InstagramPostSerializer(post, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='carousel-slides')
    def add_carousel_slide(self, request, pk=None):
        denied = _funcao_required_response(request, 'editar-posts', _EDITAR_POSTS_DETAIL)
        if denied:
            return denied
        post = self.get_object()
        serializer = InstagramCarouselSlideUploadSerializer(
            data=request.data,
            context={'post': post},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(post)
        return Response(InstagramPostSerializer(post, context={'request': request}).data)

    @action(detail=True, methods=['delete'], url_path=r'carousel-slides/(?P<slide_id>[^/.]+)')
    def remove_carousel_slide(self, request, pk=None, slide_id=None):
        denied = _funcao_required_response(request, 'editar-posts', _EDITAR_POSTS_DETAIL)
        if denied:
            return denied
        post = self.get_object()
        slide = post.slides.filter(pk=slide_id).first()
        if not slide:
            return Response({'detail': 'Slide não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        if slide.media_file:
            slide.media_file.delete(save=False)
        slide.delete()
        for index, remaining in enumerate(post.slides.order_by('position', 'id')):
            if remaining.position != index:
                remaining.position = index
                remaining.save(update_fields=['position'])
        return Response(InstagramPostSerializer(post, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='carousel-slides/reorder')
    def reorder_carousel_slides(self, request, pk=None):
        denied = _funcao_required_response(request, 'editar-posts', _EDITAR_POSTS_DETAIL)
        if denied:
            return denied
        post = self.get_object()
        serializer = InstagramCarouselSlideReorderSerializer(
            data=request.data,
            context={'post': post},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(post)
        return Response(InstagramPostSerializer(post, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        denied = _funcao_required_response(request, 'publicar-posts', _PUBLICAR_POSTS_DETAIL)
        if denied:
            return denied
        post = self.get_object()
        if post.status == 'published' and post.instagram_post_id:
            return Response({'detail': 'Esta postagem já foi publicada no Instagram.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            publish_instagram_post(post)
        except ValueError as exc:
            post.publish_error = str(exc)
            post.save(update_fields=['publish_error', 'data_atualizacao'])
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(InstagramPostSerializer(post, context={'request': request}).data)
