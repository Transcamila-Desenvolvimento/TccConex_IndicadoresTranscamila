from django.db import migrations, models


def preencher_data_conclusao(apps, schema_editor):
    AuditoriaSGQ = apps.get_model('sgq', 'AuditoriaSGQ')
    AuditLog = apps.get_model('audit', 'AuditLog')
    concluidas = AuditoriaSGQ.objects.filter(
        questionario_concluido=True,
        questionario_concluido_em__isnull=True,
    )
    for auditoria in concluidas:
        registro = (
            AuditLog.objects.filter(
                action='sgq.auditoria.questionario_concluido',
                details__contains=auditoria.codigo,
            )
            .order_by('-created_at')
            .first()
        )
        if registro is None:
            continue
        auditoria.questionario_concluido_em = registro.created_at
        auditoria.save(update_fields=['questionario_concluido_em'])


class Migration(migrations.Migration):

    dependencies = [
        ('audit', '0001_initial'),
        ('sgq', '0045_anexo_somente_drive'),
    ]

    operations = [
        migrations.AddField(
            model_name='auditoriasgq',
            name='questionario_concluido_em',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Questionário concluído em'),
        ),
        migrations.RunPython(preencher_data_conclusao, migrations.RunPython.noop),
    ]
