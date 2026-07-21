from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.audit.services import record_audit
from apps.financeiro.pagination import ReportPagination

from .models import AVALIACAO_CHOICES, CRITERIOS_AVALIACAO, PesquisaSatisfacao
from .serializers import PesquisaSatisfacaoSerializer

_AVALIACAO_KEYS = [key for key, _ in AVALIACAO_CHOICES]
_CRITERIO_FIELDS = [field for field, _ in CRITERIOS_AVALIACAO]

# Escala usada no score médio por critério (mesma da plataforma anterior).
_SCORE_MAP = {'ruim': 1, 'regular': 2, 'bom': 3, 'otimo': 4}

_ORDERING_MAP = {
    'data_asc': ('data', 'id'),
    'data_desc': ('-data', '-id'),
}


def _usuario_display(user) -> str:
    if not user or not user.is_authenticated:
        return ''
    return user.name or user.get_full_name() or user.username


def filter_pesquisas_queryset(qs, params):
    search = (params.get('search') or '').strip()
    cliente = (params.get('cliente') or '').strip()
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
    if avaliacao in _AVALIACAO_KEYS:
        # Pesquisas em que qualquer um dos critérios recebeu a avaliação filtrada.
        condition = Q()
        for field in _CRITERIO_FIELDS:
            condition |= Q(**{field: avaliacao})
        qs = qs.filter(condition)
    if data_inicio:
        qs = qs.filter(data__gte=data_inicio)
    if data_fim:
        qs = qs.filter(data__lte=data_fim)

    return qs.order_by(*_ORDERING_MAP.get(ordering, ('-data', '-id')))


class PesquisaSatisfacaoViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'SGQ'
    serializer_class = PesquisaSatisfacaoSerializer
    queryset = PesquisaSatisfacao.objects.all()
    pagination_class = ReportPagination
    http_method_names = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']

    def get_queryset(self):
        return filter_pesquisas_queryset(self.queryset, self.request.query_params)

    def perform_create(self, serializer):
        pesquisa = serializer.save(criado_por=_usuario_display(self.request.user))
        record_audit(
            self.request.user,
            'sgq.pesquisa.criada',
            f'Pesquisa de satisfação #{pesquisa.pk} ({pesquisa.cliente}, CT-e {pesquisa.cte}) registrada.',
        )

    def perform_update(self, serializer):
        pesquisa = serializer.save()
        record_audit(
            self.request.user,
            'sgq.pesquisa.atualizada',
            f'Pesquisa de satisfação #{pesquisa.pk} ({pesquisa.cliente}, CT-e {pesquisa.cte}) atualizada.',
        )

    def perform_destroy(self, instance):
        record_audit(
            self.request.user,
            'sgq.pesquisa.excluida',
            f'Pesquisa de satisfação #{instance.pk} ({instance.cliente}, CT-e {instance.cte}) excluída.',
        )
        instance.delete()

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """KPIs e distribuição por critério, respeitando os mesmos filtros da lista."""
        qs = filter_pesquisas_queryset(
            PesquisaSatisfacao.objects.all(), request.query_params
        )
        pesquisas = list(qs.values(*_CRITERIO_FIELDS))
        total_pesquisas = len(pesquisas)

        totais = {key: 0 for key in _AVALIACAO_KEYS}
        criterios = []
        for field, label in CRITERIOS_AVALIACAO:
            contagem = {key: 0 for key in _AVALIACAO_KEYS}
            for row in pesquisas:
                valor = row[field]
                if valor in contagem:
                    contagem[valor] += 1
                    totais[valor] += 1
            respondidas = sum(contagem.values())
            score = (
                sum(_SCORE_MAP[key] * qtd for key, qtd in contagem.items()) / respondidas
                if respondidas else 0
            )
            criterios.append({
                'campo': field,
                'label': label,
                'otimo': contagem['otimo'],
                'bom': contagem['bom'],
                'regular': contagem['regular'],
                'ruim': contagem['ruim'],
                'score': round(score, 2),
            })

        total_avaliacoes = sum(totais.values())

        def pct(qtd: int) -> float:
            return round((qtd / total_avaliacoes) * 100, 1) if total_avaliacoes else 0.0

        return Response({
            'totalPesquisas': total_pesquisas,
            'totalAvaliacoes': total_avaliacoes,
            'contagem': {
                'otimo': totais['otimo'],
                'bom': totais['bom'],
                'regular': totais['regular'],
                'ruim': totais['ruim'],
            },
            'percentual': {
                'otimo': pct(totais['otimo']),
                'bom': pct(totais['bom']),
                'regular': pct(totais['regular']),
                'ruim': pct(totais['ruim']),
            },
            'pontosAtencao': totais['regular'] + totais['ruim'],
            'metaOtimo': 80,
            'criterios': criterios,
        })
