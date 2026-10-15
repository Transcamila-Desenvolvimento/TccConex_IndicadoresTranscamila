from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.audit.services import record_audit
from apps.financeiro.pagination import ReportPagination

from .bipagem_import import BipagemImportError, importar_base_csv
from .bipagem_service import (
    buscar_documentos,
    listar_base,
    resumo_lote,
    separar_por_cliente,
    serializar_documento,
)


class BipagemBaseView(ModuleScopedViewMixin, APIView):
    """Lista a base importada. A seleção feita na tela não é gravada."""

    permission_module = 'Faturamento'
    permission_requires_filial = False
    pagination_class = ReportPagination

    def get(self, request):
        busca = (request.query_params.get('search') or '').strip()
        cod_cliente = (request.query_params.get('codCliente') or '').strip()
        if len(busca) > 80 or len(cod_cliente) > 50:
            return Response({'detail': 'Busca maior que o esperado.'}, status=400)
        importacao, qs = listar_base(busca, cod_cliente)
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request, view=self) or []
        resposta = paginator.get_paginated_response([serializar_documento(row) for row in page])
        resposta.data['lote'] = resumo_lote(importacao)
        return resposta


class BipagemImportarView(ModuleScopedViewMixin, APIView):
    """Importa o relatório Aging Luft (CSV) como base provisória da bipagem."""

    permission_module = 'Faturamento'
    permission_requires_filial = False
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        arquivo = request.FILES.get('file') or request.FILES.get('arquivo')
        if not arquivo:
            return Response({'detail': 'Selecione o arquivo CSV do relatório.'}, status=400)
        nome = getattr(arquivo, 'name', '') or ''
        if not nome.lower().endswith('.csv'):
            return Response({'detail': 'Envie o relatório em formato CSV.'}, status=400)
        try:
            resultado = importar_base_csv(arquivo.read(), arquivo=nome, usuario=request.user)
        except BipagemImportError as exc:
            return Response({'detail': str(exc)}, status=400)
        record_audit(
            request.user,
            'faturamento.bipagem.importada',
            f'Base da fatura por bipagem importada ({nome}) — {resultado["linhas"]} documento(s).',
        )
        return Response({
            'lote': resumo_lote(resultado['importacao']),
            'linhas': resultado['linhas'],
            'ignoradas': resultado['ignoradas'],
        })


class BipagemDocumentoView(ModuleScopedViewMixin, APIView):
    """Localiza CTE/documento na base importada. Não grava a relação."""

    permission_module = 'Faturamento'
    permission_requires_filial = False

    def get(self, request):
        codigo = request.query_params.get('codigo', '')
        texto = (codigo or '').strip()
        if not texto:
            return Response({'detail': 'Informe o CTE ou o documento.'}, status=400)
        cod_cliente = (request.query_params.get('codCliente') or '').strip()
        if len(texto) > 80 or len(cod_cliente) > 50:
            return Response({'detail': 'Código maior que o esperado para um documento.'}, status=400)
        importacao, rows = buscar_documentos(texto)
        permitidos, outros = separar_por_cliente(rows, cod_cliente)
        return Response({
            'lote': resumo_lote(importacao),
            'encontrados': [serializar_documento(row) for row in permitidos],
            'outroCliente': [serializar_documento(row) for row in outros],
        })
