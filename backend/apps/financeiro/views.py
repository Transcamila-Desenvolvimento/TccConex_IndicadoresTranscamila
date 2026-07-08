from datetime import date

from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.audit.services import record_audit

from .async_imports import celery_enabled, save_upload

from .batch_service import create_import_batch
from .constants import MAX_REPORT_BATCHES
from .billing_import_service import import_billing_xml
from .import_service import import_report_file
from .models import (
    AgingTitulo,
    BalanceHistoryEntry,
    BankAccount,
    BillingRecord,
    CashAdjustment,
    PagarTitulo,
    ReceberTitulo,
    ReportBatch,
)
from .balance_service import refresh_account_balance, sync_account_metadata
from .list_filters import (
    filter_adjustments_queryset,
    filter_balance_history_queryset,
    filter_billing_queryset,
)
from .pagination import ReportPagination
from .report_filters import (
    active_batch,
    filter_aging_queryset,
    filter_pagar_queryset,
    filter_receber_queryset,
    report_facets,
)
from .serializers import (
    AgingTituloSerializer,
    BalanceHistoryEntrySerializer,
    BankAccountSerializer,
    BillingRecordSerializer,
    CashAdjustmentSerializer,
    PagarTituloSerializer,
    ReceberTituloSerializer,
    ReportBatchSerializer,
)
from .pagar_diff_service import build_pagar_diff_analysis
from .pr_analysis_service import apply_pr_action, build_pr_analysis
from .tasks import import_billing_xml_task, import_report_task


def _report_import_response(report_type: str, file_name: str, result: dict):
    return Response({
        'type': report_type,
        'fileName': file_name,
        'success': result['success'],
        'rowCount': result['rowCount'],
        'skippedRows': result['skippedRows'],
        'issues': result['issues'],
    }, status=status.HTTP_200_OK if result['success'] else status.HTTP_400_BAD_REQUEST)


