from django.core.management.base import BaseCommand

from apps.accounts.models import Role

INITIAL_ROLES = [
    {
        'id': '1',
        'name': 'Administrador',
        'description': 'Acesso total a todos os módulos do ERP e administração.',
        'permissions': ['Administração', 'Financeiro', 'Indicadores', 'Compras', 'RH', 'Faturamento', 'SGQ'],
    },
    {
        'id': '2',
        'name': 'Operador',
        'description': 'Acesso restrito aos módulos operacionais autorizados.',
        'permissions': ['Financeiro', 'Indicadores', 'Compras', 'RH', 'Faturamento', 'SGQ'],
    },
]


class Command(BaseCommand):
    help = 'Seed the database with initial roles'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Overwrite existing roles')

    def handle(self, *args, **options):
        force = options['force']
        created = 0
        updated = 0
        skipped = 0

        for data in INITIAL_ROLES:
            role_id = data['id']
            exists = Role.objects.filter(pk=role_id).exists()

            if exists and not force:
                self.stdout.write(f"  Skipped: {data['name']} (already exists)")
                skipped += 1
                continue

            if exists and force:
                Role.objects.filter(pk=role_id).update(**data)
                self.stdout.write(self.style.WARNING(f"  Updated: {data['name']}"))
                updated += 1
            else:
                Role.objects.create(**data)
                self.stdout.write(self.style.SUCCESS(f"  Created: {data['name']}"))
                created += 1

        self.stdout.write(self.style.SUCCESS(
            f'\nSeed complete — {created} created, {updated} updated, {skipped} skipped.'
        ))
