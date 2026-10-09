from datetime import datetime

from django.db import transaction
from django.db.models import Count, Q
from django.db.models.functions import Concat, Substr
from django.utils import timezone

from apps.financeiro.models import ReceberTitulo, ReportBatch

from .models import PagadorNd, TituloNd


def lote_receber_ativo():
    return (
        ReportBatch.objects.filter(is_active=True, imported_receber=True)
        .order_by('-reference_date', '-created_at')
        .first()
    )


def resumo_lote():
    lote = lote_receber_ativo()
    if not lote:
        return None
    return {'label': lote.label, 'referenceDate': lote.reference_date.isoformat()}


def _agrupar_pagadores(rows):
    agrupado = {}
    for row in rows:
        cod = (row['cod_cliente'] or '').strip()
        if not cod:
            continue
        nome = (row['cliente'] or '').strip()
        qtd = row['titulos']
        atual = agrupado.get(cod)
        if not atual:
            agrupado[cod] = {'codCliente': cod, 'nome': nome, 'titulos': qtd, 'maior': qtd}
            continue
        atual['titulos'] += qtd
        if nome and qtd >= atual['maior']:
            atual['nome'] = nome
            atual['maior'] = qtd
    return agrupado


def nomes_atuais_por_codigo(codigos):
    lote = lote_receber_ativo()
    if not lote or not codigos:
        return {}
    rows = (
        ReceberTitulo.objects.filter(batch=lote, cod_cliente__in=codigos)
        .values('cod_cliente', 'cliente')
        .annotate(titulos=Count('id'))
    )
    return {
        cod: item['nome']
        for cod, item in _agrupar_pagadores(rows).items()
    }


def aplicar_nomes_por_codigo(mapa):
    if not mapa:
        return
    for pagador in PagadorNd.objects.filter(cod_cliente__in=mapa):
        nome = mapa.get(pagador.cod_cliente) or ''
        if nome and nome != pagador.nome:
            pagador.nome = nome
            pagador.save(update_fields=['nome'])
    for cod, nome in mapa.items():
        if nome:
            TituloNd.objects.filter(cod_cliente=cod).exclude(cliente=nome).update(cliente=nome)


def pagadores_disponiveis(search=''):
    lote = lote_receber_ativo()
    if not lote:
        return []
    qs = ReceberTitulo.objects.filter(batch=lote).exclude(cod_cliente='')
    term = (search or '').strip()
    if term:
        qs = qs.filter(Q(cliente__icontains=term) | Q(cod_cliente__icontains=term))
    rows = qs.values('cod_cliente', 'cliente').annotate(titulos=Count('id'))
    itens = [
        {'codCliente': item['codCliente'], 'nome': item['nome'], 'titulos': item['titulos']}
        for item in _agrupar_pagadores(rows).values()
    ]
    itens.sort(key=lambda item: (item['nome'].casefold(), item['codCliente']))
    return itens


def codigos_selecionados():
    return list(PagadorNd.objects.order_by('nome', 'cod_cliente').values_list('cod_cliente', flat=True))


def pagadores_selecionados():
    aplicar_nomes_por_codigo(nomes_atuais_por_codigo(codigos_selecionados()))
    return [
        {'codCliente': pagador.cod_cliente, 'nome': pagador.nome}
        for pagador in PagadorNd.objects.order_by('nome', 'cod_cliente')
    ]


def salvar_pagadores(codigos, user):
    limpos = []
    vistos = set()
    for cod in codigos:
        texto = str(cod or '').strip()
        if not texto or len(texto) > 50 or texto in vistos:
            continue
        vistos.add(texto)
        limpos.append(texto)
    nomes = nomes_atuais_por_codigo(limpos)
    PagadorNd.objects.exclude(cod_cliente__in=limpos).delete()
    existentes = {
        pagador.cod_cliente: pagador
        for pagador in PagadorNd.objects.filter(cod_cliente__in=limpos)
    }
    autor = user if user and getattr(user, 'is_authenticated', False) else None
    novos = []
    for cod in limpos:
        nome = nomes.get(cod, '')
        atual = existentes.get(cod)
        if atual:
            if nome and nome != atual.nome:
                atual.nome = nome
                atual.save(update_fields=['nome'])
            continue
        novos.append(PagadorNd(cod_cliente=cod, nome=nome, criado_por=autor))
    if novos:
        PagadorNd.objects.bulk_create(novos)
    return pagadores_selecionados()


