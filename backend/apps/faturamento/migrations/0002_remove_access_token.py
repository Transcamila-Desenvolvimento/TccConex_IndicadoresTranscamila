from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('faturamento', '0001_initial'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='protocoloenvio',
            name='access_token',
        ),
    ]
