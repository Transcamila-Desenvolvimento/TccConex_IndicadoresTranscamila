"""Ambientes e filiais ERP ativos no sistema — fonte única, não duplicar em outros arquivos."""

ADMIN_ENVIRONMENT = 'Administração/Manutenção'
LEGACY_ADMIN_ENVIRONMENT = 'Administração'

ACTIVE_ENVIRONMENTS = frozenset({ADMIN_ENVIRONMENT, 'Financeiro', 'Indicadores', 'Compras', 'RH', 'Faturamento', 'SGQ', 'Marketing', 'Logística', 'Frota'})

DEPRECATED_ENVIRONMENTS = frozenset({'Comercial'})

# Filiais operacionais às quais um usuário pode ser vinculado por ambiente
# (permissões/escopo de dados). Não confundir com listas de domínio específicas,
# como as filiais de faturamento em apps/financeiro/billing_import_service.py.
ALL_BRANCHES = ['Ibiporã (Matriz)', 'Rondonópolis', 'Paranaguá']

# Filiais liberáveis por módulo. Módulos ausentes usam ALL_BRANCHES (padrão).
# SGQ opera só nas unidades Ibiporã e Rondonópolis.
# Mantém paridade com frontend/src/constants/filiais.ts.
MODULE_BRANCHES: dict[str, list[str]] = {
    'SGQ': ['Ibiporã (Matriz)', 'Rondonópolis'],
}


def branches_for_module(module: str) -> list[str]:
    return list(MODULE_BRANCHES.get(module, ALL_BRANCHES))

# Indicadores/abas liberáveis individualmente no ambiente Indicadores.
# Mantém paridade com frontend/src/constants/indicadores.ts.
# Lista vazia em CustomUser.indicadores = acesso a todos os indicadores.
INDICADORES_KEYS = frozenset({
    'fluxo-caixa',
    'meta-faturamento',
    'movimentacao-rh',
    'satisfacao-clientes',
    'custos-frota',
})

# Abas de menu liberáveis por ambiente (Indicadores continua em INDICADORES_KEYS).
# Lista vazia em CustomUser.abas[modulo] = todas as abas daquele ambiente.
# A aba "home" é obrigatória: quem tem o ambiente sempre acessa a home.
# Mantém paridade com frontend/src/constants/abas.ts.
HOME_ABA_KEY = 'home'

ABAS_POR_AMBIENTE = {
    'Financeiro': frozenset({
        'home',
        'calendario',
        'inclusao-relatorios',
        'saldos-bancarios',
        'ajustes-caixa',
        'faturamento',
    }),
    'Faturamento': frozenset({
        'home',
        'envio-nf-cliente',
        'cadastro-clientes',
    }),
    'Compras': frozenset({'home', 'controle-estoque'}),
    'RH': frozenset({'home', 'movimentacoes'}),
    'SGQ': frozenset({'home', 'pesquisa-satisfacao'}),
    'Marketing': frozenset({'home', 'campanhas'}),
    'Logística': frozenset({'home', 'configuracoes'}),
    'Frota': frozenset({'home', 'cadastro-veiculos', 'cadastro-condutores', 'custos-frota'}),
}

# Funções liberáveis por ambiente para operadores (admin sempre tem todas).
# Mantém paridade com frontend/src/constants/funcoes.ts.
FUNCOES_POR_AMBIENTE = {
    'Faturamento': frozenset({
        'criar-protocolos',
        'editar-protocolos',
        'excluir-protocolos',
        'gerenciar-clientes',
    }),
    'SGQ': frozenset({
        'criar-pesquisas',
        'editar-pesquisas',
        'excluir-pesquisas',
        'importar-pesquisas',
        'gerenciar-escopos',
    }),
    'Marketing': frozenset({
        'criar-campanhas',
        'editar-campanhas',
        'excluir-campanhas',
    }),
    'Frota': frozenset({
        'gerenciar-veiculos',
        'gerenciar-condutores',
        'gerenciar-custos-frota',
    }),
}


def normalize_environment(env: str) -> str:
    if env == LEGACY_ADMIN_ENVIRONMENT:
        return ADMIN_ENVIRONMENT
    return env


def sanitize_environments(environments: list | None) -> list[str]:
    return [
        env
        for env in (normalize_environment(e) for e in (environments or []))
        if env in ACTIVE_ENVIRONMENTS
    ]


def sanitize_filiais(filiais: dict | None) -> dict[str, list]:
    normalized = {
        normalize_environment(module): branches
        for module, branches in (filiais or {}).items()
    }
    return {
        module: [b for b in (branches or []) if b in branches_for_module(module)]
        for module, branches in normalized.items()
        if module in ACTIVE_ENVIRONMENTS
    }


def sanitize_indicadores(indicadores: list | None) -> list[str]:
    return [key for key in (indicadores or []) if key in INDICADORES_KEYS]


def sanitize_funcoes(funcoes: dict | None) -> dict[str, list]:
    result: dict[str, list] = {}
    for module, keys in (funcoes or {}).items():
        module = normalize_environment(module)
        allowed = FUNCOES_POR_AMBIENTE.get(module)
        if not allowed:
            continue
        valid = [key for key in (keys or []) if key in allowed]
        if valid:
            result[module] = valid
    return result


def sanitize_abas(abas: dict | None) -> dict[str, list]:
    result: dict[str, list] = {}
    for module, keys in (abas or {}).items():
        module = normalize_environment(module)
        allowed = ABAS_POR_AMBIENTE.get(module)
        if not allowed:
            continue
        seen: set[str] = set()
        valid: list[str] = []
        for key in (keys or []):
            if key in allowed and key not in seen:
                seen.add(key)
                valid.append(key)
        if HOME_ABA_KEY in allowed and valid:
            valid = [HOME_ABA_KEY, *[key for key in valid if key != HOME_ABA_KEY]]
        if valid:
            result[module] = valid
    return result


def sanitize_permissions(permissions: list | None) -> list[str]:
    return [
        perm
        for perm in (normalize_environment(p) for p in (permissions or []))
        if perm in ACTIVE_ENVIRONMENTS
    ]
