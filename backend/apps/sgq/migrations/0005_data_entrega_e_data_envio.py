from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0004_merge_analise_tratativa'),
    ]

    operations = [
        migrations.RenameField(
            model_name='pesquisasatisfacao',
            old_name='data',
            new_name='data_entrega',
        ),
        migrations.AlterField(
            model_name='pesquisasatisfacao',
            name='data_entrega',
            field=models.DateField(verbose_name='Data Entrega'),
        ),
        migrations.AddField(
            model_name='pesquisasatisfacao',
            name='data_envio',
            field=models.DateField(blank=True, null=True, verbose_name='Data de Envio'),
        ),
        migrations.AlterModelOptions(
            name='pesquisasatisfacao',
            options={'ordering': ['-data_entrega', '-id'], 'verbose_name': 'Pesquisa de Satisfação', 'verbose_name_plural': 'Pesquisas de Satisfação'},
        ),
    ]
