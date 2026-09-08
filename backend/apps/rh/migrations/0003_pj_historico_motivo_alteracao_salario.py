from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rh', '0002_colaboradorpj_data_demissao_colaboradorpjhistorico'),
    ]

    operations = [
        migrations.AddField(
            model_name='colaboradorpjhistorico',
            name='motivo',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Obrigatório em alteração salarial; use p.ex. redução por governança.',
                max_length=255,
                verbose_name='Motivo',
            ),
        ),
        migrations.AlterField(
            model_name='inconsistenciacolaborador',
            name='tipo',
            field=models.CharField(
                choices=[
                    ('salario', 'Alteração de Salário'),
                    ('cargo', 'Alteração de Cargo'),
                    ('outros', 'Outros'),
                ],
                default='salario',
                max_length=20,
                verbose_name='Tipo',
            ),
        ),
    ]
