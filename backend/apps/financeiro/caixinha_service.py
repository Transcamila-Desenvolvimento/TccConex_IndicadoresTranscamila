from decimal import Decimal

from django.db.models import Case, DecimalField, F, Sum, Value, When

from .models import CaixinhaLancamento

ENTRADA = 'Entrada'
SAIDA = 'Saída'
TIPOS = (ENTRADA, SAIDA)

_MONEY = DecimalField(max_digits=14, decimal_places=2)


def _somar(qs) -> tuple[Decimal, Decimal, Decimal]:
    agg = qs.aggregate(
        entradas=Sum(
            Case(
                When(movement_type=ENTRADA, then=F('value')),
                default=Value(0),
                output_field=_MONEY,
            )
        ),
        saidas=Sum(
            Case(
                When(movement_type=SAIDA, then=F('value')),
                default=Value(0),
                output_field=_MONEY,
            )
        ),
    )
    entradas = agg['entradas'] or Decimal('0')
    saidas = agg['saidas'] or Decimal('0')
    return entradas, saidas, entradas - saidas


def totais(exclude_pk=None) -> tuple[Decimal, Decimal, Decimal]:
    qs = CaixinhaLancamento.objects.all()
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    return _somar(qs)


def montar_extrato(start, end) -> dict:
    """Extrato do cofre no intervalo, sem misturar com o fluxo de caixa."""
    _, _, saldo_anterior = _somar(CaixinhaLancamento.objects.filter(reference_date__lt=start))
    movimentos = CaixinhaLancamento.objects.filter(
        reference_date__gte=start,
        reference_date__lte=end,
    ).order_by('reference_date', 'id')

    saldo = saldo_anterior
    entradas = Decimal('0')
    saidas = Decimal('0')
    linhas = []
    for item in movimentos:
        if item.movement_type == ENTRADA:
            saldo += item.value
            entradas += item.value
        else:
            saldo -= item.value
            saidas += item.value
        linhas.append({
            'id': item.pk,
            'date': item.reference_date.isoformat(),
            'type': item.movement_type,
            'value': item.value,
            'description': item.description,
            'user': item.created_by,
            'saldo': saldo,
        })

    return {
        'startDate': start.isoformat(),
        'endDate': end.isoformat(),
        'saldoAnterior': saldo_anterior,
        'totalEntradas': entradas,
        'totalSaidas': saidas,
        'saldoFinal': saldo,
        'lancamentos': linhas,
    }


def saldo_apos(tipo: str, valor, exclude_pk=None) -> Decimal:
    _, _, saldo = totais(exclude_pk)
    valor = Decimal(valor)
    if tipo == ENTRADA:
        return saldo + valor
    return saldo - valor
