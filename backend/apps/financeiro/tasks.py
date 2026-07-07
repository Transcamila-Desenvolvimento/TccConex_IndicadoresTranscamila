from pathlib import Path

from celery import shared_task
from django.contrib.auth import get_user_model

from apps.audit.services import record_audit

from .async_imports import remove_upload
from .billing_import_service import import_billing_xml
from .import_service import import_report_file
from .models import ReportBatch

User = get_user_model()


def _resolve_user(user_id: int | None):
    if not user_id:
        return None
    try:
        return User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return None


@shared_task(bind=True, name='financeiro.import_report')
def import_report_task(self, batch_id: str, report_type: str, temp_path: str, file_name: str, user_id: int | None):
    path = Path(temp_path)
    try:
        file_bytes = path.read_bytes()
        batch = ReportBatch.objects.get(pk=batch_id)
        result = import_report_file(batch, report_type, file_bytes, file_name)

        user = _resolve_user(user_id)
        if user:
            batch.updated_by = user
            batch.save(update_fields=['updated_by'])

        if result['success']:
            record_audit(
                user,
                'importacao.relatorio',
                f'Importação {report_type} ({file_name}) — {result["rowCount"]} linha(s).',
            )

        return {
            'type': report_type,
            'fileName': file_name,
            'success': result['success'],
            'rowCount': result['rowCount'],
            'skippedRows': result['skippedRows'],
            'issues': result['issues'],
        }
    finally:
        remove_upload(path)


@shared_task(bind=True, name='financeiro.import_billing_xml')
def import_billing_xml_task(self, temp_path: str, file_name: str = '', user_id: int | None = None):
    path = Path(temp_path)
    try:
        result = import_billing_xml(path.read_bytes())
        if result['success']:
            record_audit(
                _resolve_user(user_id),
                'financeiro.faturamento.importado',
                f'Importação XML ({file_name}) — R$ {result["totalValue"]:.2f} em {result["totalNotes"]} nota(s).',
            )
        return result
    finally:
        remove_upload(path)
