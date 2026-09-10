from django.db import migrations, models


def separar_tipos_servico(apps, schema_editor):
    Generalidade = apps.get_model('comercial', 'GeneralidadeComercial')
    Generalidade.objects.filter(tipo_servico='transferencia_armazenagem').update(tipo_servico='frete')

    padrao_fonte = list(
        Generalidade.objects.filter(cliente__isnull=True, tipo_servico='frete').order_by('ordem', 'pk')
    )
    if not padrao_fonte:
        padrao_fonte = list(
            Generalidade.objects.filter(cliente__isnull=True, tipo_servico='distribuicao').order_by('ordem', 'pk')
        )
    if padrao_fonte and not Generalidade.objects.filter(cliente__isnull=True, tipo_servico='armazenagem').exists():
        Generalidade.objects.bulk_create([
            Generalidade(
                cliente=None,
                tipo_servico='armazenagem',
                ordem=item.ordem,
                rotulo=item.rotulo,
                valor=item.valor,
            )
            for item in padrao_fonte
        ])
    if padrao_fonte and not Generalidade.objects.filter(cliente__isnull=True, tipo_servico='frete').exists():
        Generalidade.objects.bulk_create([
            Generalidade(
                cliente=None,
                tipo_servico='frete',
                ordem=item.ordem,
                rotulo=item.rotulo,
                valor=item.valor,
            )
            for item in padrao_fonte
        ])


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0020_generalidade_cliente_tipo'),
    ]

    operations = [
        migrations.AlterField(
            model_name='generalidadecomercial',
            name='tipo_servico',
            field=models.CharField(
                choices=[
                    ('frete', 'Frete'),
                    ('distribuicao', 'Distribuição'),
                    ('armazenagem', 'Armazenagem'),
                ],
                default='frete',
                max_length=40,
                verbose_name='Tipo de serviço',
            ),
        ),
        migrations.AlterField(
            model_name='generalidadecomercial',
            name='valor',
            field=models.CharField(blank=True, default='', max_length=800),
        ),
        migrations.RunPython(separar_tipos_servico, migrations.RunPython.noop),
    ]
