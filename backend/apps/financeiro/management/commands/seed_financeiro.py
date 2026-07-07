from datetime import date
from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.financeiro.models import (
    BalanceHistoryEntry,
    BankAccount,
    BillingRecord,
    CashAdjustment,
    ReportBatch,
)

INITIAL_BATCHES = [
    {'label': '##046', 'reference_date': date(2026, 6, 10), 'is_active': True, 'imported_pagar': True, 'imported_receber': True, 'imported_aging': True},
    {'label': '##045', 'reference_date': date(2026, 6, 5), 'is_active': False, 'imported_pagar': True, 'imported_receber': True, 'imported_aging': True},
    {'label': '##044', 'reference_date': date(2026, 6, 4), 'is_active': False, 'imported_pagar': True, 'imported_receber': True, 'imported_aging': True},
    {'label': '##043', 'reference_date': date(2026, 6, 3), 'is_active': False, 'imported_pagar': True, 'imported_receber': True, 'imported_aging': True},
    {'label': '##042', 'reference_date': date(2026, 6, 2), 'is_active': False, 'imported_pagar': True, 'imported_receber': True, 'imported_aging': True},
]

INITIAL_BILLING = [
    ('2026-06-09', 'Ibiporã', 145200.50, 48),
    ('2026-06-09', 'Rondonópolis', 280450.00, 32),
    ('2026-06-09', 'Barueri', 310890.20, 64),
    ('2026-06-09', 'Paranaguá', 95150.00, 15),
    ('2026-06-09', 'Armazém', 42600.00, 8),
    ('2026-06-08', 'Ibiporã', 138900.00, 45),
    ('2026-06-08', 'Rondonópolis', 265100.80, 29),
    ('2026-06-08', 'Barueri', 295400.00, 58),
    ('2026-06-08', 'Paranaguá', 89600.30, 14),
    ('2026-06-08', 'Armazém', 38450.00, 7),
    ('2026-06-07', 'Ibiporã', 120400.00, 40),
    ('2026-06-07', 'Rondonópolis', 210000.00, 22),
    ('2026-06-07', 'Barueri', 350200.10, 72),
    ('2026-06-07', 'Paranaguá', 115000.00, 18),
    ('2026-06-07', 'Armazém', 51000.00, 10),
    ('2026-06-06', 'Ibiporã', 110500.00, 35),
    ('2026-06-06', 'Rondonópolis', 198000.00, 20),
    ('2026-06-06', 'Barueri', 320000.00, 65),
    ('2026-06-06', 'Paranaguá', 87000.00, 12),
    ('2026-06-06', 'Armazém', 35000.00, 6),
]

INITIAL_ADJUSTMENTS = [
    ('2026-06-05', 'Saída', 530000.00, 'TRANSAÇÃO REPOM - 05/06/2026', 'bruna.daiane'),
    ('2026-06-05', 'Entrada', 16659.84, 'Ajuste automático - OPs: R$ 15.853,85 + PAs: R$ 805,99 (venc. 2026-06-05)', 'bruna.daiane'),
    ('2026-06-03', 'Saída', 180000.00, 'TRANSAÇÃO REPOM - 03/06/2026', 'bruna.daiane'),
    ('2026-06-03', 'Entrada', 5526.93, 'Ajuste automático - OPs: R$ 3.108,94 + PAs: R$ 2.417,99 (venc. 2026-06-03)', 'bruna.daiane'),
    ('2026-06-02', 'Saída', 126000.00, 'TRANSAÇÃO REPOM - 02/06/2026', 'bruna.daiane'),
    ('2026-06-02', 'Entrada', 12912.43, 'Ajuste automático - OPs: R$ 12.912,43 (venc. 2026-06-02)', 'bruna.daiane'),
    ('2026-06-01', 'Saída', 12000.00, 'TRANSAÇÃO PAMCARD - 01/06/2026', 'bruna.daiane'),
    ('2026-06-01', 'Saída', 50000.00, 'TRANSAÇÃO REPOM - 01/06/2026', 'bruna.daiane'),
    ('2026-06-01', 'Entrada', 1613.92, 'Ajuste automático - OPs: R$ 1.613,92 (venc. 2026-06-01)', 'bruna.daiane'),
    ('2026-05-29', 'Saída', 160000.00, 'TRANSAÇÃO REPOM - 29/05/2026', 'bruna.daiane'),
    ('2026-05-29', 'Entrada', 9549.95, 'Ajuste automático - OPs: R$ 9.549,95 (venc. 2026-05-29)', 'bruna.daiane'),
    ('2026-05-28', 'Saída', 120000.00, 'TRANSAÇÃO REPOM - 28/05/2026', 'bruna.daiane'),
]

