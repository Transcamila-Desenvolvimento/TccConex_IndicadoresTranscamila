import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def copiar_criado_para_atualizado(apps, schema_editor):
    TabelaFrete = apps.get_model('comercial', 'TabelaFrete')
    for tabela in TabelaFrete.objects.exclude(criado_por_id=None).iterator():
        TabelaFrete.objects.filter(pk=tabela.pk).update(atualizado_por_id=tabela.criado_por_id)


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('comercial', '0018_tabelafrete_clientes_m2m'),
    ]

    operations = [
        migrations.AddField(
            model_name='tabelafrete',
            name='atualizado_por',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='tabelas_frete_atualizadas',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(copiar_criado_para_atualizado, migrations.RunPython.noop),
    ]
