import datetime
import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .google_contacts_service import build_google_token_record, fetch_google_contacts
from .google_oauth import build_google_auth_url, exchange_code_for_link, google_oauth_configured
from .models import Role
from .pagination import UserPagination
from apps.audit.services import record_audit

from .serializers import (
    CreateUserSerializer,
    LoginSerializer,
    RoleSerializer,
    UpdateUserSerializer,
    UserSerializer,
)

User = get_user_model()


def _build_google_oauth_state(user_id: int) -> str:
    payload = {
        'purpose': 'google_link',
        'user_id': user_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(minutes=15),
    }
    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.JWT_SETTINGS.get('ALGORITHM', 'HS256'),
    )


def _validate_google_oauth_state(state: str, user_id: int) -> bool:
    try:
        payload = jwt.decode(
            state,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_SETTINGS.get('ALGORITHM', 'HS256')],
        )
    except jwt.PyJWTError:
        return False
    return payload.get('purpose') == 'google_link' and payload.get('user_id') == user_id


def _apply_google_link(user, userinfo: dict, token_data: dict | None = None) -> None:
    email = userinfo.get('email')
    google_sub = userinfo.get('sub')
    email_verified = userinfo.get('email_verified', False)
    hosted_domain = userinfo.get('hd')

    if not email or not google_sub:
        raise ValueError('Google não retornou e-mail válido.')

    if not email_verified:
        raise ValueError('O e-mail Google informado não está verificado.')

    expected_hd = getattr(settings, 'GOOGLE_OAUTH_HD', '') or ''
    if expected_hd and hosted_domain and hosted_domain != expected_hd:
        raise ValueError(f'Use uma conta @{expected_hd} para vincular.')

    if expected_hd and not email.lower().endswith(f'@{expected_hd}'):
        raise ValueError(f'Use uma conta corporativa @{expected_hd}.')

    existing = User.objects.filter(google_sub=google_sub).exclude(pk=user.pk).first()
    if existing:
        raise ValueError('Esta conta Google já está vinculada a outro usuário.')

    user.google_email = email
    user.google_sub = google_sub
    user.google_linked_at = timezone.now()
    if token_data:
        user.google_token = build_google_token_record(token_data, userinfo)
    user.save(update_fields=['google_email', 'google_sub', 'google_linked_at', 'google_token'])


def generate_jwt_token(user):
    payload = {
        'user_id': user.id,
        'username': user.username,
        'name': user.name,
        'role_id': user.role_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(
            minutes=settings.JWT_SETTINGS.get('ACCESS_TOKEN_LIFETIME_MINUTES', 60)
        )
    }
    token = jwt.encode(
        payload, 
        settings.SECRET_KEY, 
        algorithm=settings.JWT_SETTINGS.get('ALGORITHM', 'HS256')
    )
    return token


class LoginAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        username = serializer.validated_data['username']
        password = serializer.validated_data['password']

        try:
            user = User.objects.get(username__iexact=username)
        except User.DoesNotExist:
            return Response(
                {"detail": "Nome de usuário ou senha incorretos."}, 
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.check_password(password):
            return Response(
                {"detail": "Nome de usuário ou senha incorretos."}, 
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.is_currently_active:
            return Response(
                {"detail": "Este usuário foi desativado pela administração."}, 
                status=status.HTTP_403_FORBIDDEN
            )

        # Update last login time
        user.last_login = datetime.datetime.now()
        user.save()

        record_audit(user, 'login', 'Login realizado com sucesso.')

        # Generate JWT Access token
        token = generate_jwt_token(user)

        user_data = UserSerializer(user).data

        return Response({
            "token": token,
            "user": user_data
        }, status=status.HTTP_200_OK)


class UserProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class GoogleLinkAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not google_oauth_configured():
            return Response(
                {'detail': 'Integração Google não configurada no servidor.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        state = _build_google_oauth_state(request.user.id)
        return Response({'authUrl': build_google_auth_url(state)}, status=status.HTTP_200_OK)


class GoogleCallbackAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        code = request.data.get('code')
        state = request.data.get('state')
        if not code or not state:
            return Response({'detail': 'Parâmetros OAuth inválidos.'}, status=status.HTTP_400_BAD_REQUEST)
        if not _validate_google_oauth_state(state, request.user.id):
            return Response({'detail': 'State OAuth inválido ou expirado.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            userinfo, token_data = exchange_code_for_link(code)
            _apply_google_link(request.user, userinfo, token_data)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)


class GoogleUnlinkAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if not user.google_email:
            return Response(
                {'detail': 'Nenhuma conta Google vinculada.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.google_email = None
        user.google_sub = None
        user.google_linked_at = None
        user.google_token = None
        user.save(update_fields=['google_email', 'google_sub', 'google_linked_at', 'google_token'])
        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)


class GoogleContactsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            contacts = fetch_google_contacts(request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'contacts': contacts}, status=status.HTTP_200_OK)


class RoleViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista papéis disponíveis para atribuição a usuários (somente admin)."""
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not request.user.is_admin:
            self.permission_denied(
                request,
                message="Acesso negado. Apenas administradores possuem acesso a este recurso.",
            )


class UserManagementViewSet(viewsets.ModelViewSet):
    """
    CRUD Endpoint for managing users, restricted to admin users.
    """
    queryset = User.objects.all().order_by('-id')
    permission_classes = [IsAuthenticated]
    pagination_class = UserPagination

    def get_serializer_class(self):
        if self.action == 'create':
            return CreateUserSerializer
        elif self.action in ['update', 'partial_update']:
            return UpdateUserSerializer
        return UserSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action != 'list':
            return qs

        params = self.request.query_params

        search = (params.get('search') or '').strip()
        if search:
            qs = qs.filter(Q(username__icontains=search) | Q(name__icontains=search))

        role_id = (params.get('roleId') or '').strip()
        if role_id:
            qs = qs.filter(role_id=role_id)

        status_param = (params.get('status') or '').strip()
        if status_param:
            qs = qs.filter(status=status_param)

        return qs

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        # Check permissions - only role_id == '1' (Admin) can manage users
        if not request.user.is_admin:
            self.permission_denied(
                request, 
                message="Acesso negado. Apenas administradores possuem acesso a este recurso."
            )

    def perform_create(self, serializer):
        user = serializer.save()
        record_audit(
            self.request.user,
            'usuario.criado',
            f'Usuário {user.username} criado.',
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.id == self.request.user.id and instance.role_id == '1':
            new_role_id = serializer.validated_data.get('role_id', instance.role_id)
            if new_role_id != '1':
                raise ValidationError({
                    'roleId': 'Não é permitido remover sua própria permissão de administrador.',
                })

        user = serializer.save()
        record_audit(
            self.request.user,
            'usuario.atualizado',
            f'Usuário {user.username} atualizado.',
        )

    def perform_destroy(self, instance):
        username = instance.username
        super().perform_destroy(instance)
        record_audit(
            self.request.user,
            'usuario.excluido',
            f'Usuário {username} excluído.',
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.id == request.user.id:
            return Response(
                {"detail": "Não é permitido excluir seu próprio usuário conectado."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def toggle_status(self, request, pk=None):
        user_to_toggle = self.get_object()
        if user_to_toggle.id == request.user.id:
            return Response(
                {"detail": "Não é permitido alterar o status do seu próprio usuário."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user_to_toggle.status = 'inativo' if user_to_toggle.status == 'ativo' else 'ativo'
        user_to_toggle.save()
        record_audit(
            request.user,
            'usuario.status',
            f'Usuário {user_to_toggle.username} alterado para {user_to_toggle.status}.',
        )
        return Response({
            "id": user_to_toggle.id,
            "username": user_to_toggle.username,
            "status": user_to_toggle.status
        }, status=status.HTTP_200_OK)
