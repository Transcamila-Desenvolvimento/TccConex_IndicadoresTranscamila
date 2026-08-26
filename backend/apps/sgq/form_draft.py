"""Sanitização e helpers do rascunho do formulário de lançamento (SGQ)."""

from .escopo_analise import has_escopo_opcoes
from .lote_draft import _CRITERIOS_CAMEL, sanitize_draft_row

EMPTY_FORM = {
    'dataEntrega': '',
    'cliente': '',
    'motorista': '',
    'cte': '',
    'notaFiscal': '',
    'clienteRecusouAssinar': False,
    'prazoEntrega': '',
    'condicoesMercadoria': '',
    'condicoesVeiculo': '',
    'apresentacaoMotorista': '',
    'atendimentoDispensado': '',
    'analise': '',
    'escopoAnalise': {},
}


def sanitize_form_draft(raw) -> dict:
    if isinstance(raw, dict) and isinstance(raw.get('form'), dict):
        raw = raw['form']
    row = sanitize_draft_row(raw if isinstance(raw, dict) else {})
    return row or dict(EMPTY_FORM)


def has_meaningful_form_draft(payload: dict | None) -> bool:
    """Data de entrega sozinha não conta — o formulário pré-preenche a data de hoje."""
    if not payload:
        return False
    if payload.get('clienteRecusouAssinar'):
        return True
    if payload.get('cliente'):
        return True
    if payload.get('motorista') or payload.get('cte') or payload.get('notaFiscal') or payload.get('analise') or has_escopo_opcoes(payload.get('escopoAnalise')):
        return True
    if any(payload.get(camel) for camel in _CRITERIOS_CAMEL.values()):
        return True
    return False


def form_draft_payload(draft, filial: str) -> dict:
    if draft is None:
        return {
            'version': 1,
            'updatedAt': None,
            'filial': filial,
            'hasDraft': False,
            'form': dict(EMPTY_FORM),
        }
    form = draft.payload or dict(EMPTY_FORM)
    return {
        'version': draft.version,
        'updatedAt': draft.updated_at.isoformat(),
        'filial': draft.filial,
        'hasDraft': has_meaningful_form_draft(form),
        'form': form,
    }
