from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0026_customuser_cargo'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='telefone',
            field=models.CharField(blank=True, default='', max_length=30),
        ),
    ]
