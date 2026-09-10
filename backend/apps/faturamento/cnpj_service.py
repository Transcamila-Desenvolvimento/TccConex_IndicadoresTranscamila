"""Consulta pública de CNPJ (BrasilAPI, com fallback ReceitaWS)."""

from __future__ import annotations

import json
import re
import ssl
import urllib.error
import urllib.request

_DIGITOS = re.compile(r'\D+')


def only_digits(cnpj: str, max_len: int = 14) -> str:
    return _DIGITOS.sub('', cnpj or '')[:max_len]


def format_cnpj(cnpj: str) -> str:
    digits = only_digits(cnpj, 14)
    if len(digits) != 14:
        return cnpj or ''
    return f'{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}'


def format_cpf(cpf: str) -> str:
    digits = only_digits(cpf, 11)
    if len(digits) != 11:
        return cpf or ''
    return f'{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}'


def format_documento(value: str, tipo_pessoa: str = 'J') -> str:
    if (tipo_pessoa or 'J').upper() == 'F':
        return format_cpf(value)
    return format_cnpj(value)


def format_cep(cep: str) -> str:
    digits = only_digits(cep, 8)
    if len(digits) != 8:
        return (cep or '').strip()
    return f'{digits[:5]}-{digits[5:]}'


from .models import format_municipio_cadastro, format_nome_cadastro


class CnpjLookupError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def _get_json(url: str, timeout: int = 8) -> dict:
    ctx = ssl.create_default_context()
    request = urllib.request.Request(url, headers={'User-Agent': 'TccConex-ERP/1.0'})
    with urllib.request.urlopen(request, timeout=timeout, context=ctx) as response:
        return json.loads(response.read().decode('utf-8'))


def _cnpj_payload(digits: str, razao: str, fantasia: str, data: dict, telefone_key: str) -> dict:
    telefone = (data.get(telefone_key) or data.get('telefone') or '').strip()
    return {
        'cnpj': format_cnpj(digits),
        'razaoSocial': format_nome_cadastro(razao),
        'nomeFantasia': format_nome_cadastro(fantasia),
        'municipio': format_municipio_cadastro(data.get('municipio') or ''),
        'uf': (data.get('uf') or '').strip().upper()[:2],
        'logradouro': (data.get('logradouro') or '').strip(),
        'numero': (data.get('numero') or '').strip(),
        'complemento': (data.get('complemento') or '').strip(),
        'bairro': (data.get('bairro') or '').strip(),
        'cep': format_cep(data.get('cep') or ''),
        'telefone': telefone,
        'email': (data.get('email') or '').strip().lower(),
    }


def consultar_cnpj(cnpj: str) -> dict:
    digits = only_digits(cnpj)
    if len(digits) != 14:
        raise CnpjLookupError('Informe um CNPJ com 14 dígitos.')

    try:
        data = _get_json(f'https://brasilapi.com.br/api/cnpj/v1/{digits}')
        razao = (data.get('razao_social') or '').strip()
        fantasia = (data.get('nome_fantasia') or '').strip()
        if razao:
            return _cnpj_payload(digits, razao, fantasia, data, 'ddd_telefone_1')
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
        return _cnpj_payload(digits, razao, fantasia, data, 'telefone')
    except CnpjLookupError:
        raise
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise CnpjLookupError('CNPJ não encontrado na Receita Federal.', 404) from exc
        raise CnpjLookupError('Não foi possível consultar o CNPJ agora. Tente novamente.', 502) from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        raise CnpjLookupError('Não foi possível consultar o CNPJ agora. Tente novamente.', 502) from exc
