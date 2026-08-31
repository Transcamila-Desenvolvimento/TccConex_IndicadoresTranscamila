from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('frota', '0004_custos_frota'),
    ]

    operations = [
        migrations.DeleteModel(name='OcorrenciaFrota'),
        migrations.DeleteModel(name='TipoOcorrenciaFrota'),
    ]
