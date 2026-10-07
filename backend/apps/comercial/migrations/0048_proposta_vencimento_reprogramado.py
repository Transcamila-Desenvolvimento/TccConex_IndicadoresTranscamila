from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0047_produto_tipo_adjuvante_pastagem'),
    ]

    operations = [
        migrations.AddField(
            model_name='propostacomercial',
            name='vencimento_reprogramado',
            field=models.DateField(blank=True, null=True, verbose_name='Vencimento reprogramado'),
        ),
    ]
