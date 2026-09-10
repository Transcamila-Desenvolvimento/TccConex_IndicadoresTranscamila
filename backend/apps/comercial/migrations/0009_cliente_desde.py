from django.db import migrations, models
from django.utils import timezone


def backfill_cliente_desde(apps, schema_editor):
    ClienteComercial = apps.get_model('comercial', 'ClienteComercial')
    PropostaComercial = apps.get_model('comercial', 'PropostaComercial')

    aceitas = PropostaComercial.objects.filter(status='aprovada', cliente_id__isnull=False).order_by('data_atualizacao', 'pk')
    visto = set()
    for proposta in aceitas:
        cliente = ClienteComercial.objects.filter(pk=proposta.cliente_id).first()
        if not cliente or cliente.pk in visto:
            continue
        visto.add(cliente.pk)
        campos = []
        if cliente.situacao != 'cliente':
            cliente.situacao = 'cliente'
            campos.append('situacao')
        if cliente.cliente_desde is None:
            cliente.cliente_desde = proposta.data_atualizacao or timezone.now()
            campos.append('cliente_desde')
        if campos:
            cliente.save(update_fields=campos)

    for cliente in ClienteComercial.objects.filter(situacao='cliente', cliente_desde__isnull=True):
        cliente.cliente_desde = cliente.data_criacao or timezone.now()
        cliente.save(update_fields=['cliente_desde'])


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0008_remove_tipo_container'),
    ]

    operations = [
        migrations.AddField(
            model_name='clientecomercial',
            name='cliente_desde',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Cliente desde'),
        ),
        migrations.RunPython(backfill_cliente_desde, migrations.RunPython.noop),
    ]
