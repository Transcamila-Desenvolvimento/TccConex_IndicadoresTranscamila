from django.db.models import Q

from .models import BillingRecord


def _skip_filter(value: str | None) -> bool:
    if not value:
        return True
    normalized = value.strip().lower()
    return normalized in ('', 'todas', 'todos', 'all')


def _parse_bool_filter(value: str | None) -> bool | None:
    if value is None:
        return None
    normalized = str(value).strip().lower()
    if normalized in ('', 'todos', 'todas', 'all'):
        return None
    if normalized in ('1', 'true', 'sim', 'yes', 's'):
        return True
    if normalized in ('0', 'false', 'nao', 'não', 'no', 'n'):
        return False
    return None


def filter_billing_queryset(qs, params):
    search = (params.get('search') or '').strip()
    branch = params.get('branch') or params.get('filial')
    start_date = params.get('start_date') or params.get('startDate')
    end_date = params.get('end_date') or params.get('endDate')

    if not _skip_filter(branch):
        qs = qs.filter(branch=branch)
    if start_date:
        qs = qs.filter(reference_date__gte=start_date)
    if end_date:
        qs = qs.filter(reference_date__lte=end_date)
    if search:
        qs = qs.filter(
            Q(branch__icontains=search)
            | Q(value__icontains=search)
            | Q(reference_date__icontains=search)
        )
    return qs


def filter_adjustments_queryset(qs, params):
    search = (params.get('search') or '').strip()
    ref_date = params.get('date')
    adj_type = params.get('type') or params.get('tipo')

    if ref_date:
        qs = qs.filter(reference_date=ref_date)
    if not _skip_filter(adj_type):
        qs = qs.filter(adjustment_type=adj_type)
    if search:
        qs = qs.filter(
            Q(observation__icontains=search)
            | Q(created_by__icontains=search)
        )
    return qs


def filter_balance_history_queryset(qs, params):
    search = (params.get('search') or '').strip()
    bank = params.get('bank')
    entry_type = params.get('type') or params.get('tipo')
    account_id = params.get('account_id') or params.get('accountId')

    if account_id:
        qs = qs.filter(account_id=account_id)

    if not _skip_filter(bank):
        qs = qs.filter(bank=bank)
    if not _skip_filter(entry_type):
        qs = qs.filter(entry_type=entry_type)
    if search:
        qs = qs.filter(
            Q(bank__icontains=search)
            | Q(number__icontains=search)
            | Q(value__icontains=search)
            | Q(reference_date__icontains=search)
        )
    return qs


def billing_trend(record: BillingRecord) -> str:
    previous = (
        BillingRecord.objects.filter(branch=record.branch)
        .filter(
            Q(reference_date__lt=record.reference_date)
            | Q(reference_date=record.reference_date, pk__lt=record.pk)
        )
        .order_by('-reference_date', '-pk')
        .first()
    )
    if not previous:
        return 'none'
    if record.value > previous.value:
        return 'up'
    if record.value < previous.value:
        return 'down'
    return 'equal'


def filter_ops_recebidas_queryset(qs, params):
    search = (params.get('search') or '').strip()
    filial = params.get('filial') or params.get('branch')
    ref_date = params.get('date') or params.get('dataPagamento')
    mdfe = _parse_bool_filter(params.get('mdfeEncerrado') or params.get('mdfe_encerrado'))

    if not _skip_filter(filial):
        qs = qs.filter(filial=filial)
    if ref_date:
        qs = qs.filter(data_pagamento=ref_date)
    if mdfe is not None:
        qs = qs.filter(mdfe_encerrado=mdfe)
    if search:
        qs = qs.filter(
            Q(filial__icontains=search)
            | Q(contrato__icontains=search)
        )
    return qs


def filter_gnre_icms_queryset(qs, params):
    search = (params.get('search') or '').strip()
    filial = params.get('filial') or params.get('branch')
    ref_date = params.get('date') or params.get('dataPagamento')
    validada = _parse_bool_filter(params.get('validada'))
    periodo = (params.get('periodoReferencia') or params.get('periodo_referencia') or '').strip()

    if not _skip_filter(filial):
        qs = qs.filter(filial=filial)
    if ref_date:
        qs = qs.filter(data_pagamento=ref_date)
    if validada is not None:
        qs = qs.filter(validada=validada)
    if periodo:
        qs = qs.filter(periodo_referencia=periodo)
    if search:
        qs = qs.filter(
            Q(filial__icontains=search)
            | Q(cte__icontains=search)
            | Q(periodo_referencia__icontains=search)
        )
    return qs


def filter_notas_pagas_queryset(qs, params):
    search = (params.get('search') or '').strip()
    filial = params.get('filial') or params.get('branch')
    ref_date = params.get('date') or params.get('dataPagamento')
    justificativa = params.get('justificativa')

    if not _skip_filter(filial):
        qs = qs.filter(filial=filial)
    if ref_date:
        qs = qs.filter(data_pagamento=ref_date)
    if not _skip_filter(justificativa):
        qs = qs.filter(justificativa=justificativa)
    if search:
        qs = qs.filter(
            Q(filial__icontains=search)
            | Q(nfs__icontains=search)
            | Q(fornecedor__icontains=search)
            | Q(justificativa__icontains=search)
        )
    return qs
