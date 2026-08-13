"""Navegação leve no Google Drive do usuário (pessoal, compartilhados e drives de equipe)."""

from __future__ import annotations

import urllib.error
import urllib.parse
import urllib.request

from apps.accounts.google_contacts_service import _google_api_get, ensure_valid_google_token

DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
FOLDER_MIME = 'application/vnd.google-apps.folder'
HOME_FOLDER_ID = '__home__'
SHARED_WITH_ME_ID = 'shared-with-me'
DRIVE_ID_PREFIX = 'drive:'
DRIVE_FILE_FIELDS = (
    'nextPageToken,files(id,name,mimeType,thumbnailLink,webViewLink,iconLink,modifiedTime,size)'
)
DRIVE_LIST_FIELDS = 'nextPageToken,drives(id,name)'


def _user_has_drive_scope(user) -> bool:
    token_info = user.google_token or {}
    scopes = token_info.get('scopes') or []
    if isinstance(scopes, str):
        scopes = scopes.split()
    return any('drive' in scope for scope in scopes)


def get_drive_access_token(user) -> str:
    if not user.google_token or not user.google_token.get('token'):
        raise ValueError('Vincule sua conta Google no perfil para acessar o Drive.')

    if not _user_has_drive_scope(user):
        raise ValueError(
            'Permissão do Google Drive ausente. Vincule novamente a conta Google no perfil '
            'para autorizar leitura dos seus arquivos.'
        )

    token_info = ensure_valid_google_token(user)
    return token_info['token']


def drive_status(user) -> dict:
    google_linked = bool(user.google_token and user.google_token.get('token'))
    has_drive_scope = _user_has_drive_scope(user) if google_linked else False
    return {
        'googleLinked': google_linked,
        'hasDriveScope': has_drive_scope,
        'needsGoogleLink': not google_linked or not has_drive_scope,
    }


def normalize_drive_kind(mime_type: str) -> str:
    mime = mime_type or ''
    if mime == FOLDER_MIME:
        return 'folder'
    if mime.startswith('image/'):
        return 'image'
    if mime.startswith('video/'):
        return 'video'
    if mime == 'application/pdf':
        return 'pdf'
    return 'other'


def is_attachable_kind(kind: str) -> bool:
    return kind in {'image', 'video', 'pdf'}


def _mime_filter_clause() -> str:
    return (
        "mimeType = 'application/vnd.google-apps.folder' "
        "or mimeType contains 'image/' "
        "or mimeType contains 'video/' "
        "or mimeType = 'application/pdf'"
    )


def _serialize_drive_item(item: dict) -> dict | None:
    file_id = item.get('id')
    if not file_id:
        return None
    mime_type = item.get('mimeType') or ''
    kind = normalize_drive_kind(mime_type)
    return {
        'id': file_id,
        'name': item.get('name') or '',
        'mimeType': mime_type,
        'kind': kind,
        'modifiedTime': item.get('modifiedTime'),
        'size': int(item['size']) if str(item.get('size', '')).isdigit() else None,
        'webViewLink': item.get('webViewLink'),
        'iconLink': item.get('iconLink'),
        'hasThumbnail': bool(item.get('thumbnailLink')),
        'attachable': is_attachable_kind(kind),
        'virtual': False,
        'driveId': item.get('driveId'),
    }


def _serialize_drive_items(payload: dict) -> list[dict]:
    items = []
    for item in payload.get('files') or []:
        serialized = _serialize_drive_item(item)
        if serialized:
            items.append(serialized)
    return items


def _list_drive_files(
    access_token: str,
    *,
    query: str,
    page_token: str | None = None,
    page_size: int = 50,
    drive_id: str | None = None,
) -> dict:
    params = {
        'q': query,
        'fields': DRIVE_FILE_FIELDS,
        'pageSize': str(min(max(page_size, 1), 100)),
        'orderBy': 'folder desc,name',
        'supportsAllDrives': 'true',
        'includeItemsFromAllDrives': 'true',
    }
    if drive_id:
        params['corpora'] = 'drive'
        params['driveId'] = drive_id
    if page_token:
        params['pageToken'] = page_token

    url = 'https://www.googleapis.com/drive/v3/files?' + urllib.parse.urlencode(params)
    return _google_api_get(url, access_token)


