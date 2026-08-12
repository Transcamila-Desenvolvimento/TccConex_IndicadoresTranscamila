"""Listagem leve de mídias (fotos/vídeos) em pasta do Google Drive."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

from apps.accounts.google_contacts_service import (
    _google_api_get,
    ensure_valid_google_token,
)

DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'

DRIVE_FILE_FIELDS = (
    'nextPageToken,files(id,name,mimeType,thumbnailLink,webViewLink,iconLink,modifiedTime,size)'
)


def drive_folder_configured() -> bool:
    return bool(getattr(settings, 'MARKETING_DRIVE_FOLDER_ID', ''))


def service_account_configured() -> bool:
    return bool(getattr(settings, 'GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON', ''))


def _service_account_access_token() -> str:
    raw = getattr(settings, 'GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON', '') or ''
    if not raw:
        raise ValueError('Conta de serviço do Google Drive não configurada.')

    try:
        from google.auth.transport.requests import Request
        from google.oauth2 import service_account
    except ImportError as exc:
        raise ValueError('Dependência google-auth não instalada no servidor.') from exc

    info = json.loads(raw)
    credentials = service_account.Credentials.from_service_account_info(
        info,
        scopes=[DRIVE_READONLY_SCOPE],
    )
    credentials.refresh(Request())
    if not credentials.token:
        raise ValueError('Não foi possível obter token da conta de serviço Google.')
    return credentials.token


def _user_has_drive_scope(user) -> bool:
    token_info = user.google_token or {}
    scopes = token_info.get('scopes') or []
    if isinstance(scopes, str):
        scopes = scopes.split()
    return any('drive' in scope for scope in scopes)


def get_drive_access_token(user) -> tuple[str, str]:
    """Retorna (access_token, auth_mode) onde auth_mode é service_account ou user."""
    if service_account_configured():
        return _service_account_access_token(), 'service_account'

    if not user.google_token or not user.google_token.get('token'):
        raise ValueError('Vincule sua conta Google no perfil para acessar o banco de mídias.')

    if not _user_has_drive_scope(user):
        raise ValueError(
            'Permissão do Google Drive ausente. Vincule novamente a conta Google no perfil '
            'para autorizar leitura do Drive.'
        )

    token_info = ensure_valid_google_token(user)
    return token_info['token'], 'user'


def drive_bank_status(user) -> dict:
    configured = drive_folder_configured()
    sa = service_account_configured()
    google_linked = bool(user.google_token and user.google_token.get('token'))
    has_drive_scope = _user_has_drive_scope(user) if google_linked else False

    needs_google_link = configured and not sa and (not google_linked or not has_drive_scope)

    return {
        'configured': configured,
        'authMode': 'service_account' if sa else 'user',
        'googleLinked': google_linked,
        'hasDriveScope': has_drive_scope or sa,
        'needsGoogleLink': needs_google_link,
    }


def _mime_query(kind: str) -> str:
    if kind == 'image':
        return "(mimeType contains 'image/')"
    if kind == 'video':
        return "(mimeType contains 'video/')"
    return "(mimeType contains 'image/' or mimeType contains 'video/')"


def _normalize_kind(mime_type: str) -> str:
    if (mime_type or '').startswith('video/'):
        return 'video'
    return 'image'


def list_drive_media(
    user,
    *,
    page_token: str | None = None,
    search: str | None = None,
    kind: str = 'all',
    page_size: int = 24,
) -> dict:
    folder_id = getattr(settings, 'MARKETING_DRIVE_FOLDER_ID', '') or ''
    if not folder_id:
        raise ValueError('Banco de mídias não configurado (MARKETING_DRIVE_FOLDER_ID).')

    access_token, auth_mode = get_drive_access_token(user)

    q_parts = [
        f"'{folder_id}' in parents",
        'trashed = false',
        _mime_query(kind),
    ]
    term = (search or '').strip()
    if term:
        safe = term.replace("'", "\\'")
        q_parts.append(f"name contains '{safe}'")

    params = {
        'q': ' and '.join(q_parts),
        'fields': DRIVE_FILE_FIELDS,
        'pageSize': str(min(max(page_size, 1), 50)),
        'orderBy': 'modifiedTime desc',
        'supportsAllDrives': 'true',
        'includeItemsFromAllDrives': 'true',
    }
    if page_token:
        params['pageToken'] = page_token

    url = 'https://www.googleapis.com/drive/v3/files?' + urllib.parse.urlencode(params)
    payload = _google_api_get(url, access_token)

    files = []
    for item in payload.get('files') or []:
        file_id = item.get('id')
        if not file_id:
            continue
        mime_type = item.get('mimeType') or ''
        files.append({
            'id': file_id,
            'name': item.get('name') or '',
            'mimeType': mime_type,
            'kind': _normalize_kind(mime_type),
            'modifiedTime': item.get('modifiedTime'),
            'size': int(item['size']) if str(item.get('size', '')).isdigit() else None,
            'webViewLink': item.get('webViewLink'),
            'iconLink': item.get('iconLink'),
            'hasThumbnail': bool(item.get('thumbnailLink')),
        })

    return {
        'files': files,
        'nextPageToken': payload.get('nextPageToken'),
        'authMode': auth_mode,
    }


def fetch_file_thumbnail_link(user, file_id: str) -> str | None:
    folder_id = getattr(settings, 'MARKETING_DRIVE_FOLDER_ID', '') or ''
    if not folder_id or not file_id:
        return None

    access_token, _ = get_drive_access_token(user)
    params = urllib.parse.urlencode({
        'fields': 'thumbnailLink,iconLink,mimeType',
        'supportsAllDrives': 'true',
    })
    url = f'https://www.googleapis.com/drive/v3/files/{urllib.parse.quote(file_id)}?{params}'
    payload = _google_api_get(url, access_token)
    return payload.get('thumbnailLink') or payload.get('iconLink')


def fetch_thumbnail_bytes(user, file_id: str) -> tuple[bytes, str]:
    link = fetch_file_thumbnail_link(user, file_id)
    if not link:
        raise ValueError('Miniatura indisponível para este arquivo.')

    access_token, _ = get_drive_access_token(user)
    request = urllib.request.Request(
        link,
        headers={'Authorization': f'Bearer {access_token}'},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            content_type = response.headers.get('Content-Type', 'image/jpeg')
            return response.read(), content_type
    except urllib.error.HTTPError as exc:
        body = exc.read().decode('utf-8', errors='replace')
        raise ValueError(f'Falha ao carregar miniatura: {body}') from exc
