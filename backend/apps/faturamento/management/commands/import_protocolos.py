"""Importa protocolos de envio a partir de um arquivo .xlsx.

Uso básico:
    manage.py import_protocolos "caminho/arquivo.xlsx" --cliente "Ascenza"

Inspecionar colunas sem importar:
    manage.py import_protocolos "caminho/arquivo.xlsx" --inspect

Testar sem salvar no banco:
    manage.py import_protocolos "caminho/arquivo.xlsx" --cliente "Ascenza" --dry-run

Mapeamento manual de colunas (quando os nomes diferem do padrão):
    manage.py import_protocolos "caminho/arquivo.xlsx" --cliente "Ascenza" \\
        --col-data "Data Envio" --col-nf "Notas" --col-expedicao "Transp" --col-filial "Filial"

Quando o arquivo tiver colunas Ano + Número Protocolo (uma NF por linha),
as linhas são agrupadas em um único protocolo por (Ano, Número).
Expedição e Filial são opcionais: se presentes, são gravadas; se o cliente
exigir e a coluna faltar, a importação segue com avisos (sem abortar).
"""

from __future__ import annotations

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.faturamento.models import ClienteProtocolo
from apps.faturamento.protocolo_import_service import (
    ProtocoloImportError,
    import_protocolos_from_workbook,
    inspect_protocolo_workbook,
)


