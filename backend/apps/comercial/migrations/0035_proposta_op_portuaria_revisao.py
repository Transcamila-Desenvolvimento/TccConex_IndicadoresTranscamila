from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0034_proposta_inclui_armazenagem'),
    ]

    operations = [
        migrations.AddField(
            model_name='propostacomercial',
            name='inclui_op_portuaria',
            field=models.BooleanField(default=False, verbose_name='Op. Portuária'),
        ),
        migrations.AddField(
            model_name='propostacomercial',
            name='margens_veiculo',
            field=models.JSONField(blank=True, default=list, verbose_name='Margens da proposta'),
        ),
        migrations.AddField(
            model_name='propostacomercial',
            name='tabela_distribuicao',
            field=models.JSONField(blank=True, default=dict, verbose_name='Snapshot da tabela de distribuição'),
        ),
        migrations.AddField(
            model_name='propostacomercial',
            name='historico_revisoes',
            field=models.JSONField(blank=True, default=list, verbose_name='Trilha de revisões'),
        ),
        migrations.AddField(
            model_name='propostacomercial',
            name='modo_envio',
            field=models.CharField(blank=True, default='', max_length=20, verbose_name='Próximo envio'),
        ),
        migrations.AddField(
            model_name='propostafretelinha',
            name='veiculo_key',
            field=models.CharField(blank=True, default='', max_length=40),
        ),
        migrations.AddField(
            model_name='propostafretelinha',
            name='modalidade',
            field=models.CharField(blank=True, default='transferencia', max_length=20),
        ),
        migrations.AddField(
            model_name='propostafretelinha',
            name='km',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
    ]
