from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0037_customuser_funcao_filiais'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='last_seen_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