def _list_shared_drives(
    access_token: str,
    *,
    page_token: str | None = None,
    page_size: int = 50,
) -> dict:
    params = {
        'fields': DRIVE_LIST_FIELDS,
        'pageSize': str(min(max(page_size, 1), 100)),
    }
    if page_token:
        params['pageToken'] = page_token

    url = 'https://www.googleapis.com/drive/v3/drives?' + urllib.parse.urlencode(params)
    return _google_api_get(url, access_token)


def _virtual_folder(
    folder_id: str,
    name: str,
    *,
    drive_id: str | None = None,
) -> dict:
    item = {
        'id': folder_id,
        'name': name,
        'mimeType': FOLDER_MIME,
        'kind': 'folder',
        'modifiedTime': None,
        'size': None,
        'webViewLink': None,
        'iconLink': None,
        'hasThumbnail': False,
        'attachable': False,
        'virtual': True,
        'driveId': drive_id,
    }
    return item


def browse_drive_home(
    user,
    *,
    page_token: str | None = None,
    page_size: int = 50,
) -> dict:
    access_token = get_drive_access_token(user)
    items: list[dict] = []

    if not page_token:
        items.extend([
            _virtual_folder('root', 'Meu Drive'),
            _virtual_folder(SHARED_WITH_ME_ID, 'Compartilhados comigo'),
        ])

    drives_payload = _list_shared_drives(access_token, page_token=page_token, page_size=page_size)
    for drive in drives_payload.get('drives') or []:
        drive_id = drive.get('id')
        if not drive_id:
            continue
        items.append(_virtual_folder(
            f'{DRIVE_ID_PREFIX}{drive_id}',
            drive.get('name') or 'Drive compartilhado',
            drive_id=drive_id,
        ))

    return {
        'folderId': HOME_FOLDER_ID,
        'items': items,
        'nextPageToken': drives_payload.get('nextPageToken'),
        'driveId': None,
    }


def browse_drive_folder(
    user,
    *,
    folder_id: str = 'root',
    page_token: str | None = None,
    page_size: int = 50,
    drive_id: str | None = None,
) -> dict:
    safe_folder = (folder_id or 'root').strip() or 'root'
    safe_drive_id = (drive_id or '').strip() or None
    access_token = get_drive_access_token(user)
    mime_filter = _mime_filter_clause()

    if safe_folder == HOME_FOLDER_ID:
        return browse_drive_home(user, page_token=page_token, page_size=page_size)

    if safe_folder == SHARED_WITH_ME_ID:
        query = f'sharedWithMe = true and trashed = false and ({mime_filter})'
        payload = _list_drive_files(
            access_token,
            query=query,
            page_token=page_token,
            page_size=page_size,
        )
        return {
            'folderId': safe_folder,
            'items': _serialize_drive_items(payload),
            'nextPageToken': payload.get('nextPageToken'),
            'driveId': None,
        }

    if safe_folder.startswith(DRIVE_ID_PREFIX):
        safe_drive_id = safe_folder[len(DRIVE_ID_PREFIX):]
        safe_folder = safe_drive_id

    query = f"'{safe_folder}' in parents and trashed = false and ({mime_filter})"
    payload = _list_drive_files(
        access_token,
        query=query,
        page_token=page_token,
        page_size=page_size,
        drive_id=safe_drive_id,
    )
    return {
        'folderId': folder_id,
        'items': _serialize_drive_items(payload),
        'nextPageToken': payload.get('nextPageToken'),
        'driveId': safe_drive_id,
    }


def fetch_drive_files_by_ids(user, file_ids: list[str]) -> list[dict]:
    if not file_ids:
        return []

    access_token = get_drive_access_token(user)
    results: list[dict] = []

    for file_id in file_ids:
        safe_id = (file_id or '').strip()
        if not safe_id:
            continue
        params = urllib.parse.urlencode({
            'fields': 'id,name,mimeType,thumbnailLink,webViewLink,iconLink,modifiedTime,size',
            'supportsAllDrives': 'true',
        })
        url = f'https://www.googleapis.com/drive/v3/files/{urllib.parse.quote(safe_id)}?{params}'
        try:
            item = _google_api_get(url, access_token)
        except ValueError:
            continue
        mime_type = item.get('mimeType') or ''
        kind = normalize_drive_kind(mime_type)
        results.append({
            'id': item.get('id') or safe_id,
            'name': item.get('name') or '',
            'mimeType': mime_type,
            'kind': kind,
            'modifiedTime': item.get('modifiedTime'),
            'size': int(item['size']) if str(item.get('size', '')).isdigit() else None,
            'webViewLink': item.get('webViewLink'),
            'iconLink': item.get('iconLink'),
            'hasThumbnail': bool(item.get('thumbnailLink')),
        })

    return results


