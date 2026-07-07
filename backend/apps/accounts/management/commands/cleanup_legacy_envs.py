from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.accounts.constants import sanitize_environments, sanitize_filiais, sanitize_permissions
from apps.accounts.models import Role

User = get_user_model()


class Command(BaseCommand):
    help = 'Remove ambientes legados (Comercial, Frota) de usuários e papéis'

    def handle(self, *args, **options):
        users_updated = 0
        roles_updated = 0

        for user in User.objects.all():
            new_envs = sanitize_environments(user.environments)
            new_filiais = sanitize_filiais(user.filiais)
            if new_envs != user.environments or new_filiais != user.filiais:
                user.environments = new_envs
                user.filiais = new_filiais
                user.save(update_fields=['environments', 'filiais'])
                users_updated += 1
                self.stdout.write(f'  Usuário atualizado: {user.username}')

        for role in Role.objects.all():
            new_perms = sanitize_permissions(role.permissions)
            if new_perms != role.permissions:
                role.permissions = new_perms
                role.save(update_fields=['permissions'])
                roles_updated += 1
                self.stdout.write(f'  Papel atualizado: {role.name}')

        self.stdout.write(self.style.SUCCESS(
            f'\nLimpeza concluída — {users_updated} usuário(s), {roles_updated} papel(is) atualizado(s).'
        ))
