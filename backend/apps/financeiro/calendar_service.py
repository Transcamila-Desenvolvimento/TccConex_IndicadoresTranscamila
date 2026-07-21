"""Agrega contas a pagar/receber do lote ativo em eventos de calendário.

Mesma ideia do calendário financeiro do ERP anterior: um evento por
fornecedor/cliente por dia de vencimento, com a lista de títulos no detalhe.
"""
from __future__ import annotations

from datetime import date, datetime

from .models import PagarTitulo, ReceberTitulo
from .report_filters import scope_pagar_queryset, scope_receber_queryset


def _parse_vencimento(row_vencimento_real: str, row_vencimento: str) -> date | None:
    raw = (row_vencimento_real or '').strip() or (row_vencimento or '').strip()
    if not raw:
        return None
    try:
        return datetime.strptime(raw, '%d/%m/%Y').date()
    except ValueError:
        return None


def _grouped_events(rows, *, tipo: str, start: date, end: date) -> dict[str, list[dict]]:
    grouped: dict[tuple[str, str], dict] = {}

    for row in rows:
        vencimento = _parse_vencimento(row.vencimento_real, row.vencimento)
        if vencimento is None or vencimento < start or vencimento > end:
            continue

        if tipo == 'pagar':
            codigo, nome = row.cod_forn, row.fornecedor
        else:
            codigo, nome = row.cod_cliente, row.cliente

        date_str = vencimento.isoformat()
        key = (date_str, codigo)
        if key not in grouped:
            grouped[key] = {
                'type': tipo,
                'date': date_str,
                'title': (nome or '')[:20],
                'fullTitle': f'{codigo} - {nome}',
                'amount': 0.0,
                'count': 0,
                'titulos': [],
            }

        entry = grouped[key]
        entry['amount'] += float(row.saldo)
        entry['count'] += 1
        entry['titulos'].append({
            'doc': row.titulo or 'S/N',
            'filial': row.filial,
            'vencimento': vencimento.strftime('%d/%m/%Y'),
            'valor': float(row.saldo),
        })

    events: dict[str, list[dict]] = {}
    for (date_str, _), entry in grouped.items():
        if entry['count'] > 1:
            entry['title'] = f"({entry['count']}) {entry['title']}"
        events.setdefault(date_str, []).append(entry)
    return events


def build_system_events(batch, *, start: date, end: date, user, request) -> dict[str, list[dict]]:
    """Retorna { 'YYYY-MM-DD': [eventos] } respeitando o escopo de filiais do usuário."""
    if not batch:
        return {}

    pagar = scope_pagar_queryset(PagarTitulo.objects.filter(batch=batch), user, request)
    receber = scope_receber_queryset(ReceberTitulo.objects.filter(batch=batch), user, request)

    events = _grouped_events(pagar, tipo='pagar', start=start, end=end)
    for date_str, day_events in _grouped_events(receber, tipo='receber', start=start, end=end).items():
        events.setdefault(date_str, []).extend(day_events)

    for day_events in events.values():
        day_events.sort(key=lambda ev: (ev['type'], -ev['amount']))
    return events
