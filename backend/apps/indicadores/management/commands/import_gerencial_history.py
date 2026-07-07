from datetime import date

from django.core.management.base import BaseCommand, CommandError

from apps.indicadores.gerencial_import_service import import_gerencial_history_file


class Command(BaseCommand):
    help = 'Importa histórico gerencial (Gerenciais_Analitico.xlsx) para GerencialSnapshot'

    def add_arguments(self, parser):
        parser.add_argument('file', type=str, help='Caminho do arquivo .xlsx')
        parser.add_argument(
            '--dates',
            type=str,
            default='',
            help='Datas ISO separadas por vírgula (ex.: 2026-06-08,2026-06-09). Vazio = todas do arquivo.',
        )
        parser.add_argument(
            '--skip-existing',
            action='store_true',
            help='Não sobrescreve snapshots já existentes (ex.: dia 12 enviado por e-mail).',
        )

    def handle(self, *args, **options):
        file_path = options['file']
        only_dates = None
        if options['dates'].strip():
            try:
                only_dates = {
                    date.fromisoformat(part.strip())
                    for part in options['dates'].split(',')
                    if part.strip()
                }
            except ValueError as exc:
                raise CommandError('Datas inválidas em --dates. Use YYYY-MM-DD.') from exc

        result = import_gerencial_history_file(
            file_path,
            only_dates=only_dates,
            skip_existing=options['skip_existing'],
        )

        if result['total_in_file'] == 0:
            self.stdout.write(self.style.WARNING('Nenhuma coluna de data reconhecida no arquivo.'))
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Importação concluída: {result['created']} criado(s), "
                f"{result['updated']} atualizado(s), {result['skipped']} ignorado(s)."
            )
        )
        if result['dates']:
            formatted = ', '.join(d.strftime('%d/%m/%Y') for d in result['dates'])
            self.stdout.write(f"Datas importadas: {formatted}")
