"""Avisos no canto do sistema operacional via Web Push (Chrome/Edge/Firefox).

O navegador entrega o aviso mesmo com o ERP fechado, desde que esteja aberto ou
rodando em segundo plano. Chaves VAPID vêm das variáveis WEBPUSH_VAPID_*.
"""

from __future__ import annotations

import json
import logging

from django.conf import settings

from .models import PushInscricao

logger = logging.getLogger(__name__)

TIMEOUT_SEGUNDOS = 8
# Inscrição expirada/cancelada no navegador: o serviço de push responde 404 ou 410.
STATUS_INSCRICAO_INVALIDA = {404, 410}


def chave_publica() -> str:
    return (getattr(settings, 'WEBPUSH_VAPID_PUBLIC_KEY', '') or '').strip()


def _chave_privada() -> str:
    return (getattr(settings, 'WEBPUSH_VAPID_PRIVATE_KEY', '') or '').strip()


def push_habilitado() -> bool:
    return bool(chave_publica() and _chave_privada())


def montar_payload(*, notificacao_id, titulo: str, mensagem: str = '', link: str = '', tag: str = '') -> dict:
    return {
        'id': str(notificacao_id) if notificacao_id is not None else '',
        'titulo': titulo,
        'mensagem': mensagem,
        'link': link,
        'tag': tag or (f'notif-{notificacao_id}' if notificacao_id is not None else ''),
    }


def enviar_para_inscricao(inscricao: PushInscricao, payload: dict) -> bool:
    """Envia para um navegador. Remove a inscrição se o navegador a invalidou."""
    from pywebpush import WebPushException, webpush

    try:
        webpush(
            subscription_info={
                'endpoint': inscricao.endpoint,
                'keys': {'p256dh': inscricao.p256dh, 'auth': inscricao.auth},
            },
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=_chave_privada(),
            vapid_claims={'sub': settings.WEBPUSH_VAPID_SUBJECT},
            timeout=TIMEOUT_SEGUNDOS,
            ttl=24 * 60 * 60,
        )
        return True
    except WebPushException as exc:
        status = getattr(getattr(exc, 'response', None), 'status_code', None)
        if status in STATUS_INSCRICAO_INVALIDA:
            inscricao.delete()
            return False
        raise


def enviar_para_usuario(user, payload: dict) -> int:
    enviados = 0
    for inscricao in list(PushInscricao.objects.filter(usuario=user)):
        try:
            if enviar_para_inscricao(inscricao, payload):
                enviados += 1
        except Exception:
            logger.exception('Falha ao enviar Web Push para o usuário %s', user.pk)
    return enviados
