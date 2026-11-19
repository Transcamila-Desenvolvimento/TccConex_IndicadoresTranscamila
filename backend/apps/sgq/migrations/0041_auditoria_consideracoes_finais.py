from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0040_remove_sipoc_revisao'),
    ]

    operations = [
        migrations.AddField(
            model_name='auditoriasgq',
            name='consideracoes_finais',
            field=models.TextField(blank=True, default='', verbose_name='Considerações finais'),
        ),
    ]
