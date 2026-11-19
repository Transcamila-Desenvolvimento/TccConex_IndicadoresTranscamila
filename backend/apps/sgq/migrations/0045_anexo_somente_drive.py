from django.db import migrations, models

import apps.sgq.models


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0044_anexo_auditoria_drive'),
    ]

    operations = [
        migrations.AlterField(
            model_name='anexorespostaauditoriasgq',
            name='arquivo',
            field=models.FileField(blank=True, upload_to=apps.sgq.models.anexo_resposta_upload_path, verbose_name='Arquivo'),
        ),
    ]
