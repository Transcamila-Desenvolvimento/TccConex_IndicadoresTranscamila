from django.db import migrations, models


def seed_catalogo(apps, schema_editor):
    EscopoAnalise = apps.get_model('sgq', 'EscopoAnalise')
    EscopoAnaliseOpcao = apps.get_model('sgq', 'EscopoAnaliseOpcao')
    from apps.sgq.escopo_analise import ESCOPO_ANALISE_CATALOGO, ESCOPO_ANALISE_CHOICES

    for ordem, (chave, label) in enumerate(ESCOPO_ANALISE_CHOICES, start=1):
        escopo, _created = EscopoAnalise.objects.get_or_create(
            chave=chave,
            defaults={'label': label, 'ordem': ordem, 'ativo': True},
        )
        for idx, (opcao_chave, opcao_label) in enumerate(ESCOPO_ANALISE_CATALOGO.get(chave, []), start=1):
            EscopoAnaliseOpcao.objects.get_or_create(
                escopo=escopo,
                chave=opcao_chave,
                defaults={'label': opcao_label, 'ordem': idx, 'ativo': True},
            )


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0015_escopo_analise_json'),
    ]

    operations = [
        migrations.CreateModel(
            name='EscopoAnalise',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('chave', models.SlugField(max_length=80, unique=True)),
                ('label', models.CharField(max_length=120)),
                ('ordem', models.PositiveSmallIntegerField(default=0)),
                ('ativo', models.BooleanField(default=True)),
            ],
            options={
                'verbose_name': 'Escopo da análise',
                'verbose_name_plural': 'Escopos da análise',
                'ordering': ['ordem', 'id'],
            },
        ),
        migrations.CreateModel(
            name='EscopoAnaliseOpcao',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('chave', models.SlugField(max_length=80)),
                ('label', models.CharField(max_length=255)),
                ('ordem', models.PositiveSmallIntegerField(default=0)),
                ('ativo', models.BooleanField(default=True)),
                ('escopo', models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name='opcoes',
                    to='sgq.escopoanalise',
                )),
            ],
            options={
                'verbose_name': 'Opção de escopo da análise',
                'verbose_name_plural': 'Opções de escopo da análise',
                'ordering': ['ordem', 'id'],
            },
        ),
        migrations.AddConstraint(
            model_name='escopoanaliseopcao',
            constraint=models.UniqueConstraint(fields=('escopo', 'chave'), name='uniq_sgq_escopo_opcao_chave'),
        ),
        migrations.RunPython(seed_catalogo, migrations.RunPython.noop),
    ]
