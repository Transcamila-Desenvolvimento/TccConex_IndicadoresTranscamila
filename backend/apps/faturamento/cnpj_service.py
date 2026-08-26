"""Consulta pública de CNPJ (BrasilAPI, com fallback ReceitaWS)."""

from __future__ import annotations

import json
import re
import ssl
import urllib.error
import urllib.request

_DIGITOS = re.compile(r'\D+')


def only_digits(cnpj: str) -> str:
    return _DIGITOS.sub('', cnpj or '')[:14]


def format_cnpj(cnpj: str) -> str:
    digits = only_digits(cnpj)
    if len(digits) != 14:
        return cnpj or ''
    return f'{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}'


from .models import format_nome_cadastro


class CnpjLookupError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def _get_json(url: str, timeout: int = 8) -> dict:
    ctx = ssl.create_default_context()
    request = urllib.request.Request(url, headers={'User-Agent': 'TccConex-ERP/1.0'})
    with urllib.request.urlopen(request, timeout=timeout, context=ctx) as response:
        return json.loads(response.read().decode('utf-8'))


def consultar_cnpj(cnpj: str) -> dict:
    digits = only_digits(cnpj)
    if len(digits) != 14:
        raise CnpjLookupError('Informe um CNPJ com 14 dígitos.')

    try:
        data = _get_json(f'https://brasilapi.com.br/api/cnpj/v1/{digits}')
        razao = (data.get('razao_social') or '').strip()
        fantasia = (data.get('nome_fantasia') or '').strip()
        if razao:
            return {
                'cnpj': format_cnpj(digits),
                'razaoSocial': format_nome_cadastro(razao),
                'nomeFantasia': format_nome_cadastro(fantasia),
            }
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        pass

    try:
        data = _get_json(f'https://www.receitaws.com.br/v1/cnpj/{digits}')
        if str(data.get('status', '')).upper() == 'ERROR':
            raise CnpjLookupError(data.get('message') or 'CNPJ não encontrado na Receita Federal.', 404)
        razao = (data.get('nome') or '').strip()
        fantasia = (data.get('fantasia') or '').strip()
        if not razao:
            raise CnpjLookupError('CNPJ não encontrado na Receita Federal.', 404)
        return {
            'cnpj': format_cnpj(digits),
            'razaoSocial': format_nome_cadastro(razao),
            'nomeFantasia': format_nome_cadastro(fantasia),
        }
    except CnpjLookupError:
        raise
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise CnpjLookupError('CNPJ não encontrado na Receita Federal.', 404) from exc
        raise CnpjLookupError('Não foi possível consultar o CNPJ agora. Tente novamente.', 502) from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        raise CnpjLookupError('Não foi possível consultar o CNPJ agora. Tente novamente.', 502) from exc
