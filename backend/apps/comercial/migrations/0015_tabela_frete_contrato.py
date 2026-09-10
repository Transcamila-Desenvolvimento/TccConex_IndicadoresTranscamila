from django.db import migrations, models


def publicar_tabelas_existentes(apps, schema_editor):
    TabelaFrete = apps.get_model('comercial', 'TabelaFrete')
    TabelaFrete.objects.filter(status='rascunho').update(status='publicada')


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0014_arredondamento_incremento_planilha'),
    ]

    operations = [
        migrations.AddField(
            model_name='tabelafrete',
            name='codigo',
            field=models.CharField(blank=True, default='', max_length=40),
        ),
        migrations.AddField(
            model_name='tabelafrete',
            name='revisao',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='tabelafrete',
            name='vigencia_inicio',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='tabelafrete',
            name='vigencia_fim',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='tabelafrete',
            name='status',
            field=models.CharField(
                choices=[
                    ('rascunho', 'Rascunho'),
                    ('publicada', 'Publicada'),
                    ('expirada', 'Expirada'),
                    ('arquivada', 'Arquivada'),
                ],
                default='rascunho',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='tabelafrete',
            name='observacoes',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.RunPython(publicar_tabelas_existentes, migrations.RunPython.noop),
    ]
