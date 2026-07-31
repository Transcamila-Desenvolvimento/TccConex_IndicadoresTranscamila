from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0006_remove_cliente_upl'),
    ]

    operations = [
        migrations.RenameField(
            model_name='pesquisasatisfacao',
            old_name='data_envio',
            new_name='data_inclusao',
        ),
        migrations.AlterField(
            model_name='pesquisasatisfacao',
            name='data_inclusao',
            field=models.DateField(
                blank=True,
                null=True,
                verbose_name='Data de Inclusão',
            ),
        ),
    ]
