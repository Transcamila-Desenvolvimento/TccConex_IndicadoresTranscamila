from django.db import migrations, models

import apps.marketing.models


def migrate_canal_to_canais(apps, schema_editor):
    CampanhaMarketing = apps.get_model('marketing', 'CampanhaMarketing')
    for campanha in CampanhaMarketing.objects.all():
        canal = getattr(campanha, 'canal', None)
        campanha.canais = [canal] if canal else ['evento']
        campanha.save(update_fields=['canais'])


def reverse_canais_to_canal(apps, schema_editor):
    CampanhaMarketing = apps.get_model('marketing', 'CampanhaMarketing')
    for campanha in CampanhaMarketing.objects.all():
        canais = campanha.canais or []
        campanha.canal = canais[0] if canais else 'evento'
        campanha.save(update_fields=['canal'])


class Migration(migrations.Migration):

    dependencies = [
        ('marketing', '0009_campanha_canal_opcoes'),
    ]

    operations = [
        migrations.AddField(
            model_name='campanhamarketing',
            name='canais',
            field=models.JSONField(
                blank=True,
                default=apps.marketing.models._default_canais,
                verbose_name='Canais de comunicação',
            ),
        ),
        migrations.RunPython(migrate_canal_to_canais, reverse_canais_to_canal),
        migrations.RemoveField(
            model_name='campanhamarketing',
            name='canal',
        ),
    ]
