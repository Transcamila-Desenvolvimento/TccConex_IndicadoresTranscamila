from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0034_backfill_uniformes_funcoes'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='aba_filiais',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
