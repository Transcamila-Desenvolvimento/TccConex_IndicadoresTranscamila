"""Análise de PRs duplicadas vs títulos reais (mesma lógica do erp_transcamila)."""

from __future__ import annotations

from datetime import date

from apps.indicadores.cashflow_utils import parse_br_date

from .models import PagarTitulo, ReportBatch


def _serialize_brief(row: PagarTitulo) -> dict:
    return {
        'id': row.id,
        'filial': row.filial,
        'fornecedor': row.fornecedor,
        'titulo': row.titulo,
        'tipo': row.tipo,
        'vencimentoReal': row.vencimento_real,
        'saldo': float(row.saldo),
    }


def _recurring_title_keys(rows: list[PagarTitulo]) -> set[tuple[str, str]]:
    months_by_key: dict[tuple[str, str], set[tuple[int, int]]] = {}
    for row in rows:
        due = parse_br_date(row.vencimento_real)
        if not due:
            continue
        key = (row.cod_forn, row.titulo)
        months_by_key.setdefault(key, set()).add((due.year, due.month))
    return {key for key, months in months_by_key.items() if len(months) > 1}


def build_pr_analysis(batch: ReportBatch) -> dict:
    today = date.today()
    all_rows = list(PagarTitulo.objects.filter(batch=batch))
    prs = [r for r in all_rows if r.tipo.upper() == 'PR' and not r.pr_desconsiderada]
    non_prs = [r for r in all_rows if r.tipo.upper() != 'PR']
    ignored = [r for r in all_rows if r.tipo.upper() == 'PR' and r.pr_desconsiderada]
    recurring = _recurring_title_keys(non_prs)

    duplicates: list[dict] = []
    for pr in prs:
        dt_venc = parse_br_date(pr.vencimento) or parse_br_date(pr.vencimento_real)
        if not dt_venc:
            continue

        matches: list[PagarTitulo] = []
        for match in non_prs:
            if match.cod_forn != pr.cod_forn:
                continue
            match_due = parse_br_date(match.vencimento_real)
            if not match_due or match_due.year != dt_venc.year or match_due.month != dt_venc.month:
                continue
            emissao = parse_br_date(match.emissao)
            if emissao and emissao > today:
                continue
            if (match.cod_forn, match.titulo) in recurring:
                continue
            matches.append(match)

        if matches:
            item = _serialize_brief(pr)
            item['matches'] = [_serialize_brief(m) for m in matches]
            duplicates.append(item)

    return {
        'batchId': batch.id,
        'batchLabel': batch.label,
        'totalPrs': len(prs),
        'totalDuplicates': len(duplicates),
        'duplicates': duplicates,
        'ignored': [_serialize_brief(row) for row in ignored],
    }


from .pr_ignore_service import apply_pr_action
