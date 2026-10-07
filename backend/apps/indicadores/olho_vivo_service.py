"""Indicador Olho vivo na estrada — recorrência mensal por filial da frota."""

from __future__ import annotations

from apps.accounts.constants import branches_for_module
from apps.frota.models import RespostaOlhoVivo
from apps.frota.olho_vivo import ANO_MINIMO, COMPORTAMENTOS, ano_maximo, validar_ano

MESES = (
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
)


def build_olho_vivo_indicador_payload(params) -> dict:
    ano_informado = params.get('ano')
    ano = validar_ano(ano_informado) if ano_informado not in (None, '') else ano_maximo()

    filial_filtro = (params.get('filial') or '').strip()
    filiais = branches_for_module('Frota')
    if filial_filtro and filial_filtro not in filiais:
        raise ValueError('Filial não faz parte da frota.')
    consulta = [filial_filtro] if filial_filtro else filiais

    respostas = (
        RespostaOlhoVivo.objects.filter(
            ano=ano,
            periodicidade=RespostaOlhoVivo.PERIODICIDADE_MENSAL,
            filial__in=consulta,
        )
        .prefetch_related('itens')
    )
    por_periodo: dict[tuple[str, int], dict[str, int]] = {}
    for resposta in respostas:
        if resposta.mes is None:
            continue
        por_periodo[(resposta.filial, resposta.mes)] = {
            item.comportamento: item.recorrencia for item in resposta.itens.all()
        }

    filiais_payload = [_filial_payload(nome, por_periodo) for nome in consulta]
    totais = {chave: 0 for chave, _ in COMPORTAMENTOS}
    for bloco in filiais_payload:
        for item in bloco['itens']:
            totais[item['comportamento']] += item['recorrencia']

    destaque = None
    if any(bloco['mesesRespondidos'] for bloco in filiais_payload):
        chave, recorrencia = max(
            totais.items(),
            key=lambda par: (par[1], -_ordem(par[0])),
        )
        destaque = {
            'key': chave,
            'label': _rotulo(chave),
            'recorrencia': recorrencia,
        }

    return {
        'ano': ano,
        'anoMinimo': ANO_MINIMO,
        'anoMaximo': ano_maximo(),
        'filial': filial_filtro or None,
        'filiaisDisponiveis': filiais,
        'comportamentos': [{'key': chave, 'label': rotulo} for chave, rotulo in COMPORTAMENTOS],
        'filiais': filiais_payload,
        'resumo': {
            'total': sum(bloco['total'] for bloco in filiais_payload),
            'mesesRespondidos': sum(bloco['mesesRespondidos'] for bloco in filiais_payload),
            'comportamentoDestaque': destaque,
        },
    }


def _filial_payload(filial: str, por_periodo: dict[tuple[str, int], dict[str, int]]) -> dict:
    totais = {chave: 0 for chave, _ in COMPORTAMENTOS}
    meses = []
    respondidos = 0
    for mes in range(1, 13):
        salvos = por_periodo.get((filial, mes))
        respondido = salvos is not None
        itens = []
        total_mes = 0
        for chave, _ in COMPORTAMENTOS:
            if not respondido:
                itens.append({'comportamento': chave, 'recorrencia': None})
                continue
            recorrencia = int(salvos.get(chave, 0))
            totais[chave] += recorrencia
            total_mes += recorrencia
            itens.append({'comportamento': chave, 'recorrencia': recorrencia})
        if respondido:
            respondidos += 1
        meses.append({
            'mes': mes,
            'nome': MESES[mes - 1],
            'respondido': respondido,
            'total': total_mes if respondido else None,
            'itens': itens,
        })
    return {
        'filial': filial,
        'mesesRespondidos': respondidos,
        'total': sum(totais.values()),
        'itens': [
            {'comportamento': chave, 'recorrencia': totais[chave]}
            for chave, _ in COMPORTAMENTOS
        ],
        'meses': meses,
    }


def _rotulo(chave: str) -> str:
    for item, rotulo in COMPORTAMENTOS:
        if item == chave:
            return rotulo
    return chave


def _ordem(chave: str) -> int:
    for indice, (item, _) in enumerate(COMPORTAMENTOS):
        if item == chave:
            return indice
    return len(COMPORTAMENTOS)
