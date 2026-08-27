from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0022_add_gerenciar_escopos_funcao'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='abas',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
