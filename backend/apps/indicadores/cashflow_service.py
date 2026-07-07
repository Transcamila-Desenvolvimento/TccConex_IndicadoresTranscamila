"""Projeção de fluxo de caixa a partir dos relatórios financeiros importados."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone

from apps.accounts.permissions import (
    filter_allowed_filiais_list,
)
from apps.audit.models import AuditLog
from apps.financeiro.models import (
    BalanceHistoryEntry,
    BankAccount,
    CashAdjustment,
    PagarTitulo,
    ReceberTitulo,
    ReportBatch,
)

from .cashflow_utils import (
    aggregate_adjustments_net,
    aggregate_resumo_adjustments,
    filter_pagar_for_cashflow,
    fmt_br as _fmt_br,
    fmt_short as _fmt_short,
    parse_br_date as _parse_br_date,
    receber_saldo,
    sum_bank_balance_on_position_date,
    to_decimal as _decimal,
)
from .gerencial_service import build_gerencial_panel

# Ações de AuditLog que alteram dados usados pelo Fluxo de Caixa/Gerencial
# (lotes, importações, faturamento, ajustes, contas e saldos bancários, PRs).
_FINANCEIRO_ACTIVITY_PREFIX = 'financeiro.'
_FINANCEIRO_ACTIVITY_EXTRA_ACTIONS = ('importacao.relatorio',)


def get_financeiro_activity_version() -> int:
    """Marcador barato (id do AuditLog mais recente relevante) usado para o
    frontend detectar, com uma consulta leve, que precisa recarregar o Fluxo de
    Caixa porque outro usuário alterou dados do Financeiro nesse meio tempo.

    O valor só muda quando uma ação relevante ocorre — sistema multiusuário:
    várias abas podem fazer polling desse endpoint com baixo custo, e o
    recálculo pesado do fluxo de caixa só é refeito quando o marcador muda.
    """
    latest_id = (
        AuditLog.objects.filter(
            Q(action__startswith=_FINANCEIRO_ACTIVITY_PREFIX)
            | Q(action__in=_FINANCEIRO_ACTIVITY_EXTRA_ACTIONS)
        )
        .order_by('-id')
        .values_list('id', flat=True)
        .first()
    )
    return latest_id or 0


@dataclass(frozen=True)
class DisponibilidadeOptions:
    include_limit: bool = True
    account_ids: tuple[int, ...] | None = None
    position_date: date | None = None


def _parse_account_ids(params: dict) -> tuple[int, ...] | None:
    """None = todas as contas; vazio = nenhuma conta selecionada."""
    for key in ('accounts', 'accountIds', 'account_ids'):
        if key not in params:
            continue
        raw = params.get(key)
        if raw is None:
            return None
        if isinstance(raw, (list, tuple)):
            parts = [str(item).strip() for item in raw]
        else:
            parts = [part.strip() for part in str(raw).split(',')]
        ids = tuple(int(part) for part in parts if part.isdigit())
        return ids
    return None


def _parse_bool_param(params: dict, *keys: str, default: bool = True) -> bool:
    for key in keys:
        if key not in params:
            continue
        raw = params.get(key)
        if raw is None:
            return default
        if isinstance(raw, bool):
            return raw
        return str(raw).strip().lower() in ('1', 'true', 'yes', 'on')
    return default


def _parse_disponibilidade_options(params: dict, position_date: date | None = None) -> DisponibilidadeOptions:
    return DisponibilidadeOptions(
        include_limit=_parse_bool_param(params, 'includeLimit', 'include_limit', default=True),
        account_ids=_parse_account_ids(params),
        position_date=position_date,
    )


def _cashflow_bank_account_label(account: BankAccount) -> str:
    return f'{account.bank} (CC: {account.number})'


def _list_cashflow_bank_accounts() -> list[dict]:
    """Contas reais para filtro do fluxo — ignora duplicatas e registros de teste."""
    deduped: dict[tuple[str, str, str], BankAccount] = {}
    for account in BankAccount.objects.order_by('-balance', '-credit_limit', '-id'):
        bank = account.bank.strip()
        if len(bank) < 3:
            continue
        key = (bank, account.agency.strip(), account.number.strip())
        if key not in deduped:
            deduped[key] = account

    return [
        {
            'id': account.pk,
            'bank': account.bank,
            'agency': account.agency,
            'number': account.number,
            'type': account.account_type,
            'balance': float(account.balance),
            'creditLimit': float(account.credit_limit),
            'label': _cashflow_bank_account_label(account),
        }
        for account in sorted(deduped.values(), key=lambda row: (row.bank, row.number))
    ]


def _parse_iso_date(value: str | None) -> date | None:
    text = (value or '').strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def _resolve_filial_codes(user, module: str, request, filial_param: str | None) -> list[str]:
    """Fluxo de caixa é sempre consolidado (lote inteiro); filial na query é ignorada."""
    return []


def _list_cashflow_positions() -> list[dict]:
    return [
        {
            'id': str(batch.pk),
            'code': batch.label,
            'referenceDate': _fmt_br(batch.reference_date),
            'referenceDateIso': batch.reference_date.isoformat(),
        }
        for batch in ReportBatch.objects.order_by('-reference_date', '-created_at')
    ]


def _resolve_cashflow_batch(params: dict) -> ReportBatch | None:
    """Posição selecionada na query; padrão = importação mais recente."""
    raw_id = (params.get('position') or params.get('batchId') or '').strip()
    if raw_id:
        try:
            return ReportBatch.objects.get(pk=raw_id)
        except (ReportBatch.DoesNotExist, ValueError, TypeError):
            raise ValueError('Posição não encontrada.')
    return ReportBatch.objects.order_by('-reference_date', '-created_at').first()


def _cashflow_start_date(base: date) -> date:
    """Espelha D5 da planilha: sábado → +2, domingo → +1, demais = base."""
    if base.weekday() == 5:
        return base + timedelta(days=2)
    if base.weekday() == 6:
        return base + timedelta(days=1)
    return base


def _next_cashflow_day(day: date) -> date:
    """Avanço de datas do RESUMO: sexta +3, sábado +2, domingo +1, demais +1."""
    if day.weekday() == 4:
        return day + timedelta(days=3)
    if day.weekday() == 5:
        return day + timedelta(days=2)
    if day.weekday() == 6:
        return day + timedelta(days=1)
    return day + timedelta(days=1)


def _vencimento_dates_for_day(day: date) -> frozenset[date]:
    """Datas de Vencto Real no SUMIFS do dia (sáb/dom acumulam na segunda; sexta já tem linha própria)."""
    if day.weekday() == 0:
        return frozenset({
            day,
            day - timedelta(days=1),
            day - timedelta(days=2),
        })
    return frozenset({day})


def _titulos_total_for_day(totals_by_date: dict[date, Decimal], day: date) -> Decimal:
    return sum(
        (totals_by_date.get(d, Decimal('0')) for d in _vencimento_dates_for_day(day)),
        Decimal('0'),
    )


def _aggregate_titulos(qs, date_field: str, saldo_getter=None) -> dict[date, Decimal]:
    get_saldo = saldo_getter or (lambda row: _decimal(row.saldo))
    totals: dict[date, Decimal] = {}
    for row in qs.iterator():
        due = _parse_br_date(getattr(row, date_field, ''))
        if not due:
            continue
        totals[due] = totals.get(due, Decimal('0')) + get_saldo(row)
    return totals


def _disponivel_com_limite(options: DisponibilidadeOptions | None = None) -> Decimal:
    """Saldo das contas na data da posição (ou atual) + limite de crédito."""
    opts = options or DisponibilidadeOptions()
    if opts.account_ids is not None and not opts.account_ids:
        return Decimal('0')

    qs = BankAccount.objects.all()
    if opts.account_ids is not None:
        qs = qs.filter(pk__in=opts.account_ids)

    if opts.position_date:
        total = sum_bank_balance_on_position_date(opts.position_date, opts.account_ids)
    else:
        total = _decimal(qs.aggregate(balance=Sum('balance'))['balance'])

    if opts.include_limit:
        total += _decimal(qs.aggregate(limit=Sum('credit_limit'))['limit'])
    return total


def _consolidated_saldo_launch(day: date, launches_by_date: dict[date, Decimal]) -> Decimal | None:
    """Lançamento consolidado (tipo Saldo) substitui o disponível apenas quando explícito."""
    if day not in launches_by_date:
        return None
    total = BalanceHistoryEntry.objects.filter(
        reference_date=day,
        entry_type='Saldo',
    ).aggregate(t=Sum('value'))['t']
    if total is None:
        return None
    return _decimal(total)


def _load_launches_by_date(until: date) -> dict[date, Decimal]:
    totals: dict[date, Decimal] = {}
    for entry in BalanceHistoryEntry.objects.filter(
        reference_date__lte=until,
        entry_type='Saldo',
    ).iterator():
        ref = entry.reference_date
        totals[ref] = totals.get(ref, Decimal('0')) + _decimal(entry.value)
    return totals


def _bank_balance_total(options: DisponibilidadeOptions | None = None) -> Decimal:
    return _disponivel_com_limite(options)


def _day_saldo_inicial(
    day: date,
    previous_closing: Decimal | None,
    launches_by_date: dict[date, Decimal],
    options: DisponibilidadeOptions | None = None,
) -> Decimal:
    consolidated = _consolidated_saldo_launch(day, launches_by_date)
    if consolidated is not None:
        return consolidated
    if previous_closing is not None:
        return previous_closing
    return _disponivel_com_limite(options)


def _simulate_closing_before(
    day: date,
    position_anchor: date,
    launches_by_date: dict[date, Decimal],
    entradas_by_day: dict[date, Decimal],
    saidas_by_day: dict[date, Decimal],
    adj_net: dict[date, Decimal],
    options: DisponibilidadeOptions | None = None,
) -> Decimal:
    """Saldo projetado ao fim do dia útil anterior a ``day`` (simula desde a posição do lote)."""
    if day <= position_anchor:
        return _day_saldo_inicial(day, None, launches_by_date, options)

    running: Decimal | None = None
    cursor = position_anchor
    while cursor < day:
        saldo_inicial = _day_saldo_inicial(cursor, running, launches_by_date, options)
        ent = _titulos_total_for_day(entradas_by_day, cursor)
        sai = _titulos_total_for_day(saidas_by_day, cursor)
        ajustes = adj_net.get(cursor, Decimal('0'))
        running = saldo_inicial + ent - sai + ajustes
        cursor = _next_cashflow_day(cursor)

    return running if running is not None else _disponivel_com_limite(options)


def _resolve_running_before_day(
    cursor: date,
    period_start: date,
    position_anchor: date,
    running: Decimal | None,
    launches_by_date: dict[date, Decimal],
    entradas_by_day: dict[date, Decimal],
    saidas_by_day: dict[date, Decimal],
    adj_net: dict[date, Decimal],
    options: DisponibilidadeOptions | None = None,
) -> Decimal | None:
    """Carry-forward da planilha: saldo anterior simulado, exceto no 1º dia da posição."""
    if running is not None:
        return running
    if _consolidated_saldo_launch(cursor, launches_by_date) is not None:
        return running
    if cursor == position_anchor and cursor == period_start:
        return running
    return _simulate_closing_before(
        cursor, position_anchor, launches_by_date, entradas_by_day, saidas_by_day, adj_net, options,
    )


def _positive_until(daily_saldos: list[dict], start: date) -> str:
    for point in daily_saldos:
        if point['saldoProjetado'] < 0:
            prev = date.fromisoformat(point['dateIso']) - timedelta(days=1)
            return _fmt_br(prev) if prev >= start else _fmt_br(start)
    if daily_saldos:
        last = date.fromisoformat(daily_saldos[-1]['dateIso'])
        return _fmt_br(last + timedelta(days=180))
    return _fmt_br(start)


def _titulos_on_day(qs, date_field: str, target: date) -> list:
    match_dates = _vencimento_dates_for_day(target)
    rows = []
    for row in qs.iterator():
        due = _parse_br_date(getattr(row, date_field, ''))
        if due in match_dates:
            rows.append(row)
    return rows


def _serialize_pagar_row(row: PagarTitulo) -> dict:
    return {
        'filial': row.filial,
        'fornecedor': row.fornecedor,
        'titulo': row.titulo,
        'tipo': row.tipo,
        'saldo': float(row.saldo),
        'historico': row.historico,
    }


def _serialize_receber_row(row: ReceberTitulo) -> dict:
    return {
        'filial': row.filial,
        'cliente': row.cliente,
        'titulo': row.titulo,
        'natureza': row.natureza,
        'saldo': float(row.saldo),
        'historico': row.historico,
    }


def build_cashflow_day_detail(user, request, params: dict) -> dict:
    target = _parse_iso_date(params.get('date'))
    if not target:
        raise ValueError('Data inválida.')

    batch = _resolve_cashflow_batch(params)
    if batch:
        position_anchor = _cashflow_start_date(batch.reference_date)
        if target < position_anchor:
            raise ValueError('Data anterior à posição selecionada.')

    iso = target.isoformat()
    overview = build_cashflow_payload(
        user,
        request,
        {
            'start': iso,
            'end': iso,
            'filial': params.get('filial'),
            'position': params.get('position'),
            'includeBanks': params.get('includeBanks'),
            'includeLimit': params.get('includeLimit'),
            'accounts': params.get('accounts'),
        },
    )
    daily_point = overview['daily'][0] if overview['daily'] else {
        'date': _fmt_short(target),
        'dateIso': iso,
        'saldoInicial': 0.0,
        'entradas': 0.0,
        'saidas': 0.0,
        'ajustes': 0.0,
        'saldoProjetado': 0.0,
    }

    pagar_rows: list[dict] = []
    receber_rows: list[dict] = []
    if batch:
        filial_codes = _resolve_filial_codes(user, 'Indicadores', request, params.get('filial'))
        pagar_qs = filter_pagar_for_cashflow(batch, filial_codes)
        receber_qs = ReceberTitulo.objects.filter(batch=batch)
        if filial_codes:
            receber_qs = receber_qs.filter(filial__in=filial_codes)

        pagar_rows = [
            _serialize_pagar_row(row)
            for row in sorted(
                _titulos_on_day(pagar_qs, 'vencimento_real', target),
                key=lambda r: (r.fornecedor, r.titulo),
            )
        ]
        receber_rows = [
            _serialize_receber_row(row)
            for row in sorted(
                _titulos_on_day(receber_qs, 'vencimento_real', target),
                key=lambda r: (r.cliente, r.titulo),
            )
        ]

    return {
        'date': _fmt_br(target),
        'dateIso': iso,
        'summary': {
            'saldoAnterior': daily_point['saldoInicial'],
            'entradas': daily_point['entradas'],
            'saidas': daily_point['saidas'],
            'ajustes': daily_point['ajustes'],
            'saldoPrevisto': daily_point['saldoProjetado'],
        },
        'pagar': pagar_rows,
        'receber': receber_rows,
    }


def build_cashflow_payload(user, request, params: dict) -> dict:
    positions = _list_cashflow_positions()
    try:
        batch = _resolve_cashflow_batch(params)
    except ValueError as exc:
        raise exc

    if not batch:
        today = _cashflow_start_date(timezone.localdate())
        return {
            'meta': {
                'updatedAt': _fmt_br(today),
                'updatedBy': 'Sistema',
                'batchLabel': '—',
                'batchReferenceDate': '—',
                'periodStart': _fmt_br(today),
                'periodEnd': _fmt_br(today + timedelta(days=30)),
            },
            'summary': {
                'saldoPrevisto': 0.0,
                'entradas': 0.0,
                'saidas': 0.0,
                'ajustes': 0.0,
                'caixaPositivoAte': _fmt_br(today),
            },
            'daily': [],
            'managerial': [],
            'gerencial': build_gerencial_panel(None, []),
            'facets': {'filiais': [], 'positions': positions, 'bankAccounts': _list_cashflow_bank_accounts()},
        }

    try:
        filial_codes = _resolve_filial_codes(user, 'Indicadores', request, params.get('filial'))
    except PermissionError as exc:
        raise exc

    disponibilidade = _parse_disponibilidade_options(params, batch.reference_date)

    raw_start = _parse_iso_date(params.get('start'))
    position_anchor = _cashflow_start_date(batch.reference_date)
    if raw_start:
        period_start = _cashflow_start_date(raw_start)
    else:
        period_start = position_anchor
    if period_start < position_anchor:
        period_start = position_anchor

    period_end = _parse_iso_date(params.get('end')) or (period_start + timedelta(days=30))
    if period_end < position_anchor:
        period_end = position_anchor
    if period_end < period_start:
        period_end = period_start

    pagar_qs = filter_pagar_for_cashflow(batch, filial_codes)
    receber_qs = ReceberTitulo.objects.filter(batch=batch)
    if filial_codes:
        receber_qs = receber_qs.filter(filial__in=filial_codes)

    saidas_by_day = _aggregate_titulos(pagar_qs, 'vencimento_real')
    entradas_by_day = _aggregate_titulos(receber_qs, 'vencimento_real', receber_saldo)
    launches_by_date = _load_launches_by_date(period_end)

    sim_start = min(launches_by_date.keys()) if launches_by_date else period_start
    adj_window_start = min(sim_start, period_start)
    adj_h, adj_j = aggregate_resumo_adjustments(adj_window_start, period_end, batch.reference_date)
    adj_net = aggregate_adjustments_net(adj_window_start, period_end, batch.reference_date)

    daily: list[dict] = []
    cursor = period_start
    running: Decimal | None = None
    total_entradas = Decimal('0')
    total_saidas = Decimal('0')
    total_ajustes = Decimal('0')

    while cursor <= period_end:
        running = _resolve_running_before_day(
            cursor,
            period_start,
            position_anchor,
            running,
            launches_by_date,
            entradas_by_day,
            saidas_by_day,
            adj_net,
            disponibilidade,
        )

        saldo_inicial = _day_saldo_inicial(cursor, running, launches_by_date, disponibilidade)
        ent = _titulos_total_for_day(entradas_by_day, cursor)
        sai = _titulos_total_for_day(saidas_by_day, cursor)
        h_adj = adj_h.get(cursor, Decimal('0'))
        j_adj = adj_j.get(cursor, Decimal('0'))
        ajustes = h_adj + j_adj
        saldo_projetado = saldo_inicial + ent - sai + h_adj + j_adj

        total_entradas += ent
        total_saidas += sai
        total_ajustes += ajustes
        running = saldo_projetado

        daily.append({
            'date': _fmt_short(cursor),
            'dateIso': cursor.isoformat(),
            'saldoInicial': float(saldo_inicial),
            'entradas': float(ent),
            'saidas': float(sai),
            'ajustes': float(ajustes),
            'saldoProjetado': float(saldo_projetado),
        })
        cursor = _next_cashflow_day(cursor)

    managerial = []
    filiais_in_batch = sorted({
        *PagarTitulo.objects.filter(batch=batch).values_list('filial', flat=True),
        *ReceberTitulo.objects.filter(batch=batch).values_list('filial', flat=True),
    })
    filiais_in_batch = [f for f in filiais_in_batch if f]
    visible_filiais = filter_allowed_filiais_list(user, 'Indicadores', filiais_in_batch)

    for code in visible_filiais:
        if filial_codes and code not in filial_codes:
            continue
        ent = _decimal(
            ReceberTitulo.objects.filter(batch=batch, filial=code).aggregate(t=Sum('saldo'))['t']
        )
        sai = _decimal(
            PagarTitulo.objects.filter(batch=batch, filial=code).aggregate(t=Sum('saldo'))['t']
        )
        managerial.append({
            'filial': code,
            'entradas': float(ent),
            'saidas': float(sai),
            'saldo': float(ent - sai),
        })

    saldo_previsto = daily[-1]['saldoProjetado'] if daily else float(_bank_balance_total(disponibilidade))
    updated_at = batch.created_at.astimezone(timezone.get_current_timezone()).strftime('%d/%m/%Y %H:%M')
    updated_by = batch.updated_by.name if batch.updated_by else 'Sistema'

    gerencial_ref = _parse_iso_date(params.get('gerencialDate')) or batch.reference_date
    if gerencial_ref < batch.reference_date:
        gerencial_ref = batch.reference_date

    default_period_end = position_anchor + timedelta(days=30)

    return {
        'meta': {
            'updatedAt': updated_at,
            'updatedBy': updated_by,
            'positionId': str(batch.pk),
            'batchLabel': batch.label,
            'batchReferenceDate': _fmt_br(batch.reference_date),
            'periodStart': _fmt_br(period_start),
            'periodEnd': _fmt_br(period_end),
            'minPeriodDate': position_anchor.isoformat(),
            'minGerencialDate': batch.reference_date.isoformat(),
            'defaultPeriodStart': _fmt_br(position_anchor),
            'defaultPeriodEnd': _fmt_br(default_period_end),
        },
        'summary': {
            'saldoPrevisto': saldo_previsto,
            'entradas': float(total_entradas),
            'saidas': float(total_saidas),
            'ajustes': float(total_ajustes),
            'caixaPositivoAte': _positive_until(daily, period_start),
        },
        'daily': daily,
        'managerial': sorted(managerial, key=lambda x: x['filial']),
        'gerencial': build_gerencial_panel(batch, filial_codes, gerencial_ref, disponibilidade.account_ids),
        'facets': {
            'filiais': visible_filiais,
            'positions': positions,
            'bankAccounts': _list_cashflow_bank_accounts(),
        },
    }
