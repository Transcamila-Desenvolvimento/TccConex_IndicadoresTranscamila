from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import ModuleAccessPermission


class ModuleScopedViewMixin:
    """Mixin para viewsets/APIViews de domínio de negócio."""
    permission_module: str = ''
    # None = padrão do módulo (global vs filial). False = visão consolidada sem filial na sessão.
    permission_requires_filial: bool | None = None
    permission_classes = [IsAuthenticated, ModuleAccessPermission]

    def scope_queryset(self, qs, filial_field: str | None = None):
        from apps.accounts.permissions import apply_filial_scope

        return apply_filial_scope(
            qs,
            self.request.user,
            self.permission_module,
            filial_field,
            self.request,
        )
