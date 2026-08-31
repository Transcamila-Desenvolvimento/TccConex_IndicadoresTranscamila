from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.audit.services import record_audit

from .custos_import_service import MAX_CUSTO_LOTES, import_custo_file
from .models import CondutorFrota, CustoFrotaLote, VeiculoFrota, format_placa
from .pagination import CustoFrotaPagination
from .serializers import (
    CondutorFrotaSerializer,
    CustoAbastecimentoLinhaSerializer,
    CustoFrotaLoteSerializer,
    CustoManutencaoLinhaSerializer,
    VeiculoFrotaSerializer,
)


class FrotaSummaryView(ModuleScopedViewMixin, APIView):
    """Resumo inicial do ambiente Frota."""

    permission_module = 'Frota'

    def get(self, request):
        return Response({
            'environment': 'Frota',
            'message': 'Ambiente Frota ativo.',
        })


def _funcao_required_response(request, funcao: str, detail: str):
    if request.user.has_funcao('Frota', funcao):
        return None
    return Response({'detail': detail}, status=status.HTTP_403_FORBIDDEN)


_GERENCIAR_VEICULOS_DETAIL = (
    'Acesso negado. Solicite ao administrador a função "Cadastrar e editar" de Veículos frota.'
)
_GERENCIAR_CONDUTORES_DETAIL = (
    'Acesso negado. Solicite ao administrador a função "Cadastrar e editar" de Condutores.'
)
_GERENCIAR_CUSTOS_DETAIL = (
    'Acesso negado. Solicite ao administrador a função "Importar relatórios" de Custos de frota.'
)


class VeiculoFrotaViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Frota'
    permission_requires_filial = False
    serializer_class = VeiculoFrotaSerializer
    queryset = VeiculoFrota.objects.all()
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']

    def get_queryset(self):
        return self.scope_queryset(super().get_queryset(), 'filial')

    def create(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-veiculos', _GERENCIAR_VEICULOS_DETAIL)
        if denied:
            return denied
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-veiculos', _GERENCIAR_VEICULOS_DETAIL)
        if denied:
            return denied
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-veiculos', _GERENCIAR_VEICULOS_DETAIL)
        if denied:
            return denied
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        veiculo = serializer.save()
        record_audit(
            self.request.user,
            'frota.veiculo.criado',
            f'Veículo {format_placa(veiculo.placa)} cadastrado.',
        )

    def perform_update(self, serializer):
        veiculo = serializer.save()
        record_audit(
            self.request.user,
            'frota.veiculo.atualizado',
            f'Veículo {format_placa(veiculo.placa)} atualizado.',
        )

    def perform_destroy(self, instance):
        placa = format_placa(instance.placa)
        instance.delete()
        record_audit(
            self.request.user,
            'frota.veiculo.excluido',
            f'Veículo {placa} excluído.',
        )


class CondutorFrotaViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Frota'
    permission_requires_filial = False
    serializer_class = CondutorFrotaSerializer
    queryset = CondutorFrota.objects.all()
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']

    def get_queryset(self):
        return self.scope_queryset(super().get_queryset(), 'filial')

    def create(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-condutores', _GERENCIAR_CONDUTORES_DETAIL)
        if denied:
            return denied
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-condutores', _GERENCIAR_CONDUTORES_DETAIL)
        if denied:
            return denied
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'gerenciar-condutores', _GERENCIAR_CONDUTORES_DETAIL)
        if denied:
            return denied
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        condutor = serializer.save()
        record_audit(self.request.user, 'frota.condutor.criado', f'Condutor "{condutor.nome}" cadastrado.')

    def perform_update(self, serializer):
        condutor = serializer.save()
        record_audit(self.request.user, 'frota.condutor.atualizado', f'Condutor "{condutor.nome}" atualizado.')

    def perform_destroy(self, instance):
        nome = instance.nome
        instance.delete()
        record_audit(self.request.user, 'frota.condutor.excluido', f'Condutor "{nome}" excluído.')


class CustoFrotaLoteViewSet(ModuleScopedViewMixin, viewsets.ReadOnlyModelViewSet):
    permission_module = 'Frota'
    permission_requires_filial = False
    serializer_class = CustoFrotaLoteSerializer
    queryset = CustoFrotaLote.objects.select_related('updated_by').order_by(
        '-is_active', '-periodo_inicio', '-created_at',
    )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'maxBatches': MAX_CUSTO_LOTES,
            'results': serializer.data,
        })

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def importar(self, request):
        denied = _funcao_required_response(request, 'gerenciar-custos-frota', _GERENCIAR_CUSTOS_DETAIL)
        if denied:
            return denied

        report_type = request.data.get('type')
        upload = request.FILES.get('file')
        if report_type not in ('manutencao', 'abastecimento'):
            return Response(
                {'detail': 'Tipo de relatório inválido.', 'success': False, 'issues': []},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not upload:
            return Response(
                {'detail': 'Arquivo não enviado.', 'success': False, 'issues': []},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_bytes = upload.read()
        file_name = upload.name
        result = import_custo_file(report_type, file_bytes, file_name, request.user)
        if result['success']:
            record_audit(
                request.user,
                'frota.custos.importado',
                f'Importação {report_type} ({file_name}) — {result["rowCount"]} linha(s), lote {result.get("loteLabel")}.',
            )
        payload = {
            'type': report_type,
            'fileName': file_name,
            'success': result['success'],
            'rowCount': result['rowCount'],
            'skippedRows': result['skippedRows'],
            'issues': result['issues'],
            'loteId': result.get('loteId'),
            'loteLabel': result.get('loteLabel'),
            'reusedLote': result.get('reusedLote'),
            'periodoInicio': result.get('periodoInicio'),
            'periodoFim': result.get('periodoFim'),
        }
        return Response(payload, status=status.HTTP_200_OK if result['success'] else status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def finalize(self, request, pk=None):
        denied = _funcao_required_response(request, 'gerenciar-custos-frota', _GERENCIAR_CUSTOS_DETAIL)
        if denied:
            return denied
        lote = self.get_object()
        CustoFrotaLote.objects.update(is_active=False)
        lote.is_active = True
        lote.updated_by = request.user
        lote.save(update_fields=['is_active', 'updated_by'])
        record_audit(
            request.user,
            'frota.custos.lote.ativado',
            f'Lote {lote.label} definido como lote atual de custos da frota.',
        )
        return Response(CustoFrotaLoteSerializer(lote).data)


class CustoFrotaRelatorioView(ModuleScopedViewMixin, APIView):
    permission_module = 'Frota'
    permission_requires_filial = False
    pagination_class = CustoFrotaPagination

    def get(self, request, report_type):
        if report_type not in ('manutencao', 'abastecimento'):
            return Response({'detail': 'Tipo inválido.'}, status=status.HTTP_400_BAD_REQUEST)

        lote = CustoFrotaLote.objects.filter(is_active=True).first()
        paginator = self.pagination_class()
        if not lote:
            return Response({'count': 0, 'next': None, 'previous': None, 'results': []})

        search = (request.query_params.get('search') or '').strip()
        if report_type == 'manutencao':
            qs = lote.manutencao_linhas.select_related('veiculo').all()
            if search:
                qs = qs.filter(
                    Q(placa__icontains=search.replace('-', ''))
                    | Q(item__icontains=search)
                    | Q(grupo__icontains=search)
                )
            serializer_class = CustoManutencaoLinhaSerializer
        elif report_type == 'abastecimento':
            qs = lote.abastecimento_linhas.select_related('veiculo').all()
            if search:
                qs = qs.filter(
                    Q(placa__icontains=search.replace('-', ''))
                    | Q(estabelecimento__icontains=search)
                    | Q(motorista__icontains=search)
                    | Q(cidade__icontains=search)
                    | Q(transacao__icontains=search)
                )
            serializer_class = CustoAbastecimentoLinhaSerializer

        page = paginator.paginate_queryset(qs, request)
        serializer = serializer_class(page, many=True)
        return paginator.get_paginated_response(serializer.data)
