from django.db import migrations, models


class Migration(migrations.Migration):
    """Somente schema: cria a tabela de metas. Sem seed de dados em produção."""

    dependencies = [
        ('indicadores', '0002_gerencialsnapshot'),
    ]

    operations = [
        migrations.CreateModel(
            name='MetaFaturamentoMensal',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ano', models.PositiveIntegerField()),
                ('mes', models.PositiveSmallIntegerField()),
                ('valor', models.DecimalField(decimal_places=2, default=0, max_digits=15)),
            ],
            options={
                'verbose_name': 'Meta de faturamento mensal',
                'verbose_name_plural': 'Metas de faturamento mensais',
                'ordering': ['ano', 'mes'],
                'unique_together': {('ano', 'mes')},
            },
        ),
    ]
