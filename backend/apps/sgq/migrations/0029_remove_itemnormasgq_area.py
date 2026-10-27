from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0028_areas_e_codigo_das_opcoes'),
    ]

    operations = [
        migrations.RemoveField(model_name='itemnormasgq', name='area'),
    ]
