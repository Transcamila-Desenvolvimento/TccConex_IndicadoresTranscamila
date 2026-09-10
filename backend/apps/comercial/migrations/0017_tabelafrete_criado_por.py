import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('comercial', '0016_matriz_icms_uf'),
    ]

    operations = [
        migrations.AddField(
            model_name='tabelafrete',
            name='criado_por',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='tabelas_frete_criadas',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
