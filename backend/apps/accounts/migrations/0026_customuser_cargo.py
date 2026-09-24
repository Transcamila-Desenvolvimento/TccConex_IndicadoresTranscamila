from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0025_add_comercial_permission'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='cargo',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
    ]
