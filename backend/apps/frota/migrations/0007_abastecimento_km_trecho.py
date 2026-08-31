from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('frota', '0006_veiculo_tipo_carroceria_choices'),
    ]

    operations = [
        migrations.AddField(
            model_name='custoabastecimentolinha',
            name='km_trecho',
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                verbose_name='Km no trecho (Tempo em Operação)',
            ),
        ),
    ]