class ReportBatchViewSet(ModuleScopedViewMixin, viewsets.ReadOnlyModelViewSet):
    permission_module = 'Financeiro'
    serializer_class = ReportBatchSerializer
    queryset = ReportBatch.objects.select_related('updated_by').order_by(
        '-is_active', '-reference_date', '-created_at',
    )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'maxBatches': MAX_REPORT_BATCHES,
            'results': serializer.data,
        })

    @action(detail=False, methods=['post'])
    def prepare_import(self, request):
        batch, created = create_import_batch(request.user)
        if created:
            record_audit(
                request.user,
                'financeiro.lote.criado',
                f'Lote {batch.label} criado para importação.',
            )
            return Response(ReportBatchSerializer(batch).data, status=status.HTTP_201_CREATED)

        record_audit(
            request.user,
            'financeiro.lote.reutilizado',
            f'Lote {batch.label} reutilizado para importação do dia.',
        )
        return Response(ReportBatchSerializer(batch).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def import_report(self, request, pk=None):
        batch = self.get_object()
        report_type = request.data.get('type')
        upload = request.FILES.get('file')

        if report_type not in ('pagar', 'receber', 'aging'):
            return Response({'detail': 'Tipo de relatório inválido.', 'success': False, 'issues': []}, status=status.HTTP_400_BAD_REQUEST)
        if not upload:
            return Response({'detail': 'Arquivo não enviado.', 'success': False, 'issues': []}, status=status.HTTP_400_BAD_REQUEST)

        file_bytes = upload.read()
        file_name = upload.name

        if celery_enabled():
            temp_path = save_upload(file_bytes, file_name)
            task = import_report_task.delay(
                str(batch.pk),
                report_type,
                str(temp_path),
                file_name,
                request.user.pk if request.user.is_authenticated else None,
            )
            return Response({'async': True, 'taskId': task.id}, status=status.HTTP_202_ACCEPTED)

        try:
            result = import_report_file(batch, report_type, file_bytes, file_name)
        except Exception as exc:
            return Response({
                'type': report_type,
                'fileName': file_name,
                'success': False,
                'rowCount': 0,
                'skippedRows': 0,
                'issues': [{'severity': 'error', 'message': f'Erro ao processar arquivo: {exc}'}],
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        batch.updated_by = request.user
        batch.save(update_fields=['updated_by'])
        if result['success']:
            record_audit(
                request.user,
                'importacao.relatorio',
                f'Importação {report_type} ({file_name}) — {result["rowCount"]} linha(s).',
            )
        return _report_import_response(report_type, file_name, result)

    @action(detail=True, methods=['post'])
    def finalize(self, request, pk=None):
        batch = self.get_object()
        ReportBatch.objects.update(is_active=False)
        batch.is_active = True
        batch.updated_by = request.user
        batch.save(update_fields=['is_active', 'updated_by'])
        record_audit(
            request.user,
            'financeiro.lote.ativado',
            f'Lote {batch.label} definido como lote atual.',
        )
        return Response(ReportBatchSerializer(batch).data)


class ActiveReportDataView(ModuleScopedViewMixin, APIView):
    permission_module = 'Financeiro'
    pagination_class = ReportPagination

    def get(self, request, report_type):
        batch = active_batch()
        if not batch:
            paginator = self.pagination_class()
            return paginator.get_paginated_response([])

        params = request.query_params

        if report_type == 'pagar':
            qs = filter_pagar_queryset(PagarTitulo.objects.filter(batch=batch), params, request.user, request)
            serializer_class = PagarTituloSerializer
        elif report_type == 'receber':
            qs = filter_receber_queryset(ReceberTitulo.objects.filter(batch=batch), params, request.user, request)
            serializer_class = ReceberTituloSerializer
        elif report_type == 'aging':
            qs = filter_aging_queryset(AgingTitulo.objects.filter(batch=batch), params, request.user, request)
            serializer_class = AgingTituloSerializer
        else:
            return Response({'detail': 'Tipo inválido.'}, status=status.HTTP_400_BAD_REQUEST)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        serializer = serializer_class(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class ReportFacetsView(ModuleScopedViewMixin, APIView):
    permission_module = 'Financeiro'

    def get(self, request, report_type):
        if report_type not in ('pagar', 'receber', 'aging'):
            return Response({'detail': 'Tipo inválido.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(report_facets(active_batch(), report_type, request.user, request))


class CeleryTaskStatusView(ModuleScopedViewMixin, APIView):
    permission_module = 'Financeiro'

    def get(self, request, task_id):
        if not celery_enabled():
            return Response({'detail': 'Celery não habilitado.'}, status=status.HTTP_400_BAD_REQUEST)

        from celery.result import AsyncResult

        async_result = AsyncResult(task_id)
        payload = {
            'taskId': task_id,
            'status': async_result.status,
        }
        if async_result.successful():
            payload['result'] = async_result.result
        elif async_result.failed():
            payload['error'] = str(async_result.result)
        return Response(payload)


class BillingRecordViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Financeiro'
    # Faturamento é consolidado — todas as filiais de billing (incl. Barueri, Armazém)
    # ficam visíveis para qualquer usuário com acesso ao módulo Financeiro.
    permission_requires_filial = False
    serializer_class = BillingRecordSerializer
    queryset = BillingRecord.objects.all()
    pagination_class = ReportPagination
    http_method_names = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']

    def get_queryset(self):
        return filter_billing_queryset(BillingRecord.objects.all(), self.request.query_params)

    def paginate_queryset(self, queryset):
        if self.request.query_params.get('export') == 'true' or self.request.query_params.get('pagination') == 'none':
            return None
        return super().paginate_queryset(queryset)

    def create(self, request, *args, **kwargs):
        return Response(
            {'detail': 'Criação manual não permitida. Use importação de relatório.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def perform_update(self, serializer):
        record = serializer.save()
        record_audit(
            self.request.user,
            'financeiro.faturamento.atualizado',
            f'Faturamento #{record.pk} ({record.branch}, {record.reference_date}) — R$ {record.value}.',
        )

    def perform_destroy(self, instance):
        record_audit(
            self.request.user,
            'financeiro.faturamento.excluido',
            f'Faturamento #{instance.pk} ({instance.branch}, {instance.reference_date}) excluído.',
        )
        super().perform_destroy(instance)

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def import_xml(self, request):
        upload = request.FILES.get('file')
        if not upload:
            return Response({'detail': 'Arquivo não enviado.', 'success': False}, status=status.HTTP_400_BAD_REQUEST)

        file_bytes = upload.read()

        if celery_enabled():
            temp_path = save_upload(file_bytes, upload.name)
            task = import_billing_xml_task.delay(
                str(temp_path),
                upload.name,
                request.user.pk if request.user.is_authenticated else None,
            )
            return Response({'async': True, 'taskId': task.id}, status=status.HTTP_202_ACCEPTED)

        result = import_billing_xml(file_bytes)
        if result['success']:
            record_audit(
                request.user,
                'financeiro.faturamento.importado',
                f'Importação XML ({upload.name}) — R$ {result["totalValue"]:.2f} em {result["totalNotes"]} nota(s).',
            )
        status_code = status.HTTP_200_OK if result['success'] else status.HTTP_400_BAD_REQUEST
        return Response(result, status=status_code)


class CashAdjustmentViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Financeiro'
    serializer_class = CashAdjustmentSerializer
    queryset = CashAdjustment.objects.all()
    pagination_class = ReportPagination

    def get_queryset(self):
        return filter_adjustments_queryset(CashAdjustment.objects.all(), self.request.query_params)

    def perform_create(self, serializer):
        adj = serializer.save(created_by=self.request.user.username)
        record_audit(
            self.request.user,
            'financeiro.ajuste.criado',
            f'Ajuste ({adj.adjustment_type}) R$ {adj.value} — {(adj.observation or "")[:80]}',
        )

    def perform_update(self, serializer):
        adj = serializer.save(created_by=self.request.user.username)
        record_audit(
            self.request.user,
            'financeiro.ajuste.atualizado',
            f'Ajuste #{adj.pk} atualizado.',
        )

    def perform_destroy(self, instance):
        record_audit(
            self.request.user,
            'financeiro.ajuste.excluido',
            f'Ajuste #{instance.pk} excluído.',
        )
        super().perform_destroy(instance)


class BankAccountViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Financeiro'
    serializer_class = BankAccountSerializer
    queryset = BankAccount.objects.all()

    def perform_create(self, serializer):
        account = serializer.save(balance=0, last_updated='--/--/----')
        record_audit(
            self.request.user,
            'financeiro.conta.criada',
            f'Conta {account.bank} ({account.number}) cadastrada.',
        )

    def perform_update(self, serializer):
        account = serializer.save()
        sync_account_metadata(account)
        refresh_account_balance(account.pk)
        record_audit(
            self.request.user,
            'financeiro.conta.atualizada',
            f'Conta #{account.pk} ({account.bank}) atualizada.',
        )

    def perform_destroy(self, instance):
        record_audit(
            self.request.user,
            'financeiro.conta.excluida',
            f'Conta #{instance.pk} ({instance.bank}) excluída.',
        )
        super().perform_destroy(instance)


class BalanceHistoryEntryViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Financeiro'
    serializer_class = BalanceHistoryEntrySerializer
    queryset = BalanceHistoryEntry.objects.select_related('account').all()
    pagination_class = ReportPagination

    def get_queryset(self):
        qs = BalanceHistoryEntry.objects.select_related('account').all()
        return filter_balance_history_queryset(qs, self.request.query_params)

    def perform_create(self, serializer):
        entry = serializer.save()
        refresh_account_balance(entry.account_id)
        record_audit(
            self.request.user,
            'financeiro.saldo.lancamento_criado',
            f'Lançamento #{entry.pk} — conta {entry.bank} ({entry.number}).',
        )

    def perform_update(self, serializer):
        previous_account_id = serializer.instance.account_id
        entry = serializer.save()
        refresh_account_balance(previous_account_id)
        if entry.account_id != previous_account_id:
            refresh_account_balance(entry.account_id)
        record_audit(
            self.request.user,
            'financeiro.saldo.lancamento_atualizado',
            f'Lançamento #{entry.pk} atualizado.',
        )

    def perform_destroy(self, instance):
        account_id = instance.account_id
        record_audit(
            self.request.user,
            'financeiro.saldo.lancamento_excluido',
            f'Lançamento #{instance.pk} excluído.',
        )
        super().perform_destroy(instance)
        refresh_account_balance(account_id)


class BankDataSyncView(ModuleScopedViewMixin, APIView):
    permission_module = 'Financeiro'

    def post(self, request):
        accounts_data = request.data.get('accounts', [])
        history_data = request.data.get('history', [])

        with transaction.atomic():
            kept_account_ids: list[int] = []

            for raw in accounts_data:
                pk = raw.get('id')
                fields = {
                    'bank': raw.get('bank', ''),
                    'agency': raw.get('agency', ''),
                    'number': raw.get('number', ''),
                    'account_type': raw.get('type') or raw.get('account_type', 'Corrente'),
                    'balance': raw.get('balance', 0),
                    'credit_limit': raw.get('creditLimit') or raw.get('credit_limit', 0),
                    'last_updated': raw.get('lastUpdated') or raw.get('last_updated', ''),
                }
                if pk and BankAccount.objects.filter(pk=pk).exists():
                    BankAccount.objects.filter(pk=pk).update(**fields)
                    acc = BankAccount.objects.get(pk=pk)
                else:
                    acc = BankAccount.objects.create(**fields)
                kept_account_ids.append(acc.id)

            BankAccount.objects.exclude(id__in=kept_account_ids).delete()

            kept_history_ids: list[int] = []
            for raw in history_data:
                pk = raw.get('id')
                account_id = raw.get('accountId') or raw.get('account_id')
                if not account_id or not BankAccount.objects.filter(pk=account_id).exists():
                    continue
                fields = {
                    'account_id': account_id,
                    'reference_date': raw.get('date') or raw.get('reference_date'),
                    'bank': raw.get('bank', ''),
                    'number': raw.get('number', ''),
                    'entry_type': raw.get('type') or raw.get('entry_type', 'Corrente'),
                    'value': raw.get('value', 0),
                }
                if pk and BalanceHistoryEntry.objects.filter(pk=pk).exists():
                    BalanceHistoryEntry.objects.filter(pk=pk).update(**fields)
                    kept_history_ids.append(int(pk))
                else:
                    entry = BalanceHistoryEntry.objects.create(**fields)
                    kept_history_ids.append(entry.id)

            BalanceHistoryEntry.objects.exclude(id__in=kept_history_ids).delete()

        record_audit(
            request.user,
            'financeiro.saldos.sync',
            f'Sincronização de saldos — {len(kept_account_ids)} conta(s), {len(kept_history_ids)} lançamento(s).',
        )

        return Response({
            'accounts': BankAccountSerializer(BankAccount.objects.all(), many=True).data,
            'history': BalanceHistoryEntrySerializer(
                BalanceHistoryEntry.objects.select_related('account').all(), many=True
            ).data,
        })


class PrAnalysisView(ModuleScopedViewMixin, APIView):
    permission_module = 'Financeiro'

    def get(self, request):
        batch = active_batch()
        if not batch:
            return Response({'detail': 'Nenhum lote ativo.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(build_pr_analysis(batch))


class PagarDiffAnalysisView(ModuleScopedViewMixin, APIView):
    permission_module = 'Financeiro'

    def get(self, request):
        batch = active_batch()
        raw_batch_id = (request.query_params.get('batchId') or request.query_params.get('batch_id') or '').strip()
        if raw_batch_id:
            try:
                batch = ReportBatch.objects.get(pk=raw_batch_id)
            except (ReportBatch.DoesNotExist, ValueError, TypeError):
                return Response({'detail': 'Lote não encontrado.'}, status=status.HTTP_400_BAD_REQUEST)

        if not batch:
            return Response({'detail': 'Nenhum lote ativo.'}, status=status.HTTP_400_BAD_REQUEST)
        if not batch.imported_pagar:
            return Response({'detail': 'O lote selecionado não possui Contas a Pagar importado.'}, status=status.HTTP_400_BAD_REQUEST)

        date_start = None
        date_end = None
        raw_start = (request.query_params.get('start') or request.query_params.get('dateStart') or '').strip()
        raw_end = (request.query_params.get('end') or request.query_params.get('dateEnd') or '').strip()
        try:
            if raw_start:
                date_start = date.fromisoformat(raw_start)
            if raw_end:
                date_end = date.fromisoformat(raw_end)
        except ValueError:
            return Response({'detail': 'Período inválido. Use o formato AAAA-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        if date_start and date_end and date_end < date_start:
            return Response({'detail': 'A data final deve ser maior ou igual à data inicial.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(build_pagar_diff_analysis(batch, date_start, date_end))


class PrActionView(ModuleScopedViewMixin, APIView):
    permission_module = 'Financeiro'

    def post(self, request):
        action = (request.data.get('action') or '').strip()
        raw_ids = request.data.get('ids') or []
        if isinstance(raw_ids, str):
            raw_ids = [raw_ids]
        try:
            ids = [int(item) for item in raw_ids]
        except (TypeError, ValueError) as exc:
            return Response({'detail': 'IDs inválidos.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            updated = apply_pr_action(ids, action)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        message = (
            f'{updated} PR(s) desconsiderada(s) com sucesso.'
            if action == 'ignore'
            else f'{updated} PR(s) restaurada(s) com sucesso.'
        )
        record_audit(
            request.user,
            'financeiro.pr.ignorado' if action == 'ignore' else 'financeiro.pr.restaurado',
            f'{updated} PR(s) — IDs: {ids}.',
        )
        return Response({'message': message, 'updated': updated})
