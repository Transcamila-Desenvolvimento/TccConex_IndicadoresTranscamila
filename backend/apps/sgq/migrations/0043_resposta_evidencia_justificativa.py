from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0042_auditoria_questionario_concluido'),
    ]

    operations = [
        migrations.AlterField(
            model_name='respostaauditoriasgq',
            name='observacoes',
            field=models.TextField(blank=True, default='', max_length=20000, verbose_name='Evidência/justificativa'),
        ),
    ]
