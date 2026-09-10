from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0025_armazenagem_somente_observacoes'),
    ]

    operations = [
        migrations.AddField(
            model_name='clientecomercial',
            name='compatibilidade',
            field=models.CharField(
                choices=[
                    ('nao_analisado', 'Não analisado'),
                    ('compativel', 'Compatível'),
                    ('incompativel', 'Incompatível'),
                ],
                default='nao_analisado',
                max_length=20,
                verbose_name='Compatibilidade',
            ),
        ),
    ]
