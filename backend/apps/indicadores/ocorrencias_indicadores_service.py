from __future__ import annotations

from decimal import Decimal

from datetime import date

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDay, TruncMonth

from apps.financeiro.constants import OCORRENCIA_FILIAIS
from apps.financeiro.models import GnreIcmsOcorrencia, OpsRecebidaOcorrencia


def _parse_optional_date(value: str | None):
    if not value:
        return None
    try:
        return date.fromisoformat(value.strip())
    except ValueError:
        return None


def _parse_year(params) -> int | None:
    raw = params.get('year') or params.get('ano')
    if raw is None or raw == '':
        return None
    try:
        year = int(str(raw).strip())
    except (TypeError, ValueError):
        return None
    if 2000 <= year <= 2100:
        return year
    return None


def _parse_months(params) -> list[int]:
    values: list[str] = []
    if hasattr(params, 'getlist'):
        for item in params.getlist('months') or params.getlist('meses') or []:
            values.extend(str(item).split(','))
    else:
        raw = params.get('months') or params.get('meses') or ''
        if raw:
            values.extend(str(raw).split(','))

    months: list[int] = []
    seen: set[int] = set()
    for value in values:
        value = value.strip()
        if not value:
            continue
        try:
            month = int(value)
        except ValueError:
            continue
        if 1 <= month <= 12 and month not in seen:
            seen.add(month)
            months.append(month)
    return months


def _parse_granularity(params) -> str:
    raw = (params.get('granularity') or params.get('granularidade') or 'month').strip().lower()
    if raw in ('day', 'dia', 'd'):
        return 'day'
    return 'month'


def _can_use_day_view(months: list[int]) -> bool:
    """Visão diária só com exatamente um mês selecionado."""
    return len(months) == 1


def _resolve_granularity(requested: str, months: list[int]) -> dict:
    day_allowed = _can_use_day_view(months)
    allowed = ['day', 'month'] if day_allowed else ['month']

    if requested == 'day' and day_allowed:
        return {
            'requested': requested,
            'effective': 'day',
            'allowed': allowed,
            'adjusted': False,
            'message': '',
        }

    adjusted = requested == 'day' and not day_allowed
    return {
        'requested': requested,
        'effective': 'month',
        'allowed': allowed,
        'adjusted': adjusted,
        'message': (
            'A visão diária exige exatamente um mês selecionado. Exibindo por mês.'
            if adjusted
            else ''
        ),
    }


def _months_param_provided(params) -> bool:
    if hasattr(params, '__contains__'):
        if 'months' in params or 'meses' in params:
            return True
    return (params.get('months') is not None) or (params.get('meses') is not None)


def _apply_common_filters(qs, params, date_field: str):
    filial = (params.get('filial') or params.get('branch') or '').strip()
    start = _parse_optional_date(params.get('startDate') or params.get('start_date'))
    end = _parse_optional_date(params.get('endDate') or params.get('end_date'))
    year = _parse_year(params)
    months = _parse_months(params)
    months_provided = _months_param_provided(params)

    if filial and filial.lower() not in ('todas', 'todos', 'all'):
        qs = qs.filter(filial=filial)
    if year is not None:
        qs = qs.filter(**{f'{date_field}__year': year})
    if months_provided:
        # months='' (desmarcar todos) → nenhum resultado; lista preenchida → filtro normal.
        if not months:
            qs = qs.none()
        else:
            qs = qs.filter(**{f'{date_field}__month__in': months})
    if start:
        qs = qs.filter(**{f'{date_field}__gte': start})
    if end:
        qs = qs.filter(**{f'{date_field}__lte': end})
    return qs


def _money(value) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _pct(part: int | float, total: int | float) -> float:
    if not total:
        return 0.0
    return round((part / total) * 100, 1)


def _available_years(model, date_field: str) -> list[int]:
    years = (
        model.objects.exclude(**{f'{date_field}__isnull': True})
        .dates(date_field, 'year')
    )
    return sorted({d.year for d in years}, reverse=True)


def _available_filiais(model) -> list[str]:
    from_db = {
        value for value in model.objects.values_list('filial', flat=True).distinct()
        if value
    }
    # Mantém a ordem canônica do domínio e inclui filiais extras vindas do import.
    ordered = [name for name in OCORRENCIA_FILIAIS if name in from_db]
    extras = sorted(from_db.difference(OCORRENCIA_FILIAIS))
    return ordered + extras


def _period_label(periodo: date, granularity: str) -> str:
    if granularity == 'day':
        return periodo.strftime('%d/%m/%Y')
    return periodo.strftime('%m/%Y')


