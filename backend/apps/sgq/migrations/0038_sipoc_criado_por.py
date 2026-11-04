import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('sgq', '0037_sipoc'),
    ]

    operations = [
        migrations.AddField(
            model_name='procedimentosipocsgq',
            name='criado_por',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='procedimentos_sipoc_sgq',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Criado por',
            ),
        ),
    ]
