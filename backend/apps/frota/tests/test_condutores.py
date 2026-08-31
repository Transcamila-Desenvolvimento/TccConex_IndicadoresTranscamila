from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.frota.models import CondutorFrota

User = get_user_model()
HEADERS = {'HTTP_X_PROTHON_ENVIRONMENT': 'Frota'}


class FrotaCondutoresTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='cond.admin',
            password='test123',
            name='Admin Cond',
            role_id='1',
            status='ativo',
            environments=['Frota'],
        )

    def test_cadastrar_e_listar_condutor(self):
        self.client.force_authenticate(user=self.admin)
        created = self.client.post(
            '/api/frota/condutores/',
            {
                'nome': 'Carlos Condutor',
                'cpf': '12345678901',
                'filial': 'Ibiporã (Matriz)',
                'status': 'ativo',
            },
            format='json',
            **HEADERS,
        )
        self.assertEqual(created.status_code, 201, created.content)
        self.assertEqual(created.json()['nome'], 'CARLOS CONDUTOR')
        self.assertNotIn('pontuacao', created.json())
        listed = self.client.get('/api/frota/condutores/', **HEADERS)
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.json()), 1)

    def test_excluir_condutor(self):
        self.client.force_authenticate(user=self.admin)
        created = self.client.post(
            '/api/frota/condutores/',
            {'nome': 'Ana Lima', 'filial': 'Ibiporã (Matriz)'},
            format='json',
            **HEADERS,
        )
        condutor_id = created.json()['id']
        deleted = self.client.delete(f'/api/frota/condutores/{condutor_id}/', **HEADERS)
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(CondutorFrota.objects.filter(pk=condutor_id).exists())

    def test_operador_sem_funcao_nao_cadastra_condutor(self):
        operador = User.objects.create_user(
            username='cond.view',
            password='test123',
            name='Leitura Cond',
            role_id='2',
            status='ativo',
            environments=['Frota'],
            filiais={'Frota': ['Ibiporã (Matriz)']},
        )
        self.client.force_authenticate(user=operador)
        response = self.client.post(
            '/api/frota/condutores/',
            {'nome': 'Sem Permissão', 'filial': 'Ibiporã (Matriz)'},
            format='json',
            **HEADERS,
        )
        self.assertEqual(response.status_code, 403)

    def test_ocorrencias_endpoint_removido(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/frota/ocorrencias/', **HEADERS)
        self.assertEqual(response.status_code, 404)
