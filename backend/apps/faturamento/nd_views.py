from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.audit.services import record_audit
from apps.financeiro.pagination import ReportPagination

from .nd_service import pagadores_disponiveis, pagadores_selecionados, resumo_lote, salvar_pagadores, titulos_do_pagador
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
        qs = titulos_do_pagador(request.query_params.get('search', ''))
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response(TituloNdSerializer(page, many=True).data)
