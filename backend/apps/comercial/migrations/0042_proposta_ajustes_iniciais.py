from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0041_generalidade_op_portuaria'),
    ]

    operations = [
        migrations.AddField(
            model_name='propostacomercial',
            name='ajustes_iniciais',
            field=models.JSONField(
                blank=True,
                default=list,
                verbose_name='Ajustes iniciais congelados no primeiro envio',
            ),
        ),
    ]
