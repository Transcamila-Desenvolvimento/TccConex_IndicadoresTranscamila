from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from apps.accounts.constants import ALL_BRANCHES

User = get_user_model()

ADMIN_FILIAIS = {env: list(ALL_BRANCHES) for env in ['Financeiro', 'Indicadores', 'Compras', 'RH', 'Faturamento', 'SGQ']}

INITIAL_USERS = [
    {
        'username': 'admin',
        'password': 'admin123',
        'name': 'Administrador Geral',
        'role_id': '1',
        'status': 'ativo',
        'environments': ['Administração', 'Financeiro', 'Indicadores', 'Compras', 'RH', 'Faturamento', 'SGQ'],
        'filiais': ADMIN_FILIAIS,
        'is_staff': True,
        'is_superuser': True,
    },
    {
        'username': 'miguel.ribeiro',
        'password': 'miguel@tcc08',
        'name': 'Miguel Ribeiro',
        'role_id': '1',
        'status': 'ativo',
        'environments': ['Administração', 'Financeiro', 'Indicadores', 'Compras', 'RH', 'Faturamento', 'SGQ'],
        'filiais': ADMIN_FILIAIS,
        'is_staff': True,
        'is_superuser': True,
    },
    {
        'username': 'ana.operador',
        'password': 'ana123',
        'name': 'Ana Silva',
        'role_id': '2',
        'status': 'ativo',
        'environments': ['Financeiro', 'Indicadores', 'Compras', 'RH', 'Faturamento'],
        'filiais': {
            'Financeiro': ['Ibiporã (Matriz)'],
            'Indicadores': ['Ibiporã (Matriz)'],
            'Compras': ['Ibiporã (Matriz)'],
            'Faturamento': ['Ibiporã (Matriz)'],
            'RH': ['Ibiporã (Matriz)'],
        },
        'is_staff': False,
        'is_superuser': False,
    },
    {
        'username': 'joao.operador',
        'password': 'joao123',
        'name': 'João Souza',
        'role_id': '2',
        'status': 'ativo',
        'environments': ['Financeiro', 'Indicadores', 'Compras', 'RH', 'Faturamento'],
        'filiais': {
            'Financeiro': ['Rondonópolis'],
            'Indicadores': ['Rondonópolis', 'Paranaguá'],
            'Compras': ['Rondonópolis', 'Paranaguá'],
            'Faturamento': ['Rondonópolis', 'Paranaguá'],
            'RH': ['Rondonópolis', 'Paranaguá'],
        },
        'is_staff': False,
        'is_superuser': False,
    },
]


class Command(BaseCommand):
    help = 'Seed the database with initial users'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Overwrite existing users')

    def handle(self, *args, **options):
        force = options['force']
        created = 0
        skipped = 0

        for data in INITIAL_USERS:
            password = data.pop('password')
            exists = User.objects.filter(username__iexact=data['username']).exists()

            if exists and not force:
                self.stdout.write(f"  Skipped: {data['username']} (already exists)")
                data['password'] = password
                skipped += 1
                continue

            if exists and force:
                user = User.objects.get(username__iexact=data['username'])
                for attr, value in data.items():
                    setattr(user, attr, value)
                user.set_password(password)
                user.save()
                self.stdout.write(self.style.WARNING(f"  Updated: {data['username']}"))
            else:
                user = User(**data)
                user.set_password(password)
                user.save()
                self.stdout.write(self.style.SUCCESS(f"  Created: {data['username']}"))
                created += 1

            data['password'] = password

        self.stdout.write(self.style.SUCCESS(
            f'\nSeed complete — {created} created, {skipped} skipped.'
        ))
