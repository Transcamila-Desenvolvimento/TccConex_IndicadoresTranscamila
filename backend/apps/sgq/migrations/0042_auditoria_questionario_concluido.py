from django.db import migrations, models


def marcar_questionarios_ja_concluidos(apps, schema_editor):
    AuditoriaSGQ = apps.get_model('sgq', 'AuditoriaSGQ')
    AuditoriaSGQ.objects.filter(status='concluida').update(questionario_concluido=True)


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0041_auditoria_consideracoes_finais'),
    ]

    operations = [
        migrations.AddField(
            model_name='auditoriasgq',
            name='questionario_concluido',
            field=models.BooleanField(default=False, verbose_name='Questionário concluído'),
        ),
        migrations.RunPython(marcar_questionarios_ja_concluidos, migrations.RunPython.noop),
    ]
