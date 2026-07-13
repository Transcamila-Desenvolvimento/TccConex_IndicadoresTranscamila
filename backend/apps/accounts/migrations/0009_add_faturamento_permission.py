from django.db import migrations

ALL_BRANCHES = ['Ibiporã (Matriz)', 'Rondonópolis', 'Paranaguá']


def add_faturamento_permission(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')

    for role_id in ('1', '2'):
        try:
            role = Role.objects.get(pk=role_id)
        except Role.DoesNotExist:
            continue
        perms = role.permissions or []
        if 'Faturamento' not in perms:
            perms.append('Faturamento')
            role.permissions = perms
            role.save()

    CustomUser = apps.get_model('accounts', 'CustomUser')
    for user in CustomUser.objects.all():
        envs = list(user.environments or [])
        fils = dict(user.filiais or {})
        changed = False

        if 'Faturamento' not in envs and ('Financeiro' in envs or user.role_id == '1'):
            envs.append('Faturamento')
            changed = True

        if 'Faturamento' not in fils:
            if user.role_id == '1':
                fils['Faturamento'] = list(ALL_BRANCHES)
                changed = True
            elif 'Financeiro' in fils:
                fils['Faturamento'] = list(fils.get('Financeiro') or ALL_BRANCHES)
                changed = True

        if changed:
            user.environments = envs
            user.filiais = fils
            user.save()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_add_rh_permission'),
        ('faturamento', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(add_faturamento_permission, migrations.RunPython.noop),
    ]
