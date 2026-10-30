from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0032_norma_compartilhamento'),
    ]

    operations = [
        migrations.AlterField(
            model_name='tiporespostasgq',
            name='publica',
            field=models.BooleanField(default=False, verbose_name='Compartilhamento'),
        ),
    ]
