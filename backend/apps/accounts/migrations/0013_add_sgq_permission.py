from django.db import migrations

ALL_BRANCHES = ['Ibiporã (Matriz)', 'Rondonópolis', 'Paranaguá']


def add_sgq_permission(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')

    for role_id in ('1', '2'):
        try:
            role = Role.objects.get(pk=role_id)
        except Role.DoesNotExist:
            continue
        perms = role.permissions or []
        if 'SGQ' not in perms:
            perms.append('SGQ')
            role.permissions = perms
            role.save()

    CustomUser = apps.get_model('accounts', 'CustomUser')
    for user in CustomUser.objects.filter(role_id='1'):
        envs = list(user.environments or [])
        fils = dict(user.filiais or {})
        changed = False

        if 'SGQ' not in envs:
            envs.append('SGQ')
            changed = True

        if 'SGQ' not in fils:
            fils['SGQ'] = list(ALL_BRANCHES)
            changed = True

        if changed:
            user.environments = envs
            user.filiais = fils
            user.save()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0012_customuser_funcoes'),
    ]

    operations = [
        migrations.RunPython(add_sgq_permission, migrations.RunPython.noop),
    ]
