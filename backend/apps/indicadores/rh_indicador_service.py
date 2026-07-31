"""Indicador "Movimentação de RH": evolução mensal de quantitativo e folha
salarial a partir dos lotes de importação já existentes em apps.rh.

Cada `LoteMovimentacaoRH` é um snapshot mensal de colaboradores. Não existe
data de desligamento própria — admissões/desligamentos são inferidos
comparando o conjunto de CPFs de um lote com o do lote cronologicamente
anterior (mesma lógica usada em apps.rh.views.dashboard_summary), mas aqui
repetida para cada mês da série, não só para o último lote.
"""

from __future__ import annotations

from decimal import Decimal

from apps.rh.models import Colaborador, LoteMovimentacaoRH, MovimentacaoColaborador

_MESES_ABREV = [
    '', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

_CATEGORIAS_VALIDAS = ('ADMINISTRATIVO', 'OPERACIONAL', 'MOTORISTA')
_CATEGORIA_PARA_CHAVE = {
    'ADMINISTRATIVO': 'administrativo',
    'OPERACIONAL': 'operacional',
    'MOTORISTA': 'motorista',
}
_CHAVE_NAO_MAPEADO = 'naoMapeado'

# Sem filtro de período explícito, mostra só os últimos N lotes — evolução
# recente é o caso de uso principal; histórico completo fica disponível via
# filtro "De".
JANELA_PADRAO_MESES = 12


def _label(mes: int, ano: int) -> str:
    return f'{_MESES_ABREV[mes]}/{ano}'


def _chave_periodo(ano: int, mes: int) -> int:
    return ano * 12 + mes


def _parse_periodo(valor) -> tuple[int, int] | None:
    """Converte "YYYY-MM" em (ano, mes). Retorna None se ausente/inválido."""
    if not valor:
        return None
    partes = str(valor).strip().split('-')
    if len(partes) != 2:
        return None
    try:
        ano, mes = int(partes[0]), int(partes[1])
    except ValueError:
        return None
    if mes < 1 or mes > 12:
        return None
    return ano, mes


def _status_bucket() -> dict:
    return {'count': 0, 'payroll': Decimal('0')}


def _bucket_categoria() -> dict:
    return {
        'count': 0,
        'payroll': Decimal('0'),
        'ativos': _status_bucket(),
        'afastados': _status_bucket(),
    }


def _bucket_categorias() -> dict:
    return {
        'administrativo': _bucket_categoria(),
        'operacional': _bucket_categoria(),
        'motorista': _bucket_categoria(),
        'naoMapeado': _bucket_categoria(),
    }


def _is_afastado(situacao: str | None) -> bool:
    """Mesma regra do e-mail de RH: substring 'AFASTADO' na situação."""
    return bool(situacao) and 'AFASTADO' in situacao.upper()


def _bucket_com_percentual(bucket: dict, total: int) -> dict:
    resultado = {}
    for chave, valores in bucket.items():
        percentual = round((valores['count'] / total) * 100, 1) if total else 0.0
        resultado[chave] = {**valores, 'percentual': percentual}
    return resultado


def _colaboradores_filtrados(lote: LoteMovimentacaoRH, *, filial: str, categoria: str, excluidos: set[str]):
    qs = lote.colaboradores.exclude(cpf__in=excluidos)
    if filial:
        qs = qs.filter(filial=filial)
    if categoria:
        qs = qs.filter(categoria=categoria)
    return qs


def _variacao_percentual(atual, anterior):
    if not anterior:
        return None
    return round(float((atual - anterior) / anterior) * 100, 1)


def _empty_summary() -> dict:
    return {
        'totalColaboradores': 0,
        'payrollTotal': Decimal('0'),
        'salarioMedio': Decimal('0'),
        'admitidosPeriodo': 0,
        'desligadosPeriodo': 0,
        'turnoverPercentual': 0.0,
        'variacaoHeadcountPercentual': None,
        'variacaoPayrollPercentual': None,
        'porCategoriaAtual': _bucket_com_percentual(_bucket_categorias(), 0),
    }


def build_rh_movimentacao_payload(params) -> dict:
    filial = (params.get('filial') or '').strip()
    categoria = (params.get('categoria') or '').strip().upper()
    if categoria not in _CATEGORIAS_VALIDAS:
        categoria = ''

    todos_lotes = list(LoteMovimentacaoRH.objects.order_by('ano', 'mes'))
    lotes_disponiveis = [
        {'mes': lote.mes, 'ano': lote.ano, 'label': _label(lote.mes, lote.ano)}
        for lote in todos_lotes
    ]
    filiais_disponiveis = sorted({
        f for f in MovimentacaoColaborador.objects
        .exclude(filial__isnull=True).exclude(filial='')
        .values_list('filial', flat=True).distinct()
    })

    meta_base = {
        'filiaisDisponiveis': filiais_disponiveis,
        'lotesDisponiveis': lotes_disponiveis,
    }

    if not todos_lotes:
        return {
            'meta': {**meta_base, 'periodoInicio': None, 'periodoFim': None},
            'summary': _empty_summary(),
            'series': [],
        }

    inicio = _parse_periodo(params.get('start'))
    fim = _parse_periodo(params.get('end'))

    lotes_periodo = todos_lotes
    if fim:
        fim_chave = _chave_periodo(*fim)
        lotes_periodo = [l for l in lotes_periodo if _chave_periodo(l.ano, l.mes) <= fim_chave]
    if inicio:
        inicio_chave = _chave_periodo(*inicio)
        lotes_periodo = [l for l in lotes_periodo if _chave_periodo(l.ano, l.mes) >= inicio_chave]
    if not inicio and not fim:
        lotes_periodo = lotes_periodo[-JANELA_PADRAO_MESES:]

    if not lotes_periodo:
        return {
            'meta': {**meta_base, 'periodoInicio': None, 'periodoFim': None},
            'summary': _empty_summary(),
            'series': [],
        }

    # Mapa lote -> lote cronologicamente anterior (pode estar fora do período
    # filtrado — necessário para calcular corretamente admitidos/desligados
    # do primeiro ponto da série exibida).
    lote_anterior_por_id: dict[int, LoteMovimentacaoRH | None] = {}
    for indice, lote in enumerate(todos_lotes):
        lote_anterior_por_id[lote.id] = todos_lotes[indice - 1] if indice > 0 else None

    excluidos = set(
        Colaborador.objects.filter(desconsiderado=True).values_list('cpf', flat=True)
    )

    series = []
    for lote in lotes_periodo:
        colaboradores_lote = list(
            _colaboradores_filtrados(lote, filial=filial, categoria=categoria, excluidos=excluidos)
        )
        cpfs_atual = {c.cpf for c in colaboradores_lote}

        lote_ant = lote_anterior_por_id.get(lote.id)
        if lote_ant is not None:
            cpfs_anterior = set(
                _colaboradores_filtrados(lote_ant, filial=filial, categoria=categoria, excluidos=excluidos)
                .values_list('cpf', flat=True)
            )
            admitidos = len(cpfs_atual - cpfs_anterior)
            desligados = len(cpfs_anterior - cpfs_atual)
        else:
            # Primeiro lote da história — não há base de comparação.
            admitidos = 0
            desligados = 0

        bucket = _bucket_categorias()
        payroll_total = Decimal('0')
        for c in colaboradores_lote:
            chave = _CATEGORIA_PARA_CHAVE.get((c.categoria or '').upper(), _CHAVE_NAO_MAPEADO)
            salario = c.salario or Decimal('0')
            bucket[chave]['count'] += 1
            bucket[chave]['payroll'] += salario
            status = 'afastados' if _is_afastado(c.situacao) else 'ativos'
            bucket[chave][status]['count'] += 1
            bucket[chave][status]['payroll'] += salario
            payroll_total += salario

        series.append({
            'mes': lote.mes,
            'ano': lote.ano,
            'label': _label(lote.mes, lote.ano),
            'headcount': len(colaboradores_lote),
            'payroll': payroll_total,
            'admitidos': admitidos,
            'desligados': desligados,
            'porCategoria': bucket,
        })

    primeiro, ultimo = series[0], series[-1]
    total_colaboradores = ultimo['headcount']
    payroll_total_atual = ultimo['payroll']
    salario_medio = (payroll_total_atual / total_colaboradores) if total_colaboradores else Decimal('0')

    admitidos_periodo = sum(p['admitidos'] for p in series)
    desligados_periodo = sum(p['desligados'] for p in series)
    headcount_medio = sum(p['headcount'] for p in series) / len(series)
    turnover_percentual = round((desligados_periodo / headcount_medio) * 100, 1) if headcount_medio else 0.0

    summary = {
        'totalColaboradores': total_colaboradores,
        'payrollTotal': payroll_total_atual,
        'salarioMedio': round(salario_medio, 2),
        'admitidosPeriodo': admitidos_periodo,
        'desligadosPeriodo': desligados_periodo,
        'turnoverPercentual': turnover_percentual,
        'variacaoHeadcountPercentual': (
            _variacao_percentual(ultimo['headcount'], primeiro['headcount']) if len(series) > 1 else None
        ),
        'variacaoPayrollPercentual': (
            _variacao_percentual(ultimo['payroll'], primeiro['payroll']) if len(series) > 1 else None
        ),
        'porCategoriaAtual': _bucket_com_percentual(ultimo['porCategoria'], total_colaboradores),
    }

    return {
        'meta': {**meta_base, 'periodoInicio': primeiro['label'], 'periodoFim': ultimo['label']},
        'summary': summary,
        'series': series,
    }
