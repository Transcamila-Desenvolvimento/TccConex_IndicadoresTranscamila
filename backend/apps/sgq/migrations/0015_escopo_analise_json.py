from django.db import migrations, models


def copy_escopo(apps, schema_editor):
    Pesquisa = apps.get_model('sgq', 'PesquisaSatisfacao')
    valid = {
        'prazo_entrega',
        'condicoes_mercadoria',
        'condicoes_veiculo',
        'apresentacao_motorista',
        'atendimento_dispensado',
    }
    for pesquisa in Pesquisa.objects.all().iterator():
        val = pesquisa.escopo_analise or ''
        if isinstance(val, str) and val in valid:
            pesquisa.escopo_analise_json = {val: []}
        else:
            pesquisa.escopo_analise_json = {}
        pesquisa.save(update_fields=['escopo_analise_json'])


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0014_pesquisasatisfacao_escopo_analise'),
    ]

    operations = [
        migrations.AddField(
            model_name='pesquisasatisfacao',
            name='escopo_analise_json',
            field=models.JSONField(blank=True, default=dict, verbose_name='Escopo da análise'),
        ),
        migrations.RunPython(copy_escopo, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='pesquisasatisfacao',
            name='escopo_analise',
        ),
        migrations.RenameField(
            model_name='pesquisasatisfacao',
            old_name='escopo_analise_json',
            new_name='escopo_analise',
        ),
    ]
