from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('camilo', '0003_termo_aceite'),
    ]

    operations = [
        migrations.AddField(
            model_name='termoaceite',
            name='cpf',
            field=models.CharField(blank=True, default='', max_length=14),
        ),
    ]
