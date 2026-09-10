import base64
import json
import urllib.error
import urllib.parse
import urllib.request

from django.core.mail import EmailMessage
from email.header import Header
from email.utils import formataddr

from .google_contacts_service import ensure_valid_google_token

GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send'


def _token_scopes(token_info: dict) -> list[str]:
    scopes = token_info.get('scopes') or []
    if isinstance(scopes, str):
        return scopes.split()
    return [str(item) for item in scopes]


def fetch_tokeninfo_scopes(access_token: str) -> list[str]:
    url = 'https://oauth2.googleapis.com/tokeninfo?' + urllib.parse.urlencode({'access_token': access_token})
    request = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            data = json.loads(response.read().decode('utf-8'))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return []
    scope = data.get('scope') or ''
    return [part for part in scope.split() if part]


def format_gmail_http_error(status_code: int, body: str) -> str:
    message = ''
    try:
        payload = json.loads(body)
        error = payload.get('error') or {}
        if isinstance(error, dict):
            message = str(error.get('message') or '')
        elif error:
            message = str(error)
    except json.JSONDecodeError:
        message = (body or '')[:300]

    combined = f'{message} {body}'.lower()
    if any(term in combined for term in ('has not been used', 'disabled', 'access not configured', 'accessnotconfigured')):
        return (
            'A API Gmail ainda não está ativada no projeto Google Cloud do TccConex. '
            'Um administrador precisa ativar "Gmail API" no Google Cloud Console e aguardar alguns minutos.'
        )
    if 'insufficient' in combined:
        return (
            'O Google não concedeu permissão de envio de e-mail. '
            'Desvincule a conta no perfil, vincule de novo e aceite a permissão de enviar e-mail em seu nome.'
        )
    if message:
        return f'O Gmail recusou o envio: {message}'
    return f'O Gmail recusou o envio (HTTP {status_code}).'


def _prepare_mime(user, email_obj: EmailMessage, google_email: str):
    mime = email_obj.message()
    display = (getattr(user, 'name', None) or getattr(user, 'username', None) or google_email).strip()
    from_header = formataddr((str(Header(display, 'utf-8')), google_email))
    if mime['From']:
        mime.replace_header('From', from_header)
    else:
        mime['From'] = from_header
    if mime.get('Sender'):
        del mime['Sender']
    return mime


def send_gmail_as_user(user, email_obj: EmailMessage) -> None:
    token_info = ensure_valid_google_token(user)
    google_email = (
        (getattr(user, 'google_email', None) or token_info.get('email') or '')
        .strip()
        .lower()
    )
    if not google_email:
        raise ValueError('Vincule sua conta Google no perfil para enviar a proposta pelo seu e-mail.')

    live_scopes = fetch_tokeninfo_scopes(token_info['token']) or _token_scopes(token_info)
    if GMAIL_SEND_SCOPE not in live_scopes:
        raise ValueError(
            'A conta Google vinculada ainda não autorizou o envio de e-mail. '
            'Desvincule no perfil, vincule de novo e aceite a permissão de enviar e-mail em seu nome.'
        )

    mime = _prepare_mime(user, email_obj, google_email)
    raw = base64.urlsafe_b64encode(mime.as_bytes()).decode('ascii').rstrip('=')
    payload = json.dumps({'raw': raw}).encode('utf-8')
    request = urllib.request.Request(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        data=payload,
        method='POST',
        headers={
            'Authorization': f'Bearer {token_info["token"]}',
            'Content-Type': 'application/json',
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            response.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode('utf-8', errors='replace')
        raise ValueError(format_gmail_http_error(exc.code, body)) from exc
