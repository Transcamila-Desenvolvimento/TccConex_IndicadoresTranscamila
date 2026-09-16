from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0032_proposta_comercial_draft'),
    ]

    operations = [
        migrations.AlterField(
            model_name='clientecomercial',
            name='situacao',
            field=models.CharField(
                choices=[
                    ('potencial', 'Potencial cliente'),
                    ('cliente', 'Cliente'),
                    ('inativo', 'Inativo'),
                ],
                default='potencial',
                max_length=20,
                verbose_name='Situação',
            ),
        ),
    ]
