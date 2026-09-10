from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0005_proposta_servico'),
    ]

    operations = [
        migrations.AddField(
            model_name='propostafretelinha',
            name='veiculo',
            field=models.CharField(blank=True, default='', max_length=80, verbose_name='Veículo'),
        ),
        migrations.AlterField(
            model_name='propostafretelinha',
            name='entrega',
            field=models.CharField(blank=True, default='', max_length=120, verbose_name='Destino'),
        ),
    ]
