from django.db import migrations

OLD = 'Administração'
NEW = 'Administração/Manutenção'


def rename_admin_environment(apps, schema_editor):
    User = apps.get_model('accounts', 'CustomUser')
    Role = apps.get_model('accounts', 'Role')

    for user in User.objects.all():
        envs = user.environments or []
        if OLD in envs:
            user.environments = [NEW if env == OLD else env for env in envs]
            user.save(update_fields=['environments'])

    for role in Role.objects.all():
        perms = role.permissions or []
        if OLD in perms:
            role.permissions = [NEW if perm == OLD else perm for perm in perms]
            role.save(update_fields=['permissions'])


def revert_admin_environment(apps, schema_editor):
    User = apps.get_model('accounts', 'CustomUser')
    Role = apps.get_model('accounts', 'Role')

    for user in User.objects.all():
        envs = user.environments or []
        if NEW in envs:
            user.environments = [OLD if env == NEW else env for env in envs]
            user.save(update_fields=['environments'])

    for role in Role.objects.all():
        perms = role.permissions or []
        if NEW in perms:
            role.permissions = [OLD if perm == NEW else perm for perm in perms]
            role.save(update_fields=['permissions'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_role'),
    ]

    operations = [
        migrations.RunPython(rename_admin_environment, revert_admin_environment),
    ]
