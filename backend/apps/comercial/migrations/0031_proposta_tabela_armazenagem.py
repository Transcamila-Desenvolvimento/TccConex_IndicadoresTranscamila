from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0030_fispq_link'),
    ]

    operations = [
        migrations.AddField(
            model_name='propostacomercial',
            name='tabela_armazenagem',
            field=models.JSONField(blank=True, default=dict, verbose_name='Tabela de armazenagem'),
        ),
    ]
