from django.db import migrations

def add_compras_permission(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    
    # Update Role 1 (Administrador)
    try:
        admin_role = Role.objects.get(pk='1')
        perms = admin_role.permissions or []
        if 'Compras' not in perms:
            perms.append('Compras')
            admin_role.permissions = perms
            admin_role.save()
    except Role.DoesNotExist:
        pass

    # Update Role 2 (Operador)
    try:
        oper_role = Role.objects.get(pk='2')
        perms = oper_role.permissions or []
        if 'Compras' not in perms:
            perms.append('Compras')
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
            if 'Compras' not in envs:
                envs.append('Compras')
                user.environments = envs
            
            fils = user.filiais or {}
            if 'Compras' not in fils:
                fils['Compras'] = list(all_branches)
                user.filiais = fils
            
            user.save()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_seed_initial_roles'),
    ]

    operations = [
        migrations.RunPython(add_compras_permission, migrations.RunPython.noop),
    ]
