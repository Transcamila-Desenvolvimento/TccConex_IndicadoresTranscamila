from django.db import migrations

INITIAL_ROLES = [
    {
        'id': '1',
        'name': 'Administrador',
        'description': 'Acesso total a todos os módulos do ERP e administração.',
        'permissions': ['Administração', 'Financeiro', 'Indicadores'],
    },
    {
        'id': '2',
        'name': 'Operador',
        'description': 'Acesso restrito aos módulos operacionais autorizados.',
        'permissions': ['Financeiro', 'Indicadores'],
    },
]


def seed_roles(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    for data in INITIAL_ROLES:
        Role.objects.update_or_create(
            pk=data['id'],
            defaults={
                'name': data['name'],
                'description': data['description'],
                'permissions': data['permissions'],
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_customuser_google_token'),
    ]

    operations = [
        migrations.RunPython(seed_roles, migrations.RunPython.noop),
    ]
