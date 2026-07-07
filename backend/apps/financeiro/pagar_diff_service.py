"""Compara Contas a Pagar entre o lote atual e o lote anterior (Novos Títulos)."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal

from apps.indicadores.cashflow_utils import (
    add_one_month,
    cashflow_start_date,
    filter_pagar_for_cashflow,
    fmt_br,
    next_cashflow_day,
    parse_br_date,
    titulos_total_for_day,
)

from .models import PagarTitulo, ReportBatch


def _previous_batch(batch: ReportBatch) -> ReportBatch | None:
    ordered = list(ReportBatch.objects.order_by('reference_date', 'created_at'))
    try:
        index = next(i for i, item in enumerate(ordered) if item.pk == batch.pk)
    except StopIteration:
        return None
    if index == 0:
        return None
    return ordered[index - 1]


def _due_date(row: PagarTitulo) -> date | None:
    return parse_br_date(row.vencimento_real)


def _filter_rows(rows: list[PagarTitulo], start: date | None, end: date | None) -> list[PagarTitulo]:
    if not start and not end:
        return rows
    filtered: list[PagarTitulo] = []
    for row in rows:
        due = _due_date(row)
        if not due:
            continue
        if start and due < start:
            continue
        if end and due > end:
            continue
        filtered.append(row)
    return filtered


def _totals_by_due(rows: list[PagarTitulo]) -> dict[date, Decimal]:
    totals: dict[date, Decimal] = {}
    for row in rows:
        due = _due_date(row)
        if not due:
            continue
        totals[due] = totals.get(due, Decimal('0')) + Decimal(str(row.saldo))
    return totals


def _iter_cashflow_days(start: date, end: date):
    """Dias úteis do RESUMO entre start e end (sexta → +3, etc.)."""
    cursor = cashflow_start_date(start)
    if cursor < start:
        while cursor < start:
            cursor = next_cashflow_day(cursor)
    while cursor <= end:
        yield cursor
        cursor = next_cashflow_day(cursor)


def _previous_day_total(
    prev_totals: dict[date, Decimal],
    prev_rows: list[PagarTitulo],
    current_rows: list[PagarTitulo],
    day: date,
    prev_reference: date,
) -> Decimal:
    """Espelha coluna do lote anterior na planilha de comparação (RESUMO)."""
    base = titulos_total_for_day(prev_totals, day)
    if day.weekday() == 0:
        return base

    prev_by_key: dict[tuple[str, str], list[PagarTitulo]] = defaultdict(list)
    for row in prev_rows:
        prev_by_key[(row.cod_forn, row.titulo)].append(row)

    extra = Decimal('0')
    for row in current_rows:
        cur_due = _due_date(row)
        if cur_due != day:
            continue
        key = (row.cod_forn, row.titulo)
        prev_rows_for_key = prev_by_key.get(key, [])
        if any(_due_date(prev_row) == day for prev_row in prev_rows_for_key):
            continue
        for prev_row in prev_rows_for_key:
            if _due_date(prev_row) == prev_reference:
                extra += Decimal(str(prev_row.saldo))
                break
    return base + extra


def _serialize_titulo(row: PagarTitulo) -> dict:
    return {
        'id': row.id,
        'filial': row.filial,
        'codForn': row.cod_forn,
        'fornecedor': row.fornecedor,
        'titulo': row.titulo,
        'tipo': row.tipo,
        'vencimentoReal': row.vencimento_real,
        'saldo': float(row.saldo),
    }


def _serialize_batch(batch: ReportBatch | None) -> dict | None:
    if batch is None:
        return None
    return {
        'id': batch.id,
        'label': batch.label,
        'referenceDate': batch.reference_date.isoformat(),
        'referenceDateLabel': fmt_br(batch.reference_date),
    }


def build_pagar_diff_analysis(
    batch: ReportBatch,
    date_start: date | None = None,
    date_end: date | None = None,
) -> dict:
    previous = _previous_batch(batch)

    if date_start is None and date_end is None:
        date_start = batch.reference_date
        date_end = add_one_month(batch.reference_date)

    all_current = list(filter_pagar_for_cashflow(batch, None))
    all_previous = (
        list(filter_pagar_for_cashflow(previous, None))
        if previous
        else []
    )

    filtered_current = _filter_rows(all_current, date_start, date_end)
    filtered_previous = _filter_rows(all_previous, date_start, date_end)
    filtered_current_ids = {row.id for row in filtered_current}
    filtered_previous_ids = {row.id for row in filtered_previous}

    days: dict[date, dict] = {}

    def get_day(due: date) -> dict:
        if due not in days:
            days[due] = {
                'date': due.isoformat(),
                'dateLabel': fmt_br(due),
                'totalCurrent': 0.0,
                'totalPrevious': 0.0,
                'diff': 0.0,
                'novosTitulos': [],
                'novasNfs': [],
                'titulosBaixados': [],
                'reprogramados': [],
            }
        return days[due]

    groups_current: dict[tuple[str, str], list[PagarTitulo]] = defaultdict(list)
    for row in all_current:
        groups_current[(row.cod_forn, row.titulo)].append(row)

    groups_previous: dict[tuple[str, str], list[PagarTitulo]] = defaultdict(list)
    for row in all_previous:
        groups_previous[(row.cod_forn, row.titulo)].append(row)

    summary_novos = Decimal('0')
    summary_nfs = Decimal('0')
    summary_baixados = Decimal('0')

    all_keys = set(groups_current.keys()) | set(groups_previous.keys())
    for key in all_keys:
        current_rows = groups_current.get(key, [])
        previous_rows = groups_previous.get(key, [])

        remaining_previous = list(previous_rows)
        unmatched_current: list[PagarTitulo] = []

        for current_row in current_rows:
            current_due = _due_date(current_row)
            matched = False
            for index, previous_row in enumerate(remaining_previous):
                if _due_date(previous_row) == current_due:
                    remaining_previous.pop(index)
                    matched = True
                    break
            if not matched:
                unmatched_current.append(current_row)

        while unmatched_current and remaining_previous:
            current_row = unmatched_current.pop(0)
            previous_row = remaining_previous.pop(0)
            current_due = _due_date(current_row)
            previous_due = _due_date(previous_row)
            if current_due is None or previous_due is None:
                continue

            payload = {
                'titulo': _serialize_titulo(current_row),
                'dataAnterior': fmt_br(previous_due),
                'dataNova': fmt_br(current_due),
                'saldo': float(current_row.saldo),
            }

            if current_row.id in filtered_current_ids:
                day = get_day(current_due)
                day['reprogramados'].append({
                    **payload,
                    'tipoReprogramacao': 'reprogramado_de',
                })

            if previous_row.id in filtered_previous_ids:
                day = get_day(previous_due)
                day['reprogramados'].append({
                    **payload,
                    'tipoReprogramacao': 'reprogramado_para',
                })

        for current_row in unmatched_current:
            if current_row.id not in filtered_current_ids:
                continue
            due = _due_date(current_row)
            if due is None:
                continue
            day = get_day(due)
            serialized = _serialize_titulo(current_row)
            saldo = Decimal(str(current_row.saldo))
            if current_row.tipo.upper() == 'NF':
                day['novasNfs'].append(serialized)
                summary_nfs += saldo
            else:
                day['novosTitulos'].append(serialized)
                summary_novos += saldo

        for previous_row in remaining_previous:
            if previous_row.id not in filtered_previous_ids:
                continue
            due = _due_date(previous_row)
            if due is None:
                continue
            day = get_day(due)
            day['titulosBaixados'].append(_serialize_titulo(previous_row))
            summary_baixados += Decimal(str(previous_row.saldo))

    current_totals = _totals_by_due(all_current)
    previous_totals = _totals_by_due(all_previous)
    prev_reference = previous.reference_date if previous else None

    total_current = Decimal('0')
    total_previous = Decimal('0')
    if date_start and date_end:
        for day in _iter_cashflow_days(date_start, date_end):
            cur_val = titulos_total_for_day(current_totals, day)
            prev_val = (
                _previous_day_total(
                    previous_totals,
                    all_previous,
                    all_current,
                    day,
                    prev_reference,
                )
                if previous and prev_reference
                else Decimal('0')
            )
            bucket = get_day(day)
            bucket['totalCurrent'] = float(cur_val)
            bucket['totalPrevious'] = float(prev_val)
            total_current += cur_val
            total_previous += prev_val

    day_list = []
    for due in sorted(days.keys()):
        item = days[due]
        item['diff'] = item['totalCurrent'] - item['totalPrevious']
        if item['totalCurrent'] or item['totalPrevious'] or item['diff']:
            day_list.append(item)

    return {
        'currentBatch': _serialize_batch(batch),
        'previousBatch': _serialize_batch(previous),
        'dateStart': date_start.isoformat() if date_start else None,
        'dateEnd': date_end.isoformat() if date_end else None,
        'totalCurrent': float(total_current),
        'totalPrevious': float(total_previous),
        'totalDiff': float(total_current - total_previous),
        'summary': {
            'novosTitulos': float(summary_novos),
            'novasNfs': float(summary_nfs),
            'titulosBaixados': float(summary_baixados),
        },
        'days': day_list,
    }
