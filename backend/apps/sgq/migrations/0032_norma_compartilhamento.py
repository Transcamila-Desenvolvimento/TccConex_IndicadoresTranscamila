from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0031_auditoria_auditores'),
    ]

    operations = [
        migrations.AlterField(
            model_name='normasgq',
            name='publica',
            field=models.BooleanField(default=False, verbose_name='Compartilhamento'),
        ),
    ]
