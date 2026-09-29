import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.db.models import Q


def preencher_emissor_pelo_responsavel(apps, schema_editor):
    """Propostas antigas não guardavam o emissor; usa o usuário cujo nome está em `responsavel`."""
    PropostaComercial = apps.get_model('comercial', 'PropostaComercial')
    User = apps.get_model(*settings.AUTH_USER_MODEL.split('.'))
    cache = {}
    for proposta in PropostaComercial.objects.filter(emitido_por__isnull=True).exclude(responsavel=''):
        nome = proposta.responsavel.strip()
        chave = nome.lower()
        if chave not in cache:
            cache[chave] = (
                User.objects.filter(Q(name__iexact=nome) | Q(username__iexact=nome))
                .order_by('-is_active', 'id')
                .values_list('id', flat=True)
                .first()
            )
        if cache[chave]:
            PropostaComercial.objects.filter(pk=proposta.pk).update(emitido_por_id=cache[chave])


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('comercial', '0043_veiculo_comercial'),
    ]

    operations = [
        migrations.AddField(
            model_name='propostacomercial',
            name='emitido_por',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='propostas_comerciais_emitidas',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Emitida por',
            ),
        ),
        migrations.RunPython(preencher_emissor_pelo_responsavel, migrations.RunPython.noop),
    ]
