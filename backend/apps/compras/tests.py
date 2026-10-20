from django.contrib.auth import get_user_model
from django.db.models import F
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
    Uniforme,
    DevolucaoUniforme,
    EntregaUniforme,
    EntregaUniformeItem,
    MovimentacaoUniforme,
    MOV_DEVOLUCAO,
    MOV_ENTRADA,
    MOV_ENTREGA,
    MOV_PERDA,
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
        setor_resp = self.client.post(
            '/api/compras/setores/', data={'nome': 'Manutenção'}, format='json',
            **auth_headers(self.user, 'Compras'),
        )
        self.assertEqual(setor_resp.status_code, 201, setor_resp.data)
        setor_id = setor_resp.data['id']

        response = self.client.post(
            '/api/compras/colaboradores/',
            data={'nome': 'João da Silva', 'setorId': setor_id},
            format='json',
            **auth_headers(self.user, 'Compras'),
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(str(response.data['setorId']), str(setor_id))

        response = self.client.post(
            '/api/compras/fornecedores/', data={'nome': 'Distribuidora ABC'}, format='json',
            **auth_headers(self.user, 'Compras'),
        )
        self.assertEqual(response.status_code, 201, response.data)

        response = self.client.get(f'/api/compras/colaboradores/?setorId={setor_id}', **auth_headers(self.user, 'Compras'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_colaborador_cargo_e_cpf_opcionais(self):
        setor = Setor.objects.create(nome='Logística')
        headers = auth_headers(self.user, 'Compras')

        response = self.client.post(
            '/api/compras/colaboradores/', data={'nome': 'Sem Dados', 'setorId': setor.pk}, format='json', **headers,
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['cargo'], '')
        self.assertEqual(response.data['cpf'], '')

        response = self.client.post(
            '/api/compras/colaboradores/',
            data={'nome': 'Com Dados', 'setorId': setor.pk, 'cargo': ' Motorista ', 'cpf': '123.456.789-01'},
            format='json',
            **headers,
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['cargo'], 'Motorista')
        self.assertEqual(response.data['cpf'], '12345678901')

        response = self.client.post(
            '/api/compras/colaboradores/',
            data={'nome': 'CPF Curto', 'setorId': setor.pk, 'cpf': '123'},
            format='json',
            **headers,
        )
        self.assertEqual(response.status_code, 400)

    def test_sugestoes_rh_lista_apenas_ativos_nao_cadastrados(self):
        from apps.rh.models import Colaborador as ColaboradorRH

        ColaboradorRH.objects.create(
            cpf='111.111.111-11', matricula='1', nome_completo='CARLOS ATIVO', cargo='MOTORISTA',
            filial='Ibiporã (Matriz)', situacao='SITUACAO NORMAL',
        )
        ColaboradorRH.objects.create(cpf='222.222.222-22', matricula='2', nome_completo='CARLA AFASTADA', situacao='AFASTADO TEMP.')
        ColaboradorRH.objects.create(
            cpf='333.333.333-33', matricula='3', nome_completo='CARMEM DEMITIDA', situacao='SITUACAO NORMAL',
            data_demissao='2026-01-10',
        )
        ColaboradorRH.objects.create(cpf='444.444.444-44', matricula='4', nome_completo='CARLOTA JA CADASTRADA')
        Colaborador.objects.create(nome='Carlota', setor=Setor.objects.create(nome='RH'), cpf='44444444444')

        headers = auth_headers(self.user, 'Compras')
        response = self.client.get('/api/compras/colaboradores/sugestoes-rh/?q=car', **headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [
            {'nome': 'CARLOS ATIVO', 'cpf': '11111111111', 'cargo': 'MOTORISTA', 'filial': 'Ibiporã (Matriz)'},
        ])

        response = self.client.get('/api/compras/colaboradores/sugestoes-rh/?q=c', **headers)
        self.assertEqual(response.data, [])

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
        self.colaborador = Colaborador.objects.create(nome='Maria Souza', setor=self.setor)
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

    def test_usuario_sem_ambiente_compras_nao_acessa_uniformes(self):
        response = self.client.get('/api/compras/uniformes/', **auth_headers(self.user_sem_acesso, 'Compras'))
        self.assertEqual(response.status_code, 403)


class ControleUniformesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='uniformes_tests', password='teste123', role_id='2',
            environments=['Compras'], filiais={}, name='Almoxarife Teste',
        )
        self.headers = auth_headers(self.user, 'Compras')
        setor = Setor.objects.create(nome='Operação')
        self.colaborador = Colaborador.objects.create(
            nome='Pedro Motorista', setor=setor, cargo='Motorista', cpf='12345678901',
        )
        response = self.client.post(
            '/api/compras/uniformes/',
            data={'nome': 'Camiseta', 'codigo': 'CAM-01', 'tamanho': 'm', 'estoqueMinimo': 3, 'estoqueInicial': 10},
            format='json', **self.headers,
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.uniforme_id = response.data['id']

    def _uniforme(self):
        return Uniforme.objects.get(pk=self.uniforme_id)

    def test_cadastro_em_lote_cria_tamanhos_com_estoque_novo_e_usado(self):
        response = self.client.post(
            '/api/compras/uniformes/lote/',
            data={'nome': 'Camiseta manga longa', 'tamanhos': [
                {'tamanho': 'p', 'qtdNova': 2, 'qtdUsada': 1, 'estoqueMinimo': 1},
                {'tamanho': '3G', 'qtdNova': 0, 'qtdUsada': 0},
            ]},
            format='json', **self.headers,
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual([u['tamanho'] for u in response.data], ['P', '3G'])
        p = Uniforme.objects.get(nome='Camiseta manga longa', tamanho='P')
        self.assertEqual((p.qtd_nova, p.qtd_usada, p.estoque_minimo), (2, 1, 1))
        self.assertEqual(p.movimentacoes.count(), 2)

    def test_cadastro_em_lote_com_tamanho_existente_nao_cria_nada(self):
        response = self.client.post(
            '/api/compras/uniformes/lote/',
            data={'nome': 'Camiseta', 'tamanhos': [{'tamanho': 'G', 'qtdNova': 3}, {'tamanho': 'M'}]},
            format='json', **self.headers,
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Uniforme.objects.filter(nome='Camiseta', tamanho='G').exists())

    def _entregar(self, quantidade=5, condicao='novo'):
        response = self.client.post(
            '/api/compras/uniformes-entregas/',
            data={
                'colaboradorId': self.colaborador.pk,
                'dataEntrega': '2026-10-20',
                'itens': [{'uniformeId': self.uniforme_id, 'condicao': condicao, 'quantidade': quantidade}],
            },
            format='json', **self.headers,
        )
        return response

    def _devolver(self, entrega, **qtds):
        item_id = entrega['itens'][0]['id']
        observacoes = qtds.pop('observacoes', '')
        return self.client.post(
            f"/api/compras/uniformes-entregas/{entrega['id']}/devolver/",
            data={'dataDevolucao': '2026-10-25', 'observacoes': observacoes, 'itens': [{'entregaItemId': item_id, **qtds}]},
            format='json', **self.headers,
        )

    def _devolucao_total(self, itens, observacoes=''):
        return self.client.post(
            '/api/compras/uniformes-entregas/devolucao-total/',
            data={'colaboradorId': self.colaborador.pk, 'dataDevolucao': '2026-10-25', 'observacoes': observacoes, 'itens': itens},
            format='json', **self.headers,
        )

    def test_devolucao_total_encerra_todos_os_termos(self):
        primeira = self._entregar(3).data
        segunda = self._entregar(2).data
        response = self._devolucao_total([
            {'entregaItemId': primeira['itens'][0]['id'], 'qtdBoa': 3},
            {'entregaItemId': segunda['itens'][0]['id'], 'qtdBoa': 1, 'qtdDanificada': 1},
        ])
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['totalPecas'], 5)
        self.assertEqual(sorted(response.data['termos']), sorted([primeira['numero'], segunda['numero']]))
        uniforme = self._uniforme()
        self.assertEqual((uniforme.qtd_nova, uniforme.qtd_usada), (5, 4))
        self.assertFalse(
            EntregaUniformeItem.objects.filter(entrega__colaborador=self.colaborador)
            .exclude(quantidade=F('qtd_devolvida') + F('qtd_descartada') + F('qtd_perdida'))
            .exists()
        )
        self.assertEqual(DevolucaoUniforme.objects.filter(observacoes='Devolução total').count(), 2)

    def test_devolucao_total_exige_destino_de_todas_as_pecas(self):
        primeira = self._entregar(3).data
        self._entregar(2)
        response = self._devolucao_total([{'entregaItemId': primeira['itens'][0]['id'], 'qtdBoa': 3}])
        self.assertEqual(response.status_code, 400)
        self.assertIn('nada pode ficar pendente', response.data['error'])
        self.assertFalse(DevolucaoUniforme.objects.exists())
        self.assertEqual(self._uniforme().qtd_usada, 0)

    def test_cadastro_com_estoque_inicial_gera_entrada(self):
        uniforme = self._uniforme()
        self.assertEqual((uniforme.tamanho, uniforme.qtd_nova, uniforme.qtd_usada), ('M', 10, 0))
        mov = MovimentacaoUniforme.objects.get(uniforme=uniforme)
        self.assertEqual((mov.tipo, mov.variacao_estoque, mov.saldo_novo), (MOV_ENTRADA, 10, 10))

    def test_entrega_diminui_estoque_novo_e_gera_termo(self):
        response = self._entregar(5)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['numero'], f"TRU-{int(response.data['id']):06d}")
        self.assertEqual(response.data['colaboradorCpf'], '12345678901')
        self.assertEqual(response.data['colaboradorSetor'], 'Operação')
        self.assertEqual(response.data['status'], 'em_posse')
        self.assertEqual(response.data['usuarioNome'], 'Almoxarife Teste')
        self.assertEqual(self._uniforme().qtd_nova, 5)

    def test_entrega_acima_do_saldo_nao_altera_nada(self):
        response = self._entregar(11)
        self.assertEqual(response.status_code, 400)
        self.assertIn('insuficiente', response.data['error'])
        self.assertEqual(self._uniforme().qtd_nova, 10)
        self.assertFalse(EntregaUniforme.objects.exists())

    def test_devolucao_com_divergencia_registra_perda_sem_voltar_ao_estoque(self):
        entrega = self._entregar(5).data

        sem_justificativa = self._devolver(entrega, qtdBoa=3, qtdPerdida=2)
        self.assertEqual(sem_justificativa.status_code, 400)

        response = self._devolver(entrega, qtdBoa=3, qtdPerdida=2, observacoes='Colaborador perdeu duas peças.')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'encerrada')
        self.assertEqual(response.data['itens'][0]['qtdPerdida'], 2)
        self.assertEqual(response.data['itens'][0]['quantidade'], 5)

        uniforme = self._uniforme()
        self.assertEqual((uniforme.qtd_nova, uniforme.qtd_usada), (5, 3))
        tipos = list(MovimentacaoUniforme.objects.filter(devolucao__isnull=False).values_list('tipo', 'quantidade', 'variacao_estoque'))
        self.assertCountEqual(tipos, [(MOV_DEVOLUCAO, 3, 3), (MOV_PERDA, 2, 0)])

        resumo = self.client.get('/api/compras/uniformes/resumo/', **self.headers).data
        self.assertEqual(
            {k: resumo[k] for k in ('estoqueNovo', 'estoqueUsado', 'destinados', 'perdidos')},
            {'estoqueNovo': 5, 'estoqueUsado': 3, 'destinados': 0, 'perdidos': 2},
        )

    def test_devolucao_parcial_e_pecas_danificadas_sao_descartadas(self):
        entrega = self._entregar(5).data
        response = self._devolver(entrega, qtdBoa=1, qtdDanificada=1, qtdSemCondicoes=1)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'parcial')
        self.assertEqual(response.data['totalPendente'], 2)
        self.assertEqual(self._uniforme().qtd_usada, 1)

        excesso = self._devolver(response.data, qtdBoa=3)
        self.assertEqual(excesso.status_code, 400)

        em_posse = self.client.get(
            f'/api/compras/uniformes-entregas/em-posse/?colaboradorId={self.colaborador.pk}', **self.headers,
        ).data
        self.assertEqual([(i['entregaNumero'], i['pendente']) for i in em_posse], [(entrega['numero'], 2)])

        lista = self.client.get('/api/compras/uniformes/', **self.headers).data
        self.assertEqual((lista[0]['destinados'], lista[0]['descartados']), (2, 2))

    def test_entrega_de_peca_usada_sai_do_saldo_usado(self):
        self.client.post(
            f'/api/compras/uniformes/{self.uniforme_id}/entrada/',
            data={'condicao': 'usado', 'quantidade': 2, 'data': '2026-10-20'}, format='json', **self.headers,
        )
        response = self._entregar(2, condicao='usado')
        self.assertEqual(response.status_code, 201, response.data)
        uniforme = self._uniforme()
        self.assertEqual((uniforme.qtd_nova, uniforme.qtd_usada), (10, 0))

    def test_ajuste_exige_justificativa_e_nao_deixa_saldo_negativo(self):
        url = f'/api/compras/uniformes/{self.uniforme_id}/ajuste/'
        self.assertEqual(self.client.post(url, data={'condicao': 'novo', 'quantidade': -2}, format='json', **self.headers).status_code, 400)
        self.assertEqual(
            self.client.post(url, data={'condicao': 'novo', 'quantidade': -20, 'observacao': 'Inventário'}, format='json', **self.headers).status_code,
            400,
        )
        response = self.client.post(url, data={'condicao': 'novo', 'quantidade': -2, 'observacao': 'Inventário'}, format='json', **self.headers)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['qtdNova'], 8)

    def test_uniforme_com_historico_nao_pode_ser_excluido(self):
        response = self.client.delete(f'/api/compras/uniformes/{self.uniforme_id}/', **self.headers)
        self.assertEqual(response.status_code, 400)
        self.assertTrue(Uniforme.objects.filter(pk=self.uniforme_id).exists())

    def test_historico_paginado_e_filtrado_por_colaborador(self):
        self._entregar(2)
        response = self.client.get(
            f'/api/compras/uniformes-movimentacoes/?colaboradorId={self.colaborador.pk}', **self.headers,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['tipo'], MOV_ENTREGA)

        entregas = self.client.get('/api/compras/uniformes-entregas/?status=abertas&q=pedro', **self.headers).data
        self.assertEqual(entregas['count'], 1)

    def test_por_colaborador_soma_pecas_em_posse(self):
        primeira = self._entregar(3).data
        self._entregar(2)
        self._devolver(primeira, qtdBoa=1)
        response = self.client.get('/api/compras/uniformes-entregas/por-colaborador/?somenteEmPosse=1', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        linha = response.data['results'][0]
        self.assertEqual((linha['nome'], linha['pecasEmPosse'], linha['totalEntregas']), ('Pedro Motorista', 4, 2))
