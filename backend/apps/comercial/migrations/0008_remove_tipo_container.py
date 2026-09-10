from django.db import migrations, models


def migrate_tipo_container(apps, schema_editor):
    PropostaComercial = apps.get_model('comercial', 'PropostaComercial')
    PropostaComercial.objects.filter(tipo='transporte_container').update(tipo='transporte_rodoviario')


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0007_proposta_numero'),
    ]

    operations = [
        migrations.RunPython(migrate_tipo_container, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='propostacomercial',
            name='tipo',
            field=models.CharField(
                choices=[
                    ('transporte_rodoviario', 'Transporte rodoviário'),
                    ('armazenagem', 'Armazenagem'),
                ],
                max_length=32,
                verbose_name='Serviço',
            ),
        ),
    ]
