from django.core.management.base import BaseCommand

from apps.notificacoes.reciclagem import reciclar_notificacoes


class Command(BaseCommand):
    help = 'Remove avisos lidos/antigos, excedentes por usuário e navegadores de Web Push sem uso.'

    def handle(self, *args, **options):
        resultado = reciclar_notificacoes()
        self.stdout.write(self.style.SUCCESS(
            'Reciclagem concluída: '
            f"{resultado['lidas']} lidas antigas, "
            f"{resultado['antigas']} vencidas, "
            f"{resultado['excedentes']} acima do limite por usuário, "
            f"{resultado['push']} navegadores sem uso."
        ))
