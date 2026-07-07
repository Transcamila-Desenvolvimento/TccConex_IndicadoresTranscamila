"""Permissões por ambiente e filial — usado em todas as views de negócio."""

from __future__ import annotations

from rest_framework.permissions import BasePermission

from .constants import ADMIN_ENVIRONMENT, ALL_BRANCHES, normalize_environment, sanitize_environments

# Ambientes sem filial obrigatória na sessão (visão consolidada).
GLOBAL_ENVIRONMENTS = frozenset({ADMIN_ENVIRONMENT, 'Financeiro', 'RH', 'Compras'})

# Nomes de filial no banco podem ser abreviados (ex.: faturamento usa "Ibiporã").
# Relatórios financeiros armazenam códigos ERP (01, 03, 05…) e Aging usa origem (1, 5, 9…).
FILIAL_DB_ALIASES: dict[str, list[str]] = {
    'Ibiporã (Matriz)': ['Ibiporã (Matriz)', 'Ibiporã', 'Matriz', '01', '10', '1', 'PA'],
    'Rondonópolis': ['Rondonópolis', '05', '11', '5', 'PA'],
    'Paranaguá': ['Paranaguá', '03', '09', '9', '3', 'PA'],
}

ENV_HEADER = 'HTTP_X_PROTHON_ENVIRONMENT'
FILIAL_HEADER = 'HTTP_X_PROTHON_FILIAL'


def get_request_context(request) -> tuple[str, str]:
    env = (request.META.get(ENV_HEADER) or '').strip()
    filial = (request.META.get(FILIAL_HEADER) or '').strip()
    return env, filial


def allowed_filiais_for_module(user, module: str) -> list[str]:
    if user.is_admin:
        return list(ALL_BRANCHES)
    return list((user.filiais or {}).get(module, []))


def db_values_for_filiais(filial_names: list[str]) -> list[str]:
    values: set[str] = set()
    for name in filial_names:
        values.update(FILIAL_DB_ALIASES.get(name, [name]))
    return sorted(values)


def user_has_module_access(user, module: str) -> bool:
    if not user.is_authenticated:
        return False
    module = normalize_environment(module)
    if module == ADMIN_ENVIRONMENT:
        return user.is_admin
    if user.is_admin:
        return True
    return module in (sanitize_environments(user.environments or []))


def user_has_filial_access(user, module: str, filial: str) -> bool:
    if not filial:
        return module in GLOBAL_ENVIRONMENTS
    return filial in allowed_filiais_for_module(user, module)


def check_module_request_access(user, request, module: str) -> bool:
    if not user_has_module_access(user, module):
        return False

    env, filial = get_request_context(request)
    if env and normalize_environment(env) != normalize_environment(module):
        return False

    if module in GLOBAL_ENVIRONMENTS:
        return True

    if not filial:
        return False

    return user_has_filial_access(user, module, filial)


def apply_filial_scope(qs, user, module: str, filial_field: str | None, request):
    """Restringe queryset aos dados permitidos para o usuário/sessão."""
    if user.is_admin:
        return qs

    allowed_names = allowed_filiais_for_module(user, module)
    if not allowed_names:
        return qs.none()

    if not filial_field:
        return qs

    if module in GLOBAL_ENVIRONMENTS:
        db_vals = db_values_for_filiais(allowed_names)
        return qs.filter(**{f'{filial_field}__in': db_vals})

    _, session_filial = get_request_context(request)
    if not session_filial or session_filial not in allowed_names:
        return qs.none()

    db_vals = db_values_for_filiais([session_filial])
    return qs.filter(**{f'{filial_field}__in': db_vals})


def filter_allowed_filiais_list(user, module: str, filiais: list[str]) -> list[str]:
    if user.is_admin:
        return filiais
    allowed_db = set(db_values_for_filiais(allowed_filiais_for_module(user, module)))
    return [f for f in filiais if f in allowed_db]


class ModuleAccessPermission(BasePermission):
    message = 'Acesso negado ao módulo ou filial selecionada.'

    def has_permission(self, request, view):
        module = getattr(view, 'permission_module', None)
        if not module:
            return True
        return check_module_request_access(request.user, request, module)
