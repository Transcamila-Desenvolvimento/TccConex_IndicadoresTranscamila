from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0031_rename_camiloia_environment'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='cpf',
            field=models.CharField(blank=True, default='', max_length=11),
        ),
        migrations.AddConstraint(
            model_name='customuser',
            constraint=models.UniqueConstraint(
                condition=models.Q(cpf__gt=''),
                fields=('cpf',),
                name='accounts_user_cpf_unique',
            ),
        ),
    ]
