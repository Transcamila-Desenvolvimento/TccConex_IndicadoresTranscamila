from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0049_proposta_validade_inicio'),
    ]

    operations = [
        migrations.AddField(
            model_name='propostacomercial',
            name='historico_situacoes',
            field=models.JSONField(blank=True, default=list, verbose_name='Histórico de situações'),
        ),
        migrations.AddField(
            model_name='propostacomercial',
            name='aviso_reprogramacao_pendente',
            field=models.BooleanField(default=False, verbose_name='Aviso de reprogramação pendente'),
        ),
    ]
