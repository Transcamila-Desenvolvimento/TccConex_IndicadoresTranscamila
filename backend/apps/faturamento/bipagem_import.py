"""Importação provisória da base da Fatura por bipagem (relatório Aging Luft em CSV)."""

from __future__ import annotations

import csv
import io
import re
import unicodedata
from decimal import Decimal, InvalidOperation

from django.db import transaction

from .models import BipagemDocumento, BipagemImportacao

MAX_BYTES = 20 * 1024 * 1024
MAX_LINHAS = 200_000

_COLUNAS = {
    'cod_cliente': ('cod.cliente', 'cod cliente', 'codcliente'),
    'loja': ('loja',),
    'cliente': ('cliente',),
    'origem': ('origem',),
    'docto': ('docto', 'documento'),
    'serie': ('serie/prefixo', 'serie'),
    'emissao': ('emissao',),
    'vencimento': ('vencto.', 'vencto', 'vencimento'),
    'total': ('total',),
    'notas': ('notas',),
    'fatura': ('pre-fatura', 'pre fatura', 'fatura'),
}
_OBRIGATORIAS = ('cod_cliente', 'docto', 'total')


class BipagemImportError(Exception):
    pass


def _chave(texto: str) -> str:
    nfd = unicodedata.normalize('NFD', (texto or '').strip().casefold())
    return ''.join(ch for ch in nfd if unicodedata.category(ch) != 'Mn')


def _decodificar(conteudo: bytes) -> str:
    for encoding in ('utf-8-sig', 'cp1252'):
        try:
            return conteudo.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise BipagemImportError('Não foi possível ler o arquivo. Exporte o relatório em CSV.')


def _numero(valor: str):
    texto = (valor or '').strip()
    if not texto:
        return None
    texto = texto.replace('.', '').replace(',', '.')
    try:
        return Decimal(texto)
    except InvalidOperation:
        return None


def _data(valor: str) -> str:
    texto = (valor or '').strip()
    return texto if re.fullmatch(r'\d{2}/\d{2}/\d{4}', texto) else ''


def _localizar_cabecalho(linhas: list[list[str]]):
    for posicao, linha in enumerate(linhas[:20]):
        chaves = [_chave(celula) for celula in linha]
        indices = {}
        for campo, nomes in _COLUNAS.items():
            indices[campo] = next((i for i, chave in enumerate(chaves) if chave in nomes), -1)
        if all(indices[campo] >= 0 for campo in _OBRIGATORIAS):
            return posicao, indices
    raise BipagemImportError(
        'Cabeçalho do relatório não encontrado. O CSV precisa das colunas Cod.Cliente, Docto e Total.'
    )


def _celula(linha: list[str], indice: int, limite: int) -> str:
    if indice < 0 or indice >= len(linha):
        return ''
    return ' '.join((linha[indice] or '').split())[:limite]


def importar_base_csv(conteudo: bytes, *, arquivo: str = '', usuario=None) -> dict:
    if not conteudo:
        raise BipagemImportError('Arquivo vazio.')
    if len(conteudo) > MAX_BYTES:
        raise BipagemImportError('Arquivo maior que 20 MB.')

    texto = _decodificar(conteudo)
    linhas = list(csv.reader(io.StringIO(texto), delimiter=';'))
    if len(linhas) > MAX_LINHAS:
        raise BipagemImportError('Arquivo com linhas demais para a base da bipagem.')
    cabecalho, idx = _localizar_cabecalho(linhas)

    documentos = []
    ignoradas = 0
    for linha in linhas[cabecalho + 1:]:
        if not any((celula or '').strip() for celula in linha):
            continue
        cod_cliente = _celula(linha, idx['cod_cliente'], 50)
        docto = _celula(linha, idx['docto'], 50)
        total = _numero(_celula(linha, idx['total'], 40))
        if not cod_cliente or not docto or total is None or _chave(cod_cliente) in _COLUNAS['cod_cliente']:
            ignoradas += 1
            continue
        documentos.append(BipagemDocumento(
            cod_cliente=cod_cliente,
            loja=_celula(linha, idx['loja'], 20),
            cliente=_celula(linha, idx['cliente'], 200),
            origem=_celula(linha, idx['origem'], 20),
            docto=docto,
            serie=_celula(linha, idx['serie'], 20),
            emissao=_data(_celula(linha, idx['emissao'], 20)),
            vencimento=_data(_celula(linha, idx['vencimento'], 20)),
            total=total,
            notas=_celula(linha, idx['notas'], 255),
            fatura=_celula(linha, idx['fatura'], 50),
        ))

    if not documentos:
        raise BipagemImportError('Nenhum documento válido encontrado no arquivo.')

    autor = usuario if usuario and getattr(usuario, 'is_authenticated', False) else None
    with transaction.atomic():
        BipagemImportacao.objects.all().delete()
        importacao = BipagemImportacao.objects.create(
            arquivo=(arquivo or '')[:255],
            linhas=len(documentos),
            importado_por=autor,
        )
        for documento in documentos:
            documento.importacao = importacao
        BipagemDocumento.objects.bulk_create(documentos, batch_size=1000)

    return {'importacao': importacao, 'linhas': len(documentos), 'ignoradas': ignoradas}
