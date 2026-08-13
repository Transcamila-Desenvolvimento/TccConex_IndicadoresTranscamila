from __future__ import annotations

from .google_drive import fetch_drive_files_by_ids, fetch_file_metadata, is_attachable_kind
from .models import CampanhaMidia


def _user_brief(user) -> dict | None:
    if not user:
        return None
    return {
        'id': user.pk,
        'name': user.name or user.username,
        'googlePicture': getattr(user, 'google_picture_url', '') or '',
    }


def _preview_url(file_id: str, kind: str, web_view_link: str | None) -> str | None:
    if web_view_link:
        return web_view_link
    if kind in {'image', 'video', 'pdf'}:
        return f'https://drive.google.com/file/d/{file_id}/view'
    return None


def build_campanha_midia_payloads(campanha, user) -> list[dict]:
    links = list(
        campanha.midias.select_related('adicionado_por').order_by('ordem', 'data_criacao'),
    )
    if not links:
        return []

    file_ids = [link.drive_file_id for link in links]
    drive_by_id: dict[str, dict] = {}
    try:
        for item in fetch_drive_files_by_ids(user, file_ids):
            drive_by_id[item['id']] = item
    except ValueError:
        drive_by_id = {}

    payloads: list[dict] = []
    for link in links:
        file_id = link.drive_file_id
        drive = drive_by_id.get(file_id, {})
        kind = drive.get('kind') or 'other'
        name = drive.get('name') or file_id
        payloads.append({
            'id': link.pk,
            'driveFileId': file_id,
            'name': name,
            'kind': kind,
            'mimeType': drive.get('mimeType') or '',
            'adicionadoPor': _user_brief(link.adicionado_por),
            'dataCriacao': link.data_criacao,
            'thumbnailUrl': f'/api/marketing/drive/thumbnail/?fileId={file_id}' if drive else None,
            'previewUrl': _preview_url(file_id, kind, drive.get('webViewLink')),
        })

    return payloads


def create_campanha_midia(*, campanha, drive_file_id: str, user) -> CampanhaMidia:
    meta = fetch_file_metadata(user, drive_file_id)
    if not is_attachable_kind(meta['kind']):
        raise ValueError('Somente fotos, vídeos e PDFs podem ser anexados.')
    file_id = drive_file_id.strip()
    next_ordem = campanha.midias.count()
    return CampanhaMidia.objects.create(
        campanha=campanha,
        drive_file_id=file_id,
        adicionado_por=user,
        ordem=next_ordem,
    )
