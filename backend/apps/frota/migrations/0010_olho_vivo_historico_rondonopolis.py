from django.db import migrations


def noop(apps, schema_editor):
    """O arquivo usado aqui não era de Rondonópolis. A carga correta está em 0011/0012."""


class Migration(migrations.Migration):

    dependencies = [
        ("frota", "0009_olho_vivo"),
    ]

    operations = [
        migrations.RunPython(noop, noop),
    ]
