from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.frota.models import VeiculoFrota, normalize_placa

User = get_user_model()

PAYLOAD = {
    'placa': 'ABC1D23',
    'marca': 'Volvo',
    'modelo': 'FH 540',
    'anoFabricacao': 2022,
    'anoModelo': 2023,
    'cor': 'Branco',
    'combustivel': 'diesel-s10',
    'categoria': 'truck',
    'tipoCarroceria': 'bau',
    'hodometro': 120000,
    'status': 'ativo',
    'filial': 'Ibiporã (Matriz)',
}


class FrotaVeiculosTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='frota.admin',
            password='test123',
            name='Admin Frota',
            role_id='1',
            status='ativo',
            environments=['Frota'],
        )
        self.operador = User.objects.create_user(
            username='frota.op',
            password='test123',
            name='Operador Frota',
            role_id='2',
            status='ativo',
            environments=['Frota'],
            filiais={'Frota': ['Ibiporã (Matriz)']},
            funcoes={'Frota': ['gerenciar-veiculos']},
        )
        self.somente_leitura = User.objects.create_user(
            username='frota.view',
            password='test123',
            name='Leitura Frota',
            role_id='2',
            status='ativo',
            environments=['Frota'],
            filiais={'Frota': ['Ibiporã (Matriz)']},
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_list_requires_auth(self):
        response = self.client.get('/api/frota/veiculos/')
        self.assertIn(response.status_code, (401, 403))

    def test_admin_cria_e_lista_veiculo(self):
        self._auth(self.admin)
        created = self.client.post(
            '/api/frota/veiculos/',
            PAYLOAD,
            format='json',
            HTTP_X_PROTHON_ENVIRONMENT='Frota',
        )
        self.assertEqual(created.status_code, 201, created.content)
        self.assertEqual(created.json()['placa'], 'ABC-1D23')
        self.assertEqual(VeiculoFrota.objects.get().placa, normalize_placa('ABC1D23'))

        listed = self.client.get('/api/frota/veiculos/', HTTP_X_PROTHON_ENVIRONMENT='Frota')
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.json()), 1)

    def test_placa_duplicada(self):
        self._auth(self.admin)
        self.client.post('/api/frota/veiculos/', PAYLOAD, format='json', HTTP_X_PROTHON_ENVIRONMENT='Frota')
        duplicated = self.client.post(
            '/api/frota/veiculos/',
            PAYLOAD,
            format='json',
            HTTP_X_PROTHON_ENVIRONMENT='Frota',
        )
        self.assertEqual(duplicated.status_code, 400)

    def test_operador_sem_funcao_nao_cadastra(self):
        self._auth(self.somente_leitura)
        response = self.client.post(
            '/api/frota/veiculos/',
            PAYLOAD,
            format='json',
            HTTP_X_PROTHON_ENVIRONMENT='Frota',
        )
        self.assertEqual(response.status_code, 403)

    def test_operador_nao_ve_outra_filial(self):
        VeiculoFrota.objects.create(
            placa='XYZ1A23',
            marca='SCANIA',
            modelo='R450',
            categoria='truck',
            combustivel='diesel-s10',
            status='ativo',
            filial='Rondonópolis',
        )
        self._auth(self.operador)
        listed = self.client.get('/api/frota/veiculos/', HTTP_X_PROTHON_ENVIRONMENT='Frota')
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json(), [])
