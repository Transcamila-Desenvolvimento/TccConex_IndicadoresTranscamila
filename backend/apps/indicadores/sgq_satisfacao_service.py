"""Indicador de Satisfação dos Clientes — consolida pesquisas do SGQ
(Ibiporã e Rondonópolis) com filtro opcional de filial, sem depender da
sessão operacional do módulo SGQ."""

from collections import Counter, defaultdict

from django.db.models import Q
from django.db.models.functions import TruncMonth

from apps.accounts.constants import branches_for_module
from apps.audit.models import AuditLog
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


def build_sgq_satisfacao_payload(params) -> dict:
    sgq_filiais = branches_for_module('SGQ')
    filial = (params.get('filial') or '').strip()

    qs = PesquisaSatisfacao.objects.filter(filial__in=sgq_filiais)
    if filial:
        qs = qs.filter(filial=filial) if filial in sgq_filiais else qs.none()

    # Listas de apoio respeitam a filial, mas não motorista/período — senão
    # os dropdowns colapsariam ao aplicar o próprio filtro.
    motoristas = _motoristas_disponiveis(qs)
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
            'anosDisponiveis': anos,
            'filial': filial or None,
        },
        **stats,
        'scoreMedio': score_medio,
        'totalRecusas': total_recusas,
        'porFilial': por_filial,
        'serieMensal': _build_serie_mensal(qs_avaliadas),
    }
