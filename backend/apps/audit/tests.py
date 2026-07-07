from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import auth_headers
from apps.audit.models import AuditLog

User = get_user_model()


class AuditLogAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin_audit',
            password='admin123',
            role_id='1',
            name='Admin Audit',
            environments=['Administração'],
        )
        self.operator = User.objects.create_user(
            username='oper_audit',
            password='oper123',
            role_id='2',
            name='Operador Audit',
            environments=['Financeiro'],
            filiais={'Financeiro': ['Ibiporã (Matriz)']},
        )
        for i in range(25):
            AuditLog.objects.create(
                user=self.admin,
                username=self.admin.username,
                action='usuario.criado' if i % 2 == 0 else 'usuario.atualizado',
                details=f'Registro de teste {i}',
            )

    def test_non_admin_cannot_list_logs(self):
        response = self.client.get('/api/audit/logs/', **auth_headers(self.operator, 'Financeiro'))
        self.assertEqual(response.status_code, 403)

    def test_admin_can_list_logs_paginated(self):
        response = self.client.get('/api/audit/logs/', **auth_headers(self.admin, 'Administração'))
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)
        self.assertIn('count', response.data)
        self.assertEqual(response.data['count'], 25)
        self.assertEqual(len(response.data['results']), 10)

    def test_admin_can_filter_logs_by_action(self):
        response = self.client.get(
            '/api/audit/logs/',
            {'action': 'usuario.atualizado'},
            **auth_headers(self.admin, 'Administração'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 12)
        self.assertTrue(all(row['action'] == 'usuario.atualizado' for row in response.data['results']))

    def test_admin_can_search_logs(self):
        response = self.client.get(
            '/api/audit/logs/',
            {'search': 'teste 1'},
            **auth_headers(self.admin, 'Administração'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data['count'], 1)

    def test_facets_returns_distinct_actions(self):
        response = self.client.get('/api/audit/logs/facets/', **auth_headers(self.admin, 'Administração'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(sorted(response.data['actions']), ['usuario.atualizado', 'usuario.criado'])

    def test_facets_denied_for_non_admin(self):
        response = self.client.get('/api/audit/logs/facets/', **auth_headers(self.operator, 'Financeiro'))
        self.assertEqual(response.status_code, 403)
