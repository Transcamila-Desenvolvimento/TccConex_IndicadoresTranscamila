from django.db import migrations, models


CANAL_MAP = {
    'multicanal': 'outro',
    'redes_sociais': 'instagram',
    'midia': 'outro',
}


def migrate_canais(apps, schema_editor):
    CampanhaMarketing = apps.get_model('marketing', 'CampanhaMarketing')
    for campanha in CampanhaMarketing.objects.all():
        novo = CANAL_MAP.get(campanha.canal)
        if novo:
            campanha.canal = novo
            campanha.save(update_fields=['canal'])


def reverse_canais(apps, schema_editor):
    CampanhaMarketing = apps.get_model('marketing', 'CampanhaMarketing')
    reverse_map = {
        'instagram': 'redes_sociais',
        'transcamila_news': 'multicanal',
    }
    for campanha in CampanhaMarketing.objects.all():
        if campanha.canal in reverse_map:
            campanha.canal = reverse_map[campanha.canal]
            campanha.save(update_fields=['canal'])


class Migration(migrations.Migration):

    dependencies = [
        ('marketing', '0008_colaboracao_membros_atividade'),
    ]

    operations = [
        migrations.RunPython(migrate_canais, reverse_canais),
        migrations.AlterField(
            model_name='campanhamarketing',
            name='canal',
            field=models.CharField(
                choices=[
                    ('evento', 'Evento'),
                    ('transcamila_news', 'Transcamila News'),
                    ('instagram', 'Instagram'),
                    ('outro', 'Outro'),
                    ('email', 'E-mail marketing'),
                ],
                default='evento',
                max_length=30,
                verbose_name='Canal',
            ),
        ),
    ]
