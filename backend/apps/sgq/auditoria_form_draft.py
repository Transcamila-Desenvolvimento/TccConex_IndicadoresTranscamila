"""Sanitização do rascunho de nova auditoria (SGQ)."""

from .serializers import limpar_texto_formatado

_STATUS = {'planejamento', 'execucao', 'concluida'}
_HTML = ('escopo', 'criterios', 'processosAreas', 'responsaveisProcessos', 'metodologia')
_HTML_MAX = 20_000

EMPTY_FORM = {
    'titulo': '',
    'categoria': '',
    'dataInicio': '',
    'dataTermino': '',
    'auditorLider': '',
    'auditores': [],
    'status': 'planejamento',
    'escopo': '',
    'criterios': '',
    'processosAreas': '',
    'responsaveisProcessos': '',
    'metodologia': '',
    'planejamento': [],
}


def _texto(valor, limite: int) -> str:
    if not isinstance(valor, str):
        return ''
    return valor.strip()[:limite]


def _data(valor) -> str:
    if not isinstance(valor, str) or len(valor) != 10:
        return ''
    ano, mes, dia = (valor.split('-') + ['', ''])[:3]
    if len(ano) == 4 and len(mes) == 2 and len(dia) == 2 and ano.isdigit() and mes.isdigit() and dia.isdigit():
        if 1 <= int(mes) <= 12 and 1 <= int(dia) <= 31:
            return valor
    return ''


def _hora(valor) -> str:
    if not isinstance(valor, str):
        return ''
    bruto = valor.strip()[:5]
    if len(bruto) != 5 or bruto[2] != ':':
        return ''
    hora, minuto = bruto.split(':')
    if hora.isdigit() and minuto.isdigit() and 0 <= int(hora) <= 23 and 0 <= int(minuto) <= 59:
        return f'{int(hora):02d}:{int(minuto):02d}'
    return ''


def _html(valor) -> str:
    if not isinstance(valor, str):
        return ''
    return limpar_texto_formatado(valor)[:_HTML_MAX]


def _planejamento(valor) -> list:
    if not isinstance(valor, list):
        return []
    itens = []
    for item in valor[:40]:
        if not isinstance(item, dict):
            continue
        itens.append({
            'data': _data(item.get('data')),
            'horaInicio': _hora(item.get('horaInicio')),
            'horaFim': _hora(item.get('horaFim')),
            'atividade': _texto(item.get('atividade'), 300),
        })
    return itens


def _auditores(valor) -> list:
    if not isinstance(valor, list):
        return []
    nomes = []
    vistos = set()
    for nome in valor:
        limpo = _texto(nome, 150)
        chave = limpo.casefold()
        if not limpo or chave in vistos:
            continue
        vistos.add(chave)
        nomes.append(limpo)
        if len(nomes) >= 30:
            break
    return nomes


def sanitize_auditoria_form_draft(raw) -> dict:
    if isinstance(raw, dict) and isinstance(raw.get('form'), dict):
        raw = raw['form']
    origem = raw if isinstance(raw, dict) else {}
    form = dict(EMPTY_FORM)
    form['titulo'] = _texto(origem.get('titulo'), 200)
    form['categoria'] = _texto(origem.get('categoria'), 120)
    form['dataInicio'] = _data(origem.get('dataInicio'))
    form['dataTermino'] = _data(origem.get('dataTermino'))
    form['auditorLider'] = _texto(origem.get('auditorLider'), 150)
    form['auditores'] = _auditores(origem.get('auditores'))
    status = origem.get('status')
    form['status'] = status if status in _STATUS else 'planejamento'
    for campo in _HTML:
        form[campo] = _html(origem.get(campo))
    form['planejamento'] = _planejamento(origem.get('planejamento'))
    return form


def _visivel(html: str) -> bool:
    texto = limpar_texto_formatado(html or '')
    return bool(texto.strip())


def has_meaningful_auditoria_form_draft(payload: dict | None) -> bool:
    if not payload:
        return False
    if any(payload.get(campo) for campo in ('titulo', 'categoria', 'dataInicio', 'dataTermino', 'auditorLider')):
        return True
    if payload.get('auditores'):
        return True
    if payload.get('status') not in ('', 'planejamento', None):
        return True
    if any(_visivel(payload.get(campo) or '') for campo in _HTML):
        return True
    for item in payload.get('planejamento') or []:
        if any(item.get(campo) for campo in ('data', 'horaInicio', 'horaFim', 'atividade')):
            return True
    return False


def auditoria_form_draft_payload(draft, filial: str) -> dict:
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
        'hasDraft': has_meaningful_auditoria_form_draft(form),
        'form': form,
    }
