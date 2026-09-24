from django.db import migrations, models


def marcar_propostas_armazenagem(apps, schema_editor):
    PropostaComercial = apps.get_model('comercial', 'PropostaComercial')
    PropostaComercial.objects.filter(tipo='armazenagem').update(inclui_armazenagem=True)


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0033_cliente_situacao_inativo'),
    ]

    operations = [
        migrations.AddField(
            model_name='propostacomercial',
            name='inclui_armazenagem',
            field=models.BooleanField(default=False, verbose_name='Armazenagem'),
        ),
        migrations.RunPython(marcar_propostas_armazenagem, migrations.RunPython.noop),
    ]