INITIAL_ACCOUNTS = [
    ('Banco do Brasil', '0229-1', '103420-5', 'Corrente', 12450.75, '08/06/2026 10:15', 25000),
    ('Itaú Unibanco', '1421-2', '500004-9', 'Corrente', 45800.20, '08/06/2026 09:30', 50000),
    ('BTG Pactual', '0001', '119716-4', 'Investimento', 150000.00, '08/06/2026 11:00', 0),
]

INITIAL_HISTORY = [
    (1, '2026-06-08', 'Banco do Brasil', '103420-5', 'Corrente', 12450.75),
    (2, '2026-06-08', 'Itaú Unibanco', '500004-9', 'Corrente', 45800.20),
    (3, '2026-06-08', 'BTG Pactual', '119716-4', 'Investimento', 150000.00),
    (1, '2026-06-07', 'Banco do Brasil', '103420-5', 'Corrente', 10200.00),
    (2, '2026-06-07', 'Itaú Unibanco', '500004-9', 'Corrente', 42100.50),
]


class Command(BaseCommand):
    help = 'Opcional: insere dados de demonstração no financeiro (somente com --demo)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--demo',
            action='store_true',
            help='Insere lotes, faturamento, ajustes e saldos de exemplo',
        )

    def handle(self, *args, **options):
        if not options['demo']:
            self.stdout.write(
                self.style.WARNING(
                    'Nenhum dado inserido. O financeiro inicia vazio; use --demo apenas para demonstração.'
                )
            )
            return

        if not ReportBatch.objects.exists():
            for item in INITIAL_BATCHES:
                ReportBatch.objects.create(**item)
            self.stdout.write(self.style.SUCCESS(f'Created {len(INITIAL_BATCHES)} report batches.'))
        else:
            self.stdout.write(self.style.WARNING('Batches already exist — skipping.'))

        if not BillingRecord.objects.exists():
            for ref_date, branch, value, notes in INITIAL_BILLING:
                BillingRecord.objects.create(
                    reference_date=date.fromisoformat(ref_date),
                    branch=branch,
                    value=Decimal(str(value)),
                    notes_count=notes,
                )
            self.stdout.write(self.style.SUCCESS(f'Created {len(INITIAL_BILLING)} billing records.'))

        if not CashAdjustment.objects.exists():
            for ref_date, adj_type, value, obs, user in INITIAL_ADJUSTMENTS:
                CashAdjustment.objects.create(
                    reference_date=date.fromisoformat(ref_date),
                    adjustment_type=adj_type,
                    value=Decimal(str(value)),
                    observation=obs,
                    created_by=user,
                )
            self.stdout.write(self.style.SUCCESS(f'Created {len(INITIAL_ADJUSTMENTS)} cash adjustments.'))

        if not BankAccount.objects.exists():
            account_map: dict[int, BankAccount] = {}
            for idx, (bank, agency, number, acc_type, balance, updated, credit_limit) in enumerate(INITIAL_ACCOUNTS, start=1):
                account_map[idx] = BankAccount.objects.create(
                    bank=bank,
                    agency=agency,
                    number=number,
                    account_type=acc_type,
                    balance=Decimal(str(balance)),
                    credit_limit=Decimal(str(credit_limit)),
                    last_updated=updated,
                )
            for account_idx, ref_date, bank, number, entry_type, value in INITIAL_HISTORY:
                account = account_map[account_idx]
                BalanceHistoryEntry.objects.create(
                    account=account,
                    reference_date=date.fromisoformat(ref_date),
                    bank=bank,
                    number=number,
                    entry_type=entry_type,
                    value=Decimal(str(value)),
                )
            self.stdout.write(self.style.SUCCESS('Created bank accounts and balance history.'))

        self.stdout.write(self.style.SUCCESS('Financeiro demo seed completed.'))
