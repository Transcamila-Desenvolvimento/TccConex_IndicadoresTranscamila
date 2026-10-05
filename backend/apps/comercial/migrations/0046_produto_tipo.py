from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0045_proposta_spot'),
    ]

    operations = [
        migrations.AddField(
            model_name='produtocomercial',
            name='tipo_produto',
            field=models.CharField(
                choices=[
                    ('fungicida', 'Fungicidas'),
                    ('herbicida', 'Herbicidas'),
                    ('inseticida', 'Inseticidas'),
                    ('acaricida', 'Acaricidas'),
                    ('fertilizante', 'Fertilizante'),
                    ('outros', 'Outros'),
                ],
                default='outros',
                max_length=20,
                verbose_name='Tipo de produto',
            ),
        ),
    ]