def _build_period_series(qs, date_field: str, granularity: str, *, extra_annotations=None):
    if granularity == 'day':
        trunc_fn = TruncDay
        period_fmt = '%Y-%m-%d'
    else:
        trunc_fn = TruncMonth
        period_fmt = '%Y-%m'

    annotations = {
        'total': Count('id'),
        **(extra_annotations or {}),
    }
    rows = (
        qs.annotate(periodo=trunc_fn(date_field))
        .values('periodo')
        .annotate(**annotations)
        .order_by('periodo')
    )
    series = []
    for row in rows:
        periodo = row['periodo']
        if not periodo:
            continue
        # Trunc* pode devolver datetime; normaliza para date.
        periodo_date = periodo.date() if hasattr(periodo, 'date') else periodo
        item = {
            'period': periodo_date.strftime(period_fmt),
            'month': periodo_date.strftime(period_fmt),
            'label': _period_label(periodo_date, granularity),
            'total': row['total'],
        }
        for key, value in row.items():
            if key in ('periodo', 'total'):
                continue
            item[key] = value
        series.append(item)
    return series


def build_ops_indicadores(params) -> dict:
    requested_granularity = _parse_granularity(params)
    year = _parse_year(params)
    months = _parse_months(params)

    qs = _apply_common_filters(OpsRecebidaOcorrencia.objects.all(), params, 'data_pagamento')
    granularity_meta = _resolve_granularity(requested_granularity, months)
    granularity = granularity_meta['effective']

    total = qs.count()
    encerradas = qs.filter(mdfe_encerrado=True).count()
    pendentes = qs.filter(mdfe_encerrado=False).count()
    percentual_ok = _pct(encerradas, total)
    percentual_falha = _pct(pendentes, total)

    by_filial_rows = list(
        qs.values('filial')
        .annotate(
            total=Count('id'),
            encerradas=Count('id', filter=Q(mdfe_encerrado=True)),
            pendentes=Count('id', filter=Q(mdfe_encerrado=False)),
        )
        .order_by('-pendentes', 'filial')
    )

    by_filial = [
        {
            'filial': row['filial'],
            'total': row['total'],
            'encerradas': row['encerradas'],
            'pendentes': row['pendentes'],
            'percentualEncerrado': _pct(row['encerradas'], row['total']),
            'percentualFalha': _pct(row['pendentes'], row['total']),
        }
        for row in by_filial_rows
    ]

    by_period_rows = _build_period_series(
        qs,
        'data_pagamento',
        granularity,
        extra_annotations={
            'encerradas': Count('id', filter=Q(mdfe_encerrado=True)),
            'pendentes': Count('id', filter=Q(mdfe_encerrado=False)),
        },
    )
    by_period = [
        {
            'period': row['period'],
            'month': row['month'],
            'label': row['label'],
            'total': row['total'],
            'encerradas': row['encerradas'],
            'pendentes': row['pendentes'],
            'percentualFalha': _pct(row['pendentes'], row['total']),
        }
        for row in by_period_rows
    ]

    return {
        'summary': {
            'total': total,
            'mdfeEncerradas': encerradas,
            'mdfePendentes': pendentes,
            'percentualEncerrado': percentual_ok,
            'percentualFalha': percentual_falha,
            'volumeOperacao': total,
        },
        'byFilial': by_filial,
        'byPeriod': by_period,
        'byMonth': by_period,
        'insights': [],
        'meta': {
            'availableYears': _available_years(OpsRecebidaOcorrencia, 'data_pagamento'),
            'availableFiliais': _available_filiais(OpsRecebidaOcorrencia),
            'granularity': granularity,
            'requestedGranularity': granularity_meta['requested'],
            'allowedGranularities': granularity_meta['allowed'],
            'granularityAdjusted': granularity_meta['adjusted'],
            'granularityMessage': granularity_meta['message'],
            'year': year,
            'months': months,
        },
    }


