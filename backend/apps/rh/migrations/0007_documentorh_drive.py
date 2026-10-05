import apps.rh.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rh', '0006_remove_documentorh_liberado_agente'),
    ]

    operations = [
        migrations.AddField(
            model_name='documentorh',
            name='drive_file_id',
            field=models.CharField(blank=True, default='', max_length=128, verbose_name='ID no Google Drive'),
        ),
        migrations.AddField(
            model_name='documentorh',
            name='link_externo',
            field=models.CharField(blank=True, default='', max_length=500, verbose_name='Link no Google Drive'),
        ),
        migrations.AlterField(
            model_name='documentorh',
            name='arquivo',
            field=models.FileField(blank=True, upload_to=apps.rh.models.documento_upload_path, verbose_name='Arquivo'),
        ),
    ]
