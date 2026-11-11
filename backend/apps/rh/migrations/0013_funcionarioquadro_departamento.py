from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rh', '0012_quadro_ativo_e_demissao'),
    ]

    operations = [
        migrations.AddField(
            model_name='funcionarioquadro',
            name='departamento',
            field=models.CharField(blank=True, default='', max_length=30, verbose_name='Departamento'),
        ),
    ]
