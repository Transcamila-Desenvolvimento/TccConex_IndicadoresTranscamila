from django.db import migrations, models
import django.db.models.deletion


def duplicar_padrao_transferencia(apps, schema_editor):
    Generalidade = apps.get_model('comercial', 'GeneralidadeComercial')
    padrao = list(
        Generalidade.objects.filter(cliente__isnull=True, tipo_servico='distribuicao').order_by('ordem', 'pk')
    )
    if not padrao:
        padrao = list(Generalidade.objects.filter(cliente__isnull=True).order_by('ordem', 'pk'))
    if not padrao:
        return
    if Generalidade.objects.filter(cliente__isnull=True, tipo_servico='transferencia_armazenagem').exists():
        return
    Generalidade.objects.bulk_create([
        Generalidade(
            cliente=None,
            tipo_servico='transferencia_armazenagem',
            ordem=item.ordem,
            rotulo=item.rotulo,
            valor=item.valor,
        )
        for item in padrao
    ])


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0019_tabelafrete_atualizado_por'),
    ]

    operations = [
        migrations.AddField(
            model_name='generalidadecomercial',
            name='cliente',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='generalidades',
                to='comercial.clientecomercial',
                verbose_name='Cliente',
            ),
        ),
        migrations.AddField(
            model_name='generalidadecomercial',
            name='tipo_servico',
            field=models.CharField(
                choices=[
                    ('distribuicao', 'Frete distribuição'),
                    ('transferencia_armazenagem', 'Transferência e armazenagem'),
                ],
                default='distribuicao',
                max_length=40,
                verbose_name='Tipo de serviço',
            ),
        ),
        migrations.AddIndex(
            model_name='generalidadecomercial',
            index=models.Index(fields=['cliente', 'tipo_servico', 'ordem'], name='comercial_g_cliente_b8e4a1_idx'),
        ),
        migrations.RunPython(duplicar_padrao_transferencia, migrations.RunPython.noop),
    ]
