from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rh', '0011_quadro_somente_ativos'),
    ]

    operations = [
        migrations.AddField(
            model_name='funcionarioquadro',
            name='ativo',
            field=models.BooleanField(default=True, verbose_name='Ativo'),
        ),
        migrations.AddField(
            model_name='funcionarioquadro',
            name='data_demissao',
            field=models.DateField(blank=True, null=True, verbose_name='Demissão'),
        ),
    ]
