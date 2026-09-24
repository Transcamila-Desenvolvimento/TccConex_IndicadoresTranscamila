from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0039_proposta_revisao_inplace_novamente'),
    ]

    operations = [
        migrations.AddField(
            model_name='propostafretelinha',
            name='retirada_ctnt',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=14,
                null=True,
                verbose_name='Retirada CTNT',
            ),
        ),
        migrations.AddField(
            model_name='propostafretelinha',
            name='desova_ctnt',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=14,
                null=True,
                verbose_name='Desova CTNT',
            ),
        ),
    ]
