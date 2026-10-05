from django.db import migrations

OLD = 'Agente Camilo AI'
NEW = 'Só Camilo IA'


def _rename_list(values):
    if not isinstance(values, list):
        return values
    return [NEW if item == OLD else item for item in values]


def _rename_keys(data):
    if not isinstance(data, dict):
        return data
    return {(NEW if key == OLD else key): value for key, value in data.items()}


def rename_agente_camilo(apps, schema_editor):
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
    Notificacao.objects.filter(ambiente=OLD).update(ambiente=NEW)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0029_add_agente_camilo_permission'),
        ('notificacoes', '0003_indice_criada_em'),
    ]

    operations = [
        migrations.RunPython(rename_agente_camilo, migrations.RunPython.noop),
    ]
