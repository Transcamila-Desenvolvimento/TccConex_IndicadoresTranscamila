from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0009_cliente_desde'),
    ]

    operations = [
        migrations.CreateModel(
            name='TabelaFreteLinha',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ordem', models.PositiveIntegerField(default=0)),
                ('origem', models.CharField(blank=True, default='', max_length=120)),
                ('entrega', models.CharField(blank=True, default='', max_length=120, verbose_name='Destino')),
                ('veiculo', models.CharField(blank=True, default='', max_length=80, verbose_name='Veículo')),
                ('tarifa_frete', models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ('pedagio', models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ('ad_valorem', models.CharField(blank=True, default='', max_length=20, verbose_name='Ad-VL')),
                ('gris', models.CharField(blank=True, default='', max_length=20, verbose_name='GRIS')),
                ('icms', models.CharField(blank=True, default='Não incluso', max_length=40)),
                ('prazo_dias', models.CharField(blank=True, default='', max_length=20)),
                ('total_estimado', models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('data_atualizacao', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Linha da tabela de frete',
                'verbose_name_plural': 'Tabela de frete',
                'ordering': ['ordem', 'pk'],
            },
        ),
        migrations.CreateModel(
            name='GeneralidadeComercial',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ordem', models.PositiveIntegerField(default=0)),
                ('rotulo', models.CharField(max_length=120)),
                ('valor', models.CharField(blank=True, default='', max_length=400)),
            ],
            options={
                'verbose_name': 'Generalidade comercial',
                'verbose_name_plural': 'Generalidades comerciais',
                'ordering': ['ordem', 'pk'],
            },
        ),
    ]
