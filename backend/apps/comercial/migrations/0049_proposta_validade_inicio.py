from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0048_proposta_vencimento_reprogramado'),
    ]

    operations = [
        migrations.AddField(
            model_name='propostacomercial',
            name='validade_inicio',
            field=models.DateField(blank=True, null=True, verbose_name='Início da validade'),
        ),
        migrations.AlterField(
            model_name='propostacomercial',
            name='vencimento_reprogramado',
            field=models.DateField(blank=True, null=True, verbose_name='Data de vencimento'),
        ),
    ]
