from django.db import migrations, models
import django.db.models.deletion

import apps.comercial.models as comercial_models


def attach_linhas_existentes(apps, schema_editor):
    TabelaFrete = apps.get_model('comercial', 'TabelaFrete')
    TabelaFreteLinha = apps.get_model('comercial', 'TabelaFreteLinha')
    if not TabelaFreteLinha.objects.filter(tabela__isnull=True).exists():
        return
    tabela = TabelaFrete.objects.create(
        nome='Tabela geral',
        tipo='transferencia',
        config={},
        faixas=[],
    )
    TabelaFreteLinha.objects.filter(tabela__isnull=True).update(tabela=tabela)


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0011_proposta_modalidades'),
    ]

    operations = [
        migrations.CreateModel(
            name='TabelaFrete',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nome', models.CharField(max_length=160)),
                ('tipo', models.CharField(
                    choices=[('transferencia', 'Transferência'), ('distribuicao', 'Distribuição')],
                    default='transferencia',
                    max_length=20,
                )),
                ('config', models.JSONField(blank=True, default=comercial_models.default_tabela_frete_config)),
                ('faixas', models.JSONField(blank=True, default=list)),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('data_atualizacao', models.DateTimeField(auto_now=True)),
                ('cliente', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='tabelas_frete',
                    to='comercial.clientecomercial',
                )),
            ],
            options={
                'verbose_name': 'Tabela de frete',
                'verbose_name_plural': 'Tabelas de frete',
                'ordering': ['-data_atualizacao', 'nome'],
            },
        ),
        migrations.AddField(
            model_name='tabelafretelinha',
            name='tabela',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='linhas',
                to='comercial.tabelafrete',
            ),
        ),
        migrations.RunPython(attach_linhas_existentes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='tabelafretelinha',
            name='tabela',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='linhas',
                to='comercial.tabelafrete',
            ),
        ),
        migrations.AlterModelOptions(
            name='tabelafretelinha',
            options={
                'ordering': ['ordem', 'pk'],
                'verbose_name': 'Trecho da tabela de frete',
                'verbose_name_plural': 'Trechos da tabela de frete',
            },
        ),
    ]
