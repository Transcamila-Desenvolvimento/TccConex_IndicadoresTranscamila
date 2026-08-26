"""Catálogo e normalização do escopo da análise (SGQ)."""

from __future__ import annotations

import re
import unicodedata

ESCOPO_ANALISE_CHOICES = [
    ('prazo_entrega', 'Prazo de Entrega'),
    ('condicoes_mercadoria', 'Condições da Mercadoria'),
    ('condicoes_veiculo', 'Condições do Veículo'),
    ('apresentacao_motorista', 'Apresentação do Motorista'),
    ('atendimento_dispensado', 'Atendimento Dispensado'),
]

# Opções por escopo — chaves estáveis; o mesmo texto pode existir em mais de um escopo.
ESCOPO_ANALISE_CATALOGO: dict[str, list[tuple[str, str]]] = {
    'prazo_entrega': [
        ('entregas_dentro_prazo_contratual', 'Entregas dentro do prazo contratual'),
        ('cliente_recusou_informar_motivos', 'Cliente se recusou a informar os motivos'),
        ('entregas_fora_prazo_contratual', 'Entregas fora do prazo contratual'),
        ('motorista_recusou_ajudar_descarga', 'Motorista se recusou a ajudar na descarga'),
    ],
    'condicoes_mercadoria': [
        ('motorista_recusou_ajudar_descarga', 'Motorista se recusou a ajudar na descarga'),
        ('embalagens_sujas', 'Embalagens sujas'),
        ('embalagens_molhadas', 'Embalagens molhadas'),
        ('embalagens_amassadas_ou_rasgadas', 'Embalagens amassadas ou rasgadas'),
        ('produtos_tombaram_dos_pallets', 'Produtos tombaram dos pallets'),
        ('pallets_mal_estrechados', 'Pallets mal estrechados'),
        ('pallets_ma_qualidade_quebrados', 'Pallets de má qualidade — quebrados'),
        ('pallets_tombaram', 'Pallets tombaram'),
        ('produtos_com_vazamento', 'Produtos com vazamento'),
        ('produtos_faltando', 'Produtos faltando'),
        ('produtos_remontados_ou_empilhados', 'Produtos remontados ou empilhados'),
        ('produtos_divergencia_lotes', 'Produtos com divergência de lotes'),
        ('produtos_mal_acondicionados_veiculo', 'Produtos mal acondicionados no veículo'),
        ('cliente_marcou_tudo_ruim', 'Cliente marcou tudo ruim devido aos problemas'),
    ],
    'condicoes_veiculo': [
        ('cliente_marcou_tudo_ruim', 'Cliente marcou tudo ruim devido aos problemas'),
        ('dificuldade_abrir_carroceria', 'Dificuldade para abrir a carroceria'),
        ('irritado_demora_abrir_bau', 'Estava irritado com a demora em abrir o baú'),
        ('motorista_recusou_ajudar_descarga', 'Motorista se recusou a ajudar na descarga'),
        ('problemas_carroceria', 'Problemas na carroceria'),
        ('problemas_assoalho', 'Problemas no assoalho'),
        ('problemas_fueiro_carreta', 'Problemas no fueiro da carreta'),
        ('reclamacao_sider', 'Reclamação por sider'),
        ('reclamacao_bau', 'Reclamação por baú'),
        ('reclamacao_veiculo_bitrem', 'Reclamação por enviar veículo bitrem'),
        ('reclamacao_veiculo_graneleiro', 'Reclamação por enviar veículo graneleiro'),
        ('rua_apertada_dificuldade_manobrar', 'Rua apertada e dificuldade em manobrar o veículo'),
        ('veiculo_sujo', 'Veículo sujo'),
    ],
    'apresentacao_motorista': [
        ('cliente_marcou_tudo_ruim', 'Cliente marcou tudo ruim devido aos problemas'),
        ('motorista_chegou_horario_almoco', 'Motorista chegou perto do horário de almoço e não teve permissão para almoçar'),
        ('motorista_precisou_falar_supervisor', 'Motorista precisou falar com supervisor para liberar'),
        ('motorista_recusou_ajudar_descarga', 'Motorista se recusou a ajudar na descarga'),
        ('outros', 'Outros'),
    ],
    'atendimento_dispensado': [
        ('cliente_marcou_tudo_ruim_pallets', 'Cliente marcou tudo ruim devido aos problemas nos pallets'),
        ('motorista_recusou_ajudar_descarga', 'Motorista se recusou a ajudar na descarga'),
        ('outros', 'Outros'),
    ],
}

_CAMEL_TO_ESCOPO = {
    'prazoEntrega': 'prazo_entrega',
    'condicoesMercadoria': 'condicoes_mercadoria',
    'condicoesVeiculo': 'condicoes_veiculo',
    'apresentacaoMotorista': 'apresentacao_motorista',
    'atendimentoDispensado': 'atendimento_dispensado',
}


