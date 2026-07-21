from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.tests import auth_headers
from apps.audit.models import AuditLog
from apps.financeiro.models import (
    BalanceHistoryEntry,
    BankAccount,
    BillingRecord,
    CashAdjustment,
    PagarTitulo,
    ReceberTitulo,
    ReportBatch,
)
from apps.indicadores.models import GerencialSnapshot

User = get_user_model()


class IndicadoresCashflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='ind_cf',
            password='ind123',
            role_id='2',
            environments=['Indicadores'],
            filiais={'Indicadores': ['Ibiporã (Matriz)']},
        )
        self.batch = ReportBatch.objects.create(
            label='##CF1',
            reference_date=date(2026, 6, 10),
            is_active=True,
            imported_pagar=True,
            imported_receber=True,
        )
        self.account = BankAccount.objects.create(
            bank='Banco Teste',
            agency='0001',
            number='12345-6',
            account_type='Corrente',
            balance=Decimal('0'),
        )
        BalanceHistoryEntry.objects.create(
            account=self.account,
            reference_date=date(2026, 6, 10),
            bank='Banco Teste',
            number='12345-6',
            entry_type='Saldo',
            value=Decimal('20000.00'),
        )
        CashAdjustment.objects.create(
            reference_date=date(2026, 6, 11),
            adjustment_type='Entrada',
            value=Decimal('500.00'),
            observation='Ajuste teste',
            created_by='ind_cf',
        )
        ReceberTitulo.objects.create(
            batch=self.batch,
            filial='01',
            cod_cliente='C1',
            cliente='Cliente A',
            titulo='R001',
            natureza='NF',
            emissao='01/06/2026',
            vencimento='10/06/2026',
            vencimento_real='10/06/2026',
            valor=Decimal('1000.00'),
            saldo=Decimal('1000.00'),
            historico='',
        )
        PagarTitulo.objects.create(
            batch=self.batch,
            filial='01',
            cod_forn='F1',
            fornecedor='Fornecedor A',
            titulo='P001',
            tipo='NF',
            emissao='01/06/2026',
            vencimento='12/06/2026',
            vencimento_real='12/06/2026',
            valor=Decimal('400.00'),
            saldo=Decimal('400.00'),
            historico='',
        )

    def test_cashflow_returns_summary_and_daily(self):
        response = self.client.get(
            '/api/indicadores/fluxo-caixa/?start=2026-06-10&end=2026-06-12',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('summary', response.data)
        self.assertIn('daily', response.data)
        self.assertEqual(response.data['meta']['batchLabel'], '##CF1')
        self.assertGreaterEqual(len(response.data['daily']), 1)

        day_10 = next(d for d in response.data['daily'] if d['dateIso'] == '2026-06-10')
        self.assertEqual(day_10['saldoInicial'], 20000.0)
        self.assertEqual(day_10['entradas'], 1000.0)
        self.assertEqual(day_10['saldoProjetado'], 21000.0)

        day_11 = next(d for d in response.data['daily'] if d['dateIso'] == '2026-06-11')
        self.assertEqual(day_11['saldoInicial'], 21000.0)
        self.assertEqual(day_11['ajustes'], 500.0)
        self.assertEqual(day_11['saldoProjetado'], 21500.0)

        self.assertEqual(
            response.data['summary']['saldoPrevisto'],
            response.data['daily'][-1]['saldoProjetado'],
        )

        self.assertIn('gerencial', response.data)
        gerencial = response.data['gerencial']
        self.assertEqual(len(gerencial['groups']), 3)
        self.assertEqual(len(gerencial['highlights']), 3)
        self.assertIn('aging', gerencial)
        self.assertIn('schedule', gerencial)

    def test_cashflow_requires_indicadores_environment(self):
        response = self.client.get(
            '/api/indicadores/fluxo-caixa/',
            **auth_headers(self.user, 'Financeiro', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.status_code, 403)

    def test_cashflow_works_without_session_filial(self):
        """Fluxo de caixa é consolidado — não exige filial na sessão."""
        response = self.client.get(
            '/api/indicadores/fluxo-caixa/?start=2026-06-10&end=2026-06-12',
            **auth_headers(self.user, 'Indicadores'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['meta']['batchLabel'], '##CF1')

    def test_launch_resets_saldo_inicial_on_new_day(self):
        BalanceHistoryEntry.objects.create(
            account=self.account,
            reference_date=date(2026, 6, 12),
            bank='Banco Teste',
            number='12345-6',
            entry_type='Saldo',
            value=Decimal('30000.00'),
        )
        response = self.client.get(
            '/api/indicadores/fluxo-caixa/?start=2026-06-10&end=2026-06-12',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        day_12 = next(d for d in response.data['daily'] if d['dateIso'] == '2026-06-12')
        self.assertEqual(day_12['saldoInicial'], 30000.0)

    def test_cashflow_day_detail_lists_titulos(self):
        response = self.client.get(
            '/api/indicadores/fluxo-caixa/dia/?date=2026-06-10',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['dateIso'], '2026-06-10')
        self.assertEqual(response.data['summary']['saldoAnterior'], 20000.0)
        self.assertEqual(response.data['summary']['entradas'], 1000.0)
        self.assertEqual(len(response.data['receber']), 1)
        self.assertEqual(response.data['receber'][0]['titulo'], 'R001')

        response_pagar = self.client.get(
            '/api/indicadores/fluxo-caixa/dia/?date=2026-06-12',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response_pagar.status_code, 200)
        self.assertEqual(len(response_pagar.data['pagar']), 1)
        self.assertEqual(response_pagar.data['pagar'][0]['titulo'], 'P001')

    def test_gerencial_uses_single_date_param(self):
        response = self.client.get(
            '/api/indicadores/fluxo-caixa/?gerencialDate=2026-06-15',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['gerencial']['referenceDate'], '15/06/2026')
        compromissos = response.data['gerencial']['groups'][1]['items']
        atrasos = next(i for i in compromissos if 'Atrasadas' in i['label'])
        self.assertEqual(atrasos['value'], 400.0)

        response_default = self.client.get(
            '/api/indicadores/fluxo-caixa/',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        compromissos_default = response_default.data['gerencial']['groups'][1]['items']
        atrasos_default = next(i for i in compromissos_default if 'Atrasadas' in i['label'])
        self.assertEqual(atrasos_default['value'], 0.0)

    def test_gerencial_pagar_cutoff_matches_resumo_d27(self):
        from apps.indicadores.cashflow_utils import fmt_br, gerencial_pagar_cutoff

        self.assertEqual(gerencial_pagar_cutoff(date(2026, 6, 19)), date(2026, 7, 21))
        self.assertEqual(gerencial_pagar_cutoff(date(2026, 6, 18)), date(2026, 7, 20))

        response = self.client.get(
            '/api/indicadores/fluxo-caixa/?gerencialDate=2026-06-19',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.status_code, 200)
        pagar_label = response.data['gerencial']['groups'][1]['items'][0]['label']
        self.assertIn(fmt_br(date(2026, 7, 21)), pagar_label)
        saidas_subtitle = response.data['gerencial']['highlights'][1]['subtitle']
        self.assertIn(fmt_br(date(2026, 7, 21)), saidas_subtitle)

    def test_cashflow_lists_positions_and_defaults_to_latest(self):
        older = ReportBatch.objects.create(
            label='##OLD',
            reference_date=date(2026, 6, 8),
            is_active=False,
            imported_pagar=True,
            imported_receber=True,
        )
        PagarTitulo.objects.create(
            batch=older,
            filial='01',
            cod_forn='F0',
            fornecedor='Fornecedor Old',
            titulo='P000',
            tipo='NF',
            emissao='01/06/2026',
            vencimento='08/06/2026',
            vencimento_real='08/06/2026',
            valor=Decimal('100.00'),
            saldo=Decimal('100.00'),
            historico='',
        )
        response = self.client.get(
            '/api/indicadores/fluxo-caixa/',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data['facets']['positions']), 2)
        self.assertEqual(response.data['meta']['batchReferenceDate'], '10/06/2026')
        self.assertEqual(response.data['meta']['positionId'], str(self.batch.pk))

        selected = self.client.get(
            f'/api/indicadores/fluxo-caixa/?position={older.pk}',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(selected.status_code, 200)
        self.assertEqual(selected.data['meta']['batchReferenceDate'], '08/06/2026')
        self.assertEqual(selected.data['meta']['minPeriodDate'], '2026-06-08')

    def test_period_start_cannot_be_before_batch_position(self):
        response = self.client.get(
            '/api/indicadores/fluxo-caixa/?start=2026-06-01&end=2026-06-12',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['meta']['periodStart'], '10/06/2026')
        self.assertEqual(response.data['meta']['minPeriodDate'], '2026-06-10')
        self.assertEqual(response.data['daily'][0]['dateIso'], '2026-06-10')

    def test_filtered_period_carries_forward_opening_balance(self):
        full = self.client.get(
            '/api/indicadores/fluxo-caixa/?start=2026-06-16&end=2026-07-16',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(full.status_code, 200)
        closing_16_07 = next(
            day for day in full.data['daily'] if day['dateIso'] == '2026-07-16'
        )['saldoProjetado']

        filtered = self.client.get(
            '/api/indicadores/fluxo-caixa/?start=2026-07-17&end=2026-07-17',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(filtered.status_code, 200)
        first = filtered.data['daily'][0]
        self.assertEqual(first['dateIso'], '2026-07-17')
        self.assertEqual(first['saldoInicial'], closing_16_07)

    def test_gerencial_fat_hoje_uses_previous_day_billing(self):
        BillingRecord.objects.create(
            reference_date=date(2026, 6, 15),
            branch='Ibiporã',
            value=Decimal('104474.77'),
        )
        BillingRecord.objects.create(
            reference_date=date(2026, 6, 16),
            branch='Ibiporã',
            value=Decimal('999.00'),
        )
        response = self.client.get(
            '/api/indicadores/fluxo-caixa/?gerencialDate=2026-06-16',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        disponibilidade = response.data['gerencial']['groups'][0]['items']
        fat_hoje = next(item for item in disponibilidade if item['label'] == 'Fat. Hoje')
        self.assertEqual(fat_hoje['value'], 104474.77)

    def test_gerencial_fat_hoje_monday_includes_weekend_billing(self):
        for ref_date, value in (
            (date(2026, 6, 19), Decimal('100.00')),
            (date(2026, 6, 20), Decimal('200.00')),
            (date(2026, 6, 21), Decimal('300.00')),
            (date(2026, 6, 22), Decimal('999.00')),
        ):
            BillingRecord.objects.create(
                reference_date=ref_date,
                branch='Ibiporã',
                value=value,
            )
        response = self.client.get(
            '/api/indicadores/fluxo-caixa/?gerencialDate=2026-06-22',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        disponibilidade = response.data['gerencial']['groups'][0]['items']
        fat_hoje = next(item for item in disponibilidade if item['label'] == 'Fat. Hoje')
        self.assertEqual(fat_hoje['value'], 600.0)

    def test_gerencial_fat_mes_stops_before_position_date(self):
        batch = ReportBatch.objects.create(
            label='##POS16F',
            reference_date=date(2026, 6, 16),
            is_active=True,
            imported_pagar=True,
            imported_receber=True,
        )
        BillingRecord.objects.create(
            reference_date=date(2026, 6, 15),
            branch='Ibiporã',
            value=Decimal('100.00'),
        )
        BillingRecord.objects.create(
            reference_date=date(2026, 6, 16),
            branch='Ibiporã',
            value=Decimal('50.00'),
        )

        response = self.client.get(
            f'/api/indicadores/fluxo-caixa/?position={batch.pk}&gerencialDate=2026-06-16',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        fat_mes = next(
            item for item in response.data['gerencial']['groups'][0]['items']
            if item['label'] == 'Fat. Mês'
        )
        self.assertEqual(fat_mes['value'], 100.0)

    def test_daily_flow_ignores_adjustments_from_later_import(self):
        older = ReportBatch.objects.create(
            label='##POS16A',
            reference_date=date(2026, 6, 16),
            is_active=False,
            imported_pagar=True,
            imported_receber=True,
        )
        ReportBatch.objects.create(
            label='##POS17A',
            reference_date=date(2026, 6, 17),
            is_active=True,
            imported_pagar=True,
            imported_receber=True,
        )
        CashAdjustment.objects.create(
            reference_date=date(2026, 6, 16),
            adjustment_type='Saída',
            value=Decimal('100.00'),
            observation='Ajuste posição 16',
            created_by='ind_cf',
        )
        CashAdjustment.objects.create(
            reference_date=date(2026, 6, 17),
            adjustment_type='Saída',
            value=Decimal('160675.29'),
            observation='Ajuste posição 17',
            created_by='ind_cf',
        )

        response = self.client.get(
            f'/api/indicadores/fluxo-caixa/?position={older.pk}&start=2026-06-16&end=2026-06-18',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.status_code, 200)
        day_16 = next(row for row in response.data['daily'] if row['dateIso'] == '2026-06-16')
        day_17 = next(row for row in response.data['daily'] if row['dateIso'] == '2026-06-17')
        self.assertNotEqual(day_16['ajustes'], 0.0)
        self.assertEqual(day_17['ajustes'], 0.0)

    def test_gerencial_aging_buckets_use_cte_emissao(self):
        from apps.financeiro.models import AgingTitulo

        AgingTitulo.objects.create(
            batch=self.batch,
            origem='01',
            cod_cliente='C1',
            cliente='Cliente CTE',
            loja='1',
            docto='CTE-1',
            serie='1',
            tipo='F',
            emissao='15/04/2026',
            vencimento='01/06/2026',
            regiao='',
            total=Decimal('1000.00'),
        )
        response = self.client.get(
            '/api/indicadores/fluxo-caixa/?gerencialDate=2026-06-12',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        aging_row = next(
            row for row in response.data['gerencial']['aging']['rows']
            if row['category'] == 'Aging (A Receber)'
        )
        self.assertEqual(aging_row['buckets'][1], 1000.0)

    def test_gerencial_duplicatas_exclude_overdue(self):
        ReceberTitulo.objects.create(
            batch=self.batch,
            filial='01',
            cod_cliente='C2',
            cliente='Cliente B',
            titulo='R-FUT',
            natureza='NF',
            emissao='01/06/2026',
            vencimento='20/06/2026',
            vencimento_real='20/06/2026',
            valor=Decimal('300.00'),
            saldo=Decimal('300.00'),
            historico='',
        )
        response = self.client.get(
            '/api/indicadores/fluxo-caixa/?gerencialDate=2026-06-12',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        recebiveis = response.data['gerencial']['groups'][2]['items']
        duplicatas = next(i for i in recebiveis if 'Duplicatas' in i['label'])
        rec_atraso = next(i for i in recebiveis if 'Atraso' in i['label'])
        self.assertEqual(rec_atraso['value'], 1000.0)
        self.assertEqual(duplicatas['value'], 300.0)
        highlights = response.data['gerencial']['highlights']
        disponibilizar = next(h for h in highlights if 'Disponibilizar' in h['title'])
        self.assertEqual(disponibilizar['value'], 21300.0)

    def test_gerencial_schedule_buckets_anchor_d27(self):
        """Espelha O25:T25 — faixas ancoradas em D27, não janelas 32/29 dias."""
        batch = ReportBatch.objects.create(
            label='##SCH',
            reference_date=date(2026, 6, 22),
            is_active=True,
            imported_receber=True,
        )
        cases = [
            ('R-WE', '20/06/2026', Decimal('100.00')),
            ('R-D27', '22/07/2026', Decimal('200.00')),
            ('R-B2', '23/07/2026', Decimal('300.00')),
            ('R-B2E', '21/08/2026', Decimal('400.00')),
            ('R-B3', '22/08/2026', Decimal('500.00')),
            ('R-AFT', '20/11/2026', Decimal('600.00')),
        ]
        for titulo, vencto, saldo in cases:
            ReceberTitulo.objects.create(
                batch=batch,
                filial='01',
                cod_cliente='C',
                cliente='Cliente',
                titulo=titulo,
                natureza='NF',
                emissao='01/06/2026',
                vencimento=vencto,
                vencimento_real=vencto,
                valor=saldo,
                saldo=saldo,
                historico='',
            )

        response = self.client.get(
            '/api/indicadores/fluxo-caixa/?gerencialDate=2026-06-22',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.status_code, 200)
        schedule = response.data['gerencial']['schedule']
        self.assertEqual(len(schedule), 6)
        self.assertEqual(schedule[0]['label'], '22/06/2026 A 22/07/2026')
        self.assertEqual(schedule[0]['value'], 300.0)
        self.assertEqual(schedule[1]['label'], '23/07/2026 A 21/08/2026')
        self.assertEqual(schedule[1]['value'], 700.0)
        self.assertEqual(schedule[2]['label'], '22/08/2026 A 20/09/2026')
        self.assertEqual(schedule[2]['value'], 500.0)
        self.assertEqual(schedule[5]['label'], 'APÓS 19/11/2026')
        self.assertEqual(schedule[5]['value'], 600.0)
        self.assertEqual(response.data['gerencial']['scheduleTotal'], 2100.0)

    def test_gerencial_pagar_ignores_adjustments_from_later_import(self):
        older = ReportBatch.objects.create(
            label='##POS16',
            reference_date=date(2026, 6, 16),
            is_active=False,
            imported_pagar=True,
            imported_receber=True,
        )
        newer = ReportBatch.objects.create(
            label='##POS17',
            reference_date=date(2026, 6, 17),
            is_active=True,
            imported_pagar=True,
            imported_receber=True,
        )
        PagarTitulo.objects.create(
            batch=older,
            filial='01',
            cod_forn='F1',
            fornecedor='Fornecedor A',
            titulo='P-OLD',
            tipo='NF',
            emissao='01/06/2026',
            vencimento='10/07/2026',
            vencimento_real='10/07/2026',
            valor=Decimal('1000.00'),
            saldo=Decimal('1000.00'),
            historico='',
        )
        PagarTitulo.objects.create(
            batch=newer,
            filial='01',
            cod_forn='F1',
            fornecedor='Fornecedor A',
            titulo='P-NEW',
            tipo='NF',
            emissao='01/06/2026',
            vencimento='10/07/2026',
            vencimento_real='10/07/2026',
            valor=Decimal('1000.00'),
            saldo=Decimal('1000.00'),
            historico='',
        )
        CashAdjustment.objects.create(
            reference_date=date(2026, 6, 17),
            adjustment_type='Saída',
            value=Decimal('160675.29'),
            observation='Ajuste importação dia 17',
            created_by='ind_cf',
        )

        response = self.client.get(
            f'/api/indicadores/fluxo-caixa/?position={older.pk}&gerencialDate=2026-06-16',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.status_code, 200)
        pagar_ate = next(
            item for item in response.data['gerencial']['groups'][1]['items']
            if item['label'].startswith('Contas a Pagar até')
        )
        self.assertEqual(pagar_ate['value'], 1000.0)

    def test_gerencial_saldo_uses_balance_history_on_batch_date(self):
        batch = ReportBatch.objects.create(
            label='##POS16B',
            reference_date=date(2026, 6, 16),
            is_active=True,
            imported_pagar=True,
            imported_receber=True,
        )
        account = BankAccount.objects.create(
            bank='Banco Posição',
            agency='0001',
            number='99999-9',
            account_type='Corrente',
            balance=Decimal('999.99'),
        )
        BalanceHistoryEntry.objects.create(
            account=account,
            reference_date=date(2026, 6, 16),
            bank=account.bank,
            number=account.number,
            entry_type='Corrente',
            value=Decimal('17514263.52'),
        )
        BalanceHistoryEntry.objects.create(
            account=account,
            reference_date=date(2026, 6, 17),
            bank=account.bank,
            number=account.number,
            entry_type='Corrente',
            value=Decimal('17356764.32'),
        )

        response = self.client.get(
            f'/api/indicadores/fluxo-caixa/?position={batch.pk}&gerencialDate=2026-06-16',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.status_code, 200)
        saldo = next(
            item for item in response.data['gerencial']['groups'][0]['items']
            if item['label'] == 'Saldo em Bancos'
        )
        self.assertEqual(saldo['value'], 17514263.52)

    def test_gerencial_saldo_respects_account_filter(self):
        """O filtro de conta bancária (?accounts=) também deve refletir no painel Gerencial."""
        batch = ReportBatch.objects.create(
            label='##POS16ACC',
            reference_date=date(2026, 6, 16),
            is_active=True,
            imported_pagar=True,
            imported_receber=True,
        )
        account_a = BankAccount.objects.create(
            bank='Banco Conta A',
            agency='0001',
            number='11111-1',
            account_type='Corrente',
            balance=Decimal('0'),
        )
        account_b = BankAccount.objects.create(
            bank='Banco Conta B',
            agency='0001',
            number='22222-2',
            account_type='Corrente',
            balance=Decimal('0'),
        )
        BalanceHistoryEntry.objects.create(
            account=account_a,
            reference_date=date(2026, 6, 16),
            bank=account_a.bank,
            number=account_a.number,
            entry_type='Corrente',
            value=Decimal('1000.00'),
        )
        BalanceHistoryEntry.objects.create(
            account=account_b,
            reference_date=date(2026, 6, 16),
            bank=account_b.bank,
            number=account_b.number,
            entry_type='Corrente',
            value=Decimal('5000.00'),
        )

        response = self.client.get(
            f'/api/indicadores/fluxo-caixa/?position={batch.pk}&gerencialDate=2026-06-16&accounts={account_a.pk}',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.status_code, 200)
        saldo = next(
            item for item in response.data['gerencial']['groups'][0]['items']
            if item['label'] == 'Saldo em Bancos'
        )
        self.assertEqual(saldo['value'], 1000.00)

    def test_daily_saldo_uses_balance_history_and_limit_on_position_date(self):
        batch = ReportBatch.objects.create(
            label='##POS16D',
            reference_date=date(2026, 6, 16),
            is_active=True,
            imported_pagar=True,
            imported_receber=True,
        )
        account = BankAccount.objects.create(
            bank='Banco Posição Diário',
            agency='0001',
            number='88888-8',
            account_type='Corrente',
            balance=Decimal('100.00'),
            credit_limit=Decimal('250000.00'),
        )
        BalanceHistoryEntry.objects.create(
            account=account,
            reference_date=date(2026, 6, 16),
            bank=account.bank,
            number=account.number,
            entry_type='Corrente',
            value=Decimal('17514263.52'),
        )

        response = self.client.get(
            f'/api/indicadores/fluxo-caixa/?position={batch.pk}&start=2026-06-16&end=2026-06-16',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.status_code, 200)
        day = next(d for d in response.data['daily'] if d['dateIso'] == '2026-06-16')
        self.assertEqual(day['saldoInicial'], 17764263.52)

    def test_ignored_pr_from_recent_position_excludes_from_older_batch(self):
        older = ReportBatch.objects.create(
            label='##POS16PR',
            reference_date=date(2026, 6, 16),
            is_active=False,
            imported_pagar=True,
            imported_receber=True,
        )
        newer = ReportBatch.objects.create(
            label='##POS17PR',
            reference_date=date(2026, 6, 17),
            is_active=True,
            imported_pagar=True,
            imported_receber=True,
        )
        pr_fields = dict(
            filial='01',
            cod_forn='FPR',
            fornecedor='Fornecedor PR',
            titulo='PR-001',
            tipo='PR',
            emissao='01/06/2026',
            vencimento='16/06/2026',
            vencimento_real='16/06/2026',
            valor=Decimal('500.00'),
            saldo=Decimal('500.00'),
            historico='',
        )
        PagarTitulo.objects.create(batch=older, pr_desconsiderada=False, **pr_fields)
        PagarTitulo.objects.create(batch=newer, pr_desconsiderada=True, **pr_fields)

        response = self.client.get(
            f'/api/indicadores/fluxo-caixa/?position={older.pk}&start=2026-06-16&end=2026-06-16',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.status_code, 200)
        day = next(d for d in response.data['daily'] if d['dateIso'] == '2026-06-16')
        self.assertEqual(day['saidas'], 0.0)

        detail = self.client.get(
            f'/api/indicadores/fluxo-caixa/dia/?date=2026-06-16&position={older.pk}',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data['pagar'], [])

    def test_ignored_pr_beyond_selected_window_does_not_exclude(self):
        older = ReportBatch.objects.create(
            label='##POS16WIN',
            reference_date=date(2026, 6, 16),
            is_active=False,
            imported_pagar=True,
            imported_receber=True,
        )
        for offset, label in enumerate(['##POS17', '##POS18', '##POS19', '##POS20', '##POS21', '##POS22'], start=1):
            ReportBatch.objects.create(
                label=label,
                reference_date=date(2026, 6, 16 + offset),
                is_active=offset == 6,
                imported_pagar=True,
                imported_receber=True,
            )
        far_batch = ReportBatch.objects.get(label='##POS22')
        pr_fields = dict(
            filial='01',
            cod_forn='FPR',
            fornecedor='Fornecedor PR',
            titulo='PR-FAR',
            tipo='PR',
            emissao='01/06/2026',
            vencimento='16/06/2026',
            vencimento_real='16/06/2026',
            valor=Decimal('500.00'),
            saldo=Decimal('500.00'),
            historico='',
        )
        PagarTitulo.objects.create(batch=older, pr_desconsiderada=False, **pr_fields)
        PagarTitulo.objects.create(batch=far_batch, pr_desconsiderada=True, **pr_fields)

        response = self.client.get(
            f'/api/indicadores/fluxo-caixa/?position={older.pk}&start=2026-06-16&end=2026-06-16',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        day = next(d for d in response.data['daily'] if d['dateIso'] == '2026-06-16')
        self.assertEqual(day['saidas'], 500.0)

    def test_cashflow_global_ignores_session_filial(self):
        PagarTitulo.objects.create(
            batch=self.batch,
            filial='05',
            cod_forn='F2',
            fornecedor='Fornecedor B',
            titulo='P002',
            tipo='NF',
            emissao='01/06/2026',
            vencimento='12/06/2026',
            vencimento_real='12/06/2026',
            valor=Decimal('500.00'),
            saldo=Decimal('500.00'),
            historico='',
        )
        response = self.client.get(
            '/api/indicadores/fluxo-caixa/?start=2026-06-12&end=2026-06-12',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        day_12 = next(d for d in response.data['daily'] if d['dateIso'] == '2026-06-12')
        self.assertEqual(day_12['saidas'], 900.0)
        ReceberTitulo.objects.create(
            batch=self.batch,
            filial='01',
            cod_cliente='C2',
            cliente='Cliente B',
            titulo='R-FRI',
            natureza='NF',
            emissao='01/06/2026',
            vencimento='12/06/2026',
            vencimento_real='12/06/2026',
            valor=Decimal('100.00'),
            saldo=Decimal('100.00'),
            historico='',
        )
        ReceberTitulo.objects.create(
            batch=self.batch,
            filial='01',
            cod_cliente='C3',
            cliente='Cliente C',
            titulo='R-SAT',
            natureza='NF',
            emissao='01/06/2026',
            vencimento='13/06/2026',
            vencimento_real='13/06/2026',
            valor=Decimal('200.00'),
            saldo=Decimal('200.00'),
            historico='',
        )
        ReceberTitulo.objects.create(
            batch=self.batch,
            filial='01',
            cod_cliente='C4',
            cliente='Cliente D',
            titulo='R-SUN',
            natureza='NF',
            emissao='01/06/2026',
            vencimento='14/06/2026',
            vencimento_real='14/06/2026',
            valor=Decimal('300.00'),
            saldo=Decimal('300.00'),
            historico='',
        )
        ReceberTitulo.objects.create(
            batch=self.batch,
            filial='01',
            cod_cliente='C5',
            cliente='Cliente E',
            titulo='R-MON',
            natureza='NF',
            emissao='01/06/2026',
            vencimento='15/06/2026',
            vencimento_real='15/06/2026',
            valor=Decimal('400.00'),
            saldo=Decimal('400.00'),
            historico='',
        )
        response = self.client.get(
            '/api/indicadores/fluxo-caixa/?start=2026-06-15&end=2026-06-15',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        monday = response.data['daily'][0]
        self.assertEqual(monday['dateIso'], '2026-06-15')
        self.assertEqual(monday['entradas'], 900.0)

        detail = self.client.get(
            '/api/indicadores/fluxo-caixa/dia/?date=2026-06-15',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        titulos = {row['titulo'] for row in detail.data['receber']}
        self.assertEqual(titulos, {'R-SAT', 'R-SUN', 'R-MON'})

    def test_daily_projection_skips_weekends(self):
        response = self.client.get(
            '/api/indicadores/fluxo-caixa/?start=2026-06-11&end=2026-06-16',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        dates = [d['dateIso'] for d in response.data['daily']]
        self.assertEqual(dates, ['2026-06-11', '2026-06-12', '2026-06-15', '2026-06-16'])

    def test_start_date_on_saturday_moves_to_monday(self):
        response = self.client.get(
            '/api/indicadores/fluxo-caixa/?start=2026-06-13&end=2026-06-13',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.data['meta']['periodStart'], '15/06/2026')
        self.assertEqual(response.data['daily'][0]['dateIso'], '2026-06-15')


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class GerencialEmailTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='ind_email',
            password='ind123',
            role_id='2',
            environments=['Financeiro'],
            filiais={'Financeiro': ['Ibiporã (Matriz)']},
        )
        self.batch = ReportBatch.objects.create(
            label='##CF1',
            reference_date=date(2026, 6, 10),
            is_active=True,
            imported_pagar=True,
            imported_receber=True,
        )
        self.account = BankAccount.objects.create(
            bank='Banco Teste',
            agency='0001',
            number='12345-6',
            account_type='Corrente',
            balance=Decimal('0'),
        )
        BalanceHistoryEntry.objects.create(
            account=self.account,
            reference_date=date(2026, 6, 10),
            bank='Banco Teste',
            number='12345-6',
            entry_type='Saldo',
            value=Decimal('20000.00'),
        )
        ReceberTitulo.objects.create(
            batch=self.batch,
            filial='01',
            cod_cliente='C1',
            cliente='Cliente A',
            titulo='R001',
            natureza='NF',
            emissao='01/06/2026',
            vencimento='10/06/2026',
            vencimento_real='10/06/2026',
            valor=Decimal('1000.00'),
            saldo=Decimal('1000.00'),
            historico='',
        )
        PagarTitulo.objects.create(
            batch=self.batch,
            filial='01',
            cod_forn='F1',
            fornecedor='Fornecedor A',
            titulo='P001',
            tipo='NF',
            emissao='01/06/2026',
            vencimento='12/06/2026',
            vencimento_real='12/06/2026',
            valor=Decimal('400.00'),
            saldo=Decimal('400.00'),
            historico='',
        )

    def test_send_gerencial_email_requires_recipient(self):
        response = self.client.post(
            '/api/indicadores/fluxo-caixa/enviar-gerencial/',
            {'gerencialDate': '2026-06-12', 'to': []},
            format='json',
            **auth_headers(self.user, 'Financeiro'),
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(GerencialSnapshot.objects.count(), 0)

    def test_fat_dia_periodo_dia_comum_mostra_vespera(self):
        from .gerencial_email_service import _fat_dia_periodo

        BillingRecord.objects.create(
            reference_date=date(2026, 6, 11),
            branch='Ibiporã',
            value=Decimal('1000.00'),
        )
        # 12/06/2026 é sexta-feira: o faturamento exibido é o de quinta (11/06).
        self.assertEqual(_fat_dia_periodo(date(2026, 6, 12)), '11/06/2026')

    def test_fat_dia_periodo_segunda_mostra_sexta_e_sabado(self):
        from .gerencial_email_service import _fat_dia_periodo

        BillingRecord.objects.create(
            reference_date=date(2026, 6, 12),
            branch='Ibiporã',
            value=Decimal('1000.00'),
        )
        BillingRecord.objects.create(
            reference_date=date(2026, 6, 13),
            branch='Ibiporã',
            value=Decimal('500.00'),
        )
        # 15/06/2026 é segunda-feira: acumula sexta (12/06) e sábado (13/06).
        self.assertEqual(_fat_dia_periodo(date(2026, 6, 15)), '12/06 e 13/06/2026')

    def test_fat_dia_periodo_segunda_com_domingo_mostra_intervalo(self):
        from .gerencial_email_service import _fat_dia_periodo

        for dia in (12, 13, 14):
            BillingRecord.objects.create(
                reference_date=date(2026, 6, dia),
                branch='Ibiporã',
                value=Decimal('100.00'),
            )
        self.assertEqual(_fat_dia_periodo(date(2026, 6, 15)), '12/06 a 14/06/2026')

    def test_fat_dia_periodo_sem_lancamento_usa_vespera(self):
        from .gerencial_email_service import _fat_dia_periodo

        self.assertEqual(_fat_dia_periodo(date(2026, 6, 12)), '11/06/2026')

    def test_send_gerencial_email_creates_snapshot_and_sends_mail(self):
        mail.outbox.clear()
        response = self.client.post(
            '/api/indicadores/fluxo-caixa/enviar-gerencial/',
            {
                'gerencialDate': '2026-06-12',
                'to': ['gerente@empresa.com.br'],
                'cc': ['copia@empresa.com.br'],
            },
            format='json',
            **auth_headers(self.user, 'Financeiro'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('snapshot', response.data)
        self.assertEqual(response.data['snapshot']['referenceDate'], '2026-06-12')
        self.assertEqual(response.data['snapshot']['batchLabel'], '##CF1')

        snapshot = GerencialSnapshot.objects.get(reference_date=date(2026, 6, 12))
        self.assertEqual(snapshot.sent_by, 'ind_email')
        self.assertEqual(snapshot.batch_label, '##CF1')

        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertIn('RELATÓRIO GERENCIAL', message.subject)
        # A data do "Faturamento do Dia" é a do faturamento defasado (véspera),
        # não a data de referência do relatório.
        self.assertIn('Faturamento do Dia (11/06/2026)', message.body)
        self.assertEqual(message.to, ['gerente@empresa.com.br'])
        self.assertEqual(message.cc, ['copia@empresa.com.br'])
        self.assertEqual(len(message.attachments), 1)
        self.assertEqual(message.attachments[0][0], 'Gerenciais_Analitico.xlsx')

    def test_snapshot_not_changed_until_resend(self):
        self.client.post(
            '/api/indicadores/fluxo-caixa/enviar-gerencial/',
            {'gerencialDate': '2026-06-12', 'to': ['gerente@empresa.com.br']},
            format='json',
            **auth_headers(self.user, 'Financeiro'),
        )
        snapshot = GerencialSnapshot.objects.get(reference_date=date(2026, 6, 12))
        posicao_inicial = snapshot.posicao_gerencial

        BalanceHistoryEntry.objects.create(
            account=self.account,
            reference_date=date(2026, 6, 12),
            bank='Banco Teste',
            number='12345-6',
            entry_type='Saldo',
            value=Decimal('999999.00'),
        )

        snapshot.refresh_from_db()
        self.assertEqual(snapshot.posicao_gerencial, posicao_inicial)

        self.client.post(
            '/api/indicadores/fluxo-caixa/enviar-gerencial/',
            {'gerencialDate': '2026-06-12', 'to': ['gerente@empresa.com.br']},
            format='json',
            **auth_headers(self.user, 'Financeiro'),
        )
        snapshot.refresh_from_db()
        self.assertNotEqual(snapshot.posicao_gerencial, posicao_inicial)


class CashflowActivityVersionTests(TestCase):
    """Sistema multiusuário: outro usuário alterando dados do Financeiro deve
    mudar o marcador de atividade consultado pelo Fluxo de Caixa (polling leve)."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='ind_activity',
            password='ind123',
            role_id='2',
            environments=['Indicadores'],
            filiais={'Indicadores': ['Ibiporã (Matriz)']},
        )

    def _get_version(self) -> int:
        response = self.client.get(
            '/api/indicadores/fluxo-caixa/atividade/',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.status_code, 200)
        return response.data['version']

    def test_version_is_zero_without_financeiro_activity(self):
        self.assertEqual(self._get_version(), 0)

    def test_version_changes_after_relevant_financeiro_action(self):
        before = self._get_version()

        AuditLog.objects.create(username='outro_user', action='financeiro.ajuste.criado', details='Ajuste teste')

        after = self._get_version()
        self.assertGreater(after, before)

    def test_version_ignores_unrelated_actions(self):
        before = self._get_version()

        AuditLog.objects.create(username='rh_user', action='rh.movimentacao.importada', details='Sem relação')

        after = self._get_version()
        self.assertEqual(after, before)

    def test_version_requires_indicadores_environment(self):
        response = self.client.get(
            '/api/indicadores/fluxo-caixa/atividade/',
            **auth_headers(self.user, 'Financeiro'),
        )
        self.assertEqual(response.status_code, 403)
