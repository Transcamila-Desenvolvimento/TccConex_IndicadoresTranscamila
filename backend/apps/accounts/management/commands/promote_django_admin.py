from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()


class Command(BaseCommand):
    help = 'Promove um usuário a administrador do Django (/admin/).'

    def add_arguments(self, parser):
        parser.add_argument('username', help='Username do usuário (ex.: miguel.ribeiro)')

    def handle(self, *args, **options):
        username = options['username'].strip()
        user = User.objects.filter(username__iexact=username).first()
        if not user:
            raise CommandError(f'Usuário não encontrado: {username}')

        user.is_staff = True
        user.is_superuser = True
        user.save(update_fields=['is_staff', 'is_superuser'])
        self.stdout.write(self.style.SUCCESS(f'OK: {user.username} agora é superuser do Django.'))
