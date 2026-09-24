from django.db import migrations, models


def dedupe_propostas_mesmo_numero(apps, schema_editor):
    """Remove cópias de revisão criadas no modelo multi-registro, mantendo a mais recente."""
    Proposta = apps.get_model('comercial', 'PropostaComercial')
    grupos = {}
    for item in Proposta.objects.filter(ano__isnull=False, numero__isnull=False).iterator():
        chave = (item.ano, item.numero)
        grupos.setdefault(chave, []).append(item)
    for itens in grupos.values():
        if len(itens) <= 1:
            continue
        itens.sort(
            key=lambda row: ((row.revisao or '').strip(), row.data_criacao or row.pk, row.pk),
            reverse=True,
        )
        for extra in itens[1:]:
            extra.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0038_proposta_revisao_por_registro'),
    ]

    operations = [
        migrations.RunPython(dedupe_propostas_mesmo_numero, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name='propostacomercial',
            name='comercial_proposta_numero_ano_revisao_uniq',
        ),
        migrations.AddConstraint(
            model_name='propostacomercial',
            constraint=models.UniqueConstraint(
                condition=models.Q(('ano__isnull', False), ('numero__isnull', False)),
                fields=('ano', 'numero'),
                name='comercial_proposta_numero_ano_uniq',
            ),
        ),
    ]
