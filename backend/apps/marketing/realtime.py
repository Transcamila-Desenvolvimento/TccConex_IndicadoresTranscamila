"""Broadcast de alterações do Marketing via Channel Layer (WebSocket)."""

from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

MARKETING_SYNC_GROUP = 'marketing.campanhas.sync'


def notify_marketing_changed(
    *,
    event: str,
    campanha_id=None,
    actor_user_id=None,
) -> None:
    layer = get_channel_layer()
    if layer is None:
        return

    async_to_sync(layer.group_send)(
        MARKETING_SYNC_GROUP,
        {
            'type': 'campanha.broadcast',
            'event': event,
            'campanhaId': str(campanha_id) if campanha_id is not None else None,
            'actorUserId': str(actor_user_id) if actor_user_id is not None else None,
        },
    )
