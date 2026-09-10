"""ICMS na simulação de frete — anexação ao resultado da cotação."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from .icms_uf import calcular_icms_frete
from .models import ensure_matriz_icms

TWO = Decimal('0.01')


def _dec(value, default='0') -> Decimal:
    if value is None or value == '':
        value = default
    return Decimal(str(value).replace(',', '.').replace('%', ''))


def _money(value: Decimal) -> str:
    return str(value.quantize(TWO, rounding=ROUND_HALF_UP))


def _base_icms_sem_pedagio(resultado: dict) -> Decimal:
    base = _dec(resultado.get('subtotal'))
    for extra in resultado.get('extras') or []:
        if extra.get('incluirNoTotal', True):
            base += _dec(extra.get('valor'))
    return base


def montar_icms_simulacao(
    total,
    uf_origem: str,
    uf_destino: str,
    subtotal=None,
    pedagio=None,
) -> dict | None:
    registro = ensure_matriz_icms()
    kwargs = {}
    if subtotal is not None and pedagio is not None:
        kwargs['subtotal'] = _dec(subtotal)
        kwargs['pedagio'] = _dec(pedagio)
    icms_calc = calcular_icms_frete(_dec(total), uf_origem, uf_destino, registro.matriz, **kwargs)
    if not icms_calc:
        return None
    return {
        'ufOrigem': icms_calc['ufOrigem'],
        'ufDestino': icms_calc['ufDestino'],
        'tipo': icms_calc['tipo'],
        'aliquotaPercent': icms_calc['aliquotaPercent'],
        'valor': _money(icms_calc['valor']),
        'totalComIcms': _money(icms_calc['totalComIcms']),
        'incluiPedagioNaBase': icms_calc.get('incluiPedagioNaBase', True),
    }


def anexar_icms_simulacao(resultado: dict, uf_origem: str, uf_destino: str) -> dict:
    uf_o = (uf_origem or '').strip().upper()[:2]
    uf_d = (uf_destino or '').strip().upper()[:2]
    if not uf_o or not uf_d:
        resultado['icms'] = None
        return resultado

    subtotal = _base_icms_sem_pedagio(resultado)
    pedagio = _dec(resultado.get('pedagio'))
    icms = montar_icms_simulacao(
        resultado.get('total'),
        uf_o,
        uf_d,
        subtotal=subtotal,
        pedagio=pedagio,
    )
    resultado['icms'] = icms
    return resultado
