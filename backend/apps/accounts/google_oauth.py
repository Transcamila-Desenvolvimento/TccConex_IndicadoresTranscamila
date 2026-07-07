import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

from .google_contacts_service import GOOGLE_LINK_SCOPES


def google_oauth_configured() -> bool:
    return bool(
        settings.GOOGLE_OAUTH_CLIENT_ID
        and settings.GOOGLE_OAUTH_CLIENT_SECRET
        and settings.GOOGLE_OAUTH_REDIRECT_URI
    )


def build_google_auth_url(state: str) -> str:
    params = {
        'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
        'redirect_uri': settings.GOOGLE_OAUTH_REDIRECT_URI,
        'response_type': 'code',
        'scope': ' '.join(GOOGLE_LINK_SCOPES),
        'access_type': 'offline',
        'include_granted_scopes': 'true',
        'prompt': 'consent',
        'state': state,
    }
    if settings.GOOGLE_OAUTH_HD:
        params['hd'] = settings.GOOGLE_OAUTH_HD
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + urllib.parse.urlencode(params)


def _exchange_code_for_token_data(code: str) -> dict:
    token_payload = urllib.parse.urlencode({
        'code': code,
        'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
        'client_secret': settings.GOOGLE_OAUTH_CLIENT_SECRET,
        'redirect_uri': settings.GOOGLE_OAUTH_REDIRECT_URI,
        'grant_type': 'authorization_code',
    }).encode('utf-8')

    token_request = urllib.request.Request(
        'https://oauth2.googleapis.com/token',
        data=token_payload,
        method='POST',
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )

    try:
        with urllib.request.urlopen(token_request, timeout=15) as response:
            token_data = json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode('utf-8', errors='replace')
        raise ValueError(f'Falha ao obter token Google: {body}') from exc

    access_token = token_data.get('access_token')
    if not access_token:
        raise ValueError('Resposta Google sem access_token.')
    return token_data


def _fetch_userinfo(access_token: str) -> dict:
    userinfo_request = urllib.request.Request(
        'https://openidconnect.googleapis.com/v1/userinfo',
        headers={'Authorization': f'Bearer {access_token}'},
    )

    try:
        with urllib.request.urlopen(userinfo_request, timeout=15) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode('utf-8', errors='replace')
        raise ValueError(f'Falha ao obter perfil Google: {body}') from exc


def exchange_code_for_userinfo(code: str) -> dict:
    token_data = _exchange_code_for_token_data(code)
    return _fetch_userinfo(token_data['access_token'])


def exchange_code_for_link(code: str) -> tuple[dict, dict]:
    token_data = _exchange_code_for_token_data(code)
    userinfo = _fetch_userinfo(token_data['access_token'])
    return userinfo, token_data
