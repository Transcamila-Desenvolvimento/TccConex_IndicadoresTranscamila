from django.db.models import Q

from apps.accounts.permissions import (
    apply_filial_scope,
    db_values_for_filiais,
    allowed_filiais_for_module,
    filter_allowed_filiais_list,
)

from .models import AgingTitulo, PagarTitulo, ReceberTitulo, ReportBatch

def active_batch():
    batch = ReportBatch.objects.filter(is_active=True).first()
    if batch:
        return batch
    return ReportBatch.objects.first()


def _skip_filter(value: str | None) -> bool:
    if not value:
        return True
    normalized = value.strip().lower()
    return normalized in ('', 'todas', 'todos', 'all')


def _validate_filial_param(user, params, module='Financeiro'):
    filial = params.get('filial')
    if _skip_filter(filial):
        return
    allowed_db = set(db_values_for_filiais(allowed_filiais_for_module(user, module)))
    if filial not in allowed_db:
        raise PermissionError('Filial não autorizada para este usuário.')


def scope_pagar_queryset(qs, user, request):
    return apply_filial_scope(qs, user, 'Financeiro', 'filial', request)


def scope_receber_queryset(qs, user, request):
    return apply_filial_scope(qs, user, 'Financeiro', 'filial', request)


def scope_aging_queryset(qs, user, request):
    return apply_filial_scope(qs, user, 'Financeiro', 'origem', request)


def filter_pagar_queryset(qs, params, user=None, request=None):
    if user and request:
        qs = scope_pagar_queryset(qs, user, request)
        try:
            _validate_filial_param(user, params)
        except PermissionError:
            return qs.none()

    filial = params.get('filial')
    party = params.get('party')
    tipo = params.get('tipo')
    search = params.get('search', '').strip()

    if not _skip_filter(filial):
        qs = qs.filter(filial=filial)
    if not _skip_filter(party):
        qs = qs.filter(fornecedor=party)
    if not _skip_filter(tipo):
        qs = qs.filter(tipo=tipo)
    if search:
        qs = qs.filter(
            Q(filial__icontains=search)
            | Q(cod_forn__icontains=search)
            | Q(fornecedor__icontains=search)
            | Q(titulo__icontains=search)
            | Q(tipo__icontains=search)
            | Q(historico__icontains=search)
        )
    return qs


def filter_receber_queryset(qs, params, user=None, request=None):
    if user and request:
        qs = scope_receber_queryset(qs, user, request)
        try:
            _validate_filial_param(user, params)
        except PermissionError:
            return qs.none()

    filial = params.get('filial')
    party = params.get('party')
    tipo = params.get('tipo')
    search = params.get('search', '').strip()

    if not _skip_filter(filial):
        qs = qs.filter(filial=filial)
    if not _skip_filter(party):
        qs = qs.filter(cliente=party)
    if not _skip_filter(tipo):
        qs = qs.filter(natureza=tipo)
    if search:
        qs = qs.filter(
            Q(filial__icontains=search)
            | Q(cod_cliente__icontains=search)
            | Q(cliente__icontains=search)
            | Q(titulo__icontains=search)
            | Q(natureza__icontains=search)
            | Q(historico__icontains=search)
        )
    return qs


def filter_aging_queryset(qs, params, user=None, request=None):
    if user and request:
        qs = scope_aging_queryset(qs, user, request)
        try:
            _validate_filial_param(user, params)
        except PermissionError:
            return qs.none()

    filial = params.get('filial')
    party = params.get('party')
    tipo = params.get('tipo')
    search = params.get('search', '').strip()

    if not _skip_filter(filial):
        qs = qs.filter(origem=filial)
    if not _skip_filter(party):
        qs = qs.filter(cliente=party)
    if not _skip_filter(tipo):
        qs = qs.filter(tipo=tipo)
    if search:
        qs = qs.filter(
            Q(origem__icontains=search)
            | Q(cod_cliente__icontains=search)
            | Q(cliente__icontains=search)
            | Q(docto__icontains=search)
            | Q(tipo__icontains=search)
            | Q(regiao__icontains=search)
        )
    return qs


def report_facets(batch, report_type: str, user=None, request=None) -> dict:
    empty = {'filiais': [], 'parties': [], 'tipos': []}
    if not batch:
        return empty

    if report_type == 'pagar':
        qs = PagarTitulo.objects.filter(batch=batch)
        if user and request:
            qs = scope_pagar_queryset(qs, user, request)
        filiais = sorted({v for v in qs.values_list('filial', flat=True) if v})
        return {
            'filiais': filter_allowed_filiais_list(user, 'Financeiro', filiais) if user else filiais,
            'parties': sorted({v for v in qs.values_list('fornecedor', flat=True) if v}),
            'tipos': sorted({v for v in qs.values_list('tipo', flat=True) if v}),
        }
    if report_type == 'receber':
        qs = ReceberTitulo.objects.filter(batch=batch)
        if user and request:
            qs = scope_receber_queryset(qs, user, request)
        filiais = sorted({v for v in qs.values_list('filial', flat=True) if v})
        return {
            'filiais': filter_allowed_filiais_list(user, 'Financeiro', filiais) if user else filiais,
            'parties': sorted({v for v in qs.values_list('cliente', flat=True) if v}),
            'tipos': sorted({v for v in qs.values_list('natureza', flat=True) if v}),
        }
    if report_type == 'aging':
        qs = AgingTitulo.objects.filter(batch=batch)
        if user and request:
            qs = scope_aging_queryset(qs, user, request)
        filiais = sorted({v for v in qs.values_list('origem', flat=True) if v})
        return {
            'filiais': filter_allowed_filiais_list(user, 'Financeiro', filiais) if user else filiais,
            'parties': sorted({v for v in qs.values_list('cliente', flat=True) if v}),
            'tipos': sorted({v for v in qs.values_list('tipo', flat=True) if v}),
        }
    return empty