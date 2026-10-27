from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0026_pontuacao_auditoria'),
    ]

    operations = [
        migrations.RemoveField(model_name='itemnormasgq', name='tipo_resposta'),
        migrations.RenameField(model_name='itemnormasgq', old_name='tipo_resposta_ref', new_name='tipo_resposta'),
    ]
