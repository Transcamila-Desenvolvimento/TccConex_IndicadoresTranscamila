"""Sanitização do rascunho de nova proposta comercial."""

from __future__ import annotations

from .models import (
    STATUS_PROPOSTA_APROVADA,
    STATUS_PROPOSTA_ENVIADA,
    STATUS_PROPOSTA_RASCUNHO,
    STATUS_PROPOSTA_RECUSADA,
    TIPO_PROPOSTA_ARMAZENAGEM,
    TIPO_PROPOSTA_TRANSPORTE_RODOVIARIO,
)

_STATUS = {
    STATUS_PROPOSTA_RASCUNHO,
    STATUS_PROPOSTA_ENVIADA,
    STATUS_PROPOSTA_APROVADA,
    STATUS_PROPOSTA_RECUSADA,
}
_FORMATOS = {'moeda', 'percentual', 'tonelada', 'quantidade'}
_ABAS = {'transferencia', 'distribuicao'}
_MAX_LINHAS = 80
_MAX_CONDICOES = 80


def _as_str(value, max_len=240):
    if value is None:
        return ''
    text = value.strip() if isinstance(value, str) else str(value).strip()
    return text[:max_len]


def _as_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'sim', 'yes'}
    return bool(value)


def _sanitize_condicao(raw):
    if not isinstance(raw, dict):
        return None
    rotulo = _as_str(raw.get('rotulo'), 120)
    valor = _as_str(raw.get('valor'), 800)
    if not rotulo and not valor:
        return None
    tipo = _as_str(raw.get('tipo'), 40)
    item = {'rotulo': rotulo, 'valor': valor}
    if tipo in {'frete', 'distribuicao', 'armazenagem'}:
        item['tipo'] = tipo
    return item


def _sanitize_linha(raw):
    if not isinstance(raw, dict):
        return None
    return {
        'origem': _as_str(raw.get('origem'), 120),
        'entrega': _as_str(raw.get('entrega'), 120),
        'veiculo': _as_str(raw.get('veiculo'), 80),
        'devolucaoContainer': _as_str(raw.get('devolucaoContainer') or raw.get('devolucao_container'), 120),
        'observacoes': _as_str(raw.get('observacoes'), 200),
        'peso': _as_str(raw.get('peso'), 40),
        'tarifaFrete': _as_str(raw.get('tarifaFrete') or raw.get('tarifa_frete'), 40),
        'pedagio': _as_str(raw.get('pedagio'), 40),
        'adValorem': _as_str(raw.get('adValorem') or raw.get('ad_valorem'), 20),
        'gris': _as_str(raw.get('gris'), 20),
        'icms': _as_str(raw.get('icms'), 40),
        'prazoDias': _as_str(raw.get('prazoDias') or raw.get('prazo_dias'), 20),
    }


def _linha_preenchida(linha):
    return any(str(linha.get(chave) or '').strip() for chave in linha)


def _sanitize_lista(fonte, sanitizer, limite):
    itens = []
    if not isinstance(fonte, list):
        return itens
    for raw in fonte:
        if len(itens) >= limite:
            break
        item = sanitizer(raw)
        if item:
            itens.append(item)
    return itens


def _sanitize_tabela(raw):
    if not isinstance(raw, dict):
        raw = {}

    def _itens(fonte, rotulo_key, valor_key, formato_padrao):
        linhas = []
        for item in fonte if isinstance(fonte, list) else []:
            if not isinstance(item, dict) or len(linhas) >= _MAX_CONDICOES:
                continue
            rotulo = _as_str(item.get(rotulo_key), 240)
            valor = _as_str(item.get(valor_key), 120)
            formato = _as_str(item.get('formato'), 20).lower()
            if formato not in _FORMATOS:
                formato = formato_padrao
            if not rotulo and not valor:
                continue
            linhas.append({rotulo_key: rotulo, valor_key: valor, 'formato': formato})
        return linhas

    return {
        'codigo': _as_str(raw.get('codigo'), 20) or 'AG',
        'local': _as_str(raw.get('local'), 80) or 'RONDONÓPOLIS-MT',
        'periodoInicio': '',
        'periodoFim': '',
        'unidade': _as_str(raw.get('unidade'), 8) or 'MT',
        'itens': _itens(raw.get('itens'), 'rotulo', 'valor', 'moeda'),
        'horaExtraTitulo': _as_str(raw.get('horaExtraTitulo'), 80) or 'Hora-extra (7)',
        'horaExtra': _itens(raw.get('horaExtra') or raw.get('hora_extra'), 'periodo', 'valor', 'tonelada'),
        'expediente': _as_str(raw.get('expediente'), 240),
    }


