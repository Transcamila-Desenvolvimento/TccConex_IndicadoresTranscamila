from django.db import migrations, models


LEGADO = {
    'pendente',
    'portal_fabricante',
    'arquivo_interno',
    'disponivel_embarque',
    'nao_se_aplica',
}


def converter_fispq_para_link(apps, schema_editor):
    Produto = apps.get_model('comercial', 'ProdutoComercial')
    Vinculo = apps.get_model('comercial', 'ClienteComercialProduto')
    for model in (Produto, Vinculo):
        for item in model.objects.all().iterator():
            raw = (item.fispq_consulta or '').strip()
            if not raw or raw.casefold() in LEGADO:
                item.fispq_consulta = ''
                item.save(update_fields=['fispq_consulta'])


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0029_homologacao_produtos_catalogo'),
    ]

    operations = [
        migrations.AlterField(
            model_name='produtocomercial',
            name='fispq_consulta',
            field=models.CharField(blank=True, default='', max_length=500, verbose_name='Link da FISPQ/FDS'),
        ),
        migrations.AlterField(
            model_name='clientecomercialproduto',
            name='fispq_consulta',
            field=models.CharField(blank=True, default='', max_length=500, verbose_name='Link da FISPQ/FDS'),
        ),
        migrations.RunPython(converter_fispq_para_link, migrations.RunPython.noop),
    ]
