from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0038_customuser_last_seen_at'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='customuser',
            name='last_seen_at',
        ),
    ]