def build_gnre_indicadores(params) -> dict:
    requested_granularity = _parse_granularity(params)
    year = _parse_year(params)
    months = _parse_months(params)

    qs = _apply_common_filters(GnreIcmsOcorrencia.objects.all(), params, 'data_pagamento')
    # Mesma sistemática de OPs: granularidade vem do frontend (dia só com exatamente 1 mês).
    granularity_meta = _resolve_granularity(requested_granularity, months)
    granularity = granularity_meta['effective']

    total = qs.count()
    validadas = qs.filter(validada=True).count()
    pendentes = qs.filter(validada=False).count()
    percentual_ok = _pct(validadas, total)
    percentual_falha = _pct(pendentes, total)

    aggregates = qs.aggregate(
        valor_total=Sum('valor_guia'),
        valor_pendente=Sum('valor_guia', filter=Q(validada=False)),
        valor_validado=Sum('valor_guia', filter=Q(validada=True)),
    )
    valor_total = _money(aggregates['valor_total'])
    valor_pendente = _money(aggregates['valor_pendente'])
    valor_validado = _money(aggregates['valor_validado'])

    by_filial_rows = list(
        qs.values('filial')
        .annotate(
            total=Count('id'),
            validadas=Count('id', filter=Q(validada=True)),
            pendentes=Count('id', filter=Q(validada=False)),
            valor_total=Sum('valor_guia'),
            valor_pendente=Sum('valor_guia', filter=Q(validada=False)),
        )
        .order_by('-valor_total', 'filial')
    )
    by_filial = [
        {
            'filial': row['filial'],
            'total': row['total'],
            'validadas': row['validadas'],
            'pendentes': row['pendentes'],
            'percentualValidado': _pct(row['validadas'], row['total']),
            'percentualFalha': _pct(row['pendentes'], row['total']),
            'valorTotal': _money(row['valor_total']),
            'valorPendente': _money(row['valor_pendente']),
        }
        for row in by_filial_rows
    ]

    by_period_rows = _build_period_series(
        qs,
        'data_pagamento',
        granularity,
        extra_annotations={
            'validadas': Count('id', filter=Q(validada=True)),
            'pendentes': Count('id', filter=Q(validada=False)),
            'valor_total': Sum('valor_guia'),
            'valor_pendente': Sum('valor_guia', filter=Q(validada=False)),
        },
    )
    by_period = [
        {
            'period': row['period'],
            'month': row['month'],
            'label': row['label'],
            'total': row['total'],
            'validadas': row['validadas'],
            'pendentes': row['pendentes'],
            'percentualFalha': _pct(row['pendentes'], row['total']),
            'valorTotal': _money(row.get('valor_total')),
            'valorPendente': _money(row.get('valor_pendente')),
        }
        for row in by_period_rows
    ]

    return {
        'summary': {
            'total': total,
            'validadas': validadas,
            'naoValidadas': pendentes,
            'percentualValidado': percentual_ok,
            'percentualFalha': percentual_falha,
            'valorTotal': valor_total,
            'valorValidado': valor_validado,
            'valorPendente': valor_pendente,
            'volumeOperacao': total,
        },
        'byFilial': by_filial,
        'byPeriod': by_period,
        'byMonth': by_period,
        'insights': [],
        'meta': {
            'availableYears': _available_years(GnreIcmsOcorrencia, 'data_pagamento'),
            'availableFiliais': _available_filiais(GnreIcmsOcorrencia),
            'granularity': granularity,
            'requestedGranularity': granularity_meta['requested'],
            'allowedGranularities': granularity_meta['allowed'],
            'granularityAdjusted': granularity_meta['adjusted'],
            'granularityMessage': granularity_meta['message'],
            'year': year,
            'months': months,
        },
    }


def _serialize_gnre_guia(row: GnreIcmsOcorrencia) -> dict:
    return {
        'id': row.id,
        'filial': row.filial,
        'cte': row.cte,
        'periodoReferencia': row.periodo_referencia,
        'dataPagamento': row.data_pagamento.isoformat() if row.data_pagamento else '',
        'validada': row.validada,
        'valorGuia': _money(row.valor_guia),
    }


def build_gnre_guias_list(params) -> dict:
    """Lista paginada de guias para a tabela do dashboard (com pesquisa)."""
    qs = _apply_common_filters(GnreIcmsOcorrencia.objects.all(), params, 'data_pagamento')
    search = (params.get('search') or '').strip()
    if search:
        qs = qs.filter(
            Q(filial__icontains=search)
            | Q(cte__icontains=search)
            | Q(periodo_referencia__icontains=search)
        )

    qs = qs.order_by('validada', '-data_pagamento', '-id')
    total = qs.count()

    try:
        page = max(1, int(params.get('page') or 1))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = int(params.get('pageSize') or params.get('page_size') or 10)
    except (TypeError, ValueError):
        page_size = 10
    page_size = max(1, min(page_size, 100))

    start = (page - 1) * page_size
    end = start + page_size
    results = [_serialize_gnre_guia(row) for row in qs[start:end]]

    return {
        'count': total,
        'page': page,
        'pageSize': page_size,
        'results': results,
    }
