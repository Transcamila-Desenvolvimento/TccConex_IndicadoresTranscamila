from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.views import generate_jwt_token

User = get_user_model()


def auth_headers(user, env='Financeiro', filial=''):
    headers = {
        'HTTP_AUTHORIZATION': f'Bearer {generate_jwt_token(user)}',
        'HTTP_X_PROTHON_ENVIRONMENT': env,
    }
    if filial:
        headers['HTTP_X_PROTHON_FILIAL'] = filial
    return headers


class AuthAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin_test',
            password='admin123',
            role_id='1',
            name='Admin Test',
            environments=['Administração', 'Financeiro', 'Indicadores', 'Compras'],
            filiais={
                'Financeiro': ['Ibiporã (Matriz)'],
                'Indicadores': ['Ibiporã (Matriz)'],
                'Compras': ['Ibiporã (Matriz)'],
            },
        )
        self.operator = User.objects.create_user(
            username='oper_test',
            password='oper123',
            role_id='2',
            name='Operador Test',
            environments=['Financeiro'],
            filiais={'Financeiro': ['Ibiporã (Matriz)']},
        )

    def test_login_success_returns_token(self):
        response = self.client.post('/api/auth/login/', {
            'username': 'admin_test',
            'password': 'admin123',
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn('token', response.data)
        self.assertIn('user', response.data)

    def test_login_invalid_credentials(self):
        response = self.client.post('/api/auth/login/', {
            'username': 'admin_test',
            'password': 'wrong',
        })
        self.assertEqual(response.status_code, 401)

    def test_profile_requires_authentication(self):
        response = self.client.get('/api/auth/profile/')
        self.assertIn(response.status_code, (401, 403))

    def test_profile_with_valid_token(self):
        response = self.client.get('/api/auth/profile/', **auth_headers(self.admin))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['username'], 'admin_test')

    def test_non_admin_cannot_manage_users(self):
        response = self.client.get('/api/auth/users/', **auth_headers(self.operator, 'Administração'))
        self.assertEqual(response.status_code, 403)

    def test_admin_can_list_users(self):
        response = self.client.get('/api/auth/users/', **auth_headers(self.admin, 'Administração'))
        self.assertEqual(response.status_code, 200)
        self.assertIn('results', response.data)
        self.assertIn('count', response.data)

    def test_google_link_requires_configuration(self):
        response = self.client.get('/api/auth/profile/google/link/', **auth_headers(self.admin))
        if response.status_code == 503:
            self.assertIn('detail', response.data)
        else:
            self.assertEqual(response.status_code, 200)
            self.assertIn('authUrl', response.data)

    def test_google_unlink_without_linked_account(self):
        response = self.client.post('/api/auth/profile/google/unlink/', **auth_headers(self.admin))
        self.assertEqual(response.status_code, 400)

    def test_admin_can_force_password_change(self):
        response = self.client.post(
            f'/api/auth/users/{self.operator.id}/force-password-change/',
            **auth_headers(self.admin, 'Administração'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['mustChangePassword'])
        self.operator.refresh_from_db()
        self.assertTrue(self.operator.must_change_password)

    def test_force_password_change_cannot_target_self(self):
        response = self.client.post(
            f'/api/auth/users/{self.admin.id}/force-password-change/',
            **auth_headers(self.admin, 'Administração'),
        )
        self.assertEqual(response.status_code, 400)

    def test_change_password_clears_must_change_flag(self):
        self.operator.must_change_password = True
        self.operator.save(update_fields=['must_change_password'])

        response = self.client.post(
            '/api/auth/profile/change-password/',
            {
                'currentPassword': 'oper123',
                'newPassword': 'nova456',
                'confirmPassword': 'nova456',
            },
            **auth_headers(self.operator),
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['mustChangePassword'])
        self.operator.refresh_from_db()
        self.assertTrue(self.operator.check_password('nova456'))
        self.assertFalse(self.operator.must_change_password)

    def test_login_includes_must_change_password(self):
        self.operator.must_change_password = True
        self.operator.save(update_fields=['must_change_password'])
        response = self.client.post('/api/auth/login/', {
            'username': 'oper_test',
            'password': 'oper123',
        })
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['user']['mustChangePassword'])


class ModulePermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.finance_user = User.objects.create_user(
            username='fin_user',
            password='fin123',
            role_id='2',
            environments=['Financeiro'],
            filiais={'Financeiro': ['Ibiporã (Matriz)']},
        )
        self.indicadores_user = User.objects.create_user(
            username='ind_user',
            password='ind123',
            role_id='2',
            environments=['Indicadores'],
            filiais={'Indicadores': ['Ibiporã (Matriz)']},
        )

    def test_financeiro_denied_with_wrong_environment_header(self):
        response = self.client.get(
            '/api/financeiro/batches/',
            **auth_headers(self.finance_user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.status_code, 403)

    def test_indicadores_requires_filial_in_session(self):
        response = self.client.get(
            '/api/indicadores/kpis/',
            **auth_headers(self.indicadores_user, 'Indicadores'),
        )
        self.assertEqual(response.status_code, 403)

    def test_indicadores_allowed_with_filial(self):
        response = self.client.get(
            '/api/indicadores/kpis/',
            **auth_headers(self.indicadores_user, 'Indicadores', 'Ibiporã (Matriz)'),
        )
        self.assertEqual(response.status_code, 200)

    def test_compras_allowed_with_filial(self):
        # Compras é ambiente global (como Financeiro/RH): não exige filial na sessão.
        compras_user = User.objects.create_user(
            username='compras_user',
            password='com123',
            role_id='2',
            environments=['Compras'],
            filiais={'Compras': ['Ibiporã (Matriz)']},
        )
        from apps.accounts.permissions import check_module_request_access
        class MockRequest:
            def __init__(self, user, env, filial):
                self.user = user
                self.META = {
                    'HTTP_X_PROTHON_ENVIRONMENT': env,
                    'HTTP_X_PROTHON_FILIAL': filial
                }
        
        req = MockRequest(compras_user, 'Compras', 'Ibiporã (Matriz)')
        self.assertTrue(check_module_request_access(compras_user, req, 'Compras'))

        req_no_filial = MockRequest(compras_user, 'Compras', '')
        self.assertTrue(check_module_request_access(compras_user, req_no_filial, 'Compras'))

    def test_rh_allowed_with_filial(self):
        rh_user = User.objects.create_user(
            username='rh_user',
            password='rh123',
            role_id='2',
            environments=['RH'],
            filiais={'RH': ['Ibiporã (Matriz)']},
        )
        from apps.accounts.permissions import check_module_request_access
        class MockRequest:
            def __init__(self, user, env, filial):
                self.user = user
                self.META = {
                    'HTTP_X_PROTHON_ENVIRONMENT': env,
                    'HTTP_X_PROTHON_FILIAL': filial
                }
        
        req = MockRequest(rh_user, 'RH', 'Ibiporã (Matriz)')
        self.assertTrue(check_module_request_access(rh_user, req, 'RH'))

        req_no_filial = MockRequest(rh_user, 'RH', '')
        self.assertTrue(check_module_request_access(rh_user, req_no_filial, 'RH'))


class UserManagementPaginationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin_users_test',
            password='admin123',
            role_id='1',
            name='Admin Users Test',
            environments=['Administração'],
        )
        for i in range(15):
            User.objects.create_user(
                username=f'oper_{i:02d}',
                password='oper123',
                role_id='2',
                name=f'Operador Teste {i:02d}',
                status='ativo' if i % 2 == 0 else 'inativo',
                environments=['Financeiro'],
                filiais={'Financeiro': ['Ibiporã (Matriz)']},
            )

    def test_users_list_is_paginated(self):
        response = self.client.get('/api/auth/users/', **auth_headers(self.admin, 'Administração'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 16)
        self.assertEqual(len(response.data['results']), 10)

    def test_users_list_filters_by_status(self):
        response = self.client.get(
            '/api/auth/users/',
            {'status': 'inativo'},
            **auth_headers(self.admin, 'Administração'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 7)
        self.assertTrue(all(row['status'] == 'inativo' for row in response.data['results']))

    def test_users_list_filters_by_role(self):
        response = self.client.get(
            '/api/auth/users/',
            {'roleId': '1'},
            **auth_headers(self.admin, 'Administração'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)

    def test_users_list_search_by_name_or_username(self):
        response = self.client.get(
            '/api/auth/users/',
            {'search': 'Teste 01'},
            **auth_headers(self.admin, 'Administração'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['username'], 'oper_01')


class UserManagementEnvironmentRulesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin_env_test',
            password='admin123',
            role_id='1',
            name='Admin Env Test',
            environments=['Administração/Manutenção'],
        )

    def test_admin_can_have_custom_environments_not_forced_to_full_access(self):
        """Admin deve poder escolher só um subconjunto de módulos/filiais;
        o backend não deve forçar acesso total a todos os ambientes."""
        response = self.client.post(
            '/api/auth/users/',
            {
                'username': 'novo_admin',
                'name': 'Novo Admin',
                'roleId': '1',
                'status': 'ativo',
                'environments': ['Financeiro'],
                'filiais': {'Financeiro': ['Ibiporã (Matriz)']},
                'password': 'senha-temp-123',
            },
            format='json',
            **auth_headers(self.admin, 'Administração'),
        )
        self.assertEqual(response.status_code, 201)
        self.assertIn('Administração/Manutenção', response.data['environments'])
        self.assertIn('Financeiro', response.data['environments'])
        self.assertNotIn('Indicadores', response.data['environments'])
        self.assertNotIn('Compras', response.data['environments'])
        self.assertEqual(response.data['filiais'].get('Financeiro'), ['Ibiporã (Matriz)'])

    def test_admin_environment_is_always_preserved(self):
        """Mesmo que o ambiente de Administração não seja enviado explicitamente,
        um usuário admin deve mantê-lo automaticamente."""
        response = self.client.post(
            '/api/auth/users/',
            {
                'username': 'outro_admin',
                'name': 'Outro Admin',
                'roleId': '1',
                'status': 'ativo',
                'environments': [],
                'filiais': {},
                'password': 'senha-temp-123',
            },
            format='json',
            **auth_headers(self.admin, 'Administração'),
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['environments'], ['Administração/Manutenção'])

    def test_admin_cannot_remove_own_admin_role(self):
        response = self.client.patch(
            f'/api/auth/users/{self.admin.id}/',
            {'roleId': '2'},
            format='json',
            **auth_headers(self.admin, 'Administração'),
        )
        self.assertEqual(response.status_code, 400)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.role_id, '1')

    def test_admin_can_update_own_other_fields_while_keeping_admin_role(self):
        response = self.client.patch(
            f'/api/auth/users/{self.admin.id}/',
            {'roleId': '1', 'name': 'Admin Renomeado'},
            format='json',
            **auth_headers(self.admin, 'Administração'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'Admin Renomeado')

    def test_admin_can_change_role_of_other_admin_user(self):
        other_admin = User.objects.create_user(
            username='other_admin',
            password='admin123',
            role_id='1',
            name='Other Admin',
            environments=['Administração/Manutenção'],
        )
        response = self.client.patch(
            f'/api/auth/users/{other_admin.id}/',
            {'roleId': '2'},
            format='json',
            **auth_headers(self.admin, 'Administração'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['roleId'], '2')
