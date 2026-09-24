from django.db import migrations, models


def limpar_revisao_inicial(apps, _schema_editor):
    PropostaComercial = apps.get_model('comercial', 'PropostaComercial')
    for proposta in PropostaComercial.objects.all().iterator():
        historico = proposta.historico_revisoes or []
        revisao = (proposta.revisao or '').strip()
        if historico:
            continue
        if revisao in ('', '01', '1'):
            proposta.revisao = ''
            proposta.save(update_fields=['revisao'])


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0035_proposta_op_portuaria_revisao'),
    ]

    operations = [
        migrations.AlterField(
            model_name='propostacomercial',
            name='revisao',
            field=models.CharField(blank=True, default='', max_length=10, verbose_name='Revisão'),
        ),
        migrations.RunPython(limpar_revisao_inicial, migrations.RunPython.noop),
    ]
