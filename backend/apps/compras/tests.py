from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import auth_headers
from apps.compras.models import (
    UnidadeMedida,
    Setor,
    Colaborador,
    Fornecedor,
    ItemEstoque,
    EntradaEstoque,
    SaidaEstoque,
)

User = get_user_model()


class CadastrosSimplesCRUDTests(TestCase):
    """CRUD dos 4 cadastros simples (unidades, setores, colaboradores, fornecedores)
    seguem o mesmo endpoint padrão de ModelViewSet."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='compras_crud_tests', password='compras123', role_id='2',
            environments=['Compras'], filiais={},
        )

    def test_unidade_medida_crud(self):
        response = self.client.post(
            '/api/compras/unidades/', data={'nome': 'Galão'}, format='json',
            **auth_headers(self.user, 'Compras'),
        )
        self.assertEqual(response.status_code, 201, response.data)
        unidade_id = response.data['id']

        response = self.client.get('/api/compras/unidades/', **auth_headers(self.user, 'Compras'))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(any(u['nome'] == 'Galão' for u in response.data))

        response = self.client.patch(
            f'/api/compras/unidades/{unidade_id}/', data={'nome': 'Galão 20L'}, format='json',
            **auth_headers(self.user, 'Compras'),
        )
        self.assertEqual(response.status_code, 200, response.data)

        response = self.client.delete(f'/api/compras/unidades/{unidade_id}/', **auth_headers(self.user, 'Compras'))
        self.assertEqual(response.status_code, 204)
        self.assertFalse(UnidadeMedida.objects.filter(pk=unidade_id).exists())

    def test_setor_colaborador_fornecedor_crud(self):
        for resource, payload in [
            ('setores', {'nome': 'Manutenção'}),
            ('colaboradores', {'nome': 'João da Silva'}),
            ('fornecedores', {'nome': 'Distribuidora ABC'}),
        ]:
            response = self.client.post(
                f'/api/compras/{resource}/', data=payload, format='json',
                **auth_headers(self.user, 'Compras'),
            )
            self.assertEqual(response.status_code, 201, response.data)

            response = self.client.get(f'/api/compras/{resource}/', **auth_headers(self.user, 'Compras'))
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.data), 1)

    def test_nome_duplicado_retorna_erro_400(self):
        Setor.objects.create(nome='Almoxarifado')
        response = self.client.post(
            '/api/compras/setores/', data={'nome': 'Almoxarifado'}, format='json',
            **auth_headers(self.user, 'Compras'),
        )
        self.assertEqual(response.status_code, 400)

    def test_item_estoque_crud(self):
        response = self.client.post(
            '/api/compras/itens/',
            data={'nome': 'Papel A4', 'unidade': 'Resma', 'qtdAtual': 10, 'qtdMinima': 5},
            format='json',
            **auth_headers(self.user, 'Compras'),
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['qtdAtual'], 10)

        item_id = response.data['id']
        response = self.client.patch(
            f'/api/compras/itens/{item_id}/', data={'qtdMinima': 8}, format='json',
            **auth_headers(self.user, 'Compras'),
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['qtdMinima'], 8)

        response = self.client.delete(f'/api/compras/itens/{item_id}/', **auth_headers(self.user, 'Compras'))
        self.assertEqual(response.status_code, 204)


class RegistrarCompraTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='compras_entrada_tests', password='compras123', role_id='2',
            environments=['Compras'], filiais={},
        )
        self.fornecedor = Fornecedor.objects.create(nome='Distribuidora ABC')
        self.item = ItemEstoque.objects.create(nome='Papel A4', unidade='Resma', qtd_atual=5, qtd_minima=2)

    def test_registrar_compra_incrementa_saldo_e_cria_entrada(self):
        response = self.client.post(
            '/api/compras/entradas/registrar_compra/',
            data={
                'data': '2026-07-01',
                'fornecedorId': self.fornecedor.id,
                'linhas': [{'itemId': self.item.id, 'quantidade': 20, 'valorUnitario': '15.90'}],
            },
            format='json',
            **auth_headers(self.user, 'Compras'),
        )
        self.assertEqual(response.status_code, 201, response.data)

        self.item.refresh_from_db()
        self.assertEqual(self.item.qtd_atual, 25)
        self.assertEqual(EntradaEstoque.objects.count(), 1)
        entrada = EntradaEstoque.objects.first()
        self.assertEqual(entrada.item_nome, 'Papel A4')
        self.assertEqual(entrada.fornecedor_nome, 'Distribuidora ABC')

    def test_registrar_compra_sem_fornecedor_retorna_400(self):
        response = self.client.post(
            '/api/compras/entradas/registrar_compra/',
            data={'data': '2026-07-01', 'linhas': [{'itemId': self.item.id, 'quantidade': 1, 'valorUnitario': '1'}]},
            format='json',
            **auth_headers(self.user, 'Compras'),
        )
        self.assertEqual(response.status_code, 400)
        self.item.refresh_from_db()
        self.assertEqual(self.item.qtd_atual, 5)

    def test_registrar_compra_item_invalido_nao_cria_nada(self):
        response = self.client.post(
            '/api/compras/entradas/registrar_compra/',
            data={
                'data': '2026-07-01',
                'fornecedorId': self.fornecedor.id,
                'linhas': [{'itemId': 99999, 'quantidade': 1, 'valorUnitario': '1'}],
            },
            format='json',
            **auth_headers(self.user, 'Compras'),
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(EntradaEstoque.objects.count(), 0)


class RegistrarSaidaTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='compras_saida_tests', password='compras123', role_id='2',
            environments=['Compras'], filiais={},
        )
        self.setor = Setor.objects.create(nome='Administrativo')
        self.colaborador = Colaborador.objects.create(nome='Maria Souza')
        self.item = ItemEstoque.objects.create(nome='Caneta Azul', unidade='Un', qtd_atual=10, qtd_minima=3)

    def test_registrar_saida_decrementa_saldo_e_cria_registro(self):
        response = self.client.post(
            '/api/compras/saidas/registrar_saida/',
            data={
                'data': '2026-07-01',
                'setorId': self.setor.id,
                'colaboradorId': self.colaborador.id,
                'linhas': [{'itemId': self.item.id, 'quantidade': 4}],
            },
            format='json',
            **auth_headers(self.user, 'Compras'),
        )
        self.assertEqual(response.status_code, 201, response.data)

        self.item.refresh_from_db()
        self.assertEqual(self.item.qtd_atual, 6)
        self.assertEqual(SaidaEstoque.objects.count(), 1)
        saida = SaidaEstoque.objects.first()
        self.assertEqual(saida.setor_nome, 'Administrativo')
        self.assertEqual(saida.colaborador_nome, 'Maria Souza')

    def test_registrar_saida_com_saldo_insuficiente_retorna_400_e_nao_altera_estoque(self):
        response = self.client.post(
            '/api/compras/saidas/registrar_saida/',
            data={
                'data': '2026-07-01',
                'setorId': self.setor.id,
                'colaboradorId': self.colaborador.id,
                'linhas': [{'itemId': self.item.id, 'quantidade': 999}],
            },
            format='json',
            **auth_headers(self.user, 'Compras'),
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.data)

        self.item.refresh_from_db()
        self.assertEqual(self.item.qtd_atual, 10)
        self.assertEqual(SaidaEstoque.objects.count(), 0)

    def test_registrar_saida_sem_setor_ou_colaborador_retorna_400(self):
        response = self.client.post(
            '/api/compras/saidas/registrar_saida/',
            data={'data': '2026-07-01', 'linhas': [{'itemId': self.item.id, 'quantidade': 1}]},
            format='json',
            **auth_headers(self.user, 'Compras'),
        )
        self.assertEqual(response.status_code, 400)


class PermissaoModuloComprasTests(TestCase):
    """Usuário sem acesso ao ambiente Compras não pode listar nem alterar dados
    do módulo — mesma regra de `ModuleAccessPermission` usada nos demais apps."""

    def setUp(self):
        self.client = APIClient()
        self.user_sem_acesso = User.objects.create_user(
            username='sem_acesso_compras_tests', password='teste123', role_id='2',
            environments=['Financeiro'], filiais={},
        )

    def test_usuario_sem_ambiente_compras_recebe_403(self):
        response = self.client.get('/api/compras/itens/', **auth_headers(self.user_sem_acesso, 'Compras'))
        self.assertEqual(response.status_code, 403)

    def test_sem_header_de_ambiente_correto_recebe_403(self):
        response = self.client.get('/api/compras/itens/', **auth_headers(self.user_sem_acesso, 'Financeiro'))
        self.assertEqual(response.status_code, 403)
