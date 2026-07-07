from django.db import migrations

def add_rh_permission(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    
    # Update Role 1 (Administrador)
    try:
        admin_role = Role.objects.get(pk='1')
        perms = admin_role.permissions or []
        if 'RH' not in perms:
            perms.append('RH')
            admin_role.permissions = perms
            admin_role.save()
    except Role.DoesNotExist:
        pass

    # Update Role 2 (Operador)
    try:
        oper_role = Role.objects.get(pk='2')
        perms = oper_role.permissions or []
        if 'RH' not in perms:
            perms.append('RH')
            oper_role.permissions = perms
            oper_role.save()
    except Role.DoesNotExist:
        pass

    # Update existing CustomUsers
    CustomUser = apps.get_model('accounts', 'CustomUser')
    all_branches = ['Ibiporã (Matriz)', 'Rondonópolis', 'Paranaguá']
    for user in CustomUser.objects.all():
        if user.role_id == '1':
            envs = user.environments or []
            if 'RH' not in envs:
                envs.append('RH')
                user.environments = envs
            
            fils = user.filiais or {}
            if 'RH' not in fils:
                fils['RH'] = list(all_branches)
                user.filiais = fils
            
            user.save()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_add_compras_permission'),
    ]

    operations = [
        migrations.RunPython(add_rh_permission, migrations.RunPython.noop),
    ]
