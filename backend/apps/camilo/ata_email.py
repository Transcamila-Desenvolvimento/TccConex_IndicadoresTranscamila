"""Envio da ata pelo Gmail da pessoa, no mesmo caminho dos outros ambientes."""

from django.core.mail import EmailMessage

from apps.accounts.google_gmail_service import send_gmail_as_user

PDF_MAX_BYTES = 8 * 1024 * 1024


def _emails(data, chave: str) -> list[str]:
    partes = []
    if hasattr(data, 'getlist'):
        listados = data.getlist(chave)
        if listados:
            partes.extend(listados)
    if not partes and hasattr(data, 'get'):
        valor = data.get(chave)
        if isinstance(valor, list):
            partes.extend(valor)
        elif valor:
            partes.append(valor)
    vistos = []
    for parte in partes:
        email = str(parte).strip().lower()
        if email and '@' in email and ' ' not in email and email not in vistos:
            vistos.append(email)
    return vistos


def _pdf(request) -> bytes:
    arquivo = request.FILES.get('pdf') if hasattr(request, 'FILES') else None
    if arquivo is None:
        raise ValueError('Não foi possível receber o PDF da ata.')
    dados = arquivo.read()
    if len(dados) > PDF_MAX_BYTES:
        raise ValueError('O PDF da ata excede o tamanho permitido.')
    if len(dados) < 5 or not dados.startswith(b'%PDF'):
        raise ValueError('O PDF da ata é inválido.')
    return dados


def enviar_ata_por_email(user, request) -> dict:
    google = (getattr(user, 'google_email', None) or '').strip()
    if not google:
        raise ValueError('Vincule sua conta Google no perfil para enviar a ata pelo seu e-mail.')
    destinatarios = _emails(request.data, 'to')
    if not destinatarios:
        raise ValueError('Informe ao menos um destinatário.')
    copias = [email for email in _emails(request.data, 'cc') if email not in destinatarios and email != google.lower()]
    titulo = ' '.join(str(request.data.get('titulo') or 'Ata de reunião').split()).strip()[:120] or 'Ata de reunião'
    observacao = ' '.join(str(request.data.get('observacao') or '').split()).strip()[:2000]
    pdf = _pdf(request)
    corpo = [f'Segue a ata da reunião "{titulo}".']
    if observacao:
        corpo.append(observacao)
    nome = (getattr(user, 'name', None) or getattr(user, 'username', None) or '').strip()
    if nome:
        corpo.append(f'Enviado por {nome} pelo TccConex.')
    email = EmailMessage(
        subject=f'Ata de reunião — {titulo}',
        body='\n\n'.join(corpo),
        to=destinatarios,
        cc=copias,
    )
    email.attach('ata-reuniao.pdf', pdf, 'application/pdf')
    send_gmail_as_user(user, email)
    return {'to': destinatarios, 'cc': copias, 'titulo': titulo}