def fetch_file_metadata(user, file_id: str) -> dict:
    fetched = fetch_drive_files_by_ids(user, [file_id])
    if not fetched:
        raise ValueError('Arquivo não encontrado no Drive ou sem permissão de acesso.')
    meta = fetched[0]
    if not is_attachable_kind(meta['kind']):
        raise ValueError('Somente fotos, vídeos e PDFs podem ser anexados à campanha.')
    return meta


def _large_thumbnail_url(link: str) -> str:
    if '=s' in link:
        return link.rsplit('=s', 1)[0] + '=s1600'
    if link.endswith('='):
        return link + 's1600'
    return f'{link}=s1600'


def _download_authenticated_url(access_token: str, url: str, *, timeout: int = 30) -> tuple[bytes, str]:
    request = urllib.request.Request(
        url,
        headers={'Authorization': f'Bearer {access_token}'},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            content_type = response.headers.get('Content-Type', 'application/octet-stream')
            return response.read(), content_type
    except urllib.error.HTTPError as exc:
        body = exc.read().decode('utf-8', errors='replace')
        raise ValueError(f'Falha ao baixar arquivo: {body}') from exc


def fetch_thumbnail_bytes(user, file_id: str) -> tuple[bytes, str]:
    access_token = get_drive_access_token(user)
    params = urllib.parse.urlencode({
        'fields': 'thumbnailLink,iconLink',
        'supportsAllDrives': 'true',
    })
    url = f'https://www.googleapis.com/drive/v3/files/{urllib.parse.quote(file_id)}?{params}'
    payload = _google_api_get(url, access_token)
    link = payload.get('thumbnailLink') or payload.get('iconLink')
    if not link:
        raise ValueError('Miniatura indisponível para este arquivo.')
    return _download_authenticated_url(access_token, link, timeout=20)


def fetch_image_preview_bytes(user, file_id: str) -> tuple[bytes, str]:
    """Preview rápido de imagem via miniatura em alta resolução (evita baixar o original)."""
    access_token = get_drive_access_token(user)
    params = urllib.parse.urlencode({
        'fields': 'thumbnailLink,iconLink',
        'supportsAllDrives': 'true',
    })
    url = f'https://www.googleapis.com/drive/v3/files/{urllib.parse.quote(file_id)}?{params}'
    payload = _google_api_get(url, access_token)
    link = payload.get('thumbnailLink') or payload.get('iconLink')
    if not link:
        raise ValueError('Visualização indisponível para este arquivo.')
    return _download_authenticated_url(access_token, _large_thumbnail_url(link), timeout=30)


def fetch_file_kind(user, file_id: str) -> str:
    access_token = get_drive_access_token(user)
    params = urllib.parse.urlencode({
        'fields': 'mimeType',
        'supportsAllDrives': 'true',
    })
    meta_url = f'https://www.googleapis.com/drive/v3/files/{urllib.parse.quote(file_id)}?{params}'
    meta = _google_api_get(meta_url, access_token)
    return normalize_drive_kind(meta.get('mimeType') or '')


def open_drive_file_stream(user, file_id: str):
    """Abre stream de leitura do arquivo no Drive (alt=media)."""
    safe_id = (file_id or '').strip()
    if not safe_id:
        raise ValueError('fileId é obrigatório.')

    access_token = get_drive_access_token(user)
    params = urllib.parse.urlencode({
        'fields': 'mimeType,name,kind',
        'supportsAllDrives': 'true',
    })
    meta_url = f'https://www.googleapis.com/drive/v3/files/{urllib.parse.quote(safe_id)}?{params}'
    meta = _google_api_get(meta_url, access_token)
    mime_type = meta.get('mimeType') or 'application/octet-stream'
    name = meta.get('name') or safe_id

    media_url = (
        f'https://www.googleapis.com/drive/v3/files/{urllib.parse.quote(safe_id)}'
        f'?alt=media&supportsAllDrives=true'
    )
    request = urllib.request.Request(
        media_url,
        headers={'Authorization': f'Bearer {access_token}'},
    )
    try:
        response = urllib.request.urlopen(request, timeout=120)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode('utf-8', errors='replace')
        raise ValueError(f'Falha ao carregar arquivo: {body}') from exc

    return mime_type, name, response
