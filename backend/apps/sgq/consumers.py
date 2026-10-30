import json
import uuid

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from apps.marketing.presence import presence_store, serialize_user

from .auditoria_realtime import grupo_sync, sala_presenca, usuario_pode_acompanhar


class AuditoriaPresencaConsumer(AsyncWebsocketConsumer):
    """Presença da pergunta aberta e aviso de resposta salva por outra pessoa."""

    async def connect(self):
        self.auditoria_id = self.scope['url_route']['kwargs']['auditoria_id']
        user = self.scope.get('user')
        if not await database_sync_to_async(usuario_pode_acompanhar)(user, self.auditoria_id):
            await self.close(code=4403)
            return

        self.room_name = sala_presenca(self.auditoria_id)
        self.group_name = f'presence.sgq_auditoria.{self.auditoria_id}'
        self.sync_group = grupo_sync(self.auditoria_id)
        self.connection_id = str(uuid.uuid4())
        self.user_payload = {**serialize_user(user), 'itemId': None}

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.channel_layer.group_add(self.sync_group, self.channel_name)
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
        if hasattr(self, 'sync_group'):
            await self.channel_layer.group_discard(self.sync_group, self.channel_name)
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return
        tipo = data.get('type')
        if tipo == 'rascunho':
            item_id = str(data.get('itemId') or '').strip()
            codigo = str(data.get('opcaoCodigo') or '').strip()[:10]
            destaque = str(data.get('destaque') or '').strip()
            if destaque not in ('', 'forte', 'fraco'):
                destaque = ''
            if not item_id.isdigit() or not codigo:
                return
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'rascunho.broadcast',
                    'itemId': item_id,
                    'opcaoCodigo': codigo,
                    'destaque': destaque,
                    'actorUserId': self.user_payload['id'],
                    'actorName': self.user_payload['name'],
                },
            )
            return
        if tipo != 'foco':
            return
        item_id = str(data.get('itemId') or '').strip()
        if not item_id.isdigit() or len(item_id) > 20:
            item_id = ''
        self.user_payload = {**self.user_payload, 'itemId': item_id or None}
        online = presence_store.add(self.room_name, self.connection_id, self.user_payload)
        await self.channel_layer.group_send(
            self.group_name,
            {'type': 'presence.broadcast', 'online': online},
        )

    async def presence_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'presence',
            'online': event['online'],
        }))

    async def rascunho_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'rascunho',
            'itemId': event.get('itemId'),
            'opcaoCodigo': event.get('opcaoCodigo'),
            'destaque': event.get('destaque') or '',
            'actorUserId': event.get('actorUserId'),
            'actorName': event.get('actorName'),
        }))

    async def resposta_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'resposta',
            'event': event.get('event'),
            'itemId': event.get('itemId'),
            'actorUserId': event.get('actorUserId'),
        }))
