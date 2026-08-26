from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0011_alter_cte_nota_fiscal_max_length'),
    ]

    operations = [
        migrations.AlterField(
            model_name='pesquisasatisfacao',
            name='cliente',
            field=models.CharField(default='OUTROS', max_length=200, verbose_name='Cliente'),
        ),
    ]
