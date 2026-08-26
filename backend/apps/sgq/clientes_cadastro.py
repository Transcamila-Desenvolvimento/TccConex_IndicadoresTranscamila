"""Clientes disponíveis na pesquisa de satisfação a partir do cadastro mestre."""

from __future__ import annotations

from .models import PesquisaSatisfacao


def clientes_pesquisa_ativos() -> list[str]:
    from apps.faturamento.models import ClienteProtocolo

    nomes = [
        (cliente.nome_interno or cliente.nome or '').strip()
        for cliente in ClienteProtocolo.objects.filter(considerar_pesquisa_satisfacao=True)
    ]
    ordered: list[str] = []
    seen: set[str] = set()
    for nome in nomes:
        if not nome or nome.casefold() in seen:
            continue
        seen.add(nome.casefold())
        ordered.append(nome)
    return ordered


def cliente_pesquisa_permitido(valor: str, *, valor_atual: str = '', permitir_outros: bool = False) -> bool:
    texto = (valor or '').strip()
    if not texto:
        return False
    if valor_atual and texto.casefold() == valor_atual.strip().casefold():
        return True
    if texto.casefold() == 'outros':
        return permitir_outros
    permitidos = {item.casefold() for item in clientes_pesquisa_ativos()}
    return texto.casefold() in permitidos


def opcoes_cliente_pesquisa(*, incluir_historico: bool = False, valor_atual: str = '') -> list[dict]:
    opcoes = clientes_pesquisa_ativos()
    seen = {item.casefold() for item in opcoes}
    extra: list[str] = []
    atual = (valor_atual or '').strip()
    if atual and atual.casefold() not in seen:
        extra.append(atual)
        seen.add(atual.casefold())
    if incluir_historico:
        for nome in PesquisaSatisfacao.objects.exclude(cliente='').values_list('cliente', flat=True).distinct():
            nome = (nome or '').strip()
            if nome and nome.casefold() not in seen:
                extra.append(nome)
                seen.add(nome.casefold())
    return [{'value': nome, 'label': nome} for nome in [*opcoes, *extra]]
