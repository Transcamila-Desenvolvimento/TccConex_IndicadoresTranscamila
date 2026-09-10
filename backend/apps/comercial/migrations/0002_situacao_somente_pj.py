from django.db import migrations, models


def migrate_ativo_to_situacao(apps, schema_editor):
    ClienteComercial = apps.get_model('comercial', 'ClienteComercial')
    ClienteComercial.objects.filter(ativo=True).update(situacao='cliente')
    ClienteComercial.objects.filter(ativo=False).update(situacao='potencial')


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='clientecomercial',
            name='situacao',
            field=models.CharField(
                choices=[('potencial', 'Potencial cliente'), ('cliente', 'Cliente')],
                default='potencial',
                max_length=20,
                verbose_name='Situação',
            ),
        ),
        migrations.RunPython(migrate_ativo_to_situacao, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='clientecomercial',
            name='ativo',
        ),
        migrations.AlterField(
            model_name='clientecomercial',
            name='cnpj',
            field=models.CharField(blank=True, default='', max_length=20, verbose_name='CNPJ'),
        ),
        migrations.AlterField(
            model_name='clientecomercial',
            name='razao_social',
            field=models.CharField(max_length=200, verbose_name='Razão social'),
        ),
        migrations.AlterField(
            model_name='clientecomercial',
            name='tipo_pessoa',
            field=models.CharField(default='J', max_length=1, verbose_name='Tipo de pessoa'),
        ),
    ]
