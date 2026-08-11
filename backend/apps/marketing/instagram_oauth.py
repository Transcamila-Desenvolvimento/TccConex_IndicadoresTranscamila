"""Integração OAuth Meta / Instagram Graph API."""

import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

META_GRAPH_VERSION = 'v21.0'
META_OAUTH_SCOPES = [
    'instagram_business_basic',
    'instagram_business_content_publish',
    'pages_show_list',
    'pages_read_engagement',
    'business_management',
]


def meta_oauth_configured() -> bool:
    return bool(
        settings.META_APP_ID
        and settings.META_APP_SECRET
        and settings.META_OAUTH_REDIRECT_URI
    )


def build_meta_auth_url(state: str) -> str:
    params = {
        'client_id': settings.META_APP_ID,
        'redirect_uri': settings.META_OAUTH_REDIRECT_URI,
        'response_type': 'code',
        'scope': ','.join(META_OAUTH_SCOPES),
        'state': state,
    }
    return f'https://www.facebook.com/{META_GRAPH_VERSION}/dialog/oauth?' + urllib.parse.urlencode(params)


def _graph_request(path: str, *, method: str = 'GET', params: dict | None = None, data: dict | None = None) -> dict:
    query = urllib.parse.urlencode(params or {})
    url = f'https://graph.facebook.com/{META_GRAPH_VERSION}/{path}'
    if query and method == 'GET':
        url = f'{url}?{query}'

    body = None
    headers = {}
    if data is not None:
        body = urllib.parse.urlencode(data).encode('utf-8')
        headers['Content-Type'] = 'application/x-www-form-urlencoded'

    request = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode('utf-8', errors='replace')
        raise ValueError(raw or f'Erro HTTP {exc.code} na Graph API.') from exc


def exchange_code_for_token(code: str) -> dict:
    short = _graph_request(
        'oauth/access_token',
        params={
            'client_id': settings.META_APP_ID,
            'client_secret': settings.META_APP_SECRET,
            'redirect_uri': settings.META_OAUTH_REDIRECT_URI,
            'code': code,
        },
    )
    access_token = short.get('access_token')
    if not access_token:
        raise ValueError('Resposta Meta sem access_token.')

    long_lived = _graph_request(
        'oauth/access_token',
        params={
            'grant_type': 'fb_exchange_token',
            'client_id': settings.META_APP_ID,
            'client_secret': settings.META_APP_SECRET,
            'fb_exchange_token': access_token,
        },
    )
    if not long_lived.get('access_token'):
        raise ValueError('Não foi possível obter token de longa duração.')
    return long_lived


def resolve_instagram_business_account(user_access_token: str) -> dict:
    pages = _graph_request(
        'me/accounts',
        params={
            'access_token': user_access_token,
            'fields': 'name,access_token,instagram_business_account{id,username}',
        },
    )
    for page in pages.get('data', []):
        ig = (page.get('instagram_business_account') or {})
        ig_id = ig.get('id')
        if ig_id and page.get('access_token'):
            return {
                'access_token': page['access_token'],
                'instagram_account_id': ig_id,
                'instagram_username': ig.get('username') or '',
                'page_name': page.get('name') or '',
            }
    raise ValueError(
        'Nenhuma página Facebook com conta Instagram Business vinculada foi encontrada.'
    )
