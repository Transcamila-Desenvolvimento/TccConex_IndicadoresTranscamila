from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0046_produto_tipo'),
    ]

    operations = [
        migrations.AlterField(
            model_name='produtocomercial',
            name='tipo_produto',
            field=models.CharField(
                choices=[
                    ('fungicida', 'Fungicidas'),
                    ('herbicida', 'Herbicidas'),
                    ('inseticida', 'Inseticidas'),
                    ('acaricida', 'Acaricidas'),
                    ('fertilizante', 'Fertilizante'),
                    ('adjuvante', 'Adjuvantes'),
                    ('pastagem', 'Pastagem'),
                    ('outros', 'Outros'),
                ],
                default='outros',
                max_length=20,
                verbose_name='Tipo de produto',
            ),
        ),
    ]
