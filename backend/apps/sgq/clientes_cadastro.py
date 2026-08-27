"""Clientes disponíveis na pesquisa de satisfação a partir do cadastro mestre."""

from __future__ import annotations

from apps.faturamento.models import ClienteProtocolo

from .models import PesquisaSatisfacao


def _label_cadastro(cliente: ClienteProtocolo) -> str:
    return (cliente.nome_interno or cliente.nome or '').strip()


def _cadastros_pesquisa_ativos():
    return list(
        ClienteProtocolo.objects.filter(considerar_pesquisa_satisfacao=True).order_by('codigo', 'loja', 'pk')
    )


def clientes_pesquisa_ativos() -> list[str]:
    """Valores aceitos no lançamento: chave código|loja e nome interno (legado)."""
    valores: list[str] = []
    seen: set[str] = set()
    for cliente in _cadastros_pesquisa_ativos():
        for valor in (cliente.chave_cadastro(), (cliente.nome_interno or cliente.nome or '').strip()):
            if not valor or valor.casefold() in seen:
                continue
            seen.add(valor.casefold())
            valores.append(valor)
    return valores


def cliente_pesquisa_permitido(valor: str, *, valor_atual: str = '', permitir_outros: bool = False) -> bool:
    texto = (valor or '').strip()
    if not texto:
        return False
    if valor_atual and texto.casefold() == valor_atual.strip().casefold():
        return True
    if texto.casefold() == 'outros':
        return permitir_outros
    permitidos = {item.casefold() for item in clientes_pesquisa_ativos()}
    if texto.casefold() in permitidos:
        return True
    for cliente in _cadastros_pesquisa_ativos():
        if _label_cadastro(cliente).casefold() == texto.casefold():
            return True
    return False


def opcoes_cliente_pesquisa(*, incluir_historico: bool = False, valor_atual: str = '') -> list[dict]:
    opcoes: list[dict] = []
    seen: set[str] = set()
    for cliente in _cadastros_pesquisa_ativos():
        label = _label_cadastro(cliente)
        if not label:
            continue
        value = cliente.chave_cadastro()
        if value.casefold() in seen or label.casefold() in seen:
            continue
        seen.add(value.casefold())
        seen.add(label.casefold())
        opcoes.append({'value': value, 'label': label})

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
    for nome in extra:
        opcoes.append({'value': nome, 'label': nome})
    return opcoes