def _norm(value) -> str:
    text = str(value or '').strip().lower()
    text = unicodedata.normalize('NFD', text)
    text = ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn')
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def slugify_chave(label: str, existentes: set[str] | None = None) -> str:
    base = _norm(label).replace(' ', '_')[:80] or 'item'
    chave = base
    n = 2
    usados = existentes or set()
    while chave in usados:
        sufixo = f'_{n}'
        chave = f'{base[:80 - len(sufixo)]}{sufixo}'
        n += 1
    return chave


def _catalogo_fallback() -> tuple[list[tuple[str, str]], dict[str, list[tuple[str, str]]]]:
    return list(ESCOPO_ANALISE_CHOICES), {key: list(vals) for key, vals in ESCOPO_ANALISE_CATALOGO.items()}


def load_catalogo(*, ativos: bool = True) -> tuple[list[tuple[str, str]], dict[str, list[tuple[str, str]]]]:
    from django.db.utils import OperationalError, ProgrammingError

    from .models import EscopoAnalise

    try:
        qs = EscopoAnalise.objects.all().prefetch_related('opcoes').order_by('ordem', 'id')
        if ativos:
            qs = qs.filter(ativo=True)

        choices: list[tuple[str, str]] = []
        catalogo: dict[str, list[tuple[str, str]]] = {}
        for escopo in qs:
            opcoes = list(escopo.opcoes.all())
            if ativos:
                opcoes = [opcao for opcao in opcoes if opcao.ativo]
            opcoes.sort(key=lambda item: (item.ordem, item.id))
            choices.append((escopo.chave, escopo.label))
            catalogo[escopo.chave] = [(opcao.chave, opcao.label) for opcao in opcoes]
    except (OperationalError, ProgrammingError):
        return _catalogo_fallback()

    if choices:
        return choices, catalogo
    return _catalogo_fallback()


def seed_catalogo_padrao() -> None:
    from .models import EscopoAnalise, EscopoAnaliseOpcao

    for ordem, (chave, label) in enumerate(ESCOPO_ANALISE_CHOICES, start=1):
        escopo, _created = EscopoAnalise.objects.get_or_create(
            chave=chave,
            defaults={'label': label, 'ordem': ordem, 'ativo': True},
        )
        for idx, (opcao_chave, opcao_label) in enumerate(ESCOPO_ANALISE_CATALOGO.get(chave, []), start=1):
            EscopoAnaliseOpcao.objects.get_or_create(
                escopo=escopo,
                chave=opcao_chave,
                defaults={'label': opcao_label, 'ordem': idx, 'ativo': True},
            )


_CHAVE_RE = re.compile(r'^[a-z0-9_]{1,80}$')


def _is_chave(value: str) -> bool:
    return bool(_CHAVE_RE.fullmatch(str(value or '').strip()))


def rotulos_escopo() -> tuple[dict[str, str], dict[str, dict[str, str]]]:
    """Rótulos para histórico: legado hardcoded + catálogo atual (inclui inativos)."""
    escopo_labels = {key: label for key, label in ESCOPO_ANALISE_CHOICES}
    opcao_labels: dict[str, dict[str, str]] = {
        escopo: {chave: label for chave, label in opcoes}
        for escopo, opcoes in ESCOPO_ANALISE_CATALOGO.items()
    }
    choices, catalogo = load_catalogo(ativos=False)
    for key, label in choices:
        escopo_labels[key] = label
        destino = opcao_labels.setdefault(key, {})
        for opcao_chave, opcao_label in catalogo.get(key, []):
            destino[opcao_chave] = opcao_label
    return escopo_labels, opcao_labels


def opcao_usada_em_pesquisas(escopo_chave: str, opcao_chave: str) -> bool:
    from .models import PesquisaSatisfacao

    for payload in PesquisaSatisfacao.objects.exclude(escopo_analise={}).values_list('escopo_analise', flat=True):
        if not isinstance(payload, dict):
            continue
        opcoes = payload.get(escopo_chave) or []
        if isinstance(opcoes, (list, tuple)) and opcao_chave in [str(item) for item in opcoes]:
            return True
    return False


def escopo_usado_em_pesquisas(escopo_chave: str) -> bool:
    from .models import PesquisaSatisfacao

    for payload in PesquisaSatisfacao.objects.exclude(escopo_analise={}).values_list('escopo_analise', flat=True):
        if isinstance(payload, dict) and payload.get(escopo_chave):
            return True
    return False


def _opcoes_por_escopo(escopo: str, catalogo: dict[str, list[tuple[str, str]]] | None = None) -> dict[str, str]:
    fonte = catalogo if catalogo is not None else load_catalogo()[1]
    mapa = {key: label for key, label in ESCOPO_ANALISE_CATALOGO.get(escopo, [])}
    mapa.update({key: label for key, label in fonte.get(escopo, [])})
    return mapa


