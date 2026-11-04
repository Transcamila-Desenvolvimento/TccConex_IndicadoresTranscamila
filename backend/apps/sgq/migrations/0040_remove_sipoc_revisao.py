from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0039_sipoc_revisao'),
    ]

    operations = [
        migrations.DeleteModel(name='RevisaoSipocSGQ'),
    ]
