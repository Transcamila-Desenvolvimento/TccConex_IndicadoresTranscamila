from collections import defaultdict

from django.db import migrations, models


def atribuir_numeros_existentes(apps, schema_editor):
    PropostaComercial = apps.get_model('comercial', 'PropostaComercial')
    por_ano = defaultdict(list)
    for proposta in PropostaComercial.objects.all().order_by('data_criacao', 'pk'):
        ano = proposta.data_proposta.year if proposta.data_proposta else proposta.data_criacao.year
        por_ano[ano].append(proposta)
    for ano, propostas in por_ano.items():
        for indice, proposta in enumerate(propostas, start=1):
            proposta.ano = ano
            proposta.numero = indice
            proposta.save(update_fields=['ano', 'numero'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0006_linha_veiculo'),
    ]

    operations = [
        migrations.AddField(
            model_name='propostacomercial',
            name='ano',
            field=models.PositiveIntegerField(blank=True, db_index=True, null=True, verbose_name='Ano da numeração'),
        ),
        migrations.AddField(
            model_name='propostacomercial',
            name='numero',
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name='Número da proposta'),
        ),
        migrations.RunPython(atribuir_numeros_existentes, noop),
        migrations.AddConstraint(
            model_name='propostacomercial',
            constraint=models.UniqueConstraint(
                condition=models.Q(('ano__isnull', False), ('numero__isnull', False)),
                fields=('ano', 'numero'),
                name='comercial_proposta_numero_ano_uniq',
            ),
        ),
    ]
