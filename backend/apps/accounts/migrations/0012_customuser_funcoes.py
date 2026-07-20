from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_customuser_indicadores'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='funcoes',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
