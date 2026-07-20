from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_customuser_must_change_password'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='indicadores',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
