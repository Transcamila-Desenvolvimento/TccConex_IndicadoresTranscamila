"""Mensagens diretas do app "TccConex ERP" no Google Chat (aparece no painel do Chat do Gmail).

Autentica como app (conta de serviço, escopo chat.bot). A pessoa só recebe se já tiver
adicionado o app no Chat (ou o administrador do Workspace tiver instalado para todos).
"""

from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.parse
import urllib.request

import jwt
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

CHAT_SCOPE = 'https://www.googleapis.com/auth/chat.bot'
CHAT_API = 'https://chat.googleapis.com/v1'
TIMEOUT_SEGUNDOS = 8
CACHE_TOKEN = 'notificacoes:google_chat:token'
CACHE_ESPACO = 'notificacoes:google_chat:dm:{email}'
CACHE_ESPACO_TTL = 24 * 60 * 60
# Evita consultar o Chat a cada aviso para quem ainda não adicionou o app.
CACHE_SEM_ESPACO_TTL = 30 * 60
SEM_ESPACO = '__sem_dm__'


def _credenciais() -> dict | None:
    raw = (getattr(settings, 'GOOGLE_CHAT_SERVICE_ACCOUNT_JSON', '') or '').strip()
    if not raw:
        return None
    try:
        if raw.startswith('{'):
            dados = json.loads(raw)
        else:
            with open(os.path.expanduser(raw), encoding='utf-8') as handle:
                dados = json.load(handle)
    except (OSError, json.JSONDecodeError):
        logger.exception('GOOGLE_CHAT_SERVICE_ACCOUNT_JSON inválido')
        return None
    if not dados.get('client_email') or not dados.get('private_key'):
        logger.error('GOOGLE_CHAT_SERVICE_ACCOUNT_JSON sem client_email/private_key')
        return None
    return dados


def chat_habilitado() -> bool:
    return _credenciais() is not None


def _access_token() -> str:
    token = cache.get(CACHE_TOKEN)
    if token:
        return token
    cred = _credenciais()
    if cred is None:
        raise RuntimeError('Google Chat não configurado.')
    token_uri = cred.get('token_uri') or 'https://oauth2.googleapis.com/token'
    agora = int(time.time())
    assertion = jwt.encode(
        {
            'iss': cred['client_email'],
            'scope': CHAT_SCOPE,
            'aud': token_uri,
            'iat': agora,
            'exp': agora + 3600,
        },
        cred['private_key'],
        algorithm='RS256',
    )
    body = urllib.parse.urlencode({
        'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion': assertion,
    }).encode('utf-8')
    request = urllib.request.Request(token_uri, data=body, method='POST')
    request.add_header('Content-Type', 'application/x-www-form-urlencoded')
    with urllib.request.urlopen(request, timeout=TIMEOUT_SEGUNDOS) as response:
        dados = json.loads(response.read().decode('utf-8'))
    token = dados['access_token']
    cache.set(CACHE_TOKEN, token, max(60, int(dados.get('expires_in') or 3600) - 120))
    return token


def _chat_request(method: str, path: str, payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode('utf-8') if payload is not None else None
    request = urllib.request.Request(f'{CHAT_API}/{path}', data=data, method=method)
    request.add_header('Authorization', f'Bearer {_access_token()}')
    if data is not None:
        request.add_header('Content-Type', 'application/json; charset=utf-8')
    with urllib.request.urlopen(request, timeout=TIMEOUT_SEGUNDOS) as response:
        raw = response.read().decode('utf-8')
    return json.loads(raw) if raw else {}


def _email_chat(user) -> str:
    return ((getattr(user, 'google_email', None) or getattr(user, 'email', None) or '').strip().lower())


def espaco_direto(email: str) -> str | None:
    """Nome da conversa direta (spaces/...) entre o app e a pessoa, ou None se ela não adicionou o app."""
    chave = CACHE_ESPACO.format(email=email)
    salvo = cache.get(chave)
    if salvo:
        return None if salvo == SEM_ESPACO else salvo
    try:
        dados = _chat_request('GET', 'spaces:findDirectMessage?' + urllib.parse.urlencode({'name': f'users/{email}'}))
    except urllib.error.HTTPError as exc:
        if exc.code in (403, 404):
            cache.set(chave, SEM_ESPACO, CACHE_SEM_ESPACO_TTL)
            return None
        raise
    nome = (dados.get('name') or '').strip()
    cache.set(chave, nome or SEM_ESPACO, CACHE_ESPACO_TTL if nome else CACHE_SEM_ESPACO_TTL)
    return nome or None


def montar_mensagem(*, titulo: str, mensagem: str, link: str) -> dict:
    url = f'{settings.FRONTEND_BASE_URL.rstrip("/")}{link}' if link else settings.FRONTEND_BASE_URL
    secao = {'widgets': [{'textParagraph': {'text': mensagem or titulo}}]}
    secao['widgets'].append({
        'buttonList': {
            'buttons': [{'text': 'Abrir no ERP', 'onClick': {'openLink': {'url': url}}}],
        },
    })
    return {
        # O texto simples é o que aparece no aviso do celular/computador.
        'text': f'*{titulo}*\n{mensagem}'.strip(),
        'cardsV2': [{
            'cardId': 'tccconex-notificacao',
            'card': {
                'header': {'title': titulo, 'subtitle': 'TccConex ERP'},
                'sections': [secao],
            },
        }],
    }


def enviar_mensagem_direta(user, *, titulo: str, mensagem: str = '', link: str = '') -> bool:
    """Envia no Chat; devolve False quando a pessoa não tem e-mail ou não adicionou o app."""
    if not chat_habilitado():
        return False
    email = _email_chat(user)
    if not email:
        return False
    espaco = espaco_direto(email)
    if not espaco:
        return False
    try:
        _chat_request('POST', f'{espaco}/messages', montar_mensagem(titulo=titulo, mensagem=mensagem, link=link))
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            cache.delete(CACHE_ESPACO.format(email=email))
            return False
        raise
    return True
