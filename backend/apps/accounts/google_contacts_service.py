import json
import time
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

GOOGLE_LINK_SCOPES = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/contacts.other.readonly',
]


def _google_api_get(url: str, access_token: str) -> dict:
    request = urllib.request.Request(
        url,
        headers={'Authorization': f'Bearer {access_token}'},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode('utf-8', errors='replace')
        raise ValueError(f'Falha na API Google: {body}') from exc


def _refresh_access_token(token_info: dict) -> dict:
    refresh_token = token_info.get('refresh_token')
    if not refresh_token:
        raise ValueError('Token Google expirado. Vincule novamente a conta Google no perfil.')

    payload = urllib.parse.urlencode({
        'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
        'client_secret': settings.GOOGLE_OAUTH_CLIENT_SECRET,
        'refresh_token': refresh_token,
        'grant_type': 'refresh_token',
    }).encode('utf-8')

    request = urllib.request.Request(
        'https://oauth2.googleapis.com/token',
        data=payload,
        method='POST',
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            refreshed = json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode('utf-8', errors='replace')
        raise ValueError(f'Falha ao renovar token Google: {body}') from exc

    access_token = refreshed.get('access_token')
    if not access_token:
        raise ValueError('Resposta Google sem access_token na renovação.')

    token_info['token'] = access_token
    token_info['expires_at'] = time.time() + int(refreshed.get('expires_in', 3600))
    if refreshed.get('refresh_token'):
        token_info['refresh_token'] = refreshed['refresh_token']
    return token_info


def ensure_valid_google_token(user):
    token_info = user.google_token
    if not token_info or not token_info.get('token'):
        raise ValueError('Conta Google não vinculada ou sem permissão de contatos.')

    expires_at = token_info.get('expires_at', 0)
    if expires_at and expires_at > time.time() + 60:
        return token_info

    refreshed = _refresh_access_token(token_info)
    user.google_token = refreshed
    user.save(update_fields=['google_token'])
    return refreshed


def build_google_token_record(token_data: dict, userinfo: dict | None = None) -> dict:
    record = {
        'token': token_data.get('access_token'),
        'refresh_token': token_data.get('refresh_token'),
        'token_uri': 'https://oauth2.googleapis.com/token',
        'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
        'client_secret': settings.GOOGLE_OAUTH_CLIENT_SECRET,
        'scopes': token_data.get('scope', ' '.join(GOOGLE_LINK_SCOPES)).split(),
        'expires_at': time.time() + int(token_data.get('expires_in', 3600)),
    }
    if userinfo and userinfo.get('email'):
        record['email'] = userinfo['email']
    return record


def _extract_contacts_from_people(people: list[dict]) -> list[dict]:
    contacts: list[dict] = []
    seen: set[str] = set()

    for person in people:
        emails = person.get('emailAddresses') or []
        names = person.get('names') or []
        photos = person.get('photos') or []
        if not emails:
            continue

        email = (emails[0].get('value') or '').strip().lower()
        if not email or email in seen:
            continue
        seen.add(email)

        name = names[0].get('displayName') if names else email
        photo = photos[0].get('url') if photos else None
        contacts.append({'name': name, 'email': email, 'photo': photo})

    contacts.sort(key=lambda item: item['name'].lower())
    return contacts


def fetch_google_contacts(user) -> list[dict]:
    token_info = ensure_valid_google_token(user)
    access_token = token_info['token']

    connections_url = (
        'https://people.googleapis.com/v1/people/me/connections'
        '?personFields=names,emailAddresses,photos&pageSize=1000'
    )
    other_url = (
        'https://people.googleapis.com/v1/otherContacts'
        '?readMask=names,emailAddresses,photos&pageSize=1000'
    )

    connections = _google_api_get(connections_url, access_token).get('connections', [])
    other_contacts = _google_api_get(other_url, access_token).get('otherContacts', [])
    return _extract_contacts_from_people(connections + other_contacts)
