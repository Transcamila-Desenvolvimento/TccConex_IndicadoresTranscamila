from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0043_resposta_evidencia_justificativa'),
    ]

    operations = [
        migrations.AddField(
            model_name='anexorespostaauditoriasgq',
            name='drive_file_id',
            field=models.CharField(blank=True, default='', max_length=128, verbose_name='ID no Google Drive'),
        ),
        migrations.AddField(
            model_name='anexorespostaauditoriasgq',
            name='drive_url',
            field=models.CharField(blank=True, default='', max_length=500, verbose_name='Link no Google Drive'),
        ),
    ]
