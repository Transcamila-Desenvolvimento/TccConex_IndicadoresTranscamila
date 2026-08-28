"""Indicador de Satisfação dos Clientes — consolida pesquisas do SGQ
(Ibiporã e Rondonópolis) com filtro opcional de filial, sem depender da
sessão operacional do módulo SGQ."""

from collections import Counter, defaultdict

from django.db.models import Q
from django.db.models.functions import TruncMonth

from apps.accounts.constants import branches_for_module
from apps.audit.models import AuditLog
from apps.faturamento.models import chave_nome_cliente
from apps.sgq.clientes_cadastro import indice_cadastros_pesquisa, nome_exibicao_pesquisa
from apps.sgq.escopo_analise import format_escopo_analise_display, rotulos_escopo
from apps.sgq.models import CRITERIOS_AVALIACAO, PesquisaSatisfacao
from apps.sgq.pesquisa_query import filter_pesquisas_queryset
from apps.sgq.stats_service import build_pesquisa_stats

_SGQ_ACTIVITY_PREFIX = 'sgq.pesquisa.'
_SGQ_DRAFT_ACTIVITY_PREFIX = 'sgq.pesquisa.lote_draft'


def get_sgq_activity_version() -> int:
    """Marcador barato (id do AuditLog mais recente de pesquisa SGQ) para o
    frontend detectar, com polling leve, que precisa recarregar o indicador de
    Satisfação porque outro usuário lançou/alterou/excluiu pesquisas.

    Rascunhos de inclusão em tabela não entram — não afetam o cenário consolidado.
    """
    latest_id = (
        AuditLog.objects.filter(action__startswith=_SGQ_ACTIVITY_PREFIX)
        .exclude(action__startswith=_SGQ_DRAFT_ACTIVITY_PREFIX)
        .order_by('-id')
        .values_list('id', flat=True)
        .first()
    )
    return latest_id or 0

_CRITERIO_FIELDS = [field for field, _ in CRITERIOS_AVALIACAO]
_MESES_PT = (
    '', 'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez',
)
_SCORE_MAP = {'ruim': 1, 'regular': 2, 'bom': 3, 'otimo': 4}


def _score_medio_criterios(criterios: list[dict]) -> float | None:
    com_dados = [c for c in criterios if (c['otimo'] + c['bom'] + c['regular'] + c['ruim']) > 0]
    if not com_dados:
        return None
    return round(sum(c['score'] for c in com_dados) / len(com_dados), 2)


def _build_serie_mensal(qs) -> list[dict]:
    """Evolução mensal de pesquisas e % ótimo (por data de entrega)."""
    rows = list(
        qs.annotate(mes=TruncMonth('data_entrega'))
        .exclude(mes__isnull=True)
        .values('mes', *_CRITERIO_FIELDS)
    )
    por_mes: dict = defaultdict(list)
    for row in rows:
        por_mes[row['mes']].append(row)

    serie = []
    for mes in sorted(por_mes.keys()):
        grupo = por_mes[mes]
        totais = {'otimo': 0, 'bom': 0, 'regular': 0, 'ruim': 0}
        for row in grupo:
            for field in _CRITERIO_FIELDS:
                valor = row[field]
                if valor in totais:
                    totais[valor] += 1
        total_aval = sum(totais.values())
        pct_otimo = round((totais['otimo'] / total_aval) * 100, 1) if total_aval else 0.0
        score = (
            round(
                sum(_SCORE_MAP[k] * q for k, q in totais.items()) / total_aval,
                2,
            )
            if total_aval else 0.0
        )
        serie.append({
            'mes': mes.strftime('%Y-%m'),
            'label': f'{_MESES_PT[mes.month]}/{mes.year}',
            'totalPesquisas': len(grupo),
            'percentualOtimo': pct_otimo,
            'scoreMedio': score,
            'contagem': totais,
        })
    return serie