def _resolver_escopo(raw: str, choices: list[tuple[str, str]] | None = None) -> str:
    token = _norm(raw)
    aliases = {
        'prazo': 'prazo_entrega',
        'prazo de entrega': 'prazo_entrega',
        'prazo entrega': 'prazo_entrega',
        'prazo_entrega': 'prazo_entrega',
        'mercadoria': 'condicoes_mercadoria',
        'condicoes da mercadoria': 'condicoes_mercadoria',
        'condicoes mercadoria': 'condicoes_mercadoria',
        'condicoes_mercadoria': 'condicoes_mercadoria',
        'veiculo': 'condicoes_veiculo',
        'condicoes do veiculo': 'condicoes_veiculo',
        'condicoes veiculo': 'condicoes_veiculo',
        'condicoes_veiculo': 'condicoes_veiculo',
        'apresentacao': 'apresentacao_motorista',
        'apresentacao do motorista': 'apresentacao_motorista',
        'apresentacao motorista': 'apresentacao_motorista',
        'apresentacao_motorista': 'apresentacao_motorista',
        'atendimento': 'atendimento_dispensado',
        'atendimento dispensado': 'atendimento_dispensado',
        'atendimento_dispensado': 'atendimento_dispensado',
    }
    lista = list(choices if choices is not None else load_catalogo()[0])
    vistos = {key for key, _ in lista}
    for key, label in ESCOPO_ANALISE_CHOICES:
        if key not in vistos:
            lista.append((key, label))
            vistos.add(key)
    chaves = vistos
    mapped = aliases.get(token, '')
    if mapped in chaves:
        return mapped
    for key, label in lista:
        if token == _norm(key) or token == _norm(label):
            return key
    camel = _CAMEL_TO_ESCOPO.get(raw.strip(), '')
    return camel if camel in chaves else ''


def _resolver_opcao(escopo: str, raw: str, catalogo: dict[str, list[tuple[str, str]]] | None = None) -> str:
    token = _norm(raw)
    if not token:
        return ''
    mapa = _opcoes_por_escopo(escopo, catalogo)
    for key, label in mapa.items():
        if token == _norm(key) or token == _norm(label):
            return key
    return ''


def has_escopo_opcoes(payload: dict | None) -> bool:
    if not isinstance(payload, dict):
        return False
    return any(isinstance(v, list) and any(str(item).strip() for item in v) for v in payload.values())


def normalize_escopo_analise(raw) -> dict[str, list[str]]:
    """Aceita dict {escopo: [opcoes]}, string legado ou texto de planilha."""
    if not raw:
        return {}

    choices, catalogo = load_catalogo()
    chaves = {key for key, _ in choices} | {key for key, _ in ESCOPO_ANALISE_CHOICES}

    if isinstance(raw, dict):
        result: dict[str, list[str]] = {}
        for key, values in raw.items():
            escopo = key if key in chaves else _resolver_escopo(str(key), choices)
            if not escopo:
                raw_key = str(key).strip()
                if _is_chave(raw_key):
                    escopo = raw_key
                else:
                    continue
            items = values if isinstance(values, list) else [values]
            opcoes = []
            seen = set()
            mapa = _opcoes_por_escopo(escopo, catalogo)
            for item in items:
                opcao = item if item in mapa else _resolver_opcao(escopo, str(item), catalogo)
                if not opcao:
                    raw_item = str(item).strip()
                    opcao = raw_item if _is_chave(raw_item) else ''
                if opcao and opcao not in seen:
                    seen.add(opcao)
                    opcoes.append(opcao)
            if opcoes:
                result[escopo] = opcoes
        return result

    if isinstance(raw, list):
        return {}

    text = str(raw).strip()
    if not text:
        return {}

    result: dict[str, list[str]] = {}
    blocos = re.split(r'[|/\n]+', text)
    for bloco in blocos:
        bloco = bloco.strip()
        if not bloco:
            continue
        if ':' in bloco:
            escopo_raw, opcoes_raw = bloco.split(':', 1)
        else:
            escopo_raw, opcoes_raw = bloco, ''
        escopo = _resolver_escopo(escopo_raw, choices)
        if not escopo:
            continue
        opcoes = []
        seen = set()
        for part in re.split(r'[;,]+', opcoes_raw):
            opcao = _resolver_opcao(escopo, part, catalogo)
            if opcao and opcao not in seen:
                seen.add(opcao)
                opcoes.append(opcao)
        if opcoes:
            result[escopo] = opcoes
    return result


def format_escopo_analise_display(payload: dict | None) -> str:
    payload = payload if isinstance(payload, dict) else {}
    escopo_labels, opcao_labels = rotulos_escopo()
    ordered = list(escopo_labels.keys())
    for chave in payload:
        if chave not in ordered:
            ordered.append(chave)

    partes = []
    for escopo in ordered:
        opcoes = payload.get(escopo) or []
        if not isinstance(opcoes, (list, tuple)):
            continue
        labels_map = opcao_labels.get(escopo, {})
        labels = [labels_map.get(str(key), str(key)) for key in opcoes if str(key).strip()]
        if not labels:
            continue
        partes.append(f'{escopo_labels.get(escopo, escopo)}: {"; ".join(labels)}')
    return ' | '.join(partes)
