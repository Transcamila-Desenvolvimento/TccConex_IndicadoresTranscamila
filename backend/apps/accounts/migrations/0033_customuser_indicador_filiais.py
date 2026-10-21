from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0032_customuser_cpf'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='indicador_filiais',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
