from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0030_respostas_auditoria'),
    ]

    operations = [
        migrations.AddField(
            model_name='auditoriasgq',
            name='auditores',
            field=models.JSONField(blank=True, default=list, verbose_name='Auditores'),
        ),
    ]
