"""Persistência e propagação de PRs desconsideradas por lote."""

from __future__ import annotations

from django.db.models import Q

from .constants import MAX_REPORT_BATCHES
from .models import PagarTitulo, ReportBatch


def recent_batch_ids(limit: int = MAX_REPORT_BATCHES) -> list[int]:
    """Últimos lotes retidos (mesma janela dos relatórios importados)."""
    return list(
        ReportBatch.objects.order_by('-reference_date', '-created_at')
        .values_list('pk', flat=True)[:limit]
    )


def position_window_batch_ids(batch, limit: int = MAX_REPORT_BATCHES) -> list[int]:
    """Posição selecionada no dashboard + até limit-1 lotes seguintes."""
    if batch is None:
        return []

    ordered_ids = list(
        ReportBatch.objects.order_by('reference_date', 'created_at').values_list('pk', flat=True)
    )
    try:
        start_idx = ordered_ids.index(batch.pk)
    except ValueError:
        return []

    return ordered_ids[start_idx:start_idx + limit]


def ignored_pr_keys(*, batch_ids: list[int]) -> set[tuple[str, str]]:
    if not batch_ids:
        return set()

    rows = PagarTitulo.objects.filter(
        batch_id__in=batch_ids,
        tipo__iexact='PR',
        pr_desconsiderada=True,
    ).values_list('cod_forn', 'titulo')
    return {(cod_forn, titulo) for cod_forn, titulo in rows}


def ignored_pr_keys_for_recent_batches(exclude_batch_id: int | None = None) -> set[tuple[str, str]]:
    batch_ids = recent_batch_ids()
    if exclude_batch_id is not None:
        batch_ids = [batch_id for batch_id in batch_ids if batch_id != exclude_batch_id]
    return ignored_pr_keys(batch_ids=batch_ids)


def ignored_pr_keys_for_position(batch) -> set[tuple[str, str]]:
    """Chaves ignoradas na janela da posição selecionada (fluxo de caixa)."""
    return ignored_pr_keys(batch_ids=position_window_batch_ids(batch))


def apply_pr_ignore_keys(
    keys: set[tuple[str, str]],
    *,
    ignored: bool,
    batch_ids: list[int] | None = None,
) -> int:
    if not keys:
        return 0

    target_batches = batch_ids or recent_batch_ids()
    if not target_batches:
        return 0

    key_q = Q()
    for cod_forn, titulo in keys:
        key_q |= Q(cod_forn=cod_forn, titulo=titulo)

    return PagarTitulo.objects.filter(
        batch_id__in=target_batches,
        tipo__iexact='PR',
    ).filter(key_q).update(pr_desconsiderada=ignored)


def apply_pr_action(ids: list[int], action: str) -> int:
    if action not in {'ignore', 'restore'}:
        raise ValueError('Ação inválida.')
    if not ids:
        raise ValueError('Informe ao menos um título.')

    qs = PagarTitulo.objects.filter(id__in=ids, tipo__iexact='PR')
    if not qs.exists():
        raise ValueError('Nenhuma PR encontrada para os IDs informados.')

    keys = set(qs.values_list('cod_forn', 'titulo'))
    return apply_pr_ignore_keys(keys, ignored=(action == 'ignore'))


def mark_ignored_prs_on_import(batch, parsed: list[PagarTitulo]) -> None:
    """Mantém PRs desconsideradas ao reimportar ou criar novo lote."""
    local_keys = set(
        PagarTitulo.objects.filter(batch=batch, tipo__iexact='PR', pr_desconsiderada=True)
        .values_list('cod_forn', 'titulo')
    )
    carried_keys = ignored_pr_keys_for_recent_batches(exclude_batch_id=batch.pk)
    ignored_keys = local_keys | carried_keys
    if not ignored_keys:
        return

    for row in parsed:
        if row.tipo.upper() == 'PR' and (row.cod_forn, row.titulo) in ignored_keys:
            row.pr_desconsiderada = True