class Command(BaseCommand):
    help = 'Importa protocolos de envio de um arquivo .xlsx para um cliente específico'

    def add_arguments(self, parser):
        parser.add_argument('file', type=str, help='Caminho do arquivo .xlsx')
        parser.add_argument(
            '--cliente',
            type=str,
            default='',
            help='Nome (ou parte do nome) do cliente de protocolo. Obrigatório, exceto com --inspect.',
        )
        parser.add_argument(
            '--criar-cliente',
            action='store_true',
            help='Cria o cliente se não existir (usa o nome passado em --cliente).',
        )
        parser.add_argument(
            '--sheet',
            type=str,
            default='',
            help='Nome da aba do Excel. Padrão: primeira aba.',
        )
        parser.add_argument(
            '--col-data',
            type=str,
            default='',
            help='Nome exato da coluna de data no Excel.',
        )
        parser.add_argument(
            '--col-nf',
            type=str,
            default='',
            help='Nome exato da coluna de notas fiscais no Excel.',
        )
        parser.add_argument(
            '--col-expedicao',
            type=str,
            default='',
            help='Nome exato da coluna de expedição no Excel (opcional).',
        )
        parser.add_argument(
            '--col-filial',
            type=str,
            default='',
            help='Nome exato da coluna de filial do cliente no Excel (opcional).',
        )
        parser.add_argument(
            '--inspect',
            action='store_true',
            help='Apenas lista as colunas encontradas no arquivo, sem importar.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Processa os dados mas não salva no banco.',
        )
        parser.add_argument(
            '--skip-duplicatas',
            action='store_true',
            help='Ignora NFs já cadastradas (remove do protocolo) em vez de abortar.',
        )

    def handle(self, *args, **options):
        file_path = Path(options['file'])
        if not file_path.exists():
            raise CommandError(f'Arquivo não encontrado: {file_path}')

        try:
            file_bytes = file_path.read_bytes()
        except OSError as exc:
            raise CommandError(f'Erro ao ler o arquivo: {exc}') from exc

        try:
            info = inspect_protocolo_workbook(file_bytes, sheet=options['sheet'])
        except ProtocoloImportError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(f'Aba utilizada: {info["sheetName"]}')
        self.stdout.write('Colunas encontradas:')
        for i, h in enumerate(info['columns'], 1):
            self.stdout.write(f'  [{i}] {h!r}')

        if options['inspect']:
            return

        cliente = self._resolver_cliente(options)
        self.stdout.write(f'Cliente: {cliente.nome} (id={cliente.pk})')

        if options['dry_run']:
            self.stdout.write(self.style.WARNING('Modo dry-run: nenhum dado será gravado.'))

        try:
            result = import_protocolos_from_workbook(
                file_bytes,
                cliente=cliente,
                dry_run=options['dry_run'],
                skip_duplicatas=options['skip_duplicatas'],
                sheet=options['sheet'],
                col_data=options['col_data'],
                col_nf=options['col_nf'],
                col_expedicao=options['col_expedicao'],
                col_filial=options['col_filial'],
                file_name=file_path.name,
            )
        except ProtocoloImportError as exc:
            raise CommandError(str(exc)) from exc

        # Reexibe mapeamento efetivo (pode incluir overrides)
        eff = result['detectedMapping']
        self.stdout.write(f'Coluna data     : {eff["data"]!r}')
        self.stdout.write(f'Coluna NF       : {eff["notaFiscal"]!r}')
        self.stdout.write(
            f'Coluna expedição: {eff["expedicao"]!r}' if eff['expedicao']
            else 'Coluna expedição: (não mapeada)'
        )
        self.stdout.write(
            f'Coluna filial   : {eff["filial"]!r}' if eff.get('filial')
            else 'Coluna filial: (não mapeada)'
        )
        self.stdout.write(
            f'Coluna ano      : {eff["ano"]!r}' if eff['ano'] else 'Coluna ano: (não mapeada)'
        )
        self.stdout.write(
            f'Coluna nº prot. : {eff["numero"]!r}' if eff['numero']
            else 'Coluna nº protocolo: (não mapeada)'
        )
        mode_label = (
            'agrupado (Ano + Número Protocolo)'
            if result['groupingMode'] == 'grouped'
            else 'linha-a-linha'
        )
        self.stdout.write(f'Modo: {mode_label}')

        for w in result['warnings']:
            self.stdout.write(self.style.WARNING(f'  AVISO — {w["label"]}: {w["message"]}'))

        self.stdout.write('')
        if result['warnings']:
            self.stdout.write(self.style.WARNING(f'{len(result["warnings"])} aviso(s).'))
        if result['errors']:
            self.stdout.write(self.style.ERROR(f'{len(result["errors"])} erro(s) encontrado(s):'))
            for e in result['errors']:
                self.stdout.write(self.style.ERROR(f'  • {e["label"]}: {e["message"]}'))
            if not result['success'] and not options['dry_run']:
                self.stdout.write(self.style.ERROR('Nenhum protocolo foi importado (rollback).'))
                self.stdout.write('Use --skip-duplicatas para ignorar NFs duplicadas.')
                return

        if options['dry_run']:
            self.stdout.write(self.style.SUCCESS(
                f'Dry-run: {result["created"]} protocolo(s) seriam criados, '
                f'{result["ignored"]} ignorados.'
            ))
        else:
            cliente.refresh_from_db()
            self.stdout.write(self.style.SUCCESS(
                f'Importação concluída: {result["created"]} protocolo(s) criado(s), '
                f'{result["ignored"]} ignorados. '
                f'Último número do cliente: {cliente.ultimo_numero_protocolo}.'
            ))

    def _resolver_cliente(self, options) -> ClienteProtocolo:
        nome_cliente = options['cliente'].strip()
        if not nome_cliente:
            raise CommandError(
                'Informe --cliente "Nome do Cliente" (ou use --inspect para ver as colunas).'
            )

        clientes = ClienteProtocolo.objects.filter(nome__icontains=nome_cliente)
        if clientes.count() == 0:
            if options['criar_cliente']:
                cliente = ClienteProtocolo.objects.create(
                    nome=nome_cliente,
                    requer_expedicao=False,
                    exige_filial=False,
                )
                self.stdout.write(self.style.SUCCESS(
                    f'Cliente "{cliente.nome}" criado (id={cliente.pk}).'
                ))
                return cliente
            raise CommandError(
                f'Nenhum cliente encontrado com nome contendo "{nome_cliente}". '
                f'Use --criar-cliente para cadastrá-lo automaticamente.'
            )
        if clientes.count() > 1:
            nomes = ', '.join(f'"{c.nome}" (id={c.pk})' for c in clientes)
            raise CommandError(
                f'Múltiplos clientes encontrados: {nomes}. Use um nome mais específico.'
            )
        return clientes.first()
