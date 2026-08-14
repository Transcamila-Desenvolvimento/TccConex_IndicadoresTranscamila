from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

User = get_user_model()


class LogisticaSummaryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='logistica.user',
            password='test123',
            name='Usuário Logística',
            role_id='2',
            status='ativo',
            environments=['Logística'],
        )

    def test_summary_requires_auth(self):
        response = self.client.get('/api/logistica/summary/')
        self.assertIn(response.status_code, (401, 403))

    def test_summary_ok_for_authorized_user(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(
            '/api/logistica/summary/',
            HTTP_X_PROTHON_ENVIRONMENT='Logística',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['environment'], 'Logística')
