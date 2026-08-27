from django.db import migrations, models


def backfill_loja_cadastro(apps, schema_editor):
    ClienteProtocolo = apps.get_model('faturamento', 'ClienteProtocolo')
    for cliente in ClienteProtocolo.objects.all().order_by('pk'):
        changed = []
        if not (cliente.loja or '').strip():
            cliente.loja = '01'
            changed.append('loja')
        if not (cliente.tipo_pessoa or '').strip():
            cliente.tipo_pessoa = 'J'
            changed.append('tipo_pessoa')
        digits = ''.join(ch for ch in (cliente.cnpj or '') if ch.isdigit())
        if len(digits) == 11:
            cliente.tipo_pessoa = 'F'
            if 'tipo_pessoa' not in changed:
                changed.append('tipo_pessoa')
        if not cliente.padrao_protocolo:
            cliente.padrao_protocolo = True
            changed.append('padrao_protocolo')
        if changed:
            cliente.save(update_fields=changed)


class Migration(migrations.Migration):

    dependencies = [
        ('faturamento', '0008_cliente_cadastro'),
    ]

    operations = [
        migrations.AddField(
            model_name='clienteprotocolo',
            name='loja',
            field=models.CharField(blank=True, default='01', max_length=10, verbose_name='Loja'),
        ),
        migrations.AddField(
            model_name='clienteprotocolo',
            name='tipo_pessoa',
            field=models.CharField(
                choices=[('J', 'Pessoa jurídica'), ('F', 'Pessoa física')],
                default='J',
                max_length=1,
                verbose_name='Tipo de pessoa',
            ),
        ),
        migrations.AddField(
            model_name='clienteprotocolo',
            name='municipio',
            field=models.CharField(blank=True, default='', max_length=150, verbose_name='Município'),
        ),
        migrations.AddField(
            model_name='clienteprotocolo',
            name='padrao_protocolo',
            field=models.BooleanField(
                default=False,
                help_text='CNPJ/CPF deste cadastro aparece no PDF do protocolo.',
                verbose_name='Filial padrão para protocolos',
            ),
        ),
        migrations.AlterField(
            model_name='clienteprotocolo',
            name='cnpj',
            field=models.CharField(blank=True, max_length=20, null=True, verbose_name='CNPJ/CPF'),
        ),
        migrations.RunPython(backfill_loja_cadastro, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='clienteprotocolo',
            name='codigo',
            field=models.CharField(blank=True, default='', max_length=20, verbose_name='Código do cliente'),
        ),
        migrations.AddConstraint(
            model_name='clienteprotocolo',
            constraint=models.UniqueConstraint(
                condition=models.Q(('codigo', ''), _negated=True),
                fields=('codigo', 'loja'),
                name='faturamento_cliente_codigo_loja_uniq',
            ),
        ),
    ]
