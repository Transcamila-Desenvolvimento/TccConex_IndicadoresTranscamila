"""Utilitários compartilhados entre serviços de fluxo de caixa."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal

GERENCIAL_DUP_MAX_DAYS = 1365
DUPLICATAS_SCHEDULE_PERIODS = 4  # colunas P..S do RESUMO (30 dias cada, após D27)
CASHFLOW_PROJECTION_ROWS = 23  # RESUMO D5..D27


def add_one_month(base: date) -> date:
    """Avança um mês civil mantendo o dia (ajusta fim de mês)."""
    month = base.month + 1
    year = base.year + (month - 1) // 12
    month = ((month - 1) % 12) + 1
    from calendar import monthrange

    max_day = monthrange(year, month)[1]
    return date(year, month, min(base.day, max_day))


def parse_br_date(value: str | None) -> date | None:
    text = (value or '').strip()
    if not text or text == '--/--/----':
        return None
    for fmt in ('%d/%m/%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def fmt_br(d: date) -> str:
    return d.strftime('%d/%m/%Y')


def fmt_short(d: date) -> str:
    return d.strftime('%d/%m')


def to_decimal(value) -> Decimal:
    if value is None:
        return Decimal('0')
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def receber_saldo(row) -> Decimal:
    """Saldo efetivo do título a receber (corrige import legado que somava atual+vencido)."""
    saldo = to_decimal(row.saldo)
    valor = to_decimal(getattr(row, 'valor', None))
    if valor > 0 and saldo == valor * 2:
        return valor
    return saldo


def cashflow_start_date(base: date) -> date:
    """Espelha D5 da planilha: sábado → +2, domingo → +1."""
    if base.weekday() == 5:
        return base + timedelta(days=2)
    if base.weekday() == 6:
        return base + timedelta(days=1)
    return base


def next_cashflow_day(day: date) -> date:
    """Avanço de datas do RESUMO: sexta +3, sábado +2, domingo +1, demais +1."""
    if day.weekday() == 4:
        return day + timedelta(days=3)
    if day.weekday() == 5:
        return day + timedelta(days=2)
    if day.weekday() == 6:
        return day + timedelta(days=1)
    return day + timedelta(days=1)


def vencimento_dates_for_day(day: date) -> frozenset[date]:
    """Datas de Vencto Real no SUMIFS do dia (sáb/dom acumulam na segunda)."""
    if day.weekday() == 0:
        return frozenset({
            day,
            day - timedelta(days=1),
            day - timedelta(days=2),
        })
    return frozenset({day})


def aggregate_titulos_by_date(qs, date_field: str, saldo_getter=None) -> dict[date, Decimal]:
    get_saldo = saldo_getter or (lambda row: to_decimal(row.saldo))
    totals: dict[date, Decimal] = {}
    for row in qs.iterator():
        due = parse_br_date(getattr(row, date_field, ''))
        if not due:
            continue
        totals[due] = totals.get(due, Decimal('0')) + get_saldo(row)
    return totals


def titulos_total_for_day(totals_by_date: dict[date, Decimal], day: date) -> Decimal:
    return sum(
        (totals_by_date.get(d, Decimal('0')) for d in vencimento_dates_for_day(day)),
        Decimal('0'),
    )


def gerencial_overdue_upper_bound(raw_reference: date) -> date:
    """Limite superior de atraso no RESUMO (O31/O32): segunda após fim de semana usa K2-2."""
    if cashflow_start_date(raw_reference).weekday() == 0:
        return raw_reference - timedelta(days=2)
    return raw_reference


def gerencial_fat_hoje_dates(raw_reference: date) -> tuple[date, ...]:
    """Datas de faturamento para Fat. Hoje — segunda: sex/sáb/dom; demais: dia anterior ao fluxo."""
    if raw_reference.weekday() == 0:
        return (
            raw_reference - timedelta(days=3),
            raw_reference - timedelta(days=2),
            raw_reference - timedelta(days=1),
        )
    return (raw_reference - timedelta(days=1),)


def sum_overdue_titulos(
    qs,
    date_field: str,
    raw_reference: date,
    saldo_getter=None,
) -> Decimal:
    get_saldo = saldo_getter or (lambda row: to_decimal(row.saldo))
    upper = gerencial_overdue_upper_bound(raw_reference)
    total = Decimal('0')
    for row in qs.iterator():
        due = parse_br_date(getattr(row, date_field, ''))
        if due and due < upper:
            total += get_saldo(row)
    return total


def bucketize_overdue_titulos(
    qs,
    date_field: str,
    raw_reference: date,
    saldo_getter=None,
) -> list[Decimal]:
    """Faixas O31:T31 / O32:T32 do RESUMO (Vencto Real vs K2)."""
    get_saldo = saldo_getter or (lambda row: to_decimal(row.saldo))
    upper = gerencial_overdue_upper_bound(raw_reference)
    buckets = [Decimal('0')] * 6
    for row in qs.iterator():
        due = parse_br_date(getattr(row, date_field, ''))
        if not due or due >= upper:
            continue
        days = (raw_reference - due).days
        if days <= 30:
            idx = 0
        elif days <= 60:
            idx = 1
        elif days <= 90:
            idx = 2
        elif days <= 120:
            idx = 3
        elif days <= 150:
            idx = 4
        else:
            idx = 5
        buckets[idx] += get_saldo(row)
    return buckets


def bucketize_aging_ctes(qs, raw_reference: date) -> list[Decimal]:
    """AGING do RESUMO — faixa pela emissão do CTE (não colunas fixas do arquivo)."""
    buckets = [Decimal('0')] * 6
    for row in qs.iterator():
        issued = parse_br_date(row.emissao)
        if not issued:
            continue
        days = max(0, (raw_reference - issued).days)
        if days <= 30:
            idx = 0
        elif days <= 60:
            idx = 1
        elif days <= 90:
            idx = 2
        elif days <= 120:
            idx = 3
        elif days <= 150:
            idx = 4
        else:
            idx = 5
        buckets[idx] += to_decimal(row.total)
    return buckets


def sum_receber_duplicatas(qs, reference: date, max_days: int = GERENCIAL_DUP_MAX_DAYS) -> Decimal:
    """P7 — duplicatas com Vencto Real >= referência (segunda: >= ref-2) até ref+1365d."""
    min_due = reference - timedelta(days=2) if reference.weekday() == 0 else reference
    max_due = reference + timedelta(days=max_days)
    total = Decimal('0')
    for row in qs.iterator():
        due = parse_br_date(row.vencimento_real)
        if due and min_due <= due <= max_due:
            total += receber_saldo(row)
    return total


def duplicatas_schedule_min_due(reference: date) -> date:
    """1ª faixa do cronograma — segunda-feira inclui vencto de sáb/dom (D5-2)."""
    if reference.weekday() == 0:
        return reference - timedelta(days=2)
    return reference


def build_duplicatas_schedule(
    qs,
    raw_reference: date,
    *,
    saldo_getter=None,
) -> tuple[list[dict], Decimal]:
    """
    Cronograma DUPLIC. À RECEBER (O25:T25) — ancorado em D27 (gerencial_pagar_cutoff).

    - Faixa 1: Vencto Real entre min_due e D27 (inclusive).
    - Faixas 2-5: blocos de 30 dias após D27 (> D27, <= D27+30, ...).
    - APÓS: vencto > D27+120.
    """
    reference = cashflow_start_date(raw_reference)
    anchor = gerencial_pagar_cutoff(raw_reference)
    min_first = duplicatas_schedule_min_due(reference)
    get_saldo = saldo_getter or receber_saldo
    totals_by_date = aggregate_titulos_by_date(qs, 'vencimento_real', get_saldo)

    def sum_between(
        start_exclusive: date | None,
        end_inclusive: date | None,
        *,
        floor: date | None = None,
    ) -> Decimal:
        total = Decimal('0')
        for due, amount in totals_by_date.items():
            if floor is not None and due < floor:
                continue
            if start_exclusive is not None and due <= start_exclusive:
                continue
            if end_inclusive is not None and due > end_inclusive:
                continue
            total += amount
        return total

    schedule: list[dict] = []
    running = Decimal('0')

    first_amount = sum_between(None, anchor, floor=min_first)
    schedule.append({
        'label': f'{fmt_br(reference)} A {fmt_br(anchor)}',
        'value': float(first_amount),
    })
    running += first_amount

    for period in range(1, DUPLICATAS_SCHEDULE_PERIODS + 1):
        low_exclusive = anchor + timedelta(days=30 * (period - 1))
        high_inclusive = anchor + timedelta(days=30 * period)
        amount = sum_between(low_exclusive, high_inclusive)
        schedule.append({
            'label': f'{fmt_br(low_exclusive + timedelta(days=1))} A {fmt_br(high_inclusive)}',
            'value': float(amount),
        })
        running += amount

    after_boundary = anchor + timedelta(days=30 * DUPLICATAS_SCHEDULE_PERIODS)
    after_amount = sum_between(after_boundary, None, floor=min_first)
    schedule.append({
        'label': f'APÓS {fmt_br(after_boundary)}',
        'value': float(after_amount),
    })
    running += after_amount

    return schedule, running


def sum_pagar_through_cutoff(qs, reference: date, cutoff: date) -> Decimal:
    """P12 — soma das saídas projetadas (coluna I do RESUMO) de D5 até D27."""
    totals = aggregate_titulos_by_date(qs, 'vencimento_real')
    total = Decimal('0')
    cursor = reference
    while True:
        total += titulos_total_for_day(totals, cursor)
        if cursor >= cutoff:
            break
        cursor = next_cashflow_day(cursor)
    return total


def _resumo_adjustment_columns(adjustment_type: str, value: Decimal, observation: str) -> tuple[Decimal, Decimal]:
    """Mapeia ajuste de caixa para colunas H (entrada) e J (saída) do RESUMO."""
    obs = (observation or '').upper()
    is_litio = any(
        token in obs
        for token in (
            'LIT', 'LITO', 'LÍTO', 'LÍQUIDO', 'LIQUIDO', 'LQUTO', 'LÍQUTO', 'TRANALHISTA',
        )
    )

    if adjustment_type == 'Entrada':
        return value, Decimal('0')

    # Saída — espelha planilha: pequenos vão para H negativo; Lítio positivo em J.
    if is_litio:
        return Decimal('0'), value
    if value < Decimal('1000'):
        return -value, Decimal('0')
    return Decimal('0'), -value


def ignored_pr_keys_for_batch(batch) -> set[tuple[str, str]]:
    from apps.financeiro.pr_ignore_service import ignored_pr_keys_for_position

    return ignored_pr_keys_for_position(batch)


def filter_pagar_for_cashflow(batch, filial_codes: list[str] | None = None):
    """Títulos do lote selecionado, respeitando PRs desconsideradas na janela da posição."""
    from django.db.models import Q

    from apps.financeiro.models import PagarTitulo

    qs = PagarTitulo.objects.filter(batch=batch)
    if filial_codes:
        qs = qs.filter(filial__in=filial_codes)

    ignored_keys = ignored_pr_keys_for_batch(batch)
    exclude_q = Q(pr_desconsiderada=True)
    if ignored_keys:
        key_q = Q()
        for cod_forn, titulo in ignored_keys:
            key_q |= Q(tipo__iexact='PR', cod_forn=cod_forn, titulo=titulo)
        exclude_q |= key_q

    return qs.exclude(exclude_q)


def _adjustment_applies_to_batch(adjustment_date: date, batch_reference: date | None) -> bool:
    """Ignora ajustes posteriores à posição quando pertencem a importação mais nova."""
    if batch_reference is None or adjustment_date <= batch_reference:
        return True

    from apps.financeiro.models import ReportBatch

    return not ReportBatch.objects.filter(
        reference_date__gt=batch_reference,
        reference_date__lte=adjustment_date,
    ).exists()


def aggregate_resumo_adjustments(
    start: date,
    end: date,
    batch_reference: date | None = None,
) -> tuple[dict[date, Decimal], dict[date, Decimal]]:
    """Colunas H e J do RESUMO: L = F + G + H + I + J."""
    from apps.financeiro.models import CashAdjustment

    h_cols: dict[date, Decimal] = {}
    j_cols: dict[date, Decimal] = {}
    for adj in CashAdjustment.objects.filter(reference_date__gte=start, reference_date__lte=end):
        if not _adjustment_applies_to_batch(adj.reference_date, batch_reference):
            continue
        h_delta, j_delta = _resumo_adjustment_columns(
            adj.adjustment_type,
            to_decimal(adj.value),
            adj.observation,
        )
        key = adj.reference_date
        if h_delta:
            h_cols[key] = h_cols.get(key, Decimal('0')) + h_delta
        if j_delta:
            j_cols[key] = j_cols.get(key, Decimal('0')) + j_delta
    return h_cols, j_cols


def aggregate_adjustments_net(
    start: date,
    end: date,
    batch_reference: date | None = None,
) -> dict[date, Decimal]:
    """Saldo líquido de ajustes (H + J) por dia."""
    h_cols, j_cols = aggregate_resumo_adjustments(start, end, batch_reference)
    net: dict[date, Decimal] = {}
    for key in set(h_cols) | set(j_cols):
        net[key] = h_cols.get(key, Decimal('0')) + j_cols.get(key, Decimal('0'))
    return net


def sum_bank_balance_on_position_date(
    position_date: date,
    account_ids: tuple[int, ...] | None = None,
) -> Decimal:
    """Saldo bancário importado na data da posição (um lançamento por conta)."""
    from django.db.models import Sum

    from apps.financeiro.models import BalanceHistoryEntry, BankAccount

    account_qs = BankAccount.objects.all()
    if account_ids is not None:
        if not account_ids:
            return Decimal('0')
        account_qs = account_qs.filter(pk__in=account_ids)

    target_ids = list(account_qs.values_list('pk', flat=True))
    if not target_ids:
        return Decimal('0')

    same_day = (
        BalanceHistoryEntry.objects.filter(
            reference_date=position_date,
            account_id__in=target_ids,
        )
        .order_by('account_id', '-id')
    )
    if same_day.exists():
        total = Decimal('0')
        seen_accounts: set[int] = set()
        for entry in same_day:
            if entry.account_id in seen_accounts:
                continue
            seen_accounts.add(entry.account_id)
            total += to_decimal(entry.value)
        return total

    total = Decimal('0')
    for account_id in target_ids:
        latest = (
            BalanceHistoryEntry.objects.filter(
                account_id=account_id,
                reference_date__lte=position_date,
            )
            .order_by('-reference_date', '-id')
            .first()
        )
        if latest:
            total += to_decimal(latest.value)
    if total:
        return total

    return to_decimal(account_qs.aggregate(t=Sum('balance'))['t'])


def sum_gerencial_ajustes_after_reference(
    raw_reference: date,
    cutoff: date,
    batch_reference: date | None = None,
) -> Decimal:
    """P12 = I28 + ajustes após a posição (ex.: Lítio +400.000 em J).

    Limitado à data da posição/lote selecionado — ajustes de importações
    posteriores não entram no painel de posições anteriores.
    """
    from apps.financeiro.models import CashAdjustment

    total = Decimal('0')
    qs = CashAdjustment.objects.filter(
        reference_date__gt=raw_reference,
        reference_date__lte=cutoff,
    )
    if batch_reference is not None:
        qs = qs.filter(reference_date__lte=batch_reference)

    for adj in qs:
        _, j_delta = _resumo_adjustment_columns(
            adj.adjustment_type,
            to_decimal(adj.value),
            adj.observation,
        )
        total += j_delta
    return total


def gerencial_pagar_cutoff(raw_reference: date) -> date:
    """D27 — última data da grade do fluxo diário (23 linhas a partir de D5).

    Não é mês civil: segue ``next_cashflow_day`` como no RESUMO (ex.: 19/06 → 21/07).
    """
    cursor = cashflow_start_date(raw_reference)
    for _ in range(CASHFLOW_PROJECTION_ROWS - 1):
        cursor = next_cashflow_day(cursor)
    return cursor
