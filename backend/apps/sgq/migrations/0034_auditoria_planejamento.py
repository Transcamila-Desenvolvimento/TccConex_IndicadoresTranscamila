from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0033_tipo_resposta_compartilhamento'),
    ]

    operations = [
        migrations.AddField(
            model_name='auditoriasgq',
            name='planejamento',
            field=models.JSONField(blank=True, default=list, verbose_name='Planejamento'),
        ),
    ]
