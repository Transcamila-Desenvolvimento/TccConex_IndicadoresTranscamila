from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('rh', '0005_documentorh_texto'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='documentorh',
            name='liberado_agente',
        ),
    ]
