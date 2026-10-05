"""Partes do ERP que um agente pode consultar. Só leitura, e só o que o usuário já acessa."""

from apps.accounts.constants import (
    ABAS_POR_AMBIENTE,
    AGENTE_CAMILO_ENVIRONMENT,
    HOME_ABA_KEY,
    INDICADORES_KEYS,
)
from apps.accounts.permissions import user_has_module_access

# Home não guarda uma consulta própria. CamiloIA é o chat, não uma fonte.
PARTES = (
    {'ambiente': 'Financeiro', 'parte': 'calendario', 'rotulo': 'Calendário'},
    {'ambiente': 'Financeiro', 'parte': 'inclusao-relatorios', 'rotulo': 'Inclusão de Relatórios'},
    {'ambiente': 'Financeiro', 'parte': 'saldos-bancarios', 'rotulo': 'Saldos Bancários'},
    {'ambiente': 'Financeiro', 'parte': 'ajustes-caixa', 'rotulo': 'Ajustes de caixa'},
    {'ambiente': 'Financeiro', 'parte': 'faturamento', 'rotulo': 'Faturamento'},
    {'ambiente': 'Faturamento', 'parte': 'envio-nf-cliente', 'rotulo': 'Envio NF Cliente'},
    {'ambiente': 'Faturamento', 'parte': 'cadastro-clientes', 'rotulo': 'Cadastro cliente'},
    {'ambiente': 'Compras', 'parte': 'controle-estoque', 'rotulo': 'Controle de estoque'},
    {'ambiente': 'RH', 'parte': 'movimentacoes', 'rotulo': 'Movimentações'},
    {'ambiente': 'RH', 'parte': 'documentos', 'rotulo': 'Documentos'},
    {'ambiente': 'SGQ', 'parte': 'pesquisa-satisfacao', 'rotulo': 'Pesquisa de satisfação'},
    {'ambiente': 'Marketing', 'parte': 'campanhas', 'rotulo': 'Calendário Transcamila'},
    {'ambiente': 'Logística', 'parte': 'configuracoes', 'rotulo': 'Configurações gerais'},
    {'ambiente': 'Frota', 'parte': 'custos-frota', 'rotulo': 'Custos de frota'},
    {'ambiente': 'Frota', 'parte': 'cadastro-condutores', 'rotulo': 'Condutores'},
    {'ambiente': 'Frota', 'parte': 'cadastro-veiculos', 'rotulo': 'Veículos frota'},
    {'ambiente': 'Comercial', 'parte': 'cadastro-clientes', 'rotulo': 'Clientes'},
    {'ambiente': 'Comercial', 'parte': 'cadastro-tabela-frete', 'rotulo': 'Tabela frete'},
    {'ambiente': 'Comercial', 'parte': 'cadastro-generalidades', 'rotulo': 'Generalidades'},
    {'ambiente': 'Comercial', 'parte': 'cadastro-icms-ufs', 'rotulo': 'ICMS por UF'},
    {'ambiente': 'Comercial', 'parte': 'cadastro-parametros', 'rotulo': 'Parâmetros'},
    {'ambiente': 'Comercial', 'parte': 'cadastro-produtos', 'rotulo': 'Composição de produtos'},
    {'ambiente': 'Comercial', 'parte': 'propostas-comerciais', 'rotulo': 'Propostas comerciais'},
    {'ambiente': 'Comercial', 'parte': 'validacao-clientes', 'rotulo': 'Validação clientes'},
    {'ambiente': 'Indicadores', 'parte': 'fluxo-caixa', 'rotulo': 'Fluxo de Caixa'},
    {'ambiente': 'Indicadores', 'parte': 'meta-faturamento', 'rotulo': 'Meta de Faturamento'},
    {'ambiente': 'Indicadores', 'parte': 'movimentacao-rh', 'rotulo': 'Movimentação de RH'},
    {'ambiente': 'Indicadores', 'parte': 'satisfacao-clientes', 'rotulo': 'Satisfação dos Clientes'},
    {'ambiente': 'Indicadores', 'parte': 'custos-frota', 'rotulo': 'Custos de frota'},
)

PARTE_POR_CHAVE = {(item['ambiente'], item['parte']): item for item in PARTES}


def _abas_consultaveis(user, ambiente: str) -> set[str]:
    catalogo = set(ABAS_POR_AMBIENTE.get(ambiente, ())) - {HOME_ABA_KEY}
    if user.is_admin:
        return catalogo
    selecionadas = (user.abas or {}).get(ambiente) or []
    if not selecionadas:
        return catalogo
    return catalogo.intersection(selecionadas)


def _indicadores_consultaveis(user) -> set[str]:
    if not user_has_module_access(user, 'Indicadores'):
        return set()
    selecionados = list(user.indicadores or [])
    if user.is_admin or not selecionados:
        return set(INDICADORES_KEYS)
    return set(INDICADORES_KEYS).intersection(selecionados)


def partes_do_usuario(user) -> list[dict]:
    """Partes que a pessoa pode liberar agora. Admin vê o catálogo inteiro."""
    if not user.is_authenticated:
        return []
    indicadores = _indicadores_consultaveis(user)
    liberadas = []
    for item in PARTES:
        ambiente = item['ambiente']
        if ambiente == AGENTE_CAMILO_ENVIRONMENT:
            continue
        if not user_has_module_access(user, ambiente):
            continue
        if ambiente == 'Indicadores':
            if item['parte'] in indicadores:
                liberadas.append(dict(item))
            continue
        if item['parte'] in _abas_consultaveis(user, ambiente):
            liberadas.append(dict(item))
    return liberadas


def normalizar_escopos(user, escopos) -> list[dict]:
    """Mantém só escopos válidos e ainda acessíveis. Descarta duplicados."""
    permitidos = {(item['ambiente'], item['parte']) for item in partes_do_usuario(user)}
    vistos: set[tuple[str, str]] = set()
    validos = []
    for item in escopos or []:
        if not isinstance(item, dict):
            continue
        chave = (str(item.get('ambiente') or '').strip(), str(item.get('parte') or '').strip())
        if chave not in permitidos or chave in vistos or chave not in PARTE_POR_CHAVE:
            continue
        vistos.add(chave)
        validos.append({'ambiente': chave[0], 'parte': chave[1]})
    return validos


def escopos_publicos(escopos) -> list[dict]:
    publicos = []
    for item in escopos or []:
        if not isinstance(item, dict):
            continue
        meta = PARTE_POR_CHAVE.get((item.get('ambiente'), item.get('parte')))
        if meta:
            publicos.append(dict(meta))
    return publicos


def grupos_do_usuario(user) -> list[dict]:
    grupos: list[dict] = []
    atual = None
    for item in partes_do_usuario(user):
        if atual is None or atual['ambiente'] != item['ambiente']:
            atual = {'ambiente': item['ambiente'], 'partes': []}
            grupos.append(atual)
        atual['partes'].append(item)
    return grupos
