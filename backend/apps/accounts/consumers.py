"""Presença da sessão por WebSocket. A conexão aberta é o sinal; não há consulta repetida."""

import json
import uuid

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from apps.marketing.presence import presence_store

APP_PRESENCE_ROOM = 'app_session'
ADMIN_PRESENCE_GROUP = 'presence.app_session.admins'


def _ids_from(entries: list[dict]) -> list[str]:
    return [item['id'] for item in entries]


class SessionPresenceConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        if user is None or not getattr(user, 'is_authenticated', False):
            await self.close(code=4401)
            return

        self.connection_id = str(uuid.uuid4())
        self.user_id = str(user.id)
        self.is_admin = bool(getattr(user, 'is_admin', False))

        if self.is_admin:
            await self.channel_layer.group_add(ADMIN_PRESENCE_GROUP, self.channel_name)
        await self.accept()

        online_ids = await self._add()
        await self.channel_layer.group_send(
            ADMIN_PRESENCE_GROUP,
            {'type': 'presence.broadcast', 'onlineIds': online_ids},
        )

    async def disconnect(self, close_code):
        if hasattr(self, 'connection_id'):
            online_ids = await self._remove()
            await self.channel_layer.group_send(
                ADMIN_PRESENCE_GROUP,
                {'type': 'presence.broadcast', 'onlineIds': online_ids},
            )
        if getattr(self, 'is_admin', False):
            await self.channel_layer.group_discard(ADMIN_PRESENCE_GROUP, self.channel_name)

    async def presence_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'presence',
            'onlineIds': event['onlineIds'],
        }))

    @sync_to_async
    def _add(self) -> list[str]:
        return _ids_from(presence_store.add(
            APP_PRESENCE_ROOM,
            self.connection_id,
            {'id': self.user_id, 'name': ''},
        ))

    @sync_to_async
    def _remove(self) -> list[str]:
        return _ids_from(presence_store.remove(APP_PRESENCE_ROOM, self.connection_id))