def _motoristas_disponiveis(qs) -> list[str]:
    """Grafias canônicas dos motoristas do recorte (sem filtrar pelo próprio motorista)."""
    variacoes: dict[str, Counter] = {}
    for nome in qs.exclude(motorista='').values_list('motorista', flat=True):
        nome = (nome or '').strip()
        if not nome:
            continue
        chave = nome.upper()
        variacoes.setdefault(chave, Counter())[nome] += 1
    return sorted(
        (contador.most_common(1)[0][0] for contador in variacoes.values()),
        key=str.upper,
    )


def _clientes_disponiveis(qs) -> list[str]:
    """Clientes do recorte com o nome atual do cadastro, sem duplicar grafia antiga."""
    indice = indice_cadastros_pesquisa()
    rotulos: dict[str, str] = {}
    for nome in qs.exclude(cliente='').values_list('cliente', flat=True):
        nome = (nome or '').strip()
        if not nome:
            continue
        rotulo = nome_exibicao_pesquisa(nome, indice) or nome
        chave = chave_nome_cliente(rotulo) or chave_nome_cliente(nome) or rotulo.casefold()
        rotulos[chave] = rotulo
    return sorted(rotulos.values(), key=str.casefold)


def _anos_disponiveis(qs) -> list[int]:
    """Anos com data de entrega no recorte (antes do filtro de período)."""
    anos = {
        d.year
        for d in qs.exclude(data_entrega__isnull=True).values_list('data_entrega', flat=True)
        if d
    }
    return sorted(anos, reverse=True)


def _q_sem_avaliacao() -> Q:
    """Sem avaliação = todos os critérios vazios.

    Pesquisas parciais (alguns critérios preenchidos) entram no total, mesmo
    que o flag cliente_recusou_assinar esteja marcado. O flag sozinho não
    define o KPI — o que importa é se há nota lançada.
    """
    vazios = Q()
    for field in _CRITERIO_FIELDS:
        vazios &= Q(**{field: ''})
    return vazios


def _qs_sem_avaliacao(qs):
    return qs.filter(_q_sem_avaliacao())


def _qs_com_avaliacao(qs):
    """Só pesquisas com pelo menos uma nota — em branco ficam fora dos KPIs."""
    return qs.exclude(_q_sem_avaliacao())


def _build_recorrencias_escopo(qs) -> list[dict]:
    """Conta opções gravadas nas pesquisas. Catálogo excluído/inativo não apaga o histórico."""
    escopo_labels, opcao_labels = rotulos_escopo()
    counters: dict[str, Counter] = defaultdict(Counter)

    for payload in qs.values_list('escopo_analise', flat=True):
        if not isinstance(payload, dict):
            continue
        for escopo, opcoes in payload.items():
            if not isinstance(opcoes, (list, tuple)):
                continue
            for opcao in opcoes:
                chave = str(opcao).strip()
                if chave:
                    counters[escopo][chave] += 1

    ordered = list(escopo_labels.keys())
    for escopo in counters:
        if escopo not in ordered:
            ordered.append(escopo)

    grupos = []
    for escopo in ordered:
        counts = counters.get(escopo)
        if not counts:
            continue
        labels_map = opcao_labels.get(escopo, {})
        itens = []
        seen = set()
        for chave in labels_map:
            total = counts.get(chave, 0)
            if total:
                itens.append({'chave': chave, 'label': labels_map[chave], 'total': total})
                seen.add(chave)
        for chave, total in counts.items():
            if chave not in seen and total:
                itens.append({'chave': chave, 'label': labels_map.get(chave, chave), 'total': total})
        if itens:
            grupos.append({
                'escopo': escopo,
                'label': escopo_labels.get(escopo, escopo),
                'total': sum(item['total'] for item in itens),
                'itens': itens,
            })
    return grupos


