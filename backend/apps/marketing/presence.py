"""Presença online por sala — store compartilhado (Redis ou memória local)."""

from __future__ import annotations

import json
import os
import threading
from typing import Any

MARKETING_PRESENCE_ROOM = 'marketing_campanhas'


def _user_has_marketing(user) -> bool:
    from apps.accounts.constants import normalize_environment

    if getattr(user, 'is_admin', False):
        return True
    envs = [normalize_environment(e) for e in (user.environments or [])]
    return 'Marketing' in envs


def serialize_user(user) -> dict[str, Any]:
    return {
        'id': str(user.id),
        'name': user.name or user.get_full_name() or user.username,
        'googlePicture': user.google_picture_url or None,
        'googleEmail': user.google_email or None,
    }


def _dedupe_users(entries: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    for item in entries.values():
        by_id[item['id']] = item
    return sorted(by_id.values(), key=lambda u: (u.get('name') or '').lower())


class InMemoryPresenceStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._rooms: dict[str, dict[str, dict[str, Any]]] = {}

    def add(self, room: str, connection_id: str, user_payload: dict[str, Any]) -> list[dict[str, Any]]:
        with self._lock:
            bucket = self._rooms.setdefault(room, {})
            bucket[connection_id] = user_payload
            return _dedupe_users(bucket)

    def remove(self, room: str, connection_id: str) -> list[dict[str, Any]]:
        with self._lock:
            bucket = self._rooms.get(room, {})
            bucket.pop(connection_id, None)
            if not bucket:
                self._rooms.pop(room, None)
            return _dedupe_users(bucket)

    def snapshot(self, room: str) -> list[dict[str, Any]]:
        with self._lock:
            return _dedupe_users(self._rooms.get(room, {}))


class RedisPresenceStore:
    def __init__(self, redis_url: str) -> None:
        import redis

        self._client = redis.Redis.from_url(redis_url, decode_responses=True)

    def _key(self, room: str) -> str:
        return f'presence:{room}'

    def add(self, room: str, connection_id: str, user_payload: dict[str, Any]) -> list[dict[str, Any]]:
        self._client.hset(self._key(room), connection_id, json.dumps(user_payload))
        return self.snapshot(room)

    def remove(self, room: str, connection_id: str) -> list[dict[str, Any]]:
        self._client.hdel(self._key(room), connection_id)
        return self.snapshot(room)

    def snapshot(self, room: str) -> list[dict[str, Any]]:
        raw = self._client.hgetall(self._key(room))
        entries = {}
        for conn_id, value in raw.items():
            try:
                entries[conn_id] = json.loads(value)
            except json.JSONDecodeError:
                continue
        return _dedupe_users(entries)


def get_presence_store():
    redis_url = os.environ.get('PRESENCE_REDIS_URL') or os.environ.get('CELERY_BROKER_URL')
    use_redis = os.environ.get('USE_PRESENCE_REDIS', 'auto')
    if use_redis == 'false':
        return InMemoryPresenceStore()
    if use_redis == 'true' and redis_url:
        return RedisPresenceStore(redis_url)
    if use_redis == 'auto' and redis_url and os.environ.get('USE_CELERY', 'False') == 'True':
        return RedisPresenceStore(redis_url)
    return InMemoryPresenceStore()


presence_store = get_presence_store()
