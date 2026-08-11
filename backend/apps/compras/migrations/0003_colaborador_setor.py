from django.db import migrations, models
import django.db.models.deletion


def assign_default_setor(apps, schema_editor):
    Setor = apps.get_model('compras', 'Setor')
    Colaborador = apps.get_model('compras', 'Colaborador')
    default, _ = Setor.objects.get_or_create(nome='Geral')
    Colaborador.objects.filter(setor__isnull=True).update(setor_id=default.pk)


class Migration(migrations.Migration):

    dependencies = [
        ('compras', '0002_seed_unidades_padrao'),
    ]

    operations = [
        migrations.AlterField(
            model_name='colaborador',
            name='nome',
            field=models.CharField(max_length=150, verbose_name='Nome'),
        ),
        migrations.AddField(
            model_name='colaborador',
            name='setor',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='colaboradores',
                to='compras.setor',
                verbose_name='Setor',
            ),
        ),
        migrations.RunPython(assign_default_setor, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='colaborador',
            name='setor',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='colaboradores',
                to='compras.setor',
                verbose_name='Setor',
            ),
        ),
        migrations.AddConstraint(
            model_name='colaborador',
            constraint=models.UniqueConstraint(
                fields=('setor', 'nome'),
                name='compras_colaborador_setor_nome_unique',
            ),
        ),
    ]
