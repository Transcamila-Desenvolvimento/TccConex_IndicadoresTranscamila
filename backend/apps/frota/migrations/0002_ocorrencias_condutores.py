from django.db import migrations, models
import django.db.models.deletion

TIPOS_OCORRENCIA_PADRAO = [
    ('multa-leve', 'Multa leve', 'multa', 3, 10),
    ('multa-media', 'Multa média', 'multa', 4, 20),
    ('multa-grave', 'Multa grave', 'multa', 5, 30),
    ('multa-gravissima', 'Multa gravíssima', 'multa', 7, 40),
    ('acidente-sem-vitima', 'Acidente sem vítima', 'acidente', 10, 50),
    ('acidente-com-vitima', 'Acidente com vítima', 'acidente', 20, 60),
    ('atraso', 'Atraso', 'operacional', 1, 70),
    ('avaria-veiculo', 'Avaria no veículo', 'operacional', 3, 80),
    ('recusa-viagem', 'Recusa de viagem', 'operacional', 5, 90),
    ('conduta-inadequada', 'Conduta inadequada', 'conduta', 4, 100),
    ('outro', 'Outros', 'operacional', 2, 110),
]


def seed_tipos(apps, schema_editor):
    TipoOcorrenciaFrota = apps.get_model('frota', 'TipoOcorrenciaFrota')
    for chave, nome, categoria, pontos, ordem in TIPOS_OCORRENCIA_PADRAO:
        TipoOcorrenciaFrota.objects.update_or_create(
            chave=chave,
            defaults={
                'nome': nome,
                'categoria': categoria,
                'pontos': pontos,
                'ordem': ordem,
                'ativo': True,
            },
        )


def unseed_tipos(apps, schema_editor):
    TipoOcorrenciaFrota = apps.get_model('frota', 'TipoOcorrenciaFrota')
    TipoOcorrenciaFrota.objects.filter(chave__in=[item[0] for item in TIPOS_OCORRENCIA_PADRAO]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('frota', '0001_veiculo_frota'),
    ]

    operations = [
        migrations.CreateModel(
            name='TipoOcorrenciaFrota',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('chave', models.SlugField(max_length=40, unique=True)),
                ('nome', models.CharField(max_length=80)),
                ('categoria', models.CharField(choices=[('multa', 'Multa'), ('acidente', 'Acidente'), ('operacional', 'Operacional'), ('conduta', 'Conduta')], max_length=20)),
                ('pontos', models.PositiveSmallIntegerField(verbose_name='Pontos descontados')),
                ('ativo', models.BooleanField(default=True)),
                ('ordem', models.PositiveSmallIntegerField(default=0)),
            ],
            options={
                'verbose_name': 'Tipo de ocorrência',
                'verbose_name_plural': 'Tipos de ocorrência',
                'ordering': ['ordem', 'nome'],
            },
        ),
        migrations.CreateModel(
            name='CondutorFrota',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nome', models.CharField(max_length=150)),
                ('cpf', models.CharField(max_length=11, unique=True)),
                ('filial', models.CharField(choices=[('Ibiporã (Matriz)', 'Ibiporã (Matriz)'), ('Rondonópolis', 'Rondonópolis'), ('Paranaguá', 'Paranaguá')], max_length=80)),
                ('status', models.CharField(choices=[('ativo', 'Ativo'), ('inativo', 'Inativo')], default='ativo', max_length=10)),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('data_atualizacao', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Condutor',
                'verbose_name_plural': 'Condutores',
                'ordering': ['nome'],
            },
        ),
        migrations.CreateModel(
            name='OcorrenciaFrota',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('data', models.DateField()),
                ('descricao', models.TextField(blank=True, default='')),
                ('valor_multa', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('pontos_aplicados', models.PositiveSmallIntegerField()),
                ('filial', models.CharField(choices=[('Ibiporã (Matriz)', 'Ibiporã (Matriz)'), ('Rondonópolis', 'Rondonópolis'), ('Paranaguá', 'Paranaguá')], max_length=80)),
                ('usuario_nome', models.CharField(blank=True, default='', max_length=150)),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('data_atualizacao', models.DateTimeField(auto_now=True)),
                ('condutor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ocorrencias', to='frota.condutorfrota')),
                ('tipo', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='ocorrencias', to='frota.tipoocorrenciafrota')),
                ('veiculo', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ocorrencias', to='frota.veiculofrota')),
            ],
            options={
                'verbose_name': 'Ocorrência',
                'verbose_name_plural': 'Ocorrências',
                'ordering': ['-data', '-id'],
            },
        ),
        migrations.RunPython(seed_tipos, unseed_tipos),
    ]
