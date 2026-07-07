from django.contrib.auth import get_user_model

from .models import AuditLog

User = get_user_model()


def record_audit(user, action: str, details: str = '') -> AuditLog:
    username = ''
    if user and getattr(user, 'is_authenticated', False):
        username = user.username
    return AuditLog.objects.create(
        user=user if user and getattr(user, 'is_authenticated', False) else None,
        username=username,
        action=action,
        details=details,
    )
