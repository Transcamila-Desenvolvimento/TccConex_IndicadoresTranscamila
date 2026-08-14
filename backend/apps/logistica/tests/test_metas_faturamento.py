from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.financeiro.tests import auth_headers

User = get_user_model()


class MetaFaturamentoConfigTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='log_meta',
            password='log123',
            role_id='2',
            status='ativo',
            environments=['Logística'],
        )

    def test_get_retorna_doze_meses(self):
        response = self.client.get(
            '/api/logistica/metas-faturamento/?ano=2026',
            **auth_headers(self.user, 'Logística'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['ano'], 2026)
        self.assertEqual(len(response.data['meses']), 12)
        self.assertEqual(response.data['meses'][0]['mes'], 1)
        self.assertEqual(response.data['meses'][0]['nomeMes'], 'Janeiro')

    def test_put_salva_metas_do_ano(self):
        response = self.client.put(
            '/api/logistica/metas-faturamento/',
            {
                'ano': 2027,
                'meses': [
                    {'mes': 1, 'valor': 1_000_000},
                    {'mes': 2, 'valor': 2_000_000},
                ],
            },
            format='json',
            **auth_headers(self.user, 'Logística'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['meses'][0]['valor'], 1_000_000.0)
        self.assertEqual(response.data['meses'][1]['valor'], 2_000_000.0)
        self.assertEqual(response.data['meses'][2]['valor'], 0.0)
        self.assertEqual(response.data['total'], 3_000_000.0)

        again = self.client.get(
            '/api/logistica/metas-faturamento/?ano=2027',
            **auth_headers(self.user, 'Logística'),
        )
        self.assertEqual(again.data['meses'][0]['valor'], 1_000_000.0)
