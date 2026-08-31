from io import BytesIO

from django.contrib.auth import get_user_model
from django.test import TestCase
from openpyxl import Workbook
from rest_framework.test import APIClient

from apps.frota.models import CustoAbastecimentoLinha, CustoFrotaLote, CustoManutencaoLinha, VeiculoFrota

User = get_user_model()


HEADERS = {'HTTP_X_PROTHON_ENVIRONMENT': 'Frota'}


def _xlsx_bytes(rows: list[list]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    for row in rows:
        sheet.append(row)
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


MANUTENCAO_JULHO = _xlsx_bytes([
    ['', '', '', 'Análise de Custo de Manutenção'],
    ['Filtro:', 'Empresa: 01 - TRANSCAMILA - IBIPORA \\ Período: 01/07/2026 até 31/07/2026 \\ '],
    ['AOX5C46'],
    ['09 - FREIOS'],
    ['09.46 - REGULAR FREIOS', '', '', '', '', 0, 0, 60, 0, 60],
    ['AOX5C99'],
    ['01 - MOTOR'],
    ['11.14 - BICO INJETOR', '', '', '', '', 100, 0, 0, 0, 100],
])

MANUTENCAO_AGOSTO = _xlsx_bytes([
    ['Filtro:', 'Período: 01/08/2026 até 31/08/2026'],
    ['AOX5C46'],
    ['09 - FREIOS'],
    ['09.46 - REGULAR FREIOS', '', '', '', '', 10, 0, 20, 0, 30],
])

ABASTECIMENTO_JULHO = _xlsx_bytes([
    ['Cliente', 'Placa', 'Marca', 'Modelo', 'Cor', 'Descricao', 'Consumo Arla'],
    ['TRANSCAMILA - IBIPORA', 'AOX5C46', 'VW', 'VW 24.250', 'AMARELA', '24.250', ''],
    ['Transacao', 'Data', 'Hora', 'Estabelecimento', 'Cidade', 'Motorista', 'Hodometro/Horimetro', 'U.M', 'Litragem', 'Combustivel', 'Preco Transacao', 'Preco Negociado', 'Valor Total', 'Numero NF-e', 'Tempo em Operacao', 'U.M'],
    ['24071488', '22/07/2026', '13:53', 'AUTO POSTO BELGA', 'LONDRINA/PR', 'MARCOS', '1.238.773', 'km', '151,330', 'Diesel S10', 'R$ 7,07', 'R$ 7,97', 'R$ 1.069,90', '135872', '465', 'km'],
    [None, None, None, None, None, None, None, 'Totais do veiculo', '151,330', None, None, None, 'R$ 1.069,90'],
    ['Cliente', 'Placa', 'Marca', 'Modelo', 'Cor', 'Descricao', 'Consumo Arla'],
    ['TRANSCAMILA', 'ZZZ9Z99', 'VW', 'X', 'AMARELA', 'X', ''],
    ['Transacao', 'Data', 'Hora', 'Estabelecimento', 'Cidade', 'Motorista', 'Hodometro/Horimetro', 'U.M', 'Litragem', 'Combustivel', 'Preco Transacao', 'Preco Negociado', 'Valor Total', 'Numero NF-e'],
    ['1', '23/07/2026', '10:00', 'POSTO X', 'LONDRINA/PR', 'FULANO', '1000', 'km', '10', 'Diesel S10', 'R$ 7,00', 'R$ 7,00', 'R$ 70,00', '1'],
])


class FrotaCustosImportTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='custos.admin',
            password='test123',
            name='Admin Custos',
            role_id='1',
            status='ativo',
            environments=['Frota'],
        )
        self.operador = User.objects.create_user(
            username='custos.op',
            password='test123',
            name='Operador Custos',
            role_id='2',
            status='ativo',
            environments=['Frota'],
            filiais={'Frota': ['Ibiporã (Matriz)']},
            funcoes={'Frota': ['gerenciar-custos-frota']},
        )
        self.somente_leitura = User.objects.create_user(
            username='custos.view',
            password='test123',
            name='Leitura Custos',
            role_id='2',
            status='ativo',
            environments=['Frota'],
            filiais={'Frota': ['Ibiporã (Matriz)']},
        )
        VeiculoFrota.objects.create(
            placa='AOX5C46',
            marca='VW',
            modelo='24.250',
            filial='Ibiporã (Matriz)',
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_import_manutencao_ignora_placa_nao_cadastrada(self):
        self._auth(self.admin)
        from django.core.files.uploadedfile import SimpleUploadedFile

        upload = SimpleUploadedFile(
            'analisecustomanutencao - julho.xlsx',
            MANUTENCAO_JULHO,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response = self.client.post(
            '/api/frota/custos-lotes/importar/',
            {'type': 'manutencao', 'file': upload},
            format='multipart',
            **HEADERS,
        )
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertTrue(body['success'])
        self.assertEqual(body['rowCount'], 1)
        self.assertGreaterEqual(body['skippedRows'], 1)
        self.assertTrue(any('AOX-5C99' in issue['message'] or 'AOX5C99' in issue['message'] for issue in body['issues']))
        self.assertEqual(CustoManutencaoLinha.objects.count(), 1)
        self.assertEqual(CustoFrotaLote.objects.get().label, 'Jul/2026')

    def test_import_abastecimento_le_hodometro_e_km_do_trecho(self):
        self._auth(self.admin)
        from django.core.files.uploadedfile import SimpleUploadedFile

        planilha = _xlsx_bytes([
            ['Cliente', 'Placa', 'Marca', 'Modelo', 'Cor', 'Descricao', 'Consumo Arla'],
            ['TRANSCAMILA', 'AOX5C46', 'VW', 'VW 24.250', 'AMARELA', '24.250', ''],
            ['Transacao', 'Data', 'Hora', 'Estabelecimento', 'Cidade', 'Motorista', 'Hodometro/Horimetro', 'U.M', 'Litragem', 'Combustivel', 'Preco Transacao', 'Preco Negociado', 'Valor Total', 'Numero NF-e', 'Tempo em Operacao', 'U.M'],
            ['1', '08/07/2026', '15:32', 'POSTO X', 'LONDRINA/PR', 'FULANO', '601.690', 'km', '100,000', 'Diesel S10', 'R$ 7,00', 'R$ 7,00', 'R$ 700,00', '1', '1.004', 'km'],
        ])
        upload = SimpleUploadedFile(
            'analitico-abastecimentos-julho.xlsx',
            planilha,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response = self.client.post(
            '/api/frota/custos-lotes/importar/',
            {'type': 'abastecimento', 'file': upload},
            format='multipart',
            **HEADERS,
        )
        self.assertEqual(response.status_code, 200, response.content)
        linha = CustoAbastecimentoLinha.objects.get()
        self.assertEqual(linha.hodometro, 601_690)
        self.assertEqual(linha.km_trecho, 1_004)

    def test_periodos_diferentes_nao_se_sobrescrevem(self):
        self._auth(self.admin)
        from django.core.files.uploadedfile import SimpleUploadedFile

        julho = SimpleUploadedFile('manut-julho.xlsx', MANUTENCAO_JULHO, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        agosto = SimpleUploadedFile('manut-agosto.xlsx', MANUTENCAO_AGOSTO, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        self.client.post('/api/frota/custos-lotes/importar/', {'type': 'manutencao', 'file': julho}, format='multipart', **HEADERS)
        self.client.post('/api/frota/custos-lotes/importar/', {'type': 'manutencao', 'file': agosto}, format='multipart', **HEADERS)
        self.assertEqual(CustoFrotaLote.objects.count(), 2)
        self.assertEqual(CustoManutencaoLinha.objects.count(), 2)

    def test_reimport_mesmo_periodo_substitui_so_o_relatorio(self):
        self._auth(self.admin)
        from django.core.files.uploadedfile import SimpleUploadedFile

        manut = SimpleUploadedFile('manut-julho.xlsx', MANUTENCAO_JULHO, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        abast = SimpleUploadedFile('abastecimentos-julho.xlsx', ABASTECIMENTO_JULHO, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        self.client.post('/api/frota/custos-lotes/importar/', {'type': 'manutencao', 'file': manut}, format='multipart', **HEADERS)
        self.client.post('/api/frota/custos-lotes/importar/', {'type': 'abastecimento', 'file': abast}, format='multipart', **HEADERS)
        self.assertEqual(CustoFrotaLote.objects.count(), 1)
        self.assertEqual(CustoAbastecimentoLinha.objects.count(), 1)
        linha = CustoAbastecimentoLinha.objects.get()
        self.assertEqual(linha.hodometro, 1_238_773)
        self.assertEqual(linha.km_trecho, 465)
        self.assertEqual(CustoManutencaoLinha.objects.count(), 1)

        manut2 = SimpleUploadedFile('manut-julho.xlsx', MANUTENCAO_JULHO, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        self.client.post('/api/frota/custos-lotes/importar/', {'type': 'manutencao', 'file': manut2}, format='multipart', **HEADERS)
        self.assertEqual(CustoFrotaLote.objects.count(), 1)
        self.assertEqual(CustoAbastecimentoLinha.objects.count(), 1)
        self.assertEqual(CustoManutencaoLinha.objects.count(), 1)

    def test_finalize_ativa_lote(self):
        self._auth(self.admin)
        from django.core.files.uploadedfile import SimpleUploadedFile

        upload = SimpleUploadedFile('manut-julho.xlsx', MANUTENCAO_JULHO, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        imported = self.client.post('/api/frota/custos-lotes/importar/', {'type': 'manutencao', 'file': upload}, format='multipart', **HEADERS)
        lote_id = imported.json()['loteId']
        finalized = self.client.post(f'/api/frota/custos-lotes/{lote_id}/finalize/', **HEADERS)
        self.assertEqual(finalized.status_code, 200, finalized.content)
        listed = self.client.get('/api/frota/custos/relatorios/manutencao/', **HEADERS)
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json()['count'], 1)

    def test_lista_sem_lote_retorna_vazio(self):
        self._auth(self.admin)
        listed = self.client.get('/api/frota/custos/relatorios/manutencao/', **HEADERS)
        self.assertEqual(listed.status_code, 200, listed.content)
        self.assertEqual(listed.json()['count'], 0)
        self.assertEqual(listed.json()['results'], [])

    def test_operador_sem_funcao_nao_importa(self):
        self._auth(self.somente_leitura)
        from django.core.files.uploadedfile import SimpleUploadedFile

        upload = SimpleUploadedFile('manut-julho.xlsx', MANUTENCAO_JULHO, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response = self.client.post('/api/frota/custos-lotes/importar/', {'type': 'manutencao', 'file': upload}, format='multipart', **HEADERS)
        self.assertEqual(response.status_code, 403)
