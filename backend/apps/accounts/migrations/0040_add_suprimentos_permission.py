from django.db import migrations


def add_suprimentos_permission(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')

    for role_id in ('1', '2'):
        try:
            role = Role.objects.get(pk=role_id)
        except Role.DoesNotExist:
            continue
        perms = role.permissions or []
        if 'Suprimentos' not in perms:
            perms.append('Suprimentos')
            role.permissions = perms
            role.save()

    CustomUser = apps.get_model('accounts', 'CustomUser')
    for user in CustomUser.objects.filter(role_id='1'):
        envs = list(user.environments or [])
        if 'Suprimentos' not in envs:
            envs.append('Suprimentos')
            user.environments = envs
            user.save()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0039_remove_customuser_last_seen_at'),
    ]

    operations = [
        migrations.RunPython(add_suprimentos_permission, migrations.RunPython.noop),
    ]
