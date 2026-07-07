from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.audit.models import AuditLog

User = get_user_model()

INITIAL_LOGS = [
    {
        'username': 'admin',
        'action': 'login',
        'details': 'Login realizado com sucesso.',
    },
    {
        'username': 'admin',
        'action': 'usuario.criado',
        'details': 'Usuário ana.operador criado no sistema.',
    },
    {
        'username': 'miguel.ribeiro',
        'action': 'relatorio.exportado',
        'details': 'Exportação: Fluxo de Caixa Mensal Consolidado (CSV).',
    },
    {
        'username': 'ana.operador',
        'action': 'indicadores.consulta',
        'details': 'Consulta de KPIs da filial Ibiporã (Matriz).',
    },
    {
        'username': 'admin',
        'action': 'importacao.relatorio',
        'details': 'Importação de relatório contas a pagar concluída.',
    },
]


class Command(BaseCommand):
    help = 'Seed the database with initial audit logs'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Delete existing logs and re-seed')

    def handle(self, *args, **options):
        force = options['force']

        if force:
            deleted, _ = AuditLog.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'  Removed {deleted} existing log(s).'))

        if AuditLog.objects.exists() and not force:
            self.stdout.write('  Skipped: audit logs already exist (use --force to re-seed)')
            return

        created = 0
        for index, data in enumerate(INITIAL_LOGS):
            user = User.objects.filter(username__iexact=data['username']).first()
            AuditLog.objects.create(
                user=user,
                username=data['username'],
                action=data['action'],
                details=data['details'],
                created_at=timezone.now() - timezone.timedelta(hours=index * 3),
            )
            created += 1

        self.stdout.write(self.style.SUCCESS(f'\nSeed complete — {created} audit log(s) created.'))
