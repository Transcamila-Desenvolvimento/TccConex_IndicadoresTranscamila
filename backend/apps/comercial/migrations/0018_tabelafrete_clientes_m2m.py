from django.db import migrations, models


def migrar_cliente_para_clientes(apps, schema_editor):
    TabelaFrete = apps.get_model('comercial', 'TabelaFrete')
    for tabela in TabelaFrete.objects.exclude(cliente_id=None).iterator():
        tabela.clientes.add(tabela.cliente_id)
        ids = list(tabela.clientes.order_by('pk').values_list('pk', flat=True))
        tabela.clientes_vinculo_key = ','.join(str(item) for item in ids)
        tabela.save(update_fields=['clientes_vinculo_key'])


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0017_tabelafrete_criado_por'),
    ]

    operations = [
        migrations.AddField(
            model_name='tabelafrete',
            name='clientes_vinculo_key',
            field=models.CharField(blank=True, default='', max_length=500),
        ),
        migrations.AddField(
            model_name='tabelafrete',
            name='clientes',
            field=models.ManyToManyField(blank=True, related_name='tabelas_frete', to='comercial.clientecomercial'),
        ),
        migrations.RunPython(migrar_cliente_para_clientes, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='tabelafrete',
            name='cliente',
        ),
    ]