def chave_titulo(filial, cod_cliente, titulo) -> str:
    return '|'.join([
        (filial or '').strip(),
        (cod_cliente or '').strip(),
        (titulo or '').strip(),
    ])


def _data_br(valor: str):
    texto = (valor or '').strip()
    try:
        return datetime.strptime(texto, '%d/%m/%Y').date()
    except ValueError:
        return None


def situacao_do_titulo(titulo, hoje=None) -> str:
    if titulo.baixado:
        return 'baixado'
    data = _data_br(titulo.vencimento_real)
    referencia = hoje or timezone.localdate()
    if data and data < referencia:
        return 'vencido'
    return 'a_vencer'


def sincronizar_titulos(codigos):
    """Atualiza a cópia do Controle de NDs a partir do contas a receber ativo.

    O vínculo é o código do cliente. Só lê o fluxo de caixa. Título que
    saiu do relatório fica baixado; se voltar, deixa de estar baixado.
    """
    lote = lote_receber_ativo()
    if not lote or not codigos:
        return
    atuais = ReceberTitulo.objects.filter(batch=lote, cod_cliente__in=codigos)
    chaves_atuais = set()
    with transaction.atomic():
        for row in atuais:
            titulo = (row.titulo or '').strip()
            cod = (row.cod_cliente or '').strip()
            if not titulo or not cod:
                continue
            chave = chave_titulo(row.filial, cod, titulo)
            chaves_atuais.add(chave)
            TituloNd.objects.update_or_create(
                chave=chave,
                defaults={
                    'filial': row.filial,
                    'cod_cliente': cod,
                    'cliente': (row.cliente or '').strip(),
                    'titulo': titulo,
                    'natureza': row.natureza,
                    'emissao': row.emissao,
                    'vencimento_real': row.vencimento_real,
                    'saldo': row.saldo,
                    'historico': row.historico,
                    'baixado': False,
                },
            )
        pendentes = TituloNd.objects.filter(cod_cliente__in=codigos, baixado=False)
        if chaves_atuais:
            pendentes = pendentes.exclude(chave__in=chaves_atuais)
        pendentes.update(baixado=True)
        aplicar_nomes_por_codigo(nomes_atuais_por_codigo(codigos))


def _ordem_data_br(campo):
    """dd/mm/aaaa vira aaaammdd para ordenar a data, não o texto."""
    return Concat(Substr(campo, 7, 4), Substr(campo, 4, 2), Substr(campo, 1, 2))


_ORDEM_TITULOS = {
    'cod_cliente_asc': ('cod_cliente', 'id'),
    'cod_cliente_desc': ('-cod_cliente', '-id'),
    'cliente_asc': ('cliente', 'id'),
    'cliente_desc': ('-cliente', '-id'),
    'titulo_asc': ('titulo', 'id'),
    'titulo_desc': ('-titulo', '-id'),
    'natureza_asc': ('natureza', 'id'),
    'natureza_desc': ('-natureza', '-id'),
    'emissao_asc': ('emissao_ordem', 'id'),
    'emissao_desc': ('-emissao_ordem', '-id'),
    'vencimento_asc': ('vencimento_ordem', 'id'),
    'vencimento_desc': ('-vencimento_ordem', '-id'),
    'saldo_asc': ('saldo', 'id'),
    'saldo_desc': ('-saldo', '-id'),
    'historico_asc': ('historico', 'id'),
    'historico_desc': ('-historico', '-id'),
    'situacao_asc': ('baixado', 'vencimento_ordem', 'id'),
    'situacao_desc': ('-baixado', '-vencimento_ordem', '-id'),
}


def titulos_do_pagador(search='', ordering=''):
    codigos = codigos_selecionados()
    if not codigos:
        return TituloNd.objects.none()
    sincronizar_titulos(codigos)
    qs = TituloNd.objects.filter(cod_cliente__in=codigos)
    term = (search or '').strip()
    if term:
        qs = qs.filter(
            Q(cliente__icontains=term)
            | Q(cod_cliente__icontains=term)
            | Q(titulo__icontains=term)
            | Q(natureza__icontains=term)
            | Q(historico__icontains=term)
        )
    qs = qs.annotate(
        emissao_ordem=_ordem_data_br('emissao'),
        vencimento_ordem=_ordem_data_br('vencimento_real'),
    )
    campos = _ORDEM_TITULOS.get((ordering or '').strip(), _ORDEM_TITULOS['cliente_asc'])
    return qs.order_by(*campos)
