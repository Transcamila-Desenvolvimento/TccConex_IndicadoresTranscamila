from django.db import migrations


class Migration(migrations.Migration):
    """Placeholder sem alteração de dados.

    O backfill de funções SGQ foi desativado para deploys em produção
    (migrate só schema). Funções podem ser ajustadas manualmente no Admin.
    """

    dependencies = [
        ('accounts', '0013_add_sgq_permission'),
    ]

    operations = [
        migrations.RunPython(migrations.RunPython.noop, migrations.RunPython.noop),
    ]
