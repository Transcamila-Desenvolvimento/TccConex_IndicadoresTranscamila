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

    def test_operador_nao_recicla_logs(self):
        response = self.client.post(
            '/api/audit/logs/reciclar/',
            {'olderThanDays': 30},
            format='json',
            **auth_headers(self.operator, 'Financeiro'),
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(AuditLog.objects.count(), 25)

    def test_admin_recicla_somente_logs_antigos(self):
        from datetime import timedelta

        from django.utils import timezone

        antigo = AuditLog.objects.create(
            user=self.admin,
            username=self.admin.username,
            action='login',
            details='acesso antigo',
        )
        AuditLog.objects.filter(pk=antigo.pk).update(created_at=timezone.now() - timedelta(days=40))

        response = self.client.post(
            '/api/audit/logs/reciclar/',
            {'olderThanDays': 30},
            format='json',
            **auth_headers(self.admin, 'Administração'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['removed'], 1)
        self.assertFalse(AuditLog.objects.filter(pk=antigo.pk).exists())
        self.assertEqual(AuditLog.objects.filter(action='usuario.criado').count(), 13)
        registro = AuditLog.objects.get(action='logs.reciclados')
        self.assertIn('1 log com mais de 30 dias', registro.details)

    def test_admin_recicla_todos_e_mantem_o_registro(self):
        response = self.client.post(
            '/api/audit/logs/reciclar/',
            {'all': True},
            format='json',
            **auth_headers(self.admin, 'Administração'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['removed'], 25)
        self.assertEqual(AuditLog.objects.count(), 1)
        self.assertEqual(AuditLog.objects.get().action, 'logs.reciclados')

    def test_prazo_invalido_nao_apaga(self):
        response = self.client.post(
            '/api/audit/logs/reciclar/',
            {'olderThanDays': 7},
            format='json',
            **auth_headers(self.admin, 'Administração'),
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(AuditLog.objects.count(), 25)
