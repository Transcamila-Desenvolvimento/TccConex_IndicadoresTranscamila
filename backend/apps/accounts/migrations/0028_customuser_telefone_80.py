from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0027_customuser_telefone'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customuser',
            name='telefone',
            field=models.CharField(blank=True, default='', max_length=80),
        ),
    ]
