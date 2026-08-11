# Generated manually — remove histórico de atividades (CampanhaAtividade)

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('marketing', '0010_campanha_canais_multiplos'),
    ]

    operations = [
        migrations.DeleteModel(
            name='CampanhaAtividade',
        ),
    ]
