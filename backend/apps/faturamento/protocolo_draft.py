"""Sanitização e helpers do rascunho de novo protocolo de envio."""

from __future__ import annotations

import re

from .constants import EXPEDICAO_VALUES, MAX_EXPEDICOES_POR_PROTOCOLO, MAX_NOTAS_FISCAIS

_NF_RE = re.compile(r'^\d+([/-]\d+)*$')


def _as_str(value, max_len: int = 200) -> str:
    if value is None:
        return ''
    text = str(value).strip() if isinstance(value, str) else str(value)
    return text[:max_len]


def _sanitize_nota(raw) -> dict | None:
    if not isinstance(raw, dict):
        return None
    nf = _as_str(raw.get('nf'), 80)
    if not nf or not _NF_RE.match(nf):
        return None
    filial = _as_str(raw.get('filial'), 150) or None
    return {'nf': nf, 'filial': filial} if filial else {'nf': nf}


def sanitize_draft_payload(raw) -> dict:
    if not isinstance(raw, dict):
        raw = {}

    data = _as_str(raw.get('data'), 32)
    cliente_id = _as_str(raw.get('clienteId'), 32)
    nf_input = re.sub(r'[^\d/-]', '', _as_str(raw.get('nfInput'), 80))
    filial_input = _as_str(raw.get('filialInput'), 150)

    expedicoes_raw = raw.get('expedicoes')
    expedicoes: list[str] = []
    if isinstance(expedicoes_raw, list):
        for item in expedicoes_raw:
            valor = _as_str(item, 100)
            if valor in EXPEDICAO_VALUES and valor not in expedicoes:
                expedicoes.append(valor)
            if len(expedicoes) >= MAX_EXPEDICOES_POR_PROTOCOLO:
                break

    notas: list[dict] = []
    seen: set[str] = set()
    notas_raw = raw.get('notas')
    if isinstance(notas_raw, list):
        for item in notas_raw:
            if len(notas) >= MAX_NOTAS_FISCAIS:
                break
            nota = _sanitize_nota(item)
            if nota is None or nota['nf'] in seen:
                continue
            seen.add(nota['nf'])
            notas.append(nota)

    return {
        'data': data,
        'clienteId': cliente_id,
        'expedicoes': expedicoes,
        'notas': notas,
        'nfInput': nf_input,
        'filialInput': filial_input,
    }


def has_meaningful_draft(payload: dict | None) -> bool:
    if not payload:
        return False
    if payload.get('notas'):
        return True
    if payload.get('clienteId'):
        return True
    if payload.get('expedicoes'):
        return True
    if payload.get('nfInput'):
        return True
    return False


def draft_payload(draft) -> dict:
    empty = {
        'data': '',
        'clienteId': '',
        'expedicoes': [],
        'notas': [],
        'nfInput': '',
        'filialInput': '',
    }
    if draft is None:
        return {
            'version': 1,
            'updatedAt': None,
            'hasDraft': False,
            **empty,
        }
    payload = draft.payload if isinstance(draft.payload, dict) else {}
    sanitized = sanitize_draft_payload(payload)
    return {
        'version': draft.version,
        'updatedAt': draft.updated_at.isoformat(),
        'hasDraft': has_meaningful_draft(sanitized),
        **sanitized,
    }
