from django.db import migrations


def add_marketing_permission(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')

    for role_id in ('1', '2'):
        try:
            role = Role.objects.get(pk=role_id)
        except Role.DoesNotExist:
            continue
        perms = role.permissions or []
        if 'Marketing' not in perms:
            perms.append('Marketing')
            role.permissions = perms
            role.save()

    CustomUser = apps.get_model('accounts', 'CustomUser')
    for user in CustomUser.objects.filter(role_id='1'):
        envs = list(user.environments or [])
        if 'Marketing' not in envs:
            envs.append('Marketing')
            user.environments = envs
            user.save()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0014_backfill_sgq_funcoes'),
    ]

    operations = [
        migrations.RunPython(add_marketing_permission, migrations.RunPython.noop),
    ]
