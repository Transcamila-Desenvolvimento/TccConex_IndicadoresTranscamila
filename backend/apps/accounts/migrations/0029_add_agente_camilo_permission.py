from django.db import migrations


def add_agente_camilo_permission(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')

    for role_id in ('1', '2'):
        try:
            role = Role.objects.get(pk=role_id)
        except Role.DoesNotExist:
            continue
        perms = role.permissions or []
        if 'Agente Camilo AI' not in perms:
            perms.append('Agente Camilo AI')
            role.permissions = perms
            role.save()

    CustomUser = apps.get_model('accounts', 'CustomUser')
    for user in CustomUser.objects.filter(role_id='1'):
        envs = list(user.environments or [])
        if 'Agente Camilo AI' not in envs:
            envs.append('Agente Camilo AI')
            user.environments = envs
            user.save()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0028_customuser_telefone_80'),
    ]

    operations = [
        migrations.RunPython(add_agente_camilo_permission, migrations.RunPython.noop),
    ]
