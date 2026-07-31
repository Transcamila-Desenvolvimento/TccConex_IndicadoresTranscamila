"""Sanitização e helpers do rascunho de inclusão em tabela (SGQ)."""

from .models import AVALIACAO_CHOICES, CLIENTE_CHOICES

_AVALIACOES = {key for key, _ in AVALIACAO_CHOICES} | {''}
_CLIENTES = {key for key, _ in CLIENTE_CHOICES}
_CRITERIOS_CAMEL = {
    'prazo_entrega': 'prazoEntrega',
    'condicoes_mercadoria': 'condicoesMercadoria',
    'condicoes_veiculo': 'condicoesVeiculo',
    'apresentacao_motorista': 'apresentacaoMotorista',
    'atendimento_dispensado': 'atendimentoDispensado',
}

MAX_DRAFT_ROWS = 200


def _as_str(value, max_len: int = 500) -> str:
    if value is None:
        return ''
    text = str(value).strip() if isinstance(value, str) else str(value)
    return text[:max_len]


def sanitize_draft_row(raw) -> dict | None:
    if not isinstance(raw, dict):
        return None

    cliente = raw.get('cliente')
    if cliente not in _CLIENTES:
        cliente = 'OUTROS'

    row = {
        'dataEntrega': _as_str(raw.get('dataEntrega'), 32),
        'cliente': cliente,
        'motorista': _as_str(raw.get('motorista'), 255),
        'cte': _as_str(raw.get('cte'), 50),
        'notaFiscal': _as_str(raw.get('notaFiscal'), 50),
        'clienteRecusouAssinar': bool(raw.get('clienteRecusouAssinar')),
        'analise': _as_str(raw.get('analise'), 5000),
    }

    for _source, camel in _CRITERIOS_CAMEL.items():
        valor = raw.get(camel, '')
        row[camel] = valor if isinstance(valor, str) and valor in _AVALIACOES else ''

    return row


def sanitize_draft_rows(raw_rows) -> list[dict]:
    if not isinstance(raw_rows, list):
        return []
    rows = []
    for item in raw_rows[:MAX_DRAFT_ROWS]:
        row = sanitize_draft_row(item)
        if row is not None:
            rows.append(row)
    return rows


def draft_row_is_empty(row: dict) -> bool:
    return not (
        row.get('motorista')
        or row.get('cte')
        or row.get('notaFiscal')
        or row.get('analise')
        or row.get('dataEntrega')
    )


def has_meaningful_draft(rows: list[dict]) -> bool:
    for row in rows:
        if not draft_row_is_empty(row):
            return True
        if row.get('clienteRecusouAssinar'):
            return True
        if any(row.get(camel) for camel in _CRITERIOS_CAMEL.values()):
            return True
    return False


def draft_payload(draft, filial: str) -> dict:
    if draft is None:
        return {
            'version': 1,
            'updatedAt': None,
            'filial': filial,
            'hasDraft': False,
            'rows': [],
        }
    return {
        'version': draft.version,
        'updatedAt': draft.updated_at.isoformat(),
        'filial': draft.filial,
        'hasDraft': has_meaningful_draft(draft.rows or []),
        'rows': draft.rows or [],
    }
