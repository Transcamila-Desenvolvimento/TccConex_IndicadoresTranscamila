"""Cópia provisória dos anexos da auditoria no Google Drive da pessoa."""

import json
import mimetypes
import uuid
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from apps.marketing.google_drive import (
    browse_drive_folder,
    drive_status,
    fetch_drive_files_by_ids,
    get_drive_access_token,
    open_drive_file_stream,
)
from apps.rh.drive_documento import EXTENSOES, MAX_BYTES

PASTA_RAIZ = 'TccConex Auditorias'
_ESCOPO_ARQUIVO = 'https://www.googleapis.com/auth/drive.file'
_PASTA_MIME = 'application/vnd.google-apps.folder'


def _escopos(user) -> list[str]:
    token_info = user.google_token or {}
    scopes = token_info.get('scopes') or []
    if isinstance(scopes, str):
        scopes = scopes.split()
    return list(scopes)


def pode_enviar_drive(user) -> bool:
    return _ESCOPO_ARQUIVO in _escopos(user) or 'https://www.googleapis.com/auth/drive' in _escopos(user)


def _get(url: str, token: str) -> dict:
    pedido = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
    try:
        with urllib.request.urlopen(pedido, timeout=30) as resposta:
            return json.loads(resposta.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        corpo = exc.read().decode('utf-8', errors='replace')
        raise ValueError(f'Não foi possível consultar o Google Drive. {corpo[:180]}') from exc


def _post_json(url: str, token: str, corpo: dict) -> dict:
    dados = json.dumps(corpo).encode('utf-8')
    pedido = urllib.request.Request(
        url,
        data=dados,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json; charset=UTF-8'},
        method='POST',
    )
    try:
        with urllib.request.urlopen(pedido, timeout=30) as resposta:
            return json.loads(resposta.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        detalhe = exc.read().decode('utf-8', errors='replace')
        raise ValueError(f'Não foi possível criar a pasta no Google Drive. {detalhe[:180]}') from exc


def _consulta_nome(nome: str) -> str:
    return nome.replace('\\', '\\\\').replace("'", "\\'")


def _pasta(token: str, nome: str, pai: str | None) -> str:
    filtro = (
        f"name = '{_consulta_nome(nome)}' and mimeType = '{_PASTA_MIME}' and trashed = false "
        f"and '{pai or 'root'}' in parents"
    )
    params = urllib.parse.urlencode({
        'q': filtro,
        'fields': 'files(id)',
        'pageSize': 1,
        'supportsAllDrives': 'true',
    })
    achada = (_get(f'https://www.googleapis.com/drive/v3/files?{params}', token).get('files') or [])
    if achada:
        return achada[0]['id']
    criada = _post_json(
        'https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true',
        token,
        {'name': nome, 'mimeType': _PASTA_MIME, 'parents': [pai or 'root']},
    )
    pasta_id = criada.get('id')
    if not pasta_id:
        raise ValueError('O Google Drive não devolveu a pasta da auditoria.')
    return pasta_id


def enviar_copia_auditoria(user, codigo: str, nome: str, conteudo: bytes) -> dict:
    if not pode_enviar_drive(user):
        raise ValueError('Para guardar a cópia no Drive, vincule novamente a conta Google no perfil.')
    token = get_drive_access_token(user)
    raiz = _pasta(token, PASTA_RAIZ, None)
    pasta = _pasta(token, (codigo or 'auditoria')[:80], raiz)
    mime = mimetypes.guess_type(nome)[0] or 'application/octet-stream'
    limite = uuid.uuid4().hex
    corpo = (
        f'--{limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'.encode()
        + json.dumps({'name': Path(nome).name[:180], 'parents': [pasta]}).encode()
        + f'\r\n--{limite}\r\nContent-Type: {mime}\r\n\r\n'.encode()
        + conteudo
        + f'\r\n--{limite}--'.encode()
    )
    pedido = urllib.request.Request(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink',
        data=corpo,
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': f'multipart/related; boundary={limite}',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(pedido, timeout=120) as resposta:
            meta = json.loads(resposta.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        detalhe = exc.read().decode('utf-8', errors='replace')
        raise ValueError(f'Não foi possível enviar a cópia ao Google Drive. {detalhe[:180]}') from exc
    arquivo_id = (meta.get('id') or '')[:128]
    if not arquivo_id:
        raise ValueError('O Google Drive não devolveu o arquivo enviado.')
    link = (meta.get('webViewLink') or f'https://drive.google.com/file/d/{arquivo_id}/view')[:500]
    return {'id': arquivo_id, 'link': link}


def referenciar_anexo_drive(user, file_id: str) -> dict:
    seguro = (file_id or '').strip()
    if not seguro:
        raise ValueError('Escolha um arquivo do Google Drive.')
    itens = fetch_drive_files_by_ids(user, [seguro])
    if not itens:
        raise ValueError('Arquivo não encontrado no Drive ou sem permissão de acesso.')
    meta = itens[0]
    nome = Path(meta.get('name') or seguro).name[:180]
    if Path(nome).suffix.lower() not in EXTENSOES:
        raise ValueError('Tipo de arquivo não aceito. Use PDF, Word, Excel, PowerPoint, texto ou imagem.')
    tamanho = int(meta.get('size') or 0)
    if tamanho > MAX_BYTES:
        raise ValueError('O arquivo passou de 15 MB.')
    link = (meta.get('webViewLink') or f'https://drive.google.com/file/d/{seguro}/view')[:500]
    return {'id': seguro[:128], 'nome': nome, 'tamanho': tamanho, 'link': link}


def abrir_anexo_drive(user, file_id: str):
    _mime, _nome, resposta = open_drive_file_stream(user, file_id)
    return resposta


def navegar_drive(user, *, folder_id: str, page_token: str | None, page_size: int, drive_id: str | None) -> dict:
    payload = browse_drive_folder(
        user,
        folder_id=folder_id,
        page_token=page_token,
        page_size=page_size,
        drive_id=drive_id,
        perfil='documentos',
    )
    items = []
    for item in payload['items']:
        ext = Path(item.get('name') or '').suffix.lower()
        anexavel = item.get('kind') != 'folder' and ext in EXTENSOES
        items.append({**item, 'thumbnailUrl': None, 'attachable': anexavel})
    return {
        'folderId': payload['folderId'],
        'driveId': payload.get('driveId'),
        'items': items,
        'nextPageToken': payload.get('nextPageToken'),
    }


def situacao_drive(user) -> dict:
    return drive_status(user)
