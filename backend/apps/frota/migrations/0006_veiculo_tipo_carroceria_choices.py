from django.db import migrations, models


COMBUSTIVEL_MAP = {
    'diesel': 'diesel-s10',
    'eletrico': 'eletrica',
    'gnv': 'gasolina',
}

CATEGORIA_MAP = {
    'caminhao': 'truck',
    'cavalo': 'truck',
    'carreta': 'truck',
    'utilitario': 'vuc',
    'automovel': 'van',
    'onibus': 'truck',
    'outro': 'truck',
}


def remap_veiculo_choices(apps, schema_editor):
    VeiculoFrota = apps.get_model('frota', 'VeiculoFrota')
    for veiculo in VeiculoFrota.objects.all():
        changed = False
        novo_combustivel = COMBUSTIVEL_MAP.get(veiculo.combustivel)
        if novo_combustivel:
            veiculo.combustivel = novo_combustivel
            changed = True
        nova_categoria = CATEGORIA_MAP.get(veiculo.categoria)
        if nova_categoria:
            veiculo.categoria = nova_categoria
            changed = True
        if changed:
            veiculo.save(update_fields=['combustivel', 'categoria'])


class Migration(migrations.Migration):
    dependencies = [
        ('frota', '0005_remove_ocorrencias'),
    ]

    operations = [
        migrations.AlterField(
            model_name='veiculofrota',
            name='combustivel',
            field=models.CharField(
                choices=[
                    ('arla-32', 'Arla 32'),
                    ('diesel-bs-500', 'Diesel BS 500'),
                    ('diesel-bs-500-itapevi', 'Diesel BS 500 Itapevi'),
                    ('diesel-s10', 'Diesel S-10'),
                    ('eletrica', 'Elétrica'),
                    ('etanol', 'Etanol'),
                    ('flex', 'Flex'),
                    ('gasolina', 'Gasolina'),
                ],
                default='diesel-s10',
                max_length=40,
                verbose_name='Combustível',
            ),
        ),
        migrations.AlterField(
            model_name='veiculofrota',
            name='categoria',
            field=models.CharField(
                choices=[
                    ('tanque', 'Tanque'),
                    ('teste', 'Teste'),
                    ('toco', 'Toco'),
                    ('trafic', 'Trafic'),
                    ('truck', 'Truck'),
                    ('van', 'Van'),
                    ('van-01-eixos', 'Van 01 eixos'),
                    ('vuc', 'VUC'),
                ],
                default='truck',
                max_length=40,
                verbose_name='Tipo de veículo',
            ),
        ),
        migrations.AddField(
            model_name='veiculofrota',
            name='tipo_carroceria',
            field=models.CharField(
                choices=[
                    ('bau', 'Baú'),
                    ('bitrem', 'Bitrem'),
                    ('carreta', 'Carreta'),
                    ('carroceria-fechada', 'Carroceria fechada'),
                    ('cavalo-mecanico', 'Cavalo mecânico'),
                    ('dolly', 'Dolly'),
                    ('empilhadeira-eletrica', 'Empilhadeira elétrica'),
                    ('empilhadeira-glp', 'Empilhadeira GLP'),
                ],
                default='bau',
                max_length=40,
                verbose_name='Tipo de carroceria',
            ),
        ),
        migrations.RunPython(remap_veiculo_choices, migrations.RunPython.noop),
    ]