def build_sgq_satisfacao_payload(params) -> dict:
    sgq_filiais = branches_for_module('SGQ')
    filial = (params.get('filial') or '').strip()

    qs = PesquisaSatisfacao.objects.filter(filial__in=sgq_filiais)
    if filial:
        qs = qs.filter(filial=filial) if filial in sgq_filiais else qs.none()

    # Listas de apoio respeitam a filial, mas não motorista/período — senão
    # os dropdowns colapsariam ao aplicar o próprio filtro.
    motoristas = _motoristas_disponiveis(qs)
    clientes = _clientes_disponiveis(qs)
    anos = _anos_disponiveis(qs)

    qs = filter_pesquisas_queryset(qs, params)
    # Em branco/recusa contam só em totalRecusas — não entram em total, %, score nem gráficos.
    qs_avaliadas = _qs_com_avaliacao(qs)
    stats = build_pesquisa_stats(qs_avaliadas)

    total_recusas = _qs_sem_avaliacao(qs).count()
    score_medio = _score_medio_criterios(stats['criterios'])

    por_filial = []
    for nome in sgq_filiais:
        if filial and nome != filial:
            continue
        f_qs = _qs_com_avaliacao(
            filter_pesquisas_queryset(
                PesquisaSatisfacao.objects.filter(filial=nome),
                params,
            )
        )
        f_stats = build_pesquisa_stats(f_qs)
        por_filial.append({
            'filial': nome,
            'totalPesquisas': f_stats['totalPesquisas'],
            'totalAvaliacoes': f_stats['totalAvaliacoes'],
            'percentualOtimo': f_stats['percentual']['otimo'],
            'pontosAtencao': f_stats['pontosAtencao'],
            'scoreMedio': _score_medio_criterios(f_stats['criterios']),
            'contagem': f_stats['contagem'],
        })

    return {
        'meta': {
            'filiaisDisponiveis': sgq_filiais,
            'motoristasDisponiveis': motoristas,
            'clientesDisponiveis': clientes,
            'anosDisponiveis': anos,
            'filial': filial or None,
        },
        **stats,
        'scoreMedio': score_medio,
        'totalRecusas': total_recusas,
        'porFilial': por_filial,
        'serieMensal': _build_serie_mensal(qs_avaliadas),
        'recorrenciasEscopo': _build_recorrencias_escopo(qs),
    }


def _filtered_pesquisas_qs(params):
    sgq_filiais = branches_for_module('SGQ')
    filial = (params.get('filial') or '').strip()
    qs = PesquisaSatisfacao.objects.filter(filial__in=sgq_filiais)
    if filial:
        qs = qs.filter(filial=filial) if filial in sgq_filiais else qs.none()
    return filter_pesquisas_queryset(qs, params)


def serialize_sgq_satisfacao_detalhe(pesquisa: PesquisaSatisfacao, indice=None) -> dict:
    return {
        'id': str(pesquisa.pk),
        'filial': pesquisa.filial,
        'dataEntrega': pesquisa.data_entrega.isoformat() if pesquisa.data_entrega else None,
        'cliente': nome_exibicao_pesquisa(pesquisa.cliente, indice),
        'motorista': pesquisa.motorista,
        'cte': pesquisa.cte,
        'notaFiscal': pesquisa.nota_fiscal,
        'clienteRecusouAssinar': pesquisa.cliente_recusou_assinar,
        'prazoEntrega': pesquisa.prazo_entrega,
        'condicoesMercadoria': pesquisa.condicoes_mercadoria,
        'condicoesVeiculo': pesquisa.condicoes_veiculo,
        'apresentacaoMotorista': pesquisa.apresentacao_motorista,
        'atendimentoDispensado': pesquisa.atendimento_dispensado,
        'analise': pesquisa.analise or '',
        'escopoAnaliseTexto': format_escopo_analise_display(pesquisa.escopo_analise),
    }


def build_sgq_satisfacao_detalhes_qs(params):
    """Mesmo recorte do indicador (filiais SGQ + filtros), para a aba Detalhes."""
    return _filtered_pesquisas_qs(params)
