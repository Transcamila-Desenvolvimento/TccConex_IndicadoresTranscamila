"""Permissões por ambiente e filial — usado em todas as views de negócio."""

from __future__ import annotations

import unicodedata
from urllib.parse import unquote

from rest_framework.permissions import BasePermission

from .constants import ADMIN_ENVIRONMENT, branches_for_module, normalize_environment, sanitize_environments

# Ambientes sem filial obrigatória na sessão (visão consolidada).
# SGQ exige filial na sessão (como Indicadores) — pesquisas diferem por unidade.
GLOBAL_ENVIRONMENTS = frozenset({ADMIN_ENVIRONMENT, 'Financeiro', 'RH', 'Compras', 'Faturamento', 'Marketing'})

# Nomes de filial no banco podem ser abreviados (ex.: faturamento usa "Ibiporã").
# Relatórios financeiros armazenam códigos ERP (01, 03, 05…) e Aging usa origem (1, 5, 9…).
FILIAL_DB_ALIASES: dict[str, list[str]] = {
    'Ibiporã (Matriz)': ['Ibiporã (Matriz)', 'Ibiporã', 'Matriz', '01', '10', '1', 'PA'],
    'Rondonópolis': ['Rondonópolis', '05', '11', '5', 'PA'],
    'Paranaguá': ['Paranaguá', '03', '09', '9', '3', 'PA'],
}

ENV_HEADER = 'HTTP_X_PROTHON_ENVIRONMENT'
FILIAL_HEADER = 'HTTP_X_PROTHON_FILIAL'


def _decode_filial_header(raw: str) -> str:
    """Decodifica filial do header (ASCII percent-encoded ou texto cru)."""
    value = (raw or '').strip()
    if not value:
        return ''
    # Frontend envia encodeURIComponent para sobreviver a proxies que quebram UTF-8 em headers.
    if '%' in value:
        try:
            value = unquote(value)
        except Exception:
            pass
    return unicodedata.normalize('NFC', value)


def get_request_context(request) -> tuple[str, str]:
    env = (request.META.get(ENV_HEADER) or '').strip()
    filial = _decode_filial_header(request.META.get(FILIAL_HEADER) or '')
    return env, filial


def allowed_filiais_for_module(user, module: str) -> list[str]:
    if user.is_admin:
        return branches_for_module(module)
    return list((user.filiais or {}).get(module, []))


def db_values_for_filiais(filial_names: list[str]) -> list[str]:
    values: set[str] = set()
    for name in filial_names:
        values.update(FILIAL_DB_ALIASES.get(name, [name]))
    return sorted(values)


def resolve_filial_name(filial: str, allowed_names: list[str]) -> str | None:
    """Resolve nome canônico da filial (NFC + aliases) dentro das permitidas."""
    if not filial:
        return None
    needle = unicodedata.normalize('NFC', filial.strip())
    for name in allowed_names:
        canonical = unicodedata.normalize('NFC', name)
        if needle == canonical:
            return name
        for alias in FILIAL_DB_ALIASES.get(name, [name]):
            if needle == unicodedata.normalize('NFC', alias):
                return name
    return None


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
    allowed = allowed_filiais_for_module(user, module)
    return resolve_filial_name(filial, allowed) is not None


def check_module_request_access(
    user,
    request,
    module: str,
    *,
    require_filial: bool | None = None,
) -> bool:
    if not user_has_module_access(user, module):
        return False

    env, filial = get_request_context(request)
    if env and normalize_environment(env) != normalize_environment(module):
        return False

    if require_filial is False or module in GLOBAL_ENVIRONMENTS:
        return True

    if not filial:
        return False

    return user_has_filial_access(user, module, filial)


def apply_filial_scope(qs, user, module: str, filial_field: str | None, request, *, admin_bypass: bool = True):
    """Restringe queryset aos dados permitidos para o usuário/sessão.

    admin_bypass=True (padrão): admin vê o consolidado de todas as filiais, como em
    Financeiro/Indicadores. admin_bypass=False: mesmo admin fica restrito à filial da
    sessão — usado quando os registros do módulo devem ficar sempre segregados por
    filial (ex.: SGQ), sem visão consolidada nem para admin.
    """
    if user.is_admin and admin_bypass:
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
    canonical = resolve_filial_name(session_filial, allowed_names)
    if not canonical:
        return qs.none()

    db_vals = db_values_for_filiais([canonical])
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
        require_filial = getattr(view, 'permission_requires_filial', None)
        return check_module_request_access(
            request.user,
            request,
            module,
            require_filial=require_filial,
        )
