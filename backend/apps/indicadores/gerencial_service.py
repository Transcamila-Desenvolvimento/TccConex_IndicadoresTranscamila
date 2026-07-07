"""Painel gerencial do fluxo de caixa — espelha o RESUMO gerencial da planilha Transcamila."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from apps.accounts.permissions import FILIAL_DB_ALIASES, db_values_for_filiais
from apps.financeiro.models import AgingTitulo, BillingRecord, CashAdjustment, PagarTitulo, ReceberTitulo, ReportBatch

from .cashflow_utils import (
    bucketize_aging_ctes,
    bucketize_overdue_titulos,
    build_duplicatas_schedule,
    cashflow_start_date,
    filter_pagar_for_cashflow,
    fmt_br,
    gerencial_fat_hoje_dates,
    gerencial_pagar_cutoff,
    parse_br_date,
    sum_bank_balance_on_position_date,
    sum_gerencial_ajustes_after_reference,
    sum_overdue_titulos,
    sum_pagar_through_cutoff,
    sum_receber_duplicatas,
    receber_saldo,
    to_decimal,
)

AGING_BUCKET_LABELS = ['0-30D', '31-60D', '61-90D', '91-120D', '121-150D', '>150D']


def _empty_gerencial(reference: date) -> dict:
    cutoff = gerencial_pagar_cutoff(reference)
    zero_rows = [
        {'category': 'Aging (A Receber)', 'variant': 'receber', 'buckets': [0.0] * 6, 'total': 0.0},
        {'category': 'Rec. Atrasados', 'variant': 'atraso', 'buckets': [0.0] * 6, 'total': 0.0},
        {'category': 'Pag. Atrasados', 'variant': 'atraso', 'buckets': [0.0] * 6, 'total': 0.0},
    ]
    return {
        'referenceDate': fmt_br(reference),
        'groups': [
            {'title': 'Disponibilidade', 'items': [
                {'label': 'Saldo em Bancos', 'value': 0.0},
                {'label': 'Fat. Hoje', 'value': 0.0},
                {'label': 'Fat. Mês', 'value': 0.0},
            ]},
            {'title': 'Compromissos', 'items': [
                {'label': f'Contas a Pagar até {fmt_br(cutoff)}', 'value': 0.0},
                {'label': 'Contas a Pagar Atrasadas', 'value': 0.0},
            ]},
            {'title': 'Futuro e Recebíveis', 'items': [
                {'label': 'Duplicatas a Receber', 'value': 0.0},
                {'label': 'Rec. Atraso', 'value': 0.0},
                {'label': 'CTEs Emitidos', 'value': 0.0},
            ]},
        ],
        'highlights': [
            {'title': 'Á Disponibilizar', 'value': 0.0, 'subtitle': 'Saldo + Duplicatas + Atrasos + CTEs', 'variant': 'positive'},
            {'title': 'Saídas Previstas', 'value': 0.0, 'subtitle': 'Pagar até corte + Atrasos', 'variant': 'negative'},
            {'title': 'Posição Gerencial', 'value': 0.0, 'subtitle': 'Disponibilizar − Saídas', 'variant': 'neutral'},
        ],
        'schedule': [],
        'scheduleTotal': 0.0,
        'aging': {'buckets': AGING_BUCKET_LABELS, 'rows': zero_rows},
    }


def _billing_branches_for_codes(filial_codes: list[str]) -> list[str]:
    branches: set[str] = set()
    for name, aliases in FILIAL_DB_ALIASES.items():
        if any(code in aliases for code in filial_codes):
            branches.add(name)
            for alias in aliases:
                if alias and not alias.isdigit() and alias not in {'PA', 'Matriz'}:
                    branches.add(alias)
    return sorted(branches)


def _aging_bucket_index(days_overdue: int) -> int:
    if days_overdue <= 30:
        return 0
    if days_overdue <= 60:
        return 1
    if days_overdue <= 90:
        return 2
    if days_overdue <= 120:
        return 3
    if days_overdue <= 150:
        return 4
    return 5


def _init_buckets() -> list[Decimal]:
    return [Decimal('0')] * len(AGING_BUCKET_LABELS)


def _bucket_row(category: str, variant: str, buckets: list[Decimal]) -> dict:
    total = sum(buckets, Decimal('0'))
    return {
        'category': category,
        'variant': variant,
        'buckets': [float(v) for v in buckets],
        'total': float(total),
    }


def _bucketize_titulos(qs, date_field: str, raw_reference: date, saldo_getter=None) -> list[Decimal]:
    return bucketize_overdue_titulos(qs, date_field, raw_reference, saldo_getter)


def _bucketize_aging(qs, raw_reference: date) -> list[Decimal]:
    return bucketize_aging_ctes(qs, raw_reference)


def _build_schedule(receber_qs, raw_reference: date) -> tuple[list[dict], Decimal]:
    """Cronograma DUPLIC. À RECEBER (O25:T25) — delega para build_duplicatas_schedule."""
    return build_duplicatas_schedule(receber_qs, raw_reference)


def build_gerencial_panel(
    batch: ReportBatch | None,
    filial_codes: list[str],
    reference_date: date | None = None,
    account_ids: tuple[int, ...] | None = None,
) -> dict:
    raw_reference = reference_date or (batch.reference_date if batch else timezone.localdate())
    reference = cashflow_start_date(raw_reference)
    if not batch:
        return _empty_gerencial(reference)

    pagar_qs = filter_pagar_for_cashflow(batch, filial_codes)
    receber_qs = ReceberTitulo.objects.filter(batch=batch)
    aging_qs = AgingTitulo.objects.filter(batch=batch)

    if filial_codes:
        receber_qs = receber_qs.filter(filial__in=filial_codes)
        aging_origins = db_values_for_filiais(_billing_branches_for_codes(filial_codes))
        aging_qs = aging_qs.filter(origem__in=aging_origins)

    pagar_cutoff = gerencial_pagar_cutoff(raw_reference)

    saldo_bancos = sum_bank_balance_on_position_date(raw_reference, account_ids)

    billing_qs = BillingRecord.objects.filter(reference_date__in=gerencial_fat_hoje_dates(raw_reference))
    billing_ref_date = raw_reference - timedelta(days=1)
    billing_month_qs = BillingRecord.objects.filter(
        reference_date__year=billing_ref_date.year,
        reference_date__month=billing_ref_date.month,
        reference_date__lte=billing_ref_date,
    )
    if filial_codes:
        branches = _billing_branches_for_codes(filial_codes)
        if branches:
            billing_qs = billing_qs.filter(branch__in=branches)
            billing_month_qs = billing_month_qs.filter(branch__in=branches)

    fat_hoje = to_decimal(billing_qs.aggregate(t=Sum('value'))['t'])
    fat_mes = to_decimal(billing_month_qs.aggregate(t=Sum('value'))['t'])

    duplicatas = sum_receber_duplicatas(receber_qs, reference)
    rec_atraso = sum_overdue_titulos(receber_qs, 'vencimento_real', raw_reference, receber_saldo)
    pagar_ate_corte = (
        sum_pagar_through_cutoff(pagar_qs, reference, pagar_cutoff)
        + sum_gerencial_ajustes_after_reference(raw_reference, pagar_cutoff, batch.reference_date)
    )
    pagar_atraso = sum_overdue_titulos(pagar_qs, 'vencimento_real', raw_reference)
    ctes = to_decimal(aging_qs.aggregate(t=Sum('total'))['t'])

    disponibilizar = saldo_bancos + duplicatas + rec_atraso + ctes
    saidas_previstas = pagar_ate_corte + pagar_atraso
    posicao = disponibilizar - saidas_previstas

    schedule, schedule_total = _build_schedule(receber_qs, raw_reference)

    aging_rows = [
        _bucket_row('Aging (A Receber)', 'receber', _bucketize_aging(aging_qs, raw_reference)),
        _bucket_row('Rec. Atrasados', 'atraso', _bucketize_titulos(receber_qs, 'vencimento_real', raw_reference, receber_saldo)),
        _bucket_row('Pag. Atrasados', 'atraso', _bucketize_titulos(pagar_qs, 'vencimento_real', raw_reference)),
    ]

    return {
        'referenceDate': fmt_br(raw_reference),
        'groups': [
            {
                'title': 'Disponibilidade',
                'items': [
                    {'label': 'Saldo em Bancos', 'value': float(saldo_bancos)},
                    {'label': 'Fat. Hoje', 'value': float(fat_hoje)},
                    {'label': 'Fat. Mês', 'value': float(fat_mes)},
                ],
            },
            {
                'title': 'Compromissos',
                'items': [
                    {'label': f'Contas a Pagar até {fmt_br(pagar_cutoff)}', 'value': float(pagar_ate_corte)},
                    {'label': 'Contas a Pagar Atrasadas', 'value': float(pagar_atraso)},
                ],
            },
            {
                'title': 'Futuro e Recebíveis',
                'items': [
                    {'label': 'Duplicatas a Receber', 'value': float(duplicatas)},
                    {'label': 'Rec. Atraso', 'value': float(rec_atraso)},
                    {'label': 'CTEs Emitidos', 'value': float(ctes)},
                ],
            },
        ],
        'highlights': [
            {
                'title': 'Á Disponibilizar',
                'value': float(disponibilizar),
                'subtitle': 'Saldo + Duplicatas + Atrasos + CTEs',
                'variant': 'positive',
            },
            {
                'title': 'Saídas Previstas',
                'value': float(saidas_previstas),
                'subtitle': f'Pagar até {fmt_br(pagar_cutoff)} + Atrasos',
                'variant': 'negative',
            },
            {
                'title': 'Posição Gerencial',
                'value': float(posicao),
                'subtitle': 'Disponibilizar − Saídas',
                'variant': 'neutral',
            },
        ],
        'schedule': schedule,
        'scheduleTotal': float(schedule_total),
        'aging': {
            'buckets': AGING_BUCKET_LABELS,
            'rows': aging_rows,
        },
    }
