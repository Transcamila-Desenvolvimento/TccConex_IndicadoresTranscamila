from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('rh', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='colaboradorpj',
            name='data_demissao',
            field=models.DateField(blank=True, null=True, verbose_name='Data Dem.'),
        ),
        migrations.CreateModel(
            name='ColaboradorPJHistorico',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ano', models.IntegerField(verbose_name='Ano')),
                ('mes', models.IntegerField(verbose_name='Mês')),
                ('salario', models.DecimalField(decimal_places=2, max_digits=12, verbose_name='Salário')),
                ('cargo', models.CharField(blank=True, max_length=100, null=True, verbose_name='Cargo')),
                ('filial', models.CharField(blank=True, max_length=100, null=True, verbose_name='Filial')),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('pj', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='historico',
                    to='rh.colaboradorpj',
                    verbose_name='PJ',
                )),
            ],
            options={
                'verbose_name': 'Histórico Salarial PJ',
                'verbose_name_plural': 'Históricos Salariais PJ',
                'ordering': ['-ano', '-mes'],
                'unique_together': {('pj', 'ano', 'mes')},
            },
        ),
    ]
