from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import auth_headers
from apps.financeiro.models import ReceberTitulo, ReportBatch

from .models import PagadorNd

User = get_user_model()


class ControleNdsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='fat_nd',
            password='senha123',
            role_id='1',
            name='Faturamento ND',
            environments=['Faturamento'],
        )
        self.headers = auth_headers(self.user, env='Faturamento')
        self.lote = ReportBatch.objects.create(
            label='09/10/2026',
            reference_date=date(2026, 10, 9),
            is_active=True,
            imported_receber=True,
        )
        ReceberTitulo.objects.create(
            batch=self.lote,
            filial='01',
            cod_cliente='10',
            cliente='ACME LTDA',
            titulo='1001',
            natureza='ND',
            emissao='01/10/2026',
            vencimento='10/10/2026',
            vencimento_real='10/10/2026',
            valor=Decimal('150.00'),
            saldo=Decimal('150.00'),
            historico='ND 1',
        )
        ReceberTitulo.objects.create(
            batch=self.lote,
            filial='02',
            cod_cliente='10',
            cliente='ACME LTDA',
            titulo='1002',
            natureza='ND',
            emissao='02/10/2026',
            vencimento='12/10/2026',
            vencimento_real='12/10/2026',
            valor=Decimal('80.00'),
            saldo=Decimal('80.00'),
        )
        ReceberTitulo.objects.create(
            batch=self.lote,
            filial='01',
            cod_cliente='20',
            cliente='BETA SA',
            titulo='2001',
            natureza='FT',
            emissao='03/10/2026',
            vencimento='15/10/2026',
            vencimento_real='15/10/2026',
            valor=Decimal('40.00'),
            saldo=Decimal('40.00'),
        )

    def test_lista_pagadores_do_contas_a_receber(self):
        response = self.client.get('/api/faturamento/nds/pagadores/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [(item['codCliente'], item['nome']) for item in response.data['disponiveis']],
            [('10', 'ACME LTDA'), ('20', 'BETA SA')],
        )
        self.assertEqual(response.data['disponiveis'][0]['titulos'], 2)
        self.assertEqual(response.data['selecionados'], [])

    def test_selecionar_pagador_puxa_somente_os_titulos_dele(self):
        salvar = self.client.put(
            '/api/faturamento/nds/pagadores/',
            {'codigos': ['10']},
            format='json',
            **self.headers,
        )
        self.assertEqual(salvar.status_code, 200)
        self.assertEqual(salvar.data['selecionados'], [{'codCliente': '10', 'nome': 'ACME LTDA'}])
        self.assertEqual(PagadorNd.objects.count(), 1)

        titulos = self.client.get('/api/faturamento/nds/titulos/', **self.headers)
        self.assertEqual(titulos.status_code, 200)
        self.assertEqual(titulos.data['count'], 2)
        self.assertEqual(
            {row['titulo'] for row in titulos.data['results']},
            {'1001', '1002'},
        )

    def test_sem_pagador_nao_lista_titulos(self):
        titulos = self.client.get('/api/faturamento/nds/titulos/', **self.headers)
        self.assertEqual(titulos.status_code, 200)
        self.assertEqual(titulos.data['count'], 0)

    def _selecionar_acme(self):
        self.client.put(
            '/api/faturamento/nds/pagadores/',
            {'codigos': ['10']},
            format='json',
            **self.headers,
        )

    def test_titulo_que_sai_do_fluxo_fica_baixado_e_volta(self):
        self._selecionar_acme()
        antes = ReceberTitulo.objects.count()
        primeiro = self.client.get('/api/faturamento/nds/titulos/', **self.headers)
        self.assertEqual(ReceberTitulo.objects.count(), antes)
        self.assertEqual(primeiro.data['count'], 2)

        ReceberTitulo.objects.filter(titulo='1001').delete()
        sumiu = self.client.get('/api/faturamento/nds/titulos/', **self.headers)
        por_titulo = {row['titulo']: row for row in sumiu.data['results']}
        self.assertEqual(por_titulo['1001']['situacao'], 'baixado')
        self.assertEqual(por_titulo['1001']['codCliente'], '10')
        self.assertNotEqual(por_titulo['1002']['situacao'], 'baixado')
        self.assertEqual(ReceberTitulo.objects.filter(titulo='1002').count(), 1)

        futuro = (date.today() + timedelta(days=10)).strftime('%d/%m/%Y')
        ReceberTitulo.objects.create(
            batch=self.lote,
            filial='01',
            cod_cliente='10',
            cliente='ACME LTDA',
            titulo='1001',
            natureza='ND',
            emissao='01/10/2026',
            vencimento=futuro,
            vencimento_real=futuro,
            valor=Decimal('20.00'),
            saldo=Decimal('20.00'),
            historico='ND 1 voltou',
        )
        voltou = self.client.get('/api/faturamento/nds/titulos/', **self.headers)
        linha = next(row for row in voltou.data['results'] if row['titulo'] == '1001')
        self.assertEqual(linha['situacao'], 'a_vencer')
        self.assertEqual(Decimal(linha['saldo']), Decimal('20.00'))
        self.assertEqual(linha['historico'], 'ND 1 voltou')

    def test_vencimento_real_passado_marca_vencido(self):
        self._selecionar_acme()
        passado = (date.today() - timedelta(days=3)).strftime('%d/%m/%Y')
        titulo = ReceberTitulo.objects.get(titulo='1002')
        titulo.vencimento_real = passado
        titulo.save(update_fields=['vencimento_real'])
        resposta = self.client.get('/api/faturamento/nds/titulos/', **self.headers)
        linha = next(row for row in resposta.data['results'] if row['titulo'] == '1002')
        self.assertEqual(linha['situacao'], 'vencido')
        self.assertEqual(linha['vencimentoReal'], passado)

    def test_sem_lote_ativo_nao_marca_baixado(self):
        self._selecionar_acme()
        self.client.get('/api/faturamento/nds/titulos/', **self.headers)
        self.lote.is_active = False
        self.lote.save(update_fields=['is_active'])
        ReceberTitulo.objects.filter(titulo='1001').delete()
        resposta = self.client.get('/api/faturamento/nds/titulos/', **self.headers)
        linha = next(row for row in resposta.data['results'] if row['titulo'] == '1001')
        self.assertNotEqual(linha['situacao'], 'baixado')

    def test_troca_de_nome_continua_amarrada_ao_codigo(self):
        self._selecionar_acme()
        ReceberTitulo.objects.create(
            batch=self.lote,
            filial='01',
            cod_cliente='99',
            cliente='ACME LTDA',
            titulo='9001',
            natureza='FT',
            emissao='01/10/2026',
            vencimento='20/10/2026',
            vencimento_real='20/10/2026',
            valor=Decimal('5.00'),
            saldo=Decimal('5.00'),
        )
        ReceberTitulo.objects.filter(cod_cliente='10').update(cliente='ACME TRANSPORTES')
        resposta = self.client.get('/api/faturamento/nds/titulos/', **self.headers)
        titulos = {row['titulo'] for row in resposta.data['results']}
        self.assertEqual(titulos, {'1001', '1002'})
        self.assertTrue(all(row['cliente'] == 'ACME TRANSPORTES' for row in resposta.data['results']))
        self.assertTrue(all(row['codCliente'] == '10' for row in resposta.data['results']))
        pagadores = self.client.get('/api/faturamento/nds/pagadores/', **self.headers)
        self.assertEqual(pagadores.data['selecionados'], [{'codCliente': '10', 'nome': 'ACME TRANSPORTES'}])

    def _selecionar_todos_com_vencido(self):
        self.client.put(
            '/api/faturamento/nds/pagadores/',
            {'codigos': ['10', '20']},
            format='json',
            **self.headers,
        )
        passado = (date.today() - timedelta(days=3)).strftime('%d/%m/%Y')
        futuro = (date.today() + timedelta(days=3)).strftime('%d/%m/%Y')
        ReceberTitulo.objects.filter(titulo='1001').update(vencimento_real=passado)
        ReceberTitulo.objects.filter(titulo__in=['1002', '2001']).update(vencimento_real=futuro)

    def test_filtra_por_situacao_e_totaliza_saldo(self):
        self._selecionar_todos_com_vencido()
        url = '/api/faturamento/nds/titulos/'

        vencidos = self.client.get(url, {'situacao': 'vencido'}, **self.headers)
        self.assertEqual([row['titulo'] for row in vencidos.data['results']], ['1001'])
        self.assertEqual(Decimal(vencidos.data['totalSaldo']), Decimal('150.00'))

        em_dia = self.client.get(url, {'situacao': 'a_vencer'}, **self.headers)
        self.assertEqual({row['titulo'] for row in em_dia.data['results']}, {'1002', '2001'})
        self.assertEqual(Decimal(em_dia.data['totalSaldo']), Decimal('120.00'))

        todos = self.client.get(url, {'page_size': 1}, **self.headers)
        self.assertEqual(todos.data['count'], 3)
        self.assertEqual(Decimal(todos.data['totalSaldo']), Decimal('270.00'))

    def test_resumo_ignora_filtro_de_situacao_e_respeita_cliente(self):
        self._selecionar_todos_com_vencido()
        url = '/api/faturamento/nds/titulos/'

        resumo = self.client.get(url, {'situacao': 'vencido'}, **self.headers).data['resumo']
        self.assertEqual(resumo['vencido']['quantidade'], 1)
        self.assertEqual(Decimal(resumo['vencido']['saldo']), Decimal('150.00'))
        self.assertEqual(resumo['aVencer']['quantidade'], 2)
        self.assertEqual(Decimal(resumo['aVencer']['saldo']), Decimal('120.00'))

        resumo_beta = self.client.get(url, {'cliente': '20'}, **self.headers).data['resumo']
        self.assertEqual(resumo_beta['vencido']['quantidade'], 0)
        self.assertEqual(Decimal(resumo_beta['vencido']['saldo']), Decimal('0'))
        self.assertEqual(Decimal(resumo_beta['aVencer']['saldo']), Decimal('40.00'))

    def test_filtra_por_cliente(self):
        self._selecionar_todos_com_vencido()
        resposta = self.client.get(
            '/api/faturamento/nds/titulos/',
            {'cliente': '20'},
            **self.headers,
        )
        self.assertEqual([row['titulo'] for row in resposta.data['results']], ['2001'])
        self.assertEqual(Decimal(resposta.data['totalSaldo']), Decimal('40.00'))

    def test_classifica_vencimento_pela_data(self):
        self._selecionar_acme()
        ReceberTitulo.objects.filter(titulo='1001').update(vencimento_real='01/11/2026')
        ReceberTitulo.objects.filter(titulo='1002').update(vencimento_real='20/10/2026')
        resposta = self.client.get(
            '/api/faturamento/nds/titulos/',
            {'ordering': 'vencimento_asc'},
            **self.headers,
        )
        ordem = [row['titulo'] for row in resposta.data['results']]
        self.assertEqual(ordem, ['1002', '1001'])
