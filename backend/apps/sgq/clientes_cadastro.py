"""Clientes disponíveis na pesquisa de satisfação a partir do cadastro mestre."""

from __future__ import annotations

from apps.faturamento.models import ClienteProtocolo, chave_texto_sem_acento

from .models import PesquisaSatisfacao


def _label_cadastro(cliente: ClienteProtocolo) -> str:
    return (cliente.nome_interno or cliente.nome or '').strip()


def _cadastros_pesquisa_ativos():
    return list(
        ClienteProtocolo.objects.filter(considerar_pesquisa_satisfacao=True).order_by('codigo', 'loja', 'pk')
    )


def encontrar_cadastro_pesquisa(valor: str):
    texto = (valor or '').strip()
    if not texto:
        return None
    if '|' in texto:
        codigo, _, loja = texto.partition('|')
        encontrado = ClienteProtocolo.objects.filter(
            codigo=codigo.strip(),
            loja=(loja.strip() or '01'),
        ).first()
        if encontrado:
            return encontrado
    alvo = chave_texto_sem_acento(texto)
    if not alvo:
        return None
    for cadastro in ClienteProtocolo.objects.all().order_by('codigo', 'loja', 'pk'):
        candidatos = (
            _label_cadastro(cadastro),
            cadastro.nome,
            cadastro.nome_interno,
            cadastro.razao_social,
            cadastro.chave_cadastro(),
        )
        if any(chave_texto_sem_acento(item) == alvo for item in candidatos if item):
            return cadastro
    return None


def nome_exibicao_pesquisa(valor: str) -> str:
    texto = (valor or '').strip()
    if not texto:
        return ''
    if texto.casefold() == 'outros':
        return 'OUTROS'
    cadastro = encontrar_cadastro_pesquisa(texto)
    if cadastro:
        return _label_cadastro(cadastro) or texto
    return texto


def valores_filtro_cliente(valor: str) -> list[str]:
    texto = (valor or '').strip()
    if not texto:
        return []
    textos = {texto}
    cadastro = encontrar_cadastro_pesquisa(texto)
    if cadastro:
        textos.update(
            filter(
                None,
                {
                    cadastro.chave_cadastro(),
                    _label_cadastro(cadastro),
                    cadastro.nome,
                    cadastro.nome_interno,
                    cadastro.razao_social,
                },
            )
        )
    alvo = chave_texto_sem_acento(texto)
    for nome in PesquisaSatisfacao.objects.exclude(cliente='').values_list('cliente', flat=True).distinct():
        nome = (nome or '').strip()
        if nome and chave_texto_sem_acento(nome) == alvo:
            textos.add(nome)
    return list(textos)


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
        if chave_texto_sem_acento(_label_cadastro(cliente)) == chave_texto_sem_acento(texto):
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
        chave = chave_texto_sem_acento(label)
        if value.casefold() in seen or label.casefold() in seen or chave in seen:
            continue
        seen.add(value.casefold())
        seen.add(label.casefold())
        seen.add(chave)
        opcoes.append({'value': value, 'label': label})

    extra: list[str] = []
    atual = (valor_atual or '').strip()
    if atual and atual.casefold() not in seen and chave_texto_sem_acento(atual) not in seen:
        extra.append(atual)
        seen.add(atual.casefold())
        seen.add(chave_texto_sem_acento(atual))
    if incluir_historico:
        for nome in PesquisaSatisfacao.objects.exclude(cliente='').values_list('cliente', flat=True).distinct():
            nome = (nome or '').strip()
            if not nome:
                continue
            if nome.casefold() == 'outros':
                if 'outros' not in seen:
                    seen.add('outros')
                    extra.append('OUTROS')
                continue
            if encontrar_cadastro_pesquisa(nome):
                continue
            chave = chave_texto_sem_acento(nome)
            if nome.casefold() in seen or chave in seen:
                continue
            extra.append(nome)
            seen.add(nome.casefold())
            seen.add(chave)
    for nome in extra:
        opcoes.append({'value': nome, 'label': nome_exibicao_pesquisa(nome)})
    return opcoes
