"""Indicador Meta de Faturamento — espelha os cálculos da planilha
FATURAMENTO 2026.xlsx usando os lançamentos de `BillingRecord` do Financeiro.

Não altera o módulo Financeiro: apenas leitura agregada + metas cadastradas
em `MetaFaturamentoMensal`.
"""

from __future__ import annotations

import calendar
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.financeiro.billing_import_service import BILLING_BRANCHES
from apps.financeiro.models import BillingRecord

from .models import MetaFaturamentoMensal

_ZERO = Decimal('0')
_CENT = Decimal('0.01')

# Fretes = filiais de emissão; Armazém fica separado (como col. H da planilha).
_FRETE_BRANCHES = ('Ibiporã', 'Rondonópolis', 'Barueri', 'Paranaguá')
_ARMAZEM_BRANCH = 'Armazém'

_MESES_ABREV = [
    '', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]
_MESES_NOME = [
    '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]


def _money(value) -> float:
    if value is None:
        return 0.0
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return float(value.quantize(_CENT, rounding=ROUND_HALF_UP))


def _pct_vs_meta(realizado: Decimal, meta: Decimal) -> float | None:
    """(real/meta - 1) em percentual; None se meta zerada."""
    if not meta:
        return None
    return round(float((realizado / meta) - 1) * 100, 2)


def _pct_share(parte: Decimal, total: Decimal) -> float:
    if not total:
        return 0.0
    return round(float(parte / total) * 100, 1)


def _variacao_ano_anterior(atual: Decimal, anterior: Decimal) -> float | None:
    if not anterior:
        return None
    return round(float((atual / anterior) - 1) * 100, 2)


def _is_weekday(d: date) -> bool:
    """Seg–sex (equivalente a WEEKDAY Excel ≠ 1 e ≠ 7 no retorno padrão)."""
    return d.weekday() < 5


def networkdays(start: date, end: date) -> int:
    """NETWORKDAYS(start, end) sem feriados — como F44 da planilha (holidays≈irrelevante)."""
    if end < start:
        return 0
    count = 0
    d = start
    while d <= end:
        if _is_weekday(d):
            count += 1
        d += timedelta(days=1)
    return count


def _month_bounds(ano: int, mes: int) -> tuple[date, date]:
    last = calendar.monthrange(ano, mes)[1]
    return date(ano, mes, 1), date(ano, mes, last)


def _parse_ano(params) -> int:
    raw = params.get('ano') or params.get('year')
    if raw in (None, ''):
        return timezone.localdate().year
    try:
        ano = int(raw)
    except (TypeError, ValueError) as exc:
        raise ValueError('Parâmetro "ano" inválido.') from exc
    if ano < 2000 or ano > 2100:
        raise ValueError('Parâmetro "ano" fora do intervalo permitido.')
    return ano


def _parse_mes(params) -> int | None:
    raw = params.get('mes') or params.get('month')
    if raw in (None, ''):
        return None
    try:
        mes = int(raw)
    except (TypeError, ValueError) as exc:
        raise ValueError('Parâmetro "mes" inválido.') from exc
    if mes < 1 or mes > 12:
        raise ValueError('Parâmetro "mes" deve estar entre 1 e 12.')
    return mes


def _metas_por_mes(ano: int) -> dict[int, Decimal]:
    rows = MetaFaturamentoMensal.objects.filter(ano=ano).values_list('mes', 'valor')
    return {int(mes): (valor or _ZERO) for mes, valor in rows}


def _billing_by_day(ano: int, mes: int | None = None) -> dict[date, dict[str, Decimal]]:
    """Soma value por (data, filial)."""
    qs = BillingRecord.objects.filter(reference_date__year=ano)
    if mes:
        qs = qs.filter(reference_date__month=mes)
    agg = (
        qs.values('reference_date', 'branch')
        .annotate(total=Sum('value'))
    )
    by_day: dict[date, dict[str, Decimal]] = defaultdict(lambda: defaultdict(lambda: _ZERO))
    for row in agg:
        by_day[row['reference_date']][row['branch']] = row['total'] or _ZERO
    return by_day


def _billing_month_totals(ano: int) -> dict[int, dict[str, Decimal]]:
    """Totais mensais por filial no ano."""
    qs = (
        BillingRecord.objects.filter(reference_date__year=ano)
        .annotate(mes_ref=TruncMonth('reference_date'))
        .values('mes_ref', 'branch')
        .annotate(total=Sum('value'))
    )
    out: dict[int, dict[str, Decimal]] = defaultdict(lambda: defaultdict(lambda: _ZERO))
    for row in qs:
        mes = row['mes_ref'].month
        out[mes][row['branch']] = row['total'] or _ZERO
    return out


def _total_receita(por_filial: dict[str, Decimal]) -> Decimal:
    return sum((por_filial.get(b, _ZERO) for b in BILLING_BRANCHES), _ZERO)


def _total_fretes(por_filial: dict[str, Decimal]) -> Decimal:
    return sum((por_filial.get(b, _ZERO) for b in _FRETE_BRANCHES), _ZERO)


def _filial_breakdown(por_filial: dict[str, Decimal]) -> list[dict]:
    total = _total_receita(por_filial)
    items = []
    for branch in BILLING_BRANCHES:
        valor = por_filial.get(branch, _ZERO)
        items.append({
            'filial': branch,
            'valor': _money(valor),
            'percentual': _pct_share(valor, total),
            'isArmazem': branch == _ARMAZEM_BRANCH,
        })
    return items


def _empty_por_filial() -> dict[str, Decimal]:
    return {b: _ZERO for b in BILLING_BRANCHES}


def _as_of_day(ano: int, mes: int) -> date:
    today = timezone.localdate()
    start, end = _month_bounds(ano, mes)
    if today.year == ano and today.month == mes:
        return today
    if (today.year, today.month) < (ano, mes):
        return start
    return end


def _build_serie_mensal(ano: int, metas: dict[int, Decimal]) -> list[dict]:
    atuais = _billing_month_totals(ano)
    anteriores = _billing_month_totals(ano - 1)
    today = timezone.localdate()

    serie = []
    meta_acum = _ZERO
    real_acum = _ZERO
    real_ant_acum = _ZERO

    for mes in range(1, 13):
        meta_mes = metas.get(mes, _ZERO)
        meta_acum += meta_mes

        por_filial = atuais.get(mes) or _empty_por_filial()
        # Normaliza chaves
        filled = _empty_por_filial()
        for k, v in por_filial.items():
            if k in filled:
                filled[k] = v
        real_mes = _total_receita(filled)
        real_acum += real_mes

        ant_filled = _empty_por_filial()
        for k, v in (anteriores.get(mes) or {}).items():
            if k in ant_filled:
                ant_filled[k] = v
        real_ant = _total_receita(ant_filled)
        real_ant_acum += real_ant

        start, end = _month_bounds(ano, mes)
        dias_uteis = networkdays(start, end)
        meta_dia = (meta_mes / Decimal(dias_uteis)) if dias_uteis else _ZERO

        # "Até o dia" só faz sentido até o mês corrente; meses futuros ficam zerados no gap YTD.
        if (ano, mes) > (today.year, today.month):
            dias_uteis_decorridos = 0
            real_ate_dia = _ZERO
            meta_ate_dia = _ZERO
        else:
            as_of = _as_of_day(ano, mes)
            dias_uteis_decorridos = networkdays(start, as_of)
            meta_ate_dia = meta_dia * Decimal(dias_uteis_decorridos)
            # No consolidado mensal, realizado do mês completo (meses passados) ou parcial (mês atual)
            if (ano, mes) < (today.year, today.month):
                real_ate_dia = real_mes
                meta_ate_dia = meta_mes  # mês fechado: meta cheia
            else:
                # mês corrente: soma dias até as_of
                by_day = _billing_by_day(ano, mes)
                real_ate_dia = _ZERO
                d = start
                while d <= as_of:
                    real_ate_dia += _total_receita(by_day.get(d, {}))
                    d += timedelta(days=1)

        serie.append({
            'mes': mes,
            'ano': ano,
            'label': f'{_MESES_ABREV[mes]}/{ano}',
            'nomeMes': _MESES_NOME[mes],
            'meta': _money(meta_mes),
            'metaAcumulada': _money(meta_acum),
            'realizado': _money(real_mes),
            'realizadoAcumulado': _money(real_acum),
            'realizadoAnoAnterior': _money(real_ant),
            'realizadoAnoAnteriorAcumulado': _money(real_ant_acum),
            'diasUteis': dias_uteis,
            'diasUteisDecorridos': dias_uteis_decorridos,
            'metaDia': _money(meta_dia),
            'metaAteDia': _money(meta_ate_dia),
            'realizadoAteDia': _money(real_ate_dia),
            'gapMetaMes': _money(real_mes - meta_mes),
            'gapMetaAteDia': _money(real_ate_dia - meta_ate_dia),
            'percentualVsMeta': _pct_vs_meta(real_mes, meta_mes),
            'percentualVsMetaAcumulada': _pct_vs_meta(real_acum, meta_acum),
            'variacaoAnoAnterior': _variacao_ano_anterior(real_mes, real_ant),
            'metaSuperada': bool(meta_mes and real_mes >= meta_mes),
            'porFilial': _filial_breakdown(filled),
            'totalFretes': _money(_total_fretes(filled)),
            'armazem': _money(filled.get(_ARMAZEM_BRANCH, _ZERO)),
        })
    return serie


def _sum_meses(totais: dict[int, dict[str, Decimal]], mes_ate: int) -> Decimal:
    """Soma receita total dos meses 1..mes_ate (exclusive do mês atual quando mes_ate=mes-1)."""
    total = _ZERO
    for m in range(1, mes_ate + 1):
        filled = _empty_por_filial()
        for k, v in (totais.get(m) or {}).items():
            if k in filled:
                filled[k] = v
        total += _total_receita(filled)
    return total


def _build_serie_diaria(ano: int, mes: int, metas: dict[int, Decimal]) -> dict:
    """Série diária no formato da planilha FATURAMENTO (aba do mês).

    Colunas-chave (como na planilha):
    - Total Fretes / RND-Armazém / Receita do dia
    - Acumulado no mês (ano atual e anterior)
    - Acumulado no ano: META 01/jan até o dia, REAL ano, REAL ano-1
    - Real × meta até hoje: valor, %, OBS
    """
    start, end = _month_bounds(ano, mes)
    by_day = _billing_by_day(ano, mes)
    by_day_ant = _billing_by_day(ano - 1, mes)
    totais_ano = _billing_month_totals(ano)
    totais_ant = _billing_month_totals(ano - 1)

    # Meta acumulada dos meses anteriores (= H6 do mês anterior na planilha)
    meta_meses_anteriores = sum((metas.get(m, _ZERO) for m in range(1, mes)), _ZERO)
    real_antes = _sum_meses(totais_ano, mes - 1) if mes > 1 else _ZERO
    real_ant_antes = _sum_meses(totais_ant, mes - 1) if mes > 1 else _ZERO

    meta_mes = metas.get(mes, _ZERO)
    dias_uteis = networkdays(start, end)
    meta_dia = (meta_mes / Decimal(dias_uteis)) if dias_uteis else _ZERO

    serie = []
    acum_mes = _ZERO
    acum_mes_ant = _ZERO
    acum_uteis = 0
    tot_ibipora = tot_rondonopolis = tot_barueri = tot_paranagua = _ZERO
    tot_fretes = tot_armazem = tot_receita = _ZERO

    d = start
    while d <= end:
        por = by_day.get(d, {})
        filled = _empty_por_filial()
        for k, v in por.items():
            if k in filled:
                filled[k] = v

        ibipora = filled.get('Ibiporã', _ZERO)
        rondonopolis = filled.get('Rondonópolis', _ZERO)
        barueri = filled.get('Barueri', _ZERO)
        paranagua = filled.get('Paranaguá', _ZERO)
        fretes = _total_fretes(filled)
        armazem = filled.get(_ARMAZEM_BRANCH, _ZERO)
        receita = fretes + armazem

        acum_mes += receita
        # REAL ano = meses anteriores + acumulado no mês (M na planilha)
        real_ano = real_antes + acum_mes

        if _is_weekday(d):
            acum_uteis += 1
        # L = meta_dia * dias_úteis_no_mês + meta acumulada até o mês anterior
        meta_ano_ate_dia = (
            (meta_dia * Decimal(acum_uteis) + meta_meses_anteriores)
            if acum_uteis <= dias_uteis else _ZERO
        )

        try:
            d_ant = date(ano - 1, mes, d.day)
            ant_raw = by_day_ant.get(d_ant, {})
        except ValueError:
            ant_raw = {}
        ant_filled = _empty_por_filial()
        for k, v in ant_raw.items():
            if k in ant_filled:
                ant_filled[k] = v
        receita_ant = _total_receita(ant_filled)
        acum_mes_ant += receita_ant
        real_ano_ant = real_ant_antes + acum_mes_ant

        gap = real_ano - meta_ano_ate_dia
        pct = _pct_vs_meta(real_ano, meta_ano_ate_dia)
        if meta_ano_ate_dia and pct is not None:
            obs = 'ACIMA DA META' if pct > 0 else 'ABAIXO DA META'
        else:
            obs = ''

        tot_ibipora += ibipora
        tot_rondonopolis += rondonopolis
        tot_barueri += barueri
        tot_paranagua += paranagua
        tot_fretes += fretes
        tot_armazem += armazem
        tot_receita += receita

        serie.append({
            'data': d.isoformat(),
            'dia': d.day,
            'diaUtilAcumulado': acum_uteis,
            'isDiaUtil': _is_weekday(d),
            'ibipora': _money(ibipora),
            'rondonopolis': _money(rondonopolis),
            'barueri': _money(barueri),
            'paranagua': _money(paranagua),
            'totalFretes': _money(fretes),
            'armazem': _money(armazem),
            'receitaDia': _money(receita),
            'acumuladoMes': _money(acum_mes),
            'acumuladoMesAnoAnterior': _money(acum_mes_ant),
            'metaAnoAteDia': _money(meta_ano_ate_dia),
            'realizadoAno': _money(real_ano),
            'realizadoAnoAnteriorAcumulado': _money(real_ano_ant),
            'gapMetaAnoAteDia': _money(gap),
            'percentualVsMetaAnoAteDia': pct,
            'observacao': obs,
            # aliases legados / resumo
            'acumuladoAno': _money(real_ano),
            'metaAteDia': _money(meta_ano_ate_dia),
            'gapMetaAteDia': _money(gap),
            'realizadoAnoAnterior': _money(receita_ant),
            'porFilial': _filial_breakdown(filled),
        })
        d += timedelta(days=1)

    # TOTAL: somas das filiais; acumulados/meta = último valor do mês (LARGE da planilha)
    ultimo = serie[-1] if serie else None
    totais = {
        'ibipora': _money(tot_ibipora),
        'rondonopolis': _money(tot_rondonopolis),
        'barueri': _money(tot_barueri),
        'paranagua': _money(tot_paranagua),
        'totalFretes': _money(tot_fretes),
        'armazem': _money(tot_armazem),
        'receitaDia': _money(tot_receita),
        'acumuladoMes': ultimo['acumuladoMes'] if ultimo else 0.0,
        'acumuladoMesAnoAnterior': ultimo['acumuladoMesAnoAnterior'] if ultimo else 0.0,
        'metaAnoAteDia': ultimo['metaAnoAteDia'] if ultimo else 0.0,
        'realizadoAno': ultimo['realizadoAno'] if ultimo else 0.0,
        'realizadoAnoAnteriorAcumulado': ultimo['realizadoAnoAnteriorAcumulado'] if ultimo else 0.0,
        'gapMetaAnoAteDia': ultimo['gapMetaAnoAteDia'] if ultimo else 0.0,
        'percentualVsMetaAnoAteDia': ultimo['percentualVsMetaAnoAteDia'] if ultimo else None,
        'observacao': ultimo['observacao'] if ultimo else '',
    }

    # Participação % de cada filial no acumulado do mês (linha % da planilha)
    shares = {
        'ibipora': _pct_share(tot_ibipora, tot_receita) if tot_receita else 0.0,
        'rondonopolis': _pct_share(tot_rondonopolis, tot_receita) if tot_receita else 0.0,
        'barueri': _pct_share(tot_barueri, tot_receita) if tot_receita else 0.0,
        'paranagua': _pct_share(tot_paranagua, tot_receita) if tot_receita else 0.0,
        'totalFretes': _pct_share(tot_fretes, tot_receita) if tot_receita else 0.0,
        'armazem': _pct_share(tot_armazem, tot_receita) if tot_receita else 0.0,
        'variacaoMesAnoAnterior': _variacao_ano_anterior(
            Decimal(str(totais['acumuladoMes'])),
            Decimal(str(totais['acumuladoMesAnoAnterior'])),
        ),
        'variacaoAnoAnterior': _variacao_ano_anterior(
            Decimal(str(totais['realizadoAno'])),
            Decimal(str(totais['realizadoAnoAnteriorAcumulado'])),
        ),
    }

    return {
        'dias': serie,
        'totais': totais,
        'participacao': shares,
        'metaMesesAnteriores': _money(meta_meses_anteriores),
        'metaDia': _money(meta_dia),
        'diasUteis': dias_uteis,
    }


def build_meta_faturamento_payload(params) -> dict:
    ano = _parse_ano(params)
    mes = _parse_mes(params)
    metas = _metas_por_mes(ano)
    meta_ano = sum(metas.get(m, _ZERO) for m in range(1, 13))
    serie_mensal = _build_serie_mensal(ano, metas)

    today = timezone.localdate()
    mes_ref = mes if mes else (today.month if today.year == ano else 12)
    if today.year != ano:
        mes_ref = mes if mes else 12

    ponto_mes = next((p for p in serie_mensal if p['mes'] == mes_ref), serie_mensal[-1])
    # Acumulados até o mês de referência
    pontos_ate = [p for p in serie_mensal if p['mes'] <= mes_ref]
    real_ytd = Decimal(str(pontos_ate[-1]['realizadoAcumulado'])) if pontos_ate else _ZERO
    meta_ytd = Decimal(str(pontos_ate[-1]['metaAcumulada'])) if pontos_ate else _ZERO
    real_ant_ytd = Decimal(str(pontos_ate[-1]['realizadoAnoAnteriorAcumulado'])) if pontos_ate else _ZERO

    real_mes = Decimal(str(ponto_mes['realizado']))
    meta_mes = Decimal(str(ponto_mes['meta']))

    anos_billing = {d.year for d in BillingRecord.objects.dates('reference_date', 'year')}
    anos_meta = set(MetaFaturamentoMensal.objects.values_list('ano', flat=True).distinct())
    anos_disponiveis = sorted(anos_billing | anos_meta | {ano, today.year}, reverse=True)

    payload = {
        'meta': {
            'ano': ano,
            'mes': mes,
            'mesReferencia': mes_ref,
            'nomeMesReferencia': _MESES_NOME[mes_ref],
            'filiais': list(BILLING_BRANCHES),
            'anosDisponiveis': anos_disponiveis,
            'temMetasCadastradas': bool(metas),
        },
        'summary': {
            'metaMes': _money(meta_mes),
            'realizadoMes': _money(real_mes),
            'gapMetaMes': _money(real_mes - meta_mes),
            'percentualVsMetaMes': _pct_vs_meta(real_mes, meta_mes),
            'metaSuperadaMes': bool(meta_mes and real_mes >= meta_mes),
            'diasUteis': ponto_mes['diasUteis'],
            'diasUteisDecorridos': ponto_mes['diasUteisDecorridos'],
            'metaDia': ponto_mes['metaDia'],
            'metaAteDia': ponto_mes['metaAteDia'],
            'realizadoAteDia': ponto_mes['realizadoAteDia'],
            'gapMetaAteDia': ponto_mes['gapMetaAteDia'],
            'metaAcumulada': _money(meta_ytd),
            'realizadoAcumulado': _money(real_ytd),
            'gapMetaAcumulada': _money(real_ytd - meta_ytd),
            'percentualVsMetaAcumulada': _pct_vs_meta(real_ytd, meta_ytd),
            'metaAno': _money(meta_ano),
            'percentualMetaAno': _pct_share(real_ytd, meta_ano) if meta_ano else 0.0,
            'realizadoAnoAnterior': ponto_mes['realizadoAnoAnterior'],
            'realizadoAnoAnteriorAcumulado': _money(real_ant_ytd),
            'variacaoAnoAnterior': _variacao_ano_anterior(real_mes, Decimal(str(ponto_mes['realizadoAnoAnterior']))),
            'variacaoAnoAnteriorAcumulada': _variacao_ano_anterior(real_ytd, real_ant_ytd),
            'totalFretes': ponto_mes['totalFretes'],
            'armazem': ponto_mes['armazem'],
            'porFilial': ponto_mes['porFilial'],
        },
        'seriesMensal': serie_mensal,
        'serieDiaria': (
            _build_serie_diaria(ano, mes, metas)
            if mes
            else {'dias': [], 'totais': None, 'participacao': None, 'metaMesesAnteriores': 0.0, 'metaDia': 0.0, 'diasUteis': 0}
        ),
    }
    return payload
