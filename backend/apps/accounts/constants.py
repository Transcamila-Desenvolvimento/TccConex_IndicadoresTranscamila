"""Ambientes e filiais ERP ativos no sistema — fonte única, não duplicar em outros arquivos."""

ADMIN_ENVIRONMENT = 'Administração/Manutenção'
LEGACY_ADMIN_ENVIRONMENT = 'Administração'

ACTIVE_ENVIRONMENTS = frozenset({ADMIN_ENVIRONMENT, 'Financeiro', 'Indicadores', 'Compras', 'RH', 'Faturamento'})

DEPRECATED_ENVIRONMENTS = frozenset({'Comercial', 'Frota'})

# Filiais operacionais às quais um usuário pode ser vinculado por ambiente
# (permissões/escopo de dados). Não confundir com listas de domínio específicas,
# como as filiais de faturamento em apps/financeiro/billing_import_service.py.
ALL_BRANCHES = ['Ibiporã (Matriz)', 'Rondonópolis', 'Paranaguá']

# Indicadores/abas liberáveis individualmente no ambiente Indicadores.
# Mantém paridade com frontend/src/constants/indicadores.ts.
# Lista vazia em CustomUser.indicadores = acesso a todos os indicadores.
INDICADORES_KEYS = frozenset({
    'fluxo-caixa',
    'meta-faturamento',
})

# Funções liberáveis por ambiente para operadores (admin sempre tem todas).
# Mantém paridade com frontend/src/constants/funcoes.ts.
FUNCOES_POR_AMBIENTE = {
    'Faturamento': frozenset({
        'criar-protocolos',
        'editar-protocolos',
        'excluir-protocolos',
        'gerenciar-clientes',
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
        module: branches
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


def sanitize_permissions(permissions: list | None) -> list[str]:
    return [
        perm
        for perm in (normalize_environment(p) for p in (permissions or []))
        if perm in ACTIVE_ENVIRONMENTS
    ]
