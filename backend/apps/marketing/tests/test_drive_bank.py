from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.tests import auth_headers

User = get_user_model()


class DriveBankConfigTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='marketing_drive_tests',
            password='teste123',
            role_id='2',
            environments=['Marketing'],
            filiais={},
        )

    @override_settings(MARKETING_DRIVE_FOLDER_ID='')
    def test_config_sem_pasta_configurada(self):
        response = self.client.get(
            '/api/marketing/drive-bank/config/',
            **auth_headers(self.user, 'Marketing'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['configured'])

    @override_settings(MARKETING_DRIVE_FOLDER_ID='abc123folder')
    def test_config_pasta_sem_google_vinculado(self):
        response = self.client.get(
            '/api/marketing/drive-bank/config/',
            **auth_headers(self.user, 'Marketing'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['configured'])
        self.assertTrue(response.data['needsGoogleLink'])

    @override_settings(MARKETING_DRIVE_FOLDER_ID='abc123folder')
    def test_list_sem_auth_drive_retorna_400(self):
        response = self.client.get(
            '/api/marketing/drive-bank/files/',
            **auth_headers(self.user, 'Marketing'),
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('detail', response.data)
