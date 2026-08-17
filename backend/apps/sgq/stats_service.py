"""Agregação de KPIs das pesquisas de satisfação — usada pelo SGQ operacional
e pelo indicador em Indicadores (visão consolidada por filial)."""

from django.db.models import Q

from .models import AVALIACAO_CHOICES, CRITERIOS_AVALIACAO

_AVALIACAO_KEYS = [key for key, _ in AVALIACAO_CHOICES]
_CRITERIO_FIELDS = [field for field, _ in CRITERIOS_AVALIACAO]
_SCORE_MAP = {'ruim': 1, 'regular': 2, 'bom': 3, 'otimo': 4}


def _q_sem_avaliacao() -> Q:
    """Pesquisa em branco = todos os critérios de avaliação vazios."""
    condition = Q()
    for field in _CRITERIO_FIELDS:
        condition &= Q(**{field: ''})
    return condition


def count_pesquisas_em_branco(qs) -> int:
    return qs.filter(_q_sem_avaliacao()).count()


def build_pesquisa_stats(qs) -> dict:
    """Calcula totais, percentuais e score por critério a partir de um queryset
    já filtrado de PesquisaSatisfacao."""
    pesquisas = list(qs.values(*_CRITERIO_FIELDS))
    total_pesquisas = len(pesquisas)

    totais = {key: 0 for key in _AVALIACAO_KEYS}
    criterios = []
    for field, label in CRITERIOS_AVALIACAO:
        contagem = {key: 0 for key in _AVALIACAO_KEYS}
        for row in pesquisas:
            valor = row[field]
            if valor in contagem:
                contagem[valor] += 1
                totais[valor] += 1
        respondidas = sum(contagem.values())
        score = (
            sum(_SCORE_MAP[key] * qtd for key, qtd in contagem.items()) / respondidas
            if respondidas else 0
        )
        criterios.append({
            'campo': field,
            'label': label,
            'otimo': contagem['otimo'],
            'bom': contagem['bom'],
            'regular': contagem['regular'],
            'ruim': contagem['ruim'],
            'score': round(score, 2),
        })

    total_avaliacoes = sum(totais.values())

    def pct(qtd: int) -> float:
        return round((qtd / total_avaliacoes) * 100, 2) if total_avaliacoes else 0.0

    return {
        'totalPesquisas': total_pesquisas,
        'totalAvaliacoes': total_avaliacoes,
        'contagem': {
            'otimo': totais['otimo'],
            'bom': totais['bom'],
            'regular': totais['regular'],
            'ruim': totais['ruim'],
        },
        'percentual': {
            'otimo': pct(totais['otimo']),
            'bom': pct(totais['bom']),
            'regular': pct(totais['regular']),
            'ruim': pct(totais['ruim']),
        },
        'pontosAtencao': totais['regular'] + totais['ruim'],
        'metaOtimo': 80,
        'criterios': criterios,
    }
