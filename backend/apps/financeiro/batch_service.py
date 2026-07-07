import re
from datetime import date

from .models import ReportBatch

from .constants import MAX_REPORT_BATCHES

MAX_BATCHES = MAX_REPORT_BATCHES
_LABEL_RE = re.compile(r'^##(\d+)$')


def _next_batch_label() -> str:
    max_num = 0
    for label in ReportBatch.objects.values_list('label', flat=True):
        match = _LABEL_RE.match(label or '')
        if match:
            max_num = max(max_num, int(match.group(1)))
    return f'##{max_num + 1:03d}'


def trim_old_batches(max_batches: int = MAX_BATCHES) -> None:
    keep_ids = list(
        ReportBatch.objects.order_by('-reference_date', '-created_at')
        .values_list('pk', flat=True)[:max_batches]
    )
    if keep_ids:
        ReportBatch.objects.exclude(pk__in=keep_ids).delete()


def create_import_batch(user) -> tuple[ReportBatch, bool]:
    """Return (batch, created). Reuses today's batch when one already exists."""
    today = date.today()
    authenticated = getattr(user, 'is_authenticated', False)

    existing = (
        ReportBatch.objects.filter(reference_date=today)
        .order_by('-created_at')
        .first()
    )
    if existing:
        ReportBatch.objects.filter(reference_date=today).exclude(pk=existing.pk).delete()
        if authenticated:
            existing.updated_by = user
            existing.save(update_fields=['updated_by'])
        return existing, False

    batch = ReportBatch.objects.create(
        label=_next_batch_label(),
        reference_date=today,
        updated_by=user if authenticated else None,
        is_active=False,
    )
    trim_old_batches()
    return batch, True
