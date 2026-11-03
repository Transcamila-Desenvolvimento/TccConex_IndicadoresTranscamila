from django.db import migrations

ABA_ECOSSISTEMA = 'matriz-ecossistema'


def liberar_ecossistema(apps, schema_editor):
    """Quem já tinha a Matriz explícita continua vendo Documentos e Ecossistema."""
    CustomUser = apps.get_model('accounts', 'CustomUser')
    for user in CustomUser.objects.all().iterator():
        abas = dict(user.abas or {})
        filiais = dict(user.aba_filiais or {})
        sgq = list(abas.get('SGQ') or [])
        por_aba = dict(filiais.get('SGQ') or {})
        alterou = False
        if sgq and 'matriz' in sgq and ABA_ECOSSISTEMA not in sgq:
            sgq.append(ABA_ECOSSISTEMA)
            abas['SGQ'] = sgq
            alterou = True
        if 'matriz' in por_aba and ABA_ECOSSISTEMA not in por_aba:
            por_aba[ABA_ECOSSISTEMA] = list(por_aba['matriz'])
            filiais['SGQ'] = por_aba
            alterou = True
        if not alterou:
            continue
        user.abas = abas
        user.aba_filiais = filiais
        user.save(update_fields=['abas', 'aba_filiais'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0035_customuser_aba_filiais'),
    ]

    operations = [
        migrations.RunPython(liberar_ecossistema, migrations.RunPython.noop),
    ]
