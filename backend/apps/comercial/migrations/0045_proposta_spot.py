from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0044_proposta_emitido_por'),
    ]

    operations = [
        migrations.AddField(
            model_name='propostacomercial',
            name='inclui_spot',
            field=models.BooleanField(default=False, verbose_name='Spot'),
        ),
        migrations.AddField(
            model_name='propostafretelinha',
            name='outros_valores',
            field=models.CharField(blank=True, default='', max_length=240, verbose_name='Outros valores'),
        ),
    ]
