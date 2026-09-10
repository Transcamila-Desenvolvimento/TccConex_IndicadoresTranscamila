from django.db import migrations


def recalcular_faixas_distribuicao(apps, schema_editor):
    TabelaFrete = apps.get_model('comercial', 'TabelaFrete')
    from apps.comercial.tabela_distribuicao import gerar_faixas_distribuicao, merge_config

    for tabela in TabelaFrete.objects.filter(tipo='distribuicao'):
        config = merge_config(tabela.config or {})
        tabela.config = config
        tabela.faixas = gerar_faixas_distribuicao(config)
        tabela.save(update_fields=['config', 'faixas'])


class Migration(migrations.Migration):
    dependencies = [
        ('comercial', '0012_tabela_frete_catalogo'),
    ]

    operations = [
        migrations.RunPython(recalcular_faixas_distribuicao, migrations.RunPython.noop),
    ]
