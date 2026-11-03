from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0036_backfill_matriz_ecossistema'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='funcao_filiais',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
