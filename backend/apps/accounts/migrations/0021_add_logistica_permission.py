from django.db import migrations


def add_logistica_permission(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')

    for role_id in ('1', '2'):
        try:
            role = Role.objects.get(pk=role_id)
        except Role.DoesNotExist:
            continue
        perms = role.permissions or []
        if 'Logística' not in perms:
            perms.append('Logística')
            role.permissions = perms
            role.save()

    CustomUser = apps.get_model('accounts', 'CustomUser')
    for user in CustomUser.objects.filter(role_id='1'):
        envs = list(user.environments or [])
        if 'Logística' not in envs:
            envs.append('Logística')
            user.environments = envs
            user.save()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0020_customuser_google_picture_url'),
    ]

    operations = [
        migrations.RunPython(add_logistica_permission, migrations.RunPython.noop),
    ]
