"""Consulta de CTE/documento na base da Fatura por bipagem.

A base vem da última importação do relatório. A relação montada na tela não é persistida.
"""

from __future__ import annotations

import re

from django.db.models import CharField, F, Func, Q
from django.utils import timezone

from .models import BipagemDocumento, BipagemImportacao


class _DoctoSemZeros(Func):
    """Tira zeros à esquerda para o leitor e o relatório usarem o mesmo número."""

    template = "LTRIM(%(expressions)s, '0')"
    output_field = CharField()


_LIMITE = 50


def importacao_atual():
    return BipagemImportacao.objects.order_by('-importado_em', '-id').first()


def resumo_lote(importacao):
    if not importacao:
        return None
    atualizado = timezone.localtime(importacao.importado_em) if importacao.importado_em else None
    return {
        'label': importacao.arquivo or 'Importação',
        'referenceDate': atualizado.date().isoformat() if atualizado else '',
        'updatedAt': atualizado.isoformat() if atualizado else None,
    }


def candidatos_codigo(codigo: str) -> list[str]:
    """Variações do código lido pelo aparelho USB (número puro ou com prefixo)."""
    texto = (codigo or '').strip()
    if not texto or len(texto) > 80:
        return []
    vistos: list[str] = []

    def add(valor: str):
        item = (valor or '').strip()
        if item and item not in vistos and len(item) <= 50:
            vistos.append(item)

    add(texto)
    if re.fullmatch(r'\d+', texto):
        add(texto.lstrip('0'))
        return vistos
    grupos = re.findall(r'\d{3,}', texto)
    if len(grupos) == 1:
        add(grupos[0])
        add(grupos[0].lstrip('0'))
    return vistos


def listar_base(search: str = '', cod_cliente: str = ''):
    """Documentos da base importada.

    Com cliente informado, a base fica restrita a ele: a relação de faturamento é de um cliente só.
    """
    importacao = importacao_atual()
    if not importacao:
        return importacao, BipagemDocumento.objects.none()
    qs = BipagemDocumento.objects.filter(importacao=importacao)
    cliente = (cod_cliente or '').strip()
    if cliente:
        qs = qs.filter(cod_cliente=cliente)
    termo = (search or '').strip()
    if termo:
        qs = qs.filter(
            Q(origem__icontains=termo)
            | Q(cod_cliente__icontains=termo)
            | Q(cliente__icontains=termo)
            | Q(loja__icontains=termo)
            | Q(docto__icontains=termo)
            | Q(notas__icontains=termo)
        )
    return importacao, qs.order_by('origem', 'loja', 'docto', 'id')


def buscar_documentos(codigo: str):
    importacao = importacao_atual()
    candidatos = candidatos_codigo(codigo)
    if not importacao or not candidatos:
        return importacao, []
    filtro = Q()
    for candidato in candidatos:
        filtro |= Q(docto__iexact=candidato)
    numeros = []
    for candidato in candidatos:
        if candidato.isdigit():
            numero = candidato.lstrip('0')
            if numero and numero not in numeros:
                numeros.append(numero)
                filtro |= Q(docto_sem_zero__iexact=numero)
    rows = list(
        BipagemDocumento.objects.filter(importacao=importacao)
        .annotate(docto_sem_zero=_DoctoSemZeros(F('docto')))
        .filter(filtro)
        .order_by('origem', 'loja', 'docto', 'id')[:_LIMITE]
    )
    return importacao, rows


def separar_por_cliente(rows, cod_cliente: str = ''):
    """Separa o que pode entrar na relação do que é de outro cliente.

    Sem cliente travado, o primeiro cliente encontrado define a relação.
    """
    cliente = (cod_cliente or '').strip()
    if not cliente and rows:
        cliente = rows[0].cod_cliente
    permitidos = [row for row in rows if row.cod_cliente == cliente]
    outros = [row for row in rows if row.cod_cliente != cliente]
    return permitidos, outros


def serializar_documento(row: BipagemDocumento) -> dict:
    return {
        'id': str(row.id),
        'codCliente': row.cod_cliente,
        'loja': row.loja,
        'cliente': row.cliente,
        'origem': row.origem,
        'docto': row.docto,
        'emissao': row.emissao,
        'vencimento': row.vencimento,
        'total': f'{row.total:.2f}',
        'notas': row.notas,
        'fatura': row.fatura,
    }
