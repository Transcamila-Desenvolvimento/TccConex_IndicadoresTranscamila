from django.db import migrations


def add_comercial_permission(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')

    for role_id in ('1', '2'):
        try:
            role = Role.objects.get(pk=role_id)
        except Role.DoesNotExist:
            continue
        perms = role.permissions or []
        if 'Comercial' not in perms:
            perms.append('Comercial')
            role.permissions = perms
            role.save()

    CustomUser = apps.get_model('accounts', 'CustomUser')
    for user in CustomUser.objects.filter(role_id='1'):
        envs = list(user.environments or [])
        if 'Comercial' not in envs:
            envs.append('Comercial')
            user.environments = envs
            user.save()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0024_add_frota_permission'),
    ]

    operations = [
        migrations.RunPython(add_comercial_permission, migrations.RunPython.noop),
    ]
