from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0051_proposta_carga_fechada'),
    ]

    operations = [
        migrations.AddField(
            model_name='propostacomercial',
            name='envio_iniciado_em',
            field=models.DateTimeField(
                blank=True,
                editable=False,
                null=True,
                verbose_name='Envio por e-mail em andamento desde',
            ),
        ),
    ]
