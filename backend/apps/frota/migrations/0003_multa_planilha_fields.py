from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('frota', '0002_ocorrencias_condutores'),
    ]

    operations = [
        migrations.AlterField(
            model_name='condutorfrota',
            name='cpf',
            field=models.CharField(blank=True, max_length=11, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='ocorrenciafrota',
            name='auto_infracao',
            field=models.CharField(blank=True, default='', max_length=40, verbose_name='Auto de infração'),
        ),
        migrations.AddField(
            model_name='ocorrenciafrota',
            name='codigo_infracao',
            field=models.CharField(blank=True, default='', max_length=20, verbose_name='Código da infração'),
        ),
        migrations.AddField(
            model_name='ocorrenciafrota',
            name='natureza',
            field=models.CharField(blank=True, default='', max_length=80, verbose_name='Natureza'),
        ),
        migrations.AddField(
            model_name='ocorrenciafrota',
            name='classificacao_infracao',
            field=models.CharField(
                choices=[
                    ('nao_aplica', 'Não aplica'),
                    ('leve', 'Leve'),
                    ('media', 'Média'),
                    ('grave', 'Grave'),
                    ('gravissima', 'Gravíssima'),
                ],
                default='media',
                max_length=20,
                verbose_name='Classificação',
            ),
        ),
        migrations.AddField(
            model_name='ocorrenciafrota',
            name='placa',
            field=models.CharField(blank=True, default='', max_length=15),
        ),
        migrations.AddField(
            model_name='ocorrenciafrota',
            name='velocidade_medida',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='ocorrenciafrota',
            name='velocidade_limite',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='ocorrenciafrota',
            name='descontado_condutor',
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name='ocorrenciafrota',
            name='tipo',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='ocorrencias',
                to='frota.tipoocorrenciafrota',
            ),
        ),
    ]
