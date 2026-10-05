"""Lê um arquivo do Drive uma vez, em memória, para extrair o texto."""

from pathlib import Path

from apps.marketing.google_drive import fetch_drive_files_by_ids, open_drive_file_stream

EXTENSOES = {
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.png', '.jpg', '.jpeg', '.txt', '.csv',
}
MAX_BYTES = 15 * 1024 * 1024


def baixar_conteudo_drive(user, file_id: str) -> dict:
    seguro = (file_id or '').strip()
    if not seguro:
        raise ValueError('Escolha um arquivo do Google Drive.')

    itens = fetch_drive_files_by_ids(user, [seguro])
    if not itens:
        raise ValueError('Arquivo não encontrado no Drive ou sem permissão de acesso.')

    meta = itens[0]
    nome = Path(meta.get('name') or seguro).name
    ext = Path(nome).suffix.lower()
    if ext not in EXTENSOES:
        raise ValueError('Tipo de arquivo não aceito. Use PDF, Word, Excel, PowerPoint, texto ou imagem.')

    tamanho_meta = meta.get('size') or 0
    if tamanho_meta and tamanho_meta > MAX_BYTES:
        raise ValueError('O arquivo passou de 15 MB.')

    _tipo, _nome, resposta = open_drive_file_stream(user, seguro)
    partes = []
    total = 0
    try:
        while True:
            bloco = resposta.read(64 * 1024)
            if not bloco:
                break
            total += len(bloco)
            if total > MAX_BYTES:
                raise ValueError('O arquivo passou de 15 MB.')
            partes.append(bloco)
    finally:
        resposta.close()

    link = (meta.get('webViewLink') or f'https://drive.google.com/file/d/{seguro}/view')[:500]
    return {
        'id': seguro[:128],
        'nome': nome[:180],
        'tamanho': total,
        'conteudo': b''.join(partes),
        'link': link,
    }
