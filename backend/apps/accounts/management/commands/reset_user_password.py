from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()


class Command(BaseCommand):
    help = 'Redefine a senha de um usuário e o reativa (uso operacional, ex. Azure SSH).'

    def add_arguments(self, parser):
        parser.add_argument('username', help='Username (ex.: miguel.ribeiro)')
        parser.add_argument('--password', required=True, help='Nova senha')
        parser.add_argument(
            '--no-activate',
            action='store_true',
            help='Não altera status/is_active',
        )

    def handle(self, *args, **options):
        username = options['username'].strip()
        password = options['password']
        user = User.objects.filter(username__iexact=username).first()
        if not user:
            raise CommandError(f'Usuário não encontrado: {username}')

        user.set_password(password)
        update_fields = ['password']
        if not options['no_activate']:
            user.status = 'ativo'
            user.is_active = True
            update_fields.extend(['status', 'is_active'])
        user.save(update_fields=update_fields)
        self.stdout.write(self.style.SUCCESS(f'OK: senha redefinida para {user.username}.'))
