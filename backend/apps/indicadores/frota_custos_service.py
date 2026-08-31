"""Indicador de custos da frota — agrega manutenção + abastecimento por veículo."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Count, Max, Min, Sum

from apps.frota.models import (
    CustoAbastecimentoLinha,
    CustoFrotaLote,
    CustoManutencaoLinha,
    format_placa,
)

_ZERO = Decimal('0')
_CENT = Decimal('0.01')
_LITRO = Decimal('0.001')


def _dec(value) -> Decimal:
    if value is None:
        return _ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _money(value) -> float:
    return float(_dec(value).quantize(_CENT, rounding=ROUND_HALF_UP))


def _qty(value) -> float:
    return float(_dec(value).quantize(_LITRO, rounding=ROUND_HALF_UP))


def _rate(numerador, denominador) -> float | None:
    den = _dec(denominador)
    if den <= 0:
        return None
    return float((_dec(numerador) / den).quantize(_CENT, rounding=ROUND_HALF_UP))


def _parse_lote_id(params) -> int | None:
    raw = params.get('loteId') if hasattr(params, 'get') else None
    if raw in (None, '', 'all', 'todos'):
        raw = params.get('lote_id') if hasattr(params, 'get') else None
    if raw in (None, '', 'all', 'todos'):
        return None
    try:
        return int(raw)
    except (TypeError, ValueError) as exc:
        raise ValueError('loteId inválido.') from exc


def _lotes_payload(lotes) -> list[dict]:
    return [
        {
            'id': lote.id,
            'label': lote.label,
            'periodoInicio': lote.periodo_inicio.isoformat() if lote.periodo_inicio else None,
            'periodoFim': lote.periodo_fim.isoformat() if lote.periodo_fim else None,
            'isActive': lote.is_active,
        }
        for lote in lotes
    ]


def _empty_payload(*, lotes, filial: str) -> dict:
    return {
        'meta': {
            'loteId': None,
            'loteLabel': 'Todos os períodos',
            'periodoInicio': None,
            'periodoFim': None,
            'filial': filial or None,
            'lotes': _lotes_payload(lotes),
            'filiaisDisponiveis': [],
        },
        'summary': {
            'custoTotal': 0.0,
            'custoManutencao': 0.0,
            'custoAbastecimento': 0.0,
            'veiculosCount': 0,
            'mediaKmPorLitro': None,
            'kmTotal': None,
            'custoPorKm': None,
            'litragemTotal': 0.0,
        },
        'veiculos': [],
        'manutencaoPorTipo': [],
    }


def build_frota_custos_payload(params) -> dict:
    filial = (params.get('filial') or '').strip()
    lote_id = _parse_lote_id(params)
    lotes_list = list(CustoFrotaLote.objects.all().order_by('-periodo_inicio', '-created_at'))

    if lote_id is not None:
        selected = next((lote for lote in lotes_list if lote.id == lote_id), None)
        if selected is None:
            raise ValueError('Lote de custos não encontrado.')
        lote_ids = [selected.id]
        lote_label = selected.label
        periodo_inicio: date | None = selected.periodo_inicio
        periodo_fim: date | None = selected.periodo_fim
    else:
        lote_ids = [lote.id for lote in lotes_list]
        lote_label = 'Todos os períodos'
        if lotes_list:
            periodo_inicio = min(lote.periodo_inicio for lote in lotes_list)
            periodo_fim = max(lote.periodo_fim for lote in lotes_list)
        else:
            periodo_inicio = None
            periodo_fim = None

    if not lote_ids:
        return _empty_payload(lotes=lotes_list, filial=filial)

    manut_base = CustoManutencaoLinha.objects.filter(lote_id__in=lote_ids)
    abast_base = CustoAbastecimentoLinha.objects.filter(lote_id__in=lote_ids)
    filiais_disponiveis = sorted(
        filial_nome
        for filial_nome in {
            *manut_base.values_list('veiculo__filial', flat=True).distinct(),
            *abast_base.values_list('veiculo__filial', flat=True).distinct(),
        }
        if filial_nome
    )
    manut_qs = manut_base
    abast_qs = abast_base
    if filial:
        manut_qs = manut_qs.filter(veiculo__filial=filial)
        abast_qs = abast_qs.filter(veiculo__filial=filial)

    manut_agg = manut_qs.values(
        'veiculo_id',
        'veiculo__placa',
        'veiculo__marca',
        'veiculo__modelo',
        'veiculo__filial',
    ).annotate(total=Sum('valor_total'))

    abast_agg = abast_qs.values(
        'veiculo_id',
        'veiculo__placa',
        'veiculo__marca',
        'veiculo__modelo',
        'veiculo__filial',
    ).annotate(
        total=Sum('valor_total'),
        litros=Sum('litragem'),
        hod_min=Min('hodometro'),
        hod_max=Max('hodometro'),
        km_trecho=Sum('km_trecho'),
    )

    by_id: dict[int, dict] = defaultdict(lambda: {
        'custoManutencao': _ZERO,
        'custoAbastecimento': _ZERO,
        'litragem': _ZERO,
        'km': None,
        'placa': '',
        'marca': '',
        'modelo': '',
        'filial': '',
    })

    for item in manut_agg:
        row = by_id[item['veiculo_id']]
        row['placa'] = item['veiculo__placa']
        row['marca'] = item['veiculo__marca']
        row['modelo'] = item['veiculo__modelo']
        row['filial'] = item['veiculo__filial']
        row['custoManutencao'] = _dec(item['total'])

    for item in abast_agg:
        row = by_id[item['veiculo_id']]
        row['placa'] = item['veiculo__placa']
        row['marca'] = item['veiculo__marca']
        row['modelo'] = item['veiculo__modelo']
        row['filial'] = item['veiculo__filial']
        row['custoAbastecimento'] = _dec(item['total'])
        row['litragem'] = _dec(item['litros'])
        km_trecho = item['km_trecho']
        if km_trecho:
            row['km'] = int(km_trecho)
        else:
            hod_min = item['hod_min']
            hod_max = item['hod_max']
            if hod_min is not None and hod_max is not None and hod_max > hod_min:
                row['km'] = hod_max - hod_min

    veiculos_out = []
    custo_manut = _ZERO
    custo_abast = _ZERO
    km_total = 0
    litragem_total = _ZERO

    for veiculo_id, row in by_id.items():
        total = row['custoManutencao'] + row['custoAbastecimento']
        if total == _ZERO:
            continue
        custo_manut += row['custoManutencao']
        custo_abast += row['custoAbastecimento']
        litragem_total += row['litragem']
        km = row['km']
        if km:
            km_total += km
        litros = row['litragem']
        km_por_litro = _rate(km, litros) if km else None
        custo_por_km = _rate(total, km) if km else None
        veiculos_out.append({
            'veiculoId': veiculo_id,
            'placa': row['placa'],
            'placaExibicao': format_placa(row['placa']),
            'marca': row['marca'],
            'modelo': row['modelo'],
            'filial': row['filial'],
            'custoManutencao': _money(row['custoManutencao']),
            'custoAbastecimento': _money(row['custoAbastecimento']),
            'custoTotal': _money(total),
            'litragem': _qty(litros),
            'km': km,
            'kmPorLitro': km_por_litro,
            'custoPorKm': custo_por_km,
        })

    veiculos_out.sort(key=lambda item: item['placaExibicao'])
    custo_total = custo_manut + custo_abast
    count = len(veiculos_out)
    litros_com_km = sum(
        (_dec(item['litragem']) for item in veiculos_out if item['km'] and item['litragem']),
        _ZERO,
    )
    media_km_litro = _rate(km_total, litros_com_km)
    custo_por_km_geral = _rate(custo_total, km_total) if km_total else None

    for item in veiculos_out:
        item['percentualTotal'] = (
            round(float(Decimal(str(item['custoTotal'])) / custo_total * 100), 2)
            if custo_total
            else 0.0
        )

    tipos_agg = manut_qs.values('item').annotate(
        total=Sum('valor_total'),
        quantidade=Count('id'),
    )
    tipos_out = []
    for row in tipos_agg:
        valor = _dec(row['total'])
        if valor <= 0:
            continue
        item_nome = (row['item'] or '').strip() or 'Sem classificação'
        tipos_out.append({
            'item': item_nome,
            'label': item_nome,
            'valor': _money(valor),
            'quantidade': row['quantidade'],
            'percentual': round(float(valor / custo_manut * 100), 2) if custo_manut else 0.0,
        })
    tipos_out.sort(key=lambda row: (-row['valor'], row['label']))

    return {
        'meta': {
            'loteId': lote_id,
            'loteLabel': lote_label,
            'periodoInicio': periodo_inicio.isoformat() if periodo_inicio else None,
            'periodoFim': periodo_fim.isoformat() if periodo_fim else None,
            'filial': filial or None,
            'lotes': _lotes_payload(lotes_list),
            'filiaisDisponiveis': filiais_disponiveis,
        },
        'summary': {
            'custoTotal': _money(custo_total),
            'custoManutencao': _money(custo_manut),
            'custoAbastecimento': _money(custo_abast),
            'veiculosCount': count,
            'mediaKmPorLitro': media_km_litro,
            'kmTotal': km_total or None,
            'custoPorKm': custo_por_km_geral,
            'litragemTotal': _qty(litragem_total),
        },
        'veiculos': veiculos_out,
        'manutencaoPorTipo': tipos_out,
    }
