from django.db import migrations, models


def marcar_transferencia_existente(apps, schema_editor):
    PropostaComercial = apps.get_model('comercial', 'PropostaComercial')
    PropostaComercial.objects.filter(
        tipo__in=['transporte_rodoviario', 'frete', 'transporte_container'],
    ).update(inclui_transferencia=True)


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0010_catalogos_frete_generalidades'),
    ]

    operations = [
        migrations.AddField(
            model_name='propostacomercial',
            name='inclui_distribuicao',
            field=models.BooleanField(default=False, verbose_name='Distribuição'),
        ),
        migrations.AddField(
            model_name='propostacomercial',
            name='inclui_transferencia',
            field=models.BooleanField(default=False, verbose_name='Transferência'),
        ),
        migrations.RunPython(marcar_transferencia_existente, migrations.RunPython.noop),
    ]
