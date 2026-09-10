from django.db import migrations, models


def migrate_tipo_frete(apps, schema_editor):
    PropostaComercial = apps.get_model('comercial', 'PropostaComercial')
    PropostaComercial.objects.filter(tipo='frete').update(tipo='transporte_rodoviario')


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0004_proposta_frete_documento'),
    ]

    operations = [
        migrations.AlterField(
            model_name='propostacomercial',
            name='tipo',
            field=models.CharField(
                choices=[
                    ('transporte_rodoviario', 'Transporte rodoviário'),
                    ('transporte_container', 'Transporte rodoviário de contêineres'),
                    ('armazenagem', 'Armazenagem'),
                ],
                max_length=32,
                verbose_name='Serviço',
            ),
        ),
        migrations.AlterField(
            model_name='propostacomercial',
            name='att',
            field=models.CharField(blank=True, default='', max_length=150, verbose_name='Responsável do cliente'),
        ),
        migrations.RunPython(migrate_tipo_frete, migrations.RunPython.noop),
    ]
