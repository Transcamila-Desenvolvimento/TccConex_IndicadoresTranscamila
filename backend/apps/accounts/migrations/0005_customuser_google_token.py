from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_customuser_google_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='google_token',
            field=models.JSONField(blank=True, null=True),
        ),
    ]
