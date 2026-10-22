from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0050_proposta_historico_situacoes'),
    ]

    operations = [
        migrations.AddField(
            model_name='propostacomercial',
            name='inclui_carga_fechada',
            field=models.BooleanField(default=False, verbose_name='Carga Fechada'),
        ),
    ]
