from decimal import Decimal

import django.db.models.deletion
from django.db import migrations, models

VEICULOS_LEGADOS = (
    ('de9000', 'Truck', '642.55', '5.4821', 14000, 1),
    ('de14001', 'Carreta 6 eixos', '777.73', '7.7758', 26000, 2),
    ('acima26001', 'Carreta 7 eixos', '942.48', '8.5321', 32000, 3),
)


def criar_veiculos_legados(apps, schema_editor):
    VeiculoComercial = apps.get_model('comercial', 'VeiculoComercial')
    for codigo, nome, fixo, por_km, capacidade, ordem in VEICULOS_LEGADOS:
        VeiculoComercial.objects.get_or_create(
            codigo=codigo,
            defaults={
                'nome': nome,
                'antt_fixo': Decimal(fixo),
                'antt_por_km': Decimal(por_km),
                'capacidade_kg': capacidade,
                'ordem': ordem,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0042_proposta_ajustes_iniciais'),
    ]

    operations = [
        migrations.CreateModel(
            name='VeiculoComercial',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nome', models.CharField(max_length=80)),
                ('codigo', models.CharField(max_length=60, unique=True)),
                ('antt_fixo', models.DecimalField(decimal_places=4, default=0, max_digits=12, verbose_name='CC ANTT (R$)')),
                ('antt_por_km', models.DecimalField(decimal_places=4, default=0, max_digits=12, verbose_name='CCD ANTT (R$/km)')),
                ('capacidade_kg', models.PositiveIntegerField(blank=True, null=True)),
                ('ativo', models.BooleanField(default=True)),
                ('ordem', models.PositiveIntegerField(default=0)),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('data_atualizacao', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Tipo de veículo',
                'verbose_name_plural': 'Tipos de veículo',
                'ordering': ['ordem', 'capacidade_kg', 'nome'],
            },
        ),
        migrations.CreateModel(
            name='VeiculoRotuloCliente',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('rotulo', models.CharField(max_length=80)),
                ('cliente', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rotulos_veiculo', to='comercial.clientecomercial')),
                ('veiculo', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rotulos_cliente', to='comercial.veiculocomercial')),
            ],
            options={
                'verbose_name': 'Rótulo de veículo por cliente',
                'verbose_name_plural': 'Rótulos de veículo por cliente',
                'ordering': ['cliente__razao_social'],
                'constraints': [models.UniqueConstraint(fields=('veiculo', 'cliente'), name='uniq_rotulo_veiculo_cliente')],
            },
        ),
        migrations.RunPython(criar_veiculos_legados, migrations.RunPython.noop),
    ]
