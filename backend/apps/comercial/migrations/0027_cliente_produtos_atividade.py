from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0026_cliente_compatibilidade'),
    ]

    operations = [
        migrations.AddField(
            model_name='clientecomercial',
            name='posicoes_pallets',
            field=models.CharField(blank=True, default='', max_length=80, verbose_name='Posições pallets'),
        ),
        migrations.AddField(
            model_name='clientecomercial',
            name='previsao_volumes',
            field=models.CharField(blank=True, default='', max_length=200, verbose_name='Previsão de volumes'),
        ),
        migrations.AddField(
            model_name='clientecomercial',
            name='quantidade_volumes',
            field=models.CharField(blank=True, default='', max_length=80, verbose_name='Quantidade'),
        ),
        migrations.AddField(
            model_name='clientecomercial',
            name='tipos_embalagens',
            field=models.CharField(blank=True, default='', max_length=200, verbose_name='Tipos de embalagens'),
        ),
        migrations.CreateModel(
            name='ClienteComercialProduto',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ordem', models.PositiveIntegerField(default=0)),
                ('nome', models.CharField(max_length=200, verbose_name='Produto')),
                ('fispq_consulta', models.CharField(blank=True, default='', max_length=300, verbose_name='FISPQ/FDS ou local de consulta')),
                ('numero_onu', models.CharField(blank=True, default='', max_length=20, verbose_name='Nº de ONU')),
                ('classe_risco', models.CharField(blank=True, default='', max_length=20, verbose_name='Classe de risco')),
                ('cliente', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='produtos', to='comercial.clientecomercial')),
            ],
            options={
                'verbose_name': 'Produto do cliente comercial',
                'verbose_name_plural': 'Produtos do cliente comercial',
                'ordering': ['ordem', 'id'],
            },
        ),
    ]
