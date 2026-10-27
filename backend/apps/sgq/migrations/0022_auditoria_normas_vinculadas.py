import re

from django.db import migrations, models
from django.utils import timezone


def vincular_normas_texto(apps, schema_editor):
    """Converte o texto livre de normas em vínculos; nomes sem cadastro viram normas da filial."""
    AuditoriaSGQ = apps.get_model('sgq', 'AuditoriaSGQ')
    NormaSGQ = apps.get_model('sgq', 'NormaSGQ')
    for auditoria in AuditoriaSGQ.objects.exclude(normas=''):
        for nome in {n.strip() for n in re.split(r'[;,]', auditoria.normas) if n.strip()}:
            norma = NormaSGQ.objects.filter(filial=auditoria.filial, nome__iexact=nome[:150]).first()
            if norma is None:
                norma = NormaSGQ.objects.create(
                    filial=auditoria.filial,
                    nome=nome[:150],
                    data_atualizacao=timezone.localdate(),
                    emissor='',
                    criado_por_id=auditoria.criado_por_id,
                )
            auditoria.normas_vinculadas.add(norma)


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0021_item_norma_codigo'),
    ]

    operations = [
        migrations.AddField(
            model_name='auditoriasgq',
            name='normas_vinculadas',
            field=models.ManyToManyField(blank=True, related_name='auditorias', to='sgq.normasgq', verbose_name='Normas'),
        ),
        migrations.RunPython(vincular_normas_texto, migrations.RunPython.noop),
        migrations.RemoveField(model_name='auditoriasgq', name='normas'),
        migrations.RenameField(model_name='auditoriasgq', old_name='normas_vinculadas', new_name='normas'),
    ]
