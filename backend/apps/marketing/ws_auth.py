"""Autenticação JWT na query string para WebSockets."""

from urllib.parse import parse_qs

import jwt
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser

User = get_user_model()


@database_sync_to_async
def _user_from_token(token: str):
    if not token:
        return AnonymousUser()
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_SETTINGS.get('ALGORITHM', 'HS256')],
        )
    except jwt.PyJWTError:
        return AnonymousUser()

    user_id = payload.get('user_id')
    if not user_id:
        return AnonymousUser()

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return AnonymousUser()

    if not user.is_currently_active:
        return AnonymousUser()
    return user


class JWTQueryAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get('query_string', b'').decode())
        token = (query.get('token') or [''])[0]
        scope['user'] = await _user_from_token(token)
        return await super().__call__(scope, receive, send)