def sanitize_draft_payload(raw):
    if not isinstance(raw, dict):
        raw = {}
    form = raw.get('form') if isinstance(raw.get('form'), dict) else raw
    tipo = _as_str(form.get('tipo'), 40)
    if tipo in {'frete', 'transporte_container'}:
        tipo = TIPO_PROPOSTA_TRANSPORTE_RODOVIARIO
    if tipo not in {TIPO_PROPOSTA_TRANSPORTE_RODOVIARIO, TIPO_PROPOSTA_ARMAZENAGEM}:
        tipo = TIPO_PROPOSTA_TRANSPORTE_RODOVIARIO
    status = _as_str(form.get('status'), 20)
    if status not in _STATUS:
        status = STATUS_PROPOSTA_RASCUNHO
    aba = _as_str(raw.get('abaOperacao'), 20)
    if aba not in _ABAS:
        aba = 'transferencia'
    linhas = _sanitize_lista(form.get('linhas'), _sanitize_linha, _MAX_LINHAS) or [{
        'origem': '', 'entrega': '', 'veiculo': '', 'devolucaoContainer': '',
        'observacoes': '', 'peso': '', 'tarifaFrete': '', 'pedagio': '',
        'adValorem': '', 'gris': '', 'icms': '', 'prazoDias': '',
    }]
    return {
        'abaOperacao': aba,
        'form': {
            'tipo': tipo,
            'status': status,
            'clienteId': _as_str(form.get('clienteId') or form.get('cliente_id'), 40),
            'clienteNome': _as_str(form.get('clienteNome') or form.get('cliente_nome'), 200),
            'titulo': _as_str(form.get('titulo'), 200),
            'subtitulo': _as_str(form.get('subtitulo'), 240),
            'revisao': _as_str(form.get('revisao'), 10) or '01',
            'dataProposta': _as_str(form.get('dataProposta') or form.get('data_proposta'), 32),
            'propostaReferente': _as_str(form.get('propostaReferente') or form.get('proposta_referente'), 200),
            'responsavel': _as_str(form.get('responsavel'), 150),
            'reajuste': _as_str(form.get('reajuste'), 200),
            'att': _as_str(form.get('att'), 150),
            'validade': _as_str(form.get('validade'), 40),
            'vigencia': _as_str(form.get('vigencia'), 40),
            'faturamento': _as_str(form.get('faturamento'), 80),
            'localEmissao': _as_str(form.get('localEmissao') or form.get('local_emissao'), 120),
            'valorEstimado': _as_str(form.get('valorEstimado') or form.get('valor_estimado'), 40),
            'observacoes': _as_str(form.get('observacoes'), 2000),
            'incluiTransferencia': _as_bool(form.get('incluiTransferencia') or form.get('inclui_transferencia')),
            'incluiDistribuicao': _as_bool(form.get('incluiDistribuicao') or form.get('inclui_distribuicao')),
            'condicoes': _sanitize_lista(form.get('condicoes'), _sanitize_condicao, _MAX_CONDICOES),
            'condicoesTransferencia': _sanitize_lista(form.get('condicoesTransferencia'), _sanitize_condicao, _MAX_CONDICOES),
            'condicoesDistribuicao': _sanitize_lista(form.get('condicoesDistribuicao'), _sanitize_condicao, _MAX_CONDICOES),
            'tabelaArmazenagem': _sanitize_tabela(form.get('tabelaArmazenagem') or form.get('tabela_armazenagem')),
            'linhas': linhas,
        },
    }


def has_meaningful_draft(payload):
    if not payload:
        return False
    form = payload.get('form') if isinstance(payload.get('form'), dict) else payload
    if form.get('clienteId') or form.get('titulo') or form.get('observacoes') or form.get('propostaReferente'):
        return True
    if form.get('incluiTransferencia') or form.get('incluiDistribuicao'):
        return True
    if form.get('tipo') == TIPO_PROPOSTA_ARMAZENAGEM:
        return True
    if any(_linha_preenchida(item) for item in form.get('linhas') or []):
        return True
    tabela = form.get('tabelaArmazenagem') or {}
    for item in (tabela.get('itens') or []) + (tabela.get('horaExtra') or []):
        if str(item.get('valor') or '').strip():
            return True
    if form.get('condicoesTransferencia') or form.get('condicoesDistribuicao'):
        return True
    return False


def draft_payload(draft):
    empty = sanitize_draft_payload({})
    if draft is None:
        return {
            'version': 1,
            'updatedAt': None,
            'hasDraft': False,
            **empty,
        }
    payload = draft.payload if isinstance(draft.payload, dict) else {}
    sanitized = sanitize_draft_payload(payload)
    return {
        'version': draft.version,
        'updatedAt': draft.updated_at.isoformat(),
        'hasDraft': has_meaningful_draft(sanitized),
        **sanitized,
    }
