from decimal import Decimal

from django.db.models import Sum
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.audit.services import record_audit
from apps.financeiro.pagination import ReportPagination

from .nd_service import (
    filtrar_situacao,
    pagadores_disponiveis,
    pagadores_selecionados,
    resumo_lote,
    resumo_por_situacao,
    salvar_pagadores,
    titulos_do_pagador,
)
from .serializers import TituloNdSerializer


class NdPagadoresView(ModuleScopedViewMixin, APIView):
    permission_module = 'Faturamento'
    permission_requires_filial = False

    def get(self, request):
        return Response({
            'selecionados': pagadores_selecionados(),
            'disponiveis': pagadores_disponiveis(request.query_params.get('search', '')),
            'lote': resumo_lote(),
        })

    def put(self, request):
        codigos = request.data.get('codigos')
        if not isinstance(codigos, list):
            return Response({'detail': 'Informe a lista de pagadores.'}, status=400)
        if len(codigos) > 500:
            return Response({'detail': 'Selecione no máximo 500 pagadores.'}, status=400)
        salvos = salvar_pagadores(codigos, request.user)
        record_audit(
            request.user,
            'Pagadores de ND',
            f'{len(salvos)} pagador(es) selecionado(s) no Controle de NDs.',
        )
        return Response({'selecionados': salvos})


class NdTitulosView(ModuleScopedViewMixin, APIView):
    permission_module = 'Faturamento'
    permission_requires_filial = False
    pagination_class = ReportPagination

    def get(self, request):
        base = titulos_do_pagador(
            request.query_params.get('search', ''),
            request.query_params.get('ordering', ''),
            request.query_params.get('cliente', ''),
        )
        qs = filtrar_situacao(base, request.query_params.get('situacao', '').strip())
        total_saldo = qs.aggregate(total=Sum('saldo'))['total'] or Decimal('0')
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request, view=self)
        response = paginator.get_paginated_response(TituloNdSerializer(page, many=True).data)
        response.data['totalSaldo'] = str(total_saldo)
        response.data['resumo'] = resumo_por_situacao(base)
        return response
