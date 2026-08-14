"""Configuração das metas mensais de faturamento (usada pelo indicador).

Persiste em `indicadores.MetaFaturamentoMensal`. A tela fica no ambiente Logística;
o realizado continua vindo dos `BillingRecord`.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from apps.indicadores.models import MetaFaturamentoMensal

_MESES_NOME = [
    '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]


def _parse_ano(raw) -> int:
    if raw in (None, ''):
        return timezone.localdate().year
    try:
        ano = int(raw)
    except (TypeError, ValueError) as exc:
        raise ValueError('Parâmetro "ano" inválido.') from exc
    if ano < 2000 or ano > 2100:
        raise ValueError('Parâmetro "ano" fora do intervalo permitido.')
    return ano


def _parse_valor(raw) -> Decimal:
    if raw in (None, ''):
        return Decimal('0')
    try:
        valor = Decimal(str(raw).replace(',', '.'))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError('Valor de meta inválido.') from exc
    if valor < 0:
        raise ValueError('A meta não pode ser negativa.')
    return valor.quantize(Decimal('0.01'))


def list_anos_disponiveis() -> list[int]:
    anos = set(MetaFaturamentoMensal.objects.values_list('ano', flat=True).distinct())
    anos.add(timezone.localdate().year)
    return sorted(anos, reverse=True)


def build_metas_ano_payload(ano: int) -> dict:
    existentes = {
        row.mes: row
        for row in MetaFaturamentoMensal.objects.filter(ano=ano)
    }
    meses = []
    total = Decimal('0')
    for mes in range(1, 13):
        row = existentes.get(mes)
        valor = row.valor if row else Decimal('0')
        total += valor
        meses.append({
            'id': row.id if row else None,
            'mes': mes,
            'nomeMes': _MESES_NOME[mes],
            'valor': float(valor),
        })
    return {
        'ano': ano,
        'meses': meses,
        'total': float(total),
        'anosDisponiveis': list_anos_disponiveis(),
    }


@transaction.atomic
def save_metas_ano(ano: int, meses_payload) -> dict:
    """Upsert das 12 metas do ano. Aceita lista parcial — meses omitidos ficam 0/criados."""
    if not isinstance(meses_payload, list):
        raise ValueError('Informe a lista "meses".')

    por_mes: dict[int, Decimal] = {m: Decimal('0') for m in range(1, 13)}
    for item in meses_payload:
        if not isinstance(item, dict):
            raise ValueError('Cada item de "meses" deve ser um objeto.')
        try:
            mes = int(item.get('mes'))
        except (TypeError, ValueError) as exc:
            raise ValueError('Campo "mes" inválido.') from exc
        if mes < 1 or mes > 12:
            raise ValueError('Campo "mes" deve estar entre 1 e 12.')
        por_mes[mes] = _parse_valor(item.get('valor'))

    for mes, valor in por_mes.items():
        MetaFaturamentoMensal.objects.update_or_create(
            ano=ano,
            mes=mes,
            defaults={'valor': valor},
        )

    return build_metas_ano_payload(ano)
