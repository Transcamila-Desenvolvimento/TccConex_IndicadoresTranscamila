import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import authentication
from rest_framework.exceptions import AuthenticationFailed

User = get_user_model()


class JWTAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return None

        token = parts[1]
        try:
            payload = jwt.decode(
                token, 
                settings.SECRET_KEY, 
                algorithms=[settings.JWT_SETTINGS.get('ALGORITHM', 'HS256')]
            )
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token expirado. Por favor, faça login novamente.')
        except jwt.InvalidTokenError:
            raise AuthenticationFailed('Token inválido ou corrompido.')

        user_id = payload.get('user_id')
        if not user_id:
            raise AuthenticationFailed('Token não contém identificador do usuário.')

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise AuthenticationFailed('Usuário não encontrado.')

        if not user.is_currently_active:
            raise AuthenticationFailed('Este usuário está inativo no sistema.')

        return (user, token)
