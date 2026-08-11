import json
import uuid

from channels.generic.websocket import AsyncWebsocketConsumer

from .presence import MARKETING_PRESENCE_ROOM, _user_has_marketing, presence_store, serialize_user
from .realtime import MARKETING_SYNC_GROUP


class MarketingPresenceConsumer(AsyncWebsocketConsumer):
    room_name = MARKETING_PRESENCE_ROOM
    group_name = f'presence.{MARKETING_PRESENCE_ROOM}'

    async def connect(self):
        user = self.scope.get('user')
        if user is None or not user.is_authenticated or not _user_has_marketing(user):
            await self.close(code=4403)
            return

        self.connection_id = str(uuid.uuid4())
        self.user_payload = serialize_user(user)

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.channel_layer.group_add(MARKETING_SYNC_GROUP, self.channel_name)
        await self.accept()

        online = presence_store.add(self.room_name, self.connection_id, self.user_payload)
        await self.channel_layer.group_send(
            self.group_name,
            {'type': 'presence.broadcast', 'online': online},
        )

    async def disconnect(self, close_code):
        if hasattr(self, 'connection_id'):
            online = presence_store.remove(self.room_name, self.connection_id)
            await self.channel_layer.group_send(
                self.group_name,
                {'type': 'presence.broadcast', 'online': online},
            )
        await self.channel_layer.group_discard(MARKETING_SYNC_GROUP, self.channel_name)
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def presence_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'presence',
            'online': event['online'],
        }))

    async def campanha_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'campanha',
            'event': event['event'],
            'campanhaId': event.get('campanhaId'),
            'actorUserId': event.get('actorUserId'),
        }))
