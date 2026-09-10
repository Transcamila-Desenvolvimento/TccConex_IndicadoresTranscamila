from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0021_generalidade_tipos_separados'),
    ]

    operations = [
        migrations.AddField(
            model_name='clientecomercial',
            name='responsavel',
            field=models.CharField(blank=True, default='', max_length=150, verbose_name='Responsável'),
        ),
    ]
