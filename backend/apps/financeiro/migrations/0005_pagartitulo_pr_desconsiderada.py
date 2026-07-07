from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('financeiro', '0004_bankaccount_credit_limit'),
    ]

    operations = [
        migrations.AddField(
            model_name='pagartitulo',
            name='pr_desconsiderada',
            field=models.BooleanField(default=False, verbose_name='PR desconsiderada'),
        ),
    ]
