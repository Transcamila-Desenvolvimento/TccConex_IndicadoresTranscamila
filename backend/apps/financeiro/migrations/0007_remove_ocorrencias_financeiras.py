from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('financeiro', '0006_ocorrencias_financeiras'),
    ]

    operations = [
        migrations.DeleteModel(
            name='GnreIcmsOcorrencia',
        ),
        migrations.DeleteModel(
            name='NotaPagaSemLancamento',
        ),
        migrations.DeleteModel(
            name='OpsRecebidaOcorrencia',
        ),
    ]
