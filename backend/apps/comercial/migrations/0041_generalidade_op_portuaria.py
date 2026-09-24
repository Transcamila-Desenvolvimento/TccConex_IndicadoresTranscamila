from django.db import migrations, models


def seed_op_portuaria(apps, schema_editor):
    Generalidade = apps.get_model('comercial', 'GeneralidadeComercial')
    if Generalidade.objects.filter(cliente__isnull=True, tipo_servico='op_portuaria').exists():
        return
    fonte = list(
        Generalidade.objects.filter(cliente__isnull=True, tipo_servico='frete').order_by('ordem', 'pk')
    )
    if not fonte:
        return
    Generalidade.objects.bulk_create([
        Generalidade(
            cliente=None,
            tipo_servico='op_portuaria',
            ordem=item.ordem,
            rotulo=item.rotulo,
            valor=item.valor,
        )
        for item in fonte
    ])


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0040_proposta_linha_retirada_desova_ctnt'),
    ]

    operations = [
        migrations.AlterField(
            model_name='generalidadecomercial',
            name='tipo_servico',
            field=models.CharField(
                choices=[
                    ('frete', 'Transferência'),
                    ('distribuicao', 'Distribuição'),
                    ('armazenagem', 'Armazenagem'),
                    ('op_portuaria', 'Logística Retroportuária'),
                ],
                default='frete',
                max_length=40,
                verbose_name='Tipo de serviço',
            ),
        ),
        migrations.RunPython(seed_op_portuaria, migrations.RunPython.noop),
    ]
