from django.http import HttpResponse
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.audit.services import record_audit
from apps.financeiro.pagination import ReportPagination

from .models import ClienteProtocolo, FilialClienteProtocolo, ProtocoloEnvio
from .protocol_pdf import render_protocols_pdf
from .protocolo_import_service import (
    ProtocoloImportError,
    build_protocolo_import_template,
    import_protocolos_from_workbook,
)
from .serializers import (
    ClienteProtocoloSerializer,
    FilialClienteProtocoloSerializer,
    ProtocoloBulkDeleteSerializer,
    ProtocoloEnvioCreateSerializer,
    ProtocoloEnvioSerializer,
    ProtocoloEnvioUpdateSerializer,
)


def _usuario_display(user) -> str:
    if not user or not user.is_authenticated:
        return ''
    return user.name or user.get_full_name() or user.username


def _admin_required_response(request, detail: str):
    if request.user.is_admin:
        return None
    return Response({'detail': detail}, status=status.HTTP_403_FORBIDDEN)


_ORDERING_MAP = {
    'protocolo_asc': ('id',),
    'protocolo_desc': ('-id',),
    'data_asc': ('data', 'id'),
    'data_desc': ('-data', '-id'),
}

def filter_protocolos_queryset(qs, params):
    cliente = (params.get('cliente') or '').strip()
    data = (params.get('data') or '').strip()
    protocolo_id = (params.get('protocoloId') or params.get('protocolo_id') or '').strip()
    nota_fiscal = (params.get('notaFiscal') or params.get('nota_fiscal') or '').strip()
    usuario = (params.get('usuario') or '').strip()
    ordering = (params.get('ordering') or 'data_desc').strip()

    if cliente:
        qs = qs.filter(cliente__nome__icontains=cliente)
    if data:
        qs = qs.filter(data=data)
    if protocolo_id:
        if protocolo_id.isdigit():
            qs = qs.filter(pk=int(protocolo_id))
        else:
            qs = qs.none()
    if nota_fiscal:
        qs = qs.filter(nota_fiscal__icontains=nota_fiscal)
    if usuario:
        qs = qs.filter(usuario_nome__icontains=usuario)

    order_fields = _ORDERING_MAP.get(ordering, ('-data', '-id'))
    return qs.order_by(*order_fields)


class ClienteProtocoloViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Faturamento'
    permission_requires_filial = False
    serializer_class = ClienteProtocoloSerializer
    queryset = ClienteProtocolo.objects.all()
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']

    def create(self, request, *args, **kwargs):
        denied = _admin_required_response(
            request,
            'Acesso negado. Apenas administradores podem gerenciar clientes de protocolo.',
        )
        if denied:
            return denied
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        denied = _admin_required_response(
            request,
            'Acesso negado. Apenas administradores podem gerenciar clientes de protocolo.',
        )
        if denied:
            return denied
        return super().update(request, *args, **kwargs)

    def perform_create(self, serializer):
        cliente = serializer.save()
        record_audit(
            self.request.user,
            'faturamento.protocolo_cliente.criado',
            f'Cliente de protocolo "{cliente.nome}" cadastrado.',
        )

    def perform_update(self, serializer):
        cliente = serializer.save()
        record_audit(
            self.request.user,
            'faturamento.protocolo_cliente.atualizado',
            f'Cliente de protocolo "{cliente.nome}" atualizado.',
        )

    def destroy(self, request, *args, **kwargs):
        denied = _admin_required_response(
            request,
            'Acesso negado. Apenas administradores podem gerenciar clientes de protocolo.',
        )
        if denied:
            return denied
        instance = self.get_object()
        if instance.protocolos.exists():
            return Response(
                {'detail': 'Não é possível excluir cliente com protocolos vinculados.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_destroy(self, instance):
        nome = instance.nome
        instance.delete()
        record_audit(
            self.request.user,
            'faturamento.protocolo_cliente.excluido',
            f'Cliente de protocolo "{nome}" excluído.',
        )


class FilialClienteProtocoloViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Faturamento'
    permission_requires_filial = False
    serializer_class = FilialClienteProtocoloSerializer
    pagination_class = None
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        return FilialClienteProtocolo.objects.filter(cliente_id=self.kwargs['cliente_pk'])

    def create(self, request, *args, **kwargs):
        denied = _admin_required_response(
            request,
            'Acesso negado. Apenas administradores podem gerenciar filiais de cliente de protocolo.',
        )
        if denied:
            return denied
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = _admin_required_response(
            request,
            'Acesso negado. Apenas administradores podem gerenciar filiais de cliente de protocolo.',
        )
        if denied:
            return denied
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        cliente = ClienteProtocolo.objects.get(pk=self.kwargs['cliente_pk'])
        filial = serializer.save(cliente=cliente)
        record_audit(
            self.request.user,
            'faturamento.filial_cliente.criada',
            f'Filial "{filial.nome}" adicionada ao cliente "{cliente.nome}".',
        )

    def perform_destroy(self, instance):
        record_audit(
            self.request.user,
            'faturamento.filial_cliente.excluida',
            f'Filial "{instance.nome}" removida do cliente "{instance.cliente.nome}".',
        )
        instance.delete()


class ProtocoloEnvioViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Faturamento'
    permission_requires_filial = False
    serializer_class = ProtocoloEnvioSerializer
    queryset = ProtocoloEnvio.objects.select_related('cliente', 'usuario').all()
    pagination_class = ReportPagination
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'create':
            return ProtocoloEnvioCreateSerializer
        if self.action in ('partial_update', 'update'):
            return ProtocoloEnvioUpdateSerializer
        return ProtocoloEnvioSerializer

    def get_queryset(self):
        return filter_protocolos_queryset(self.queryset, self.request.query_params)

    def perform_create(self, serializer):
        protocolo = serializer.save(
            usuario=self.request.user,
            usuario_nome=_usuario_display(self.request.user),
        )
        nf_count = len([nf for nf in protocolo.nota_fiscal.split(',') if nf.strip()])
        record_audit(
            self.request.user,
            'faturamento.protocolo.criado',
            f'Protocolo #{protocolo.pk} para "{protocolo.cliente.nome}" com {nf_count} NF(s).',
        )

    def perform_update(self, serializer):
        protocolo = serializer.save()
        record_audit(
            self.request.user,
            'faturamento.protocolo.atualizado',
            f'Protocolo #{protocolo.pk} ({protocolo.cliente.nome}) atualizado.',
        )

    def _reserialize(self, instance):
        # As respostas de criação/edição usam o serializer de escrita (com `expedicoes`
        # write-only), então reserializamos com o serializer de leitura para incluir os
        # campos computados (ex.: `expedicoes` derivada de `expedicao`).
        return ProtocoloEnvioSerializer(instance, context=self.get_serializer_context()).data

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(self._reserialize(serializer.instance), status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(self._reserialize(serializer.instance))

    def perform_destroy(self, instance):
        record_audit(
            self.request.user,
            'faturamento.protocolo.excluido',
            f'Protocolo #{instance.pk} ({instance.cliente.nome}) excluído.',
        )
        instance.delete()

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        serializer = ProtocoloBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data['ids']
        qs = ProtocoloEnvio.objects.filter(pk__in=ids)
        count = qs.count()
        qs.delete()
        record_audit(
            request.user,
            'faturamento.protocolo.excluido_lote',
            f'{count} protocolo(s) excluído(s) em lote.',
        )
        return Response({'deleted': count})

    def _pdf_response(self, protocolos, filename: str):
        try:
            pdf_bytes = render_protocols_pdf(list(protocolos))
        except Exception as exc:
            return Response(
                {'detail': f'Erro ao gerar PDF: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        if not pdf_bytes:
            return Response(
                {'detail': 'PDF gerado está vazio.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response

    @action(detail=True, methods=['get'])
    def print_pdf(self, request, pk=None):
        protocolo = self.get_object()
        return self._pdf_response([protocolo], f'protocolo_{protocolo.pk}.pdf')

    @action(detail=False, methods=['get'])
    def bulk_print(self, request):
        ids_raw = (request.query_params.get('ids') or '').strip()
        if not ids_raw:
            return Response({'detail': 'Informe os IDs dos protocolos.'}, status=status.HTTP_400_BAD_REQUEST)
        ids = [int(value) for value in ids_raw.split(',') if value.strip().isdigit()]
        if not ids:
            return Response({'detail': 'IDs inválidos.'}, status=status.HTTP_400_BAD_REQUEST)
        # Mantém a ordem dos IDs selecionados na tela.
        protocolos_qs = ProtocoloEnvio.objects.filter(pk__in=ids).select_related('cliente', 'usuario')
        by_id = {p.pk: p for p in protocolos_qs}
        protocolos = [by_id[i] for i in ids if i in by_id]
        if not protocolos:
            return Response({'detail': 'Nenhum protocolo encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return self._pdf_response(protocolos, 'protocolos.pdf')

    @action(detail=False, methods=['get'])
    def exportar_modelo(self, request):
        """Baixa planilha de referência (.xlsx) para importação — somente administradores."""
        if not request.user.is_admin:
            return Response(
                {'detail': 'Acesso negado. Apenas administradores podem baixar o modelo.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            content = build_protocolo_import_template()
        except Exception as exc:
            return Response(
                {'detail': f'Não foi possível gerar a planilha de referência: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        response = HttpResponse(
            content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = (
            'attachment; filename="modelo_importacao_protocolos.xlsx"'
        )
        response['Content-Length'] = str(len(content))
        return response

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def import_spreadsheet(self, request):
        """Importa protocolos a partir de planilha .xlsx — somente administradores."""
        if not request.user.is_admin:
            return Response(
                {'detail': 'Acesso negado. Apenas administradores podem importar protocolos.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        arquivo = request.FILES.get('file') or request.FILES.get('arquivo')
        if not arquivo:
            return Response(
                {'detail': 'Arquivo Excel (.xlsx) não fornecido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cliente_id = request.data.get('clienteId') or request.data.get('cliente_id')
        if not cliente_id:
            return Response(
                {'detail': 'Informe o cliente (clienteId).'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            cliente = ClienteProtocolo.objects.get(pk=int(cliente_id))
        except (TypeError, ValueError, ClienteProtocolo.DoesNotExist):
            return Response(
                {'detail': 'Cliente de protocolo não encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        def _flag(name: str) -> bool:
            raw = request.data.get(name)
            if raw is None:
                return False
            if isinstance(raw, bool):
                return raw
            return str(raw).strip().lower() in ('1', 'true', 'yes', 'on', 'sim')

        dry_run = _flag('dryRun') or _flag('dry_run')
        skip_duplicatas = _flag('skipDuplicatas') or _flag('skip_duplicatas')
        sheet = (request.data.get('sheet') or '').strip()
        col_data = (request.data.get('colData') or request.data.get('col_data') or '').strip()
        col_nf = (request.data.get('colNf') or request.data.get('col_nf') or '').strip()
        col_expedicao = (
            request.data.get('colExpedicao') or request.data.get('col_expedicao') or ''
        ).strip()
        col_filial = (
            request.data.get('colFilial') or request.data.get('col_filial') or ''
        ).strip()

        file_bytes = arquivo.read()
        if not file_bytes:
            return Response(
                {'detail': 'Arquivo vazio ou inválido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = import_protocolos_from_workbook(
                file_bytes,
                cliente=cliente,
                dry_run=dry_run,
                skip_duplicatas=skip_duplicatas,
                sheet=sheet,
                col_data=col_data,
                col_nf=col_nf,
                col_expedicao=col_expedicao,
                col_filial=col_filial,
                usuario=request.user if not dry_run else None,
                usuario_nome=_usuario_display(request.user) or 'Importação Excel',
                file_name=getattr(arquivo, 'name', '') or '',
            )
        except ProtocoloImportError as exc:
            return Response({'detail': str(exc), 'success': False}, status=status.HTTP_400_BAD_REQUEST)

        if result['success'] and not dry_run and result['created']:
            record_audit(
                request.user,
                'faturamento.protocolo.importado',
                (
                    f'Importação Excel ({result["fileName"] or "planilha"}) — '
                    f'{result["created"]} protocolo(s) para "{cliente.nome}".'
                ),
            )

        status_code = status.HTTP_200_OK if result['success'] or dry_run else status.HTTP_400_BAD_REQUEST
        return Response(result, status=status_code)