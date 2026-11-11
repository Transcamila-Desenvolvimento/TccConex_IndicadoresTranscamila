from django.db import migrations


def excluir_inativos(apps, schema_editor):
    FuncionarioQuadro = apps.get_model('rh', 'FuncionarioQuadro')
    FuncionarioQuadro.objects.filter(ativo=False).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('rh', '0010_quadro_funcionarios'),
    ]

    operations = [
        migrations.RunPython(excluir_inativos, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='funcionarioquadro',
            name='ativo',
        ),
        migrations.RemoveField(
            model_name='funcionarioquadro',
            name='data_demissao',
        ),
        migrations.RemoveField(
            model_name='funcionarioquadro',
            name='situacao',
        ),
    ]
