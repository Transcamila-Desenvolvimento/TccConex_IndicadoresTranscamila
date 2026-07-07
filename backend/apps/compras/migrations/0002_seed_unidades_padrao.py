from django.db import migrations

UNIDADES_PADRAO = ['Un', 'Resma', 'Caixa', 'Pacote', 'Litro']


def seed_unidades(apps, schema_editor):
    UnidadeMedida = apps.get_model('compras', 'UnidadeMedida')
    for nome in UNIDADES_PADRAO:
        UnidadeMedida.objects.get_or_create(nome=nome)


def remove_unidades(apps, schema_editor):
    UnidadeMedida = apps.get_model('compras', 'UnidadeMedida')
    UnidadeMedida.objects.filter(nome__in=UNIDADES_PADRAO).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('compras', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_unidades, remove_unidades),
    ]
