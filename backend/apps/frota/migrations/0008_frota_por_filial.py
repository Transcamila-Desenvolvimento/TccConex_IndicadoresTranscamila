from django.db import migrations, models

IBIPORA = 'Ibiporã (Matriz)'
FROTA_FILIAIS = [IBIPORA, 'Rondonópolis']
FILIAL_CHOICES = [(nome, nome) for nome in FROTA_FILIAIS]


def atribuir_frota_ibipora(apps, schema_editor):
    """A frota já em produção passa a ser a de Ibiporã. Rondonópolis começa vazia."""
    Veiculo = apps.get_model('frota', 'VeiculoFrota')
    Condutor = apps.get_model('frota', 'CondutorFrota')
    Veiculo.objects.all().update(filial=IBIPORA)
    Condutor.objects.all().update(filial=IBIPORA)

    User = apps.get_model('accounts', 'CustomUser')
    for user in User.objects.all().iterator():
        environments = list(user.environments or [])
        if 'Frota' not in environments:
            continue
        filiais = dict(user.filiais or {})
        atuais = [nome for nome in (filiais.get('Frota') or []) if nome in FROTA_FILIAIS]
        if not atuais:
            atuais = [IBIPORA]
        filiais['Frota'] = atuais
        user.filiais = filiais
        user.save(update_fields=['filiais'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0031_rename_camiloia_environment'),
        ('frota', '0007_abastecimento_km_trecho'),
    ]

    operations = [
        migrations.AddField(
            model_name='custofrotalote',
            name='filial',
            field=models.CharField(
                choices=FILIAL_CHOICES,
                default=IBIPORA,
                max_length=80,
                verbose_name='Filial',
            ),
        ),
        migrations.AlterField(
            model_name='veiculofrota',
            name='filial',
            field=models.CharField(choices=FILIAL_CHOICES, max_length=80, verbose_name='Filial'),
        ),
        migrations.AlterField(
            model_name='condutorfrota',
            name='filial',
            field=models.CharField(choices=FILIAL_CHOICES, max_length=80),
        ),
        migrations.AlterUniqueTogether(
            name='custofrotalote',
            unique_together={('periodo_inicio', 'periodo_fim', 'filial')},
        ),
        migrations.RunPython(atribuir_frota_ibipora, migrations.RunPython.noop),
    ]
