from django.db.models import Q

from .models import AVALIACAO_CHOICES, CRITERIOS_AVALIACAO

_AVALIACAO_KEYS = [key for key, _ in AVALIACAO_CHOICES]
_CRITERIO_FIELDS = [field for field, _ in CRITERIOS_AVALIACAO]

_ORDERING_MAP = {
    # Legado (data = data de entrega)
    'data_asc': ('data_entrega', 'id'),
    'data_desc': ('-data_entrega', '-id'),
    'data_entrega_asc': ('data_entrega', 'id'),
    'data_entrega_desc': ('-data_entrega', '-id'),
    'data_inclusao_asc': ('data_inclusao', 'id'),
    'data_inclusao_desc': ('-data_inclusao', '-id'),
}


def filter_pesquisas_queryset(qs, params):
    search = (params.get('search') or '').strip()
    cliente = (params.get('cliente') or '').strip()
    motorista = (params.get('motorista') or '').strip()
    criado_por = (params.get('criadoPor') or params.get('criado_por') or '').strip()
    avaliacao = (params.get('avaliacao') or '').strip().lower()
    data_inicio = (params.get('dataInicio') or params.get('data_inicio') or '').strip()
    data_fim = (params.get('dataFim') or params.get('data_fim') or '').strip()
    ordering = (params.get('ordering') or 'data_desc').strip()

    if search:
        qs = qs.filter(
            Q(motorista__icontains=search)
            | Q(cte__icontains=search)
            | Q(nota_fiscal__icontains=search)
        )
    if cliente:
        qs = qs.filter(cliente=cliente)
    if motorista:
        qs = qs.filter(motorista__iexact=motorista)
    if criado_por:
        qs = qs.filter(criado_por__iexact=criado_por)
    if avaliacao in _AVALIACAO_KEYS:
        condition = Q()
        for field in _CRITERIO_FIELDS:
            condition |= Q(**{field: avaliacao})
        qs = qs.filter(condition)
    if data_inicio:
        qs = qs.filter(data_entrega__gte=data_inicio)
    if data_fim:
        qs = qs.filter(data_entrega__lte=data_fim)

    return qs.order_by(*_ORDERING_MAP.get(ordering, ('-data_entrega', '-id')))
