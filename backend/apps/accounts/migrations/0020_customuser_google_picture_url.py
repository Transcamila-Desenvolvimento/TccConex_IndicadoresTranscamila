from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0019_marketing_campanhas_funcoes'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='google_picture_url',
            field=models.URLField(blank=True, default='', max_length=500),
        ),
    ]
