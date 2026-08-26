from django.db import migrations, models


def backfill_cadastro_clientes(apps, schema_editor):
    ClienteProtocolo = apps.get_model('faturamento', 'ClienteProtocolo')
    legado_sgq = ('CCAB', 'PRENTISS', 'ALBAUGH')
    for cliente in ClienteProtocolo.objects.all().order_by('pk'):
        nome = (cliente.nome or '').strip()
        if not cliente.razao_social:
            cliente.razao_social = nome
        if not cliente.nome_interno:
            cliente.nome_interno = nome
        if not cliente.codigo:
            cliente.codigo = f'CLI-{cliente.pk:04d}'
        nome_u = nome.upper()
        if any(token in nome_u for token in legado_sgq):
            cliente.considerar_pesquisa_satisfacao = True
        cliente.save(update_fields=[
            'razao_social',
            'nome_interno',
            'codigo',
            'considerar_pesquisa_satisfacao',
        ])


class Migration(migrations.Migration):

    dependencies = [
        ('faturamento', '0007_protocolo_envio_draft'),
    ]

    operations = [
        migrations.AddField(
            model_name='clienteprotocolo',
            name='codigo',
            field=models.CharField(blank=True, default='', max_length=20, verbose_name='Código do cliente'),
        ),
        migrations.AddField(
            model_name='clienteprotocolo',
            name='razao_social',
            field=models.CharField(blank=True, default='', max_length=200, verbose_name='Razão social'),
        ),
        migrations.AddField(
            model_name='clienteprotocolo',
            name='nome_fantasia',
            field=models.CharField(blank=True, default='', max_length=200, verbose_name='Nome fantasia'),
        ),
        migrations.AddField(
            model_name='clienteprotocolo',
            name='nome_interno',
            field=models.CharField(blank=True, default='', max_length=200, verbose_name='Nome interno'),
        ),
        migrations.AddField(
            model_name='clienteprotocolo',
            name='emitir_protocolo_canhotos',
            field=models.BooleanField(default=True, verbose_name='Emitir protocolo de canhotos?'),
        ),
        migrations.AddField(
            model_name='clienteprotocolo',
            name='considerar_pesquisa_satisfacao',
            field=models.BooleanField(default=False, verbose_name='Considerar pesquisa de satisfação?'),
        ),
        migrations.AddField(
            model_name='clienteprotocolo',
            name='data_atualizacao',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AlterField(
            model_name='clienteprotocolo',
            name='nome',
            field=models.CharField(max_length=200, verbose_name='Nome interno'),
        ),
        migrations.RunPython(backfill_cadastro_clientes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='clienteprotocolo',
            name='codigo',
            field=models.CharField(blank=True, default='', max_length=20, unique=True, verbose_name='Código do cliente'),
        ),
    ]
