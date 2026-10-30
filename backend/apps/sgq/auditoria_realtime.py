"""Quem está na mesma pergunta da auditoria, e aviso quando alguém salva."""

from __future__ import annotations

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def sala_presenca(auditoria_id) -> str:
    return f'sgq_auditoria:{auditoria_id}'


def grupo_sync(auditoria_id) -> str:
    return f'sgq.auditoria.{auditoria_id}'


def usuario_pode_acompanhar(user, auditoria_id) -> bool:
    from apps.accounts.permissions import user_has_filial_access, user_has_module_access

    from .models import AuditoriaSGQ

    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    if not user_has_module_access(user, 'SGQ'):
        return False
    auditoria = AuditoriaSGQ.objects.filter(pk=auditoria_id).only('filial').first()
    if auditoria is None:
        return False
    return user_has_filial_access(user, 'SGQ', auditoria.filial)


def notify_auditoria_changed(*, auditoria_id, item_id, actor_user_id, event: str) -> None:
    layer = get_channel_layer()
    if layer is None:
        return
    try:
        async_to_sync(layer.group_send)(
            grupo_sync(auditoria_id),
            {
                'type': 'resposta.broadcast',
                'event': event,
                'itemId': str(item_id) if item_id is not None else None,
                'actorUserId': str(actor_user_id) if actor_user_id is not None else None,
            },
        )
    except Exception:
        logger.exception('Falha ao avisar a colaboração da auditoria %s', auditoria_id)
