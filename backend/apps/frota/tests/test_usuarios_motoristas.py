from datetime import date

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.test import TestCase
from rest_framework.test import APIClient

from apps.frota.models import UsuarioMotorista
from apps.rh.models import FuncionarioQuadro

User = get_user_model()
HEADERS = {
    'HTTP_X_PROTHON_ENVIRONMENT': 'Frota',
    'HTTP_X_PROTHON_FILIAL': 'Ibiporã (Matriz)',
}


class UsuariosMotoristaTests(TestCase):
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
        self.client.force_authenticate(self.admin)
        self.adalto = FuncionarioQuadro.objects.create(
            nome='ADALTO GOMES DE LIMA',
            cpf='48101494987',
            filial='Ibiporã (Matriz)',
            cargo='MOTORISTA TRUCK',
            departamento='Motoristas',
            ativo=True,
        )
        self.joao = FuncionarioQuadro.objects.create(
            nome='JOÃO DA SILVA',
            cpf='11122233344',
            filial='Ibiporã (Matriz)',
            cargo='MOTORISTA CARRETA',
            departamento='Motoristas',
            ativo=True,
        )
        FuncionarioQuadro.objects.create(
            nome='BRUNA DAIANE SILVEIRA',
            cpf='06287669985',
            filial='Ibiporã (Matriz)',
            cargo='ANALISTA FINANCEIRO I',
            departamento='Administrativo',
            ativo=True,
        )
        FuncionarioQuadro.objects.create(
            nome='CARLOS INATIVO',
            cpf='22233344455',
            filial='Ibiporã (Matriz)',
            cargo='MOTORISTA',
            departamento='Motoristas',
            ativo=False,
        )
        FuncionarioQuadro.objects.create(
            nome='PEDRO DE RONDON',
            cpf='33344455566',
            filial='Rondonópolis',
            cargo='MOTORISTA',
            departamento='Motoristas',
            ativo=True,
        )

    def test_elegiveis_so_motoristas_ativos_da_filial_com_usuario_nome_sobrenome(self):
        response = self.client.get('/api/frota/motoristas/elegiveis/', **HEADERS)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            [(item['nomeCompleto'], item['username']) for item in response.data],
            [('ADALTO GOMES DE LIMA', 'adalto.lima'), ('JOÃO DA SILVA', 'joao.silva')],
        )

    def test_cadastra_com_senha_definida_e_nao_repete_o_motorista(self):
        criado = self.client.post(
            '/api/frota/motoristas/usuarios/',
            {'funcionarioId': self.adalto.pk, 'password': 'rota123'},
            format='json',
            **HEADERS,
        )
        self.assertEqual(criado.status_code, 201, criado.data)
        self.assertEqual(criado.data['username'], 'adalto.lima')
        self.assertNotIn('password', criado.data)
        usuario = UsuarioMotorista.objects.get(pk=criado.data['id'])
        self.assertTrue(check_password('rota123', usuario.password))

        lista = self.client.get('/api/frota/motoristas/usuarios/', **HEADERS)
        self.assertEqual(lista.data['count'], 1)
        self.assertEqual(lista.data['results'][0]['username'], 'adalto.lima')

        elegiveis = self.client.get('/api/frota/motoristas/elegiveis/', **HEADERS)
        self.assertEqual([item['nomeCompleto'] for item in elegiveis.data], ['JOÃO DA SILVA'])

        repetido = self.client.post(
            '/api/frota/motoristas/usuarios/',
            {'funcionarioId': self.adalto.pk, 'password': 'rota123'},
            format='json',
            **HEADERS,
        )
        self.assertEqual(repetido.status_code, 400)

    def test_recusa_quem_nao_e_motorista_ativo_da_filial(self):
        administrativo = FuncionarioQuadro.objects.get(nome='BRUNA DAIANE SILVEIRA')
        response = self.client.post(
            '/api/frota/motoristas/usuarios/',
            {'funcionarioId': administrativo.pk, 'password': 'rota123'},
            format='json',
            **HEADERS,
        )
        self.assertEqual(response.status_code, 400)

        outra_filial = FuncionarioQuadro.objects.get(nome='PEDRO DE RONDON')
        response = self.client.post(
            '/api/frota/motoristas/usuarios/',
            {'funcionarioId': outra_filial.pk, 'password': 'rota123'},
            format='json',
            **HEADERS,
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(UsuarioMotorista.objects.count(), 0)

    def test_username_evita_colisao_e_senha_pode_ser_redefinida(self):
        User.objects.create_user(username='joao.silva', password='x', name='Outro João', role_id='2')
        criado = self.client.post(
            '/api/frota/motoristas/usuarios/',
            {'funcionarioId': self.joao.pk, 'password': 'senha123'},
            format='json',
            **HEADERS,
        )
        self.assertEqual(criado.status_code, 201, criado.data)
        self.assertEqual(criado.data['username'], 'joao.silva2')

        nova = self.client.patch(
            f"/api/frota/motoristas/usuarios/{criado.data['id']}/senha/",
            {'password': 'outra123'},
            format='json',
            **HEADERS,
        )
        self.assertEqual(nova.status_code, 200, nova.data)
        usuario = UsuarioMotorista.objects.get(pk=criado.data['id'])
        self.assertTrue(check_password('outra123', usuario.password))

    def test_lista_filtra_por_status(self):
        UsuarioMotorista.objects.create(
            funcionario=self.adalto,
            username='adalto.lima',
            password='hash',
        )
        inativo = FuncionarioQuadro.objects.get(nome='CARLOS INATIVO')
        UsuarioMotorista.objects.create(
            funcionario=inativo,
            username='carlos.inativo',
            password='hash',
        )

        lista = self.client.get('/api/frota/motoristas/usuarios/', **HEADERS)
        self.assertEqual(lista.data['count'], 2)

        ativos = self.client.get('/api/frota/motoristas/usuarios/?status=ativo', **HEADERS)
        self.assertEqual(ativos.data['count'], 1)
        self.assertEqual(ativos.data['results'][0]['username'], 'adalto.lima')

        inativos = self.client.get('/api/frota/motoristas/usuarios/?status=inativo&search=carlos', **HEADERS)
        self.assertEqual(inativos.data['count'], 1)
        self.assertEqual(inativos.data['results'][0]['username'], 'carlos.inativo')

    def test_lista_nao_mostra_usuario_de_outra_filial(self):
        pedro = FuncionarioQuadro.objects.get(nome='PEDRO DE RONDON')
        UsuarioMotorista.objects.create(
            funcionario=pedro,
            username='pedro.rondon',
            password='hash',
        )
        lista = self.client.get('/api/frota/motoristas/usuarios/', **HEADERS)
        self.assertEqual(lista.data['count'], 0)

    def test_login_do_aplicativo_e_sessao(self):
        UsuarioMotorista.objects.create(
            funcionario=self.adalto,
            username='adalto.lima',
            password='',
        )
        from apps.frota.motoristas import aplicar_senha
        usuario = UsuarioMotorista.objects.get(username='adalto.lima')
        aplicar_senha(usuario, 'rota123')
        usuario.save(update_fields=['password'])

        anonimo = APIClient()
        errado = anonimo.post(
            '/api/frota/motoristas/login/',
            {'username': 'adalto.lima', 'password': 'errada'},
            format='json',
        )
        self.assertEqual(errado.status_code, 401)

        self.adalto.data_admissao = date(2019, 3, 12)
        self.adalto.save(update_fields=['data_admissao'])
        certo = anonimo.post(
            '/api/frota/motoristas/login/',
            {'username': 'Adalto.Lima', 'password': 'rota123'},
            format='json',
        )
        self.assertEqual(certo.status_code, 200, certo.data)
        self.assertEqual(certo.data['motorista']['nomeCompleto'], 'ADALTO GOMES DE LIMA')
        self.assertEqual(certo.data['motorista']['cargo'], 'MOTORISTA TRUCK')
        self.assertEqual(certo.data['motorista']['filial'], 'Ibiporã (Matriz)')
        self.assertEqual(certo.data['motorista']['dataAdmissao'], '2019-03-12')
        token = certo.data['token']

        eu = anonimo.get('/api/frota/motoristas/eu/', HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(eu.status_code, 200, eu.data)
        self.assertEqual(eu.data['username'], 'adalto.lima')
        self.assertEqual(eu.data['cpf'], '48101494987')
        self.assertEqual(eu.data['dataAdmissao'], '2019-03-12')

        perfil = anonimo.get('/api/auth/profile/', HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertIn(perfil.status_code, (401, 403))

        self.adalto.ativo = False
        self.adalto.save(update_fields=['ativo'])
        bloqueado = anonimo.post(
            '/api/frota/motoristas/login/',
            {'username': 'adalto.lima', 'password': 'rota123'},
            format='json',
        )
        self.assertEqual(bloqueado.status_code, 403)

    def test_excluir_acesso_so_com_funcao_e_mantem_o_colaborador_no_quadro(self):
        usuario = UsuarioMotorista.objects.create(
            funcionario=self.adalto,
            username='adalto.lima',
            password='hash',
        )
        operador = User.objects.create_user(
            username='frota.op',
            password='test123',
            name='Operador Frota',
            role_id='2',
            status='ativo',
            environments=['Frota'],
            filiais={'Frota': ['Ibiporã (Matriz)']},
        )
        cliente = APIClient()
        cliente.force_authenticate(operador)
        negado = cliente.delete(f'/api/frota/motoristas/usuarios/{usuario.pk}/', **HEADERS)
        self.assertEqual(negado.status_code, 403, negado.data)
        self.assertTrue(UsuarioMotorista.objects.filter(pk=usuario.pk).exists())

        operador.funcoes = {'Frota': ['excluir-usuarios-motorista']}
        operador.save(update_fields=['funcoes'])
        permitido = cliente.delete(f'/api/frota/motoristas/usuarios/{usuario.pk}/', **HEADERS)
        self.assertEqual(permitido.status_code, 204, getattr(permitido, 'data', None))
        self.assertFalse(UsuarioMotorista.objects.filter(pk=usuario.pk).exists())
        self.assertTrue(FuncionarioQuadro.objects.filter(pk=self.adalto.pk).exists())

        elegiveis = self.client.get('/api/frota/motoristas/elegiveis/', **HEADERS)
        self.assertIn('ADALTO GOMES DE LIMA', [item['nomeCompleto'] for item in elegiveis.data])

        outra_filial = FuncionarioQuadro.objects.get(nome='PEDRO DE RONDON')
        de_outra = UsuarioMotorista.objects.create(
            funcionario=outra_filial,
            username='pedro.rondon',
            password='hash',
        )
        fora = self.client.delete(f'/api/frota/motoristas/usuarios/{de_outra.pk}/', **HEADERS)
        self.assertEqual(fora.status_code, 404)
        self.assertTrue(UsuarioMotorista.objects.filter(pk=de_outra.pk).exists())
