from django.db.models import Q

from .models import BillingRecord


def _skip_filter(value: str | None) -> bool:
    if not value:
        return True
    normalized = value.strip().lower()
    return normalized in ('', 'todas', 'todos', 'all')


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
