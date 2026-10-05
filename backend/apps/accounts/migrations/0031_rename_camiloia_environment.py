from django.db import migrations

OLD_NAMES = ('Agente Camilo AI', 'Só Camilo IA')
NEW = 'CamiloIA'


def _rename_list(values):
    if not isinstance(values, list):
        return values
    return [NEW if item in OLD_NAMES else item for item in values]


def _rename_keys(data):
    if not isinstance(data, dict):
        return data
    return {(NEW if key in OLD_NAMES else key): value for key, value in data.items()}


def rename_camiloia(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    for role in Role.objects.all():
        renamed = _rename_list(role.permissions or [])
        if renamed != role.permissions:
            role.permissions = renamed
            role.save(update_fields=['permissions'])

    CustomUser = apps.get_model('accounts', 'CustomUser')
    for user in CustomUser.objects.all():
        changed = False
        environments = _rename_list(user.environments or [])
        if environments != user.environments:
            user.environments = environments
            changed = True
        for field in ('filiais', 'abas', 'funcoes'):
            renamed = _rename_keys(getattr(user, field) or {})
            if renamed != getattr(user, field):
                setattr(user, field, renamed)
                changed = True
        if changed:
            user.save()

    Notificacao = apps.get_model('notificacoes', 'Notificacao')
    Notificacao.objects.filter(ambiente__in=OLD_NAMES).update(ambiente=NEW)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0030_rename_agente_camilo_environment'),
        ('notificacoes', '0003_indice_criada_em'),
    ]

    operations = [
        migrations.RunPython(rename_camiloia, migrations.RunPython.noop),
    ]
