from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import auth_headers
from apps.frota.models import (
    CustoAbastecimentoLinha,
    CustoFrotaLote,
    CustoManutencaoLinha,
    VeiculoFrota,
)

User = get_user_model()


class IndicadoresFrotaCustosTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='ind_frota_custos',
            password='ind123',
            role_id='2',
            environments=['Indicadores'],
            filiais={'Indicadores': ['Ibiporã (Matriz)']},
        )
        self.v1 = VeiculoFrota.objects.create(
            placa='AOX5C46',
            marca='VW',
            modelo='24.250',
            filial='Ibiporã (Matriz)',
        )
        self.v2 = VeiculoFrota.objects.create(
            placa='BBB2B22',
            marca='Volvo',
            modelo='FH',
            filial='Rondonópolis',
        )
        self.lote = CustoFrotaLote.objects.create(
            label='Jul/2026',
            periodo_inicio=date(2026, 7, 1),
            periodo_fim=date(2026, 7, 31),
            is_active=True,
            imported_manutencao=True,
            imported_abastecimento=True,
        )
        CustoManutencaoLinha.objects.create(
            lote=self.lote,
            veiculo=self.v1,
            placa=self.v1.placa,
            item='Freios',
            grupo='09 - FREIOS',
            valor_total=Decimal('100.00'),
        )
        CustoManutencaoLinha.objects.create(
            lote=self.lote,
            veiculo=self.v2,
            placa=self.v2.placa,
            item='Motor',
            grupo='01 - MOTOR',
            valor_total=Decimal('50.00'),
        )
        CustoAbastecimentoLinha.objects.create(
            lote=self.lote,
            veiculo=self.v1,
            placa=self.v1.placa,
            data=date(2026, 7, 10),
            hodometro=1000,
            km_trecho=80,
            litragem=Decimal('50.000'),
            valor_total=Decimal('400.00'),
        )
        CustoAbastecimentoLinha.objects.create(
            lote=self.lote,
            veiculo=self.v1,
            placa=self.v1.placa,
            data=date(2026, 7, 20),
            hodometro=1200,
            km_trecho=120,
            litragem=Decimal('40.000'),
            valor_total=Decimal('320.00'),
        )
        CustoAbastecimentoLinha.objects.create(
            lote=self.lote,
            veiculo=self.v2,
            placa=self.v2.placa,
            data=date(2026, 7, 15),
            hodometro=5000,
            litragem=Decimal('80.000'),
            valor_total=Decimal('600.00'),
        )

    def test_agrega_totais_media_e_custo_por_km(self):
        response = self.client.get(
            '/api/indicadores/frota/custos/',
            **auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.status_code, 200, response.content)
        summary = response.data['summary']
        self.assertEqual(summary['custoManutencao'], 150.0)
        self.assertEqual(summary['custoAbastecimento'], 1320.0)
        self.assertEqual(summary['custoTotal'], 1470.0)
        self.assertEqual(summary['veiculosCount'], 2)
        self.assertEqual(summary['mediaKmPorLitro'], 2.22)
        self.assertEqual(summary['kmTotal'], 200)
        self.assertEqual(summary['custoPorKm'], 7.35)

        veiculos = {item['placa']: item for item in response.data['veiculos']}
        self.assertEqual(veiculos['AOX5C46']['custoTotal'], 820.0)
        self.assertEqual(veiculos['AOX5C46']['km'], 200)
        self.assertEqual(veiculos['AOX5C46']['kmPorLitro'], 2.22)
        self.assertEqual(veiculos['AOX5C46']['custoPorKm'], 4.1)
        self.assertIsNone(veiculos['BBB2B22']['km'])
        self.assertIsNone(veiculos['BBB2B22']['kmPorLitro'])
        self.assertIsNone(veiculos['BBB2B22']['custoPorKm'])

        tipos = {item['item']: item for item in response.data['manutencaoPorTipo']}
        self.assertEqual(tipos['Freios']['valor'], 100.0)
        self.assertEqual(tipos['Freios']['label'], 'Freios')
        self.assertEqual(tipos['Motor']['valor'], 50.0)

    def test_filtra_por_filial_e_lote(self):
        headers = auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)')
        by_filial = self.client.get(
            '/api/indicadores/frota/custos/',
            {'filial': 'Ibiporã (Matriz)'},
            **headers,
        )
        self.assertEqual(by_filial.status_code, 200)
        self.assertEqual(by_filial.data['summary']['veiculosCount'], 1)
        self.assertEqual(by_filial.data['veiculos'][0]['placa'], 'AOX5C46')

        missing = self.client.get(
            '/api/indicadores/frota/custos/?loteId=99999',
            **headers,
        )
        self.assertEqual(missing.status_code, 400)
