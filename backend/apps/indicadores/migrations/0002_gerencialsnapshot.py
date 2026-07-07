from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('indicadores', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='GerencialSnapshot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reference_date', models.DateField(unique=True, verbose_name='Data de referência')),
                ('batch_label', models.CharField(blank=True, max_length=20)),
                ('fat_dia', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('fat_mes', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('fat_ano', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('saldo_banco', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('duplicatas_a_receber', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('ctas_rec_atrasadas', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('ctes_emitidos', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('a_disponibilizar', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('contas_pagar_ate_corte', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('pagar_cutoff_date', models.DateField(blank=True, null=True)),
                ('ctas_pag_atrasadas', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('saidas_previstas', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('posicao_gerencial', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
                ('caixa_positivo_ate', models.CharField(blank=True, max_length=20)),
                ('sent_by', models.CharField(blank=True, max_length=100)),
                ('sent_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Snapshot gerencial',
                'verbose_name_plural': 'Snapshots gerenciais',
                'ordering': ['-reference_date'],
            },
        ),
    ]
