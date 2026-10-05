from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rh', '0004_documentorh'),
    ]

    operations = [
        migrations.AddField(
            model_name='documentorh',
            name='texto',
            field=models.TextField(blank=True, default='', verbose_name='Texto para consulta'),
        ),
        migrations.AddField(
            model_name='documentorh',
            name='texto_extraido',
            field=models.BooleanField(default=False, verbose_name='Texto já extraído'),
        ),
    ]
