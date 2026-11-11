from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.frota.desempenho import garantir_padrao
from apps.frota.management.commands.sincronizar_quadro_desempenho import aplicar
from apps.frota.models import CriterioDesempenho, FaixaBonificacao, GrupoCriterioDesempenho, OcorrenciaDesempenho, UsuarioMotorista
from apps.frota.motoristas import aplicar_senha
from apps.rh.models import FuncionarioQuadro

User = get_user_model()
HEADERS = {
    'HTTP_X_PROTHON_ENVIRONMENT': 'Frota',
    'HTTP_X_PROTHON_FILIAL': 'Ibiporã (Matriz)',
}


class DesempenhoMotoristasTests(TestCase):
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
        garantir_padrao()
        self.adalto = FuncionarioQuadro.objects.create(
            nome='ADALTO GOMES DE LIMA',
            cpf='48101494987',
            filial='Ibiporã (Matriz)',
            cargo='MOTORISTA TRUCK',
            departamento='Motoristas',
            ativo=True,
        )
        self.checklist = CriterioDesempenho.objects.get(nome='Checklist diário realizado')
        self.alcool = CriterioDesempenho.objects.get(nome='Álcool ou substâncias')

    def test_nota_cheio_e_desconto_de_checklist(self):
        vazio = self.client.get('/api/frota/desempenho/apuracao/?ano=2026&mes=6', **HEADERS)
        self.assertEqual(vazio.status_code, 200, vazio.data)
        linha = vazio.data['motoristas'][0]
        self.assertEqual(linha['nota'], '100.00')
        self.assertEqual(linha['percentual'], '100.00')
        self.assertEqual(linha['valor'], '500.00')

        criado = self.client.post(
            '/api/frota/desempenho/ocorrencias/',
            {
                'funcionarioId': self.adalto.pk,
                'criterioId': self.checklist.pk,
                'data': '2026-06-12',
                'quantidade': 1,
            },
            format='json',
            **HEADERS,
        )
        self.assertEqual(criado.status_code, 201, criado.data)
        apurado = self.client.get('/api/frota/desempenho/apuracao/?ano=2026&mes=6', **HEADERS)
        linha = apurado.data['motoristas'][0]
        self.assertEqual(linha['nota'], '94.00')
        self.assertEqual(linha['percentual'], '94.00')
        self.assertEqual(linha['valor'], '470.00')

    def test_desconto_acumula_e_gatilho_que_zera(self):
        OcorrenciaDesempenho.objects.create(
            funcionario=self.adalto,
            criterio=self.checklist,
            filial=self.adalto.filial,
            data=date(2026, 6, 2),
            quantidade=10,
        )
        acumulado = self.client.get('/api/frota/desempenho/apuracao/?ano=2026&mes=6', **HEADERS)
        linha = acumulado.data['motoristas'][0]
        self.assertEqual(linha['nota'], '40.00')
        self.assertFalse(linha['zerado'])
        self.assertEqual(linha['valor'], '0.00')

        OcorrenciaDesempenho.objects.create(
            funcionario=self.adalto,
            criterio=self.alcool,
            filial=self.adalto.filial,
            data=date(2026, 7, 3),
            quantidade=1,
        )
        zerado = self.client.get('/api/frota/desempenho/apuracao/?ano=2026&mes=7', **HEADERS)
        linha = zerado.data['motoristas'][0]
        self.assertEqual(linha['nota'], '100.00')
        self.assertTrue(linha['zerado'])
        self.assertEqual(linha['valor'], '0.00')

    def test_criterio_com_ocorrencia_nao_e_excluido_e_o_app_ve_a_propria_nota(self):
        OcorrenciaDesempenho.objects.create(
            funcionario=self.adalto,
            criterio=self.checklist,
            filial=self.adalto.filial,
            data=date(2026, 6, 2),
            quantidade=1,
        )
        negado = self.client.delete(f'/api/frota/desempenho/criterios/itens/{self.checklist.pk}/', **HEADERS)
        self.assertEqual(negado.status_code, 400)

        usuario = UsuarioMotorista.objects.create(funcionario=self.adalto, username='adalto.lima', password='')
        aplicar_senha(usuario, 'rota123')
        usuario.save(update_fields=['password'])
        anonimo = APIClient()
        login = anonimo.post(
            '/api/frota/motoristas/login/',
            {'username': 'adalto.lima', 'password': 'rota123'},
            format='json',
        )
        token = login.data['token']
        eu = anonimo.get(
            '/api/frota/motoristas/desempenho/?ano=2026&mes=6',
            HTTP_AUTHORIZATION=f'Bearer {token}',
        )
        self.assertEqual(eu.status_code, 200, eu.data)
        self.assertEqual(eu.data['nota'], '94.00')
        self.assertEqual(len(eu.data['ocorrencias']), 1)
        self.assertEqual(anonimo.get('/api/frota/motoristas/desempenho/').status_code, 401)

    def test_experiencia_segura_a_bonificacao_por_tres_meses(self):
        self.adalto.data_admissao = date(2026, 5, 1)
        self.adalto.save(update_fields=['data_admissao'])
        junho = self.client.get('/api/frota/desempenho/apuracao/?ano=2026&mes=6', **HEADERS)
        linha = junho.data['motoristas'][0]
        self.assertEqual(linha['nota'], '100.00')
        self.assertTrue(linha['emExperiencia'])
        self.assertEqual(linha['inicioBonificacao'], '2026-08-01')
        self.assertEqual(linha['valor'], '0.00')
        self.assertEqual(junho.data['resumo']['comBonificacao'], 0)

        self.adalto.data_admissao = date(2026, 3, 1)
        self.adalto.save(update_fields=['data_admissao'])
        agosto = self.client.get('/api/frota/desempenho/apuracao/?ano=2026&mes=6', **HEADERS)
        liberado = agosto.data['motoristas'][0]
        self.assertFalse(liberado['emExperiencia'])
        self.assertEqual(liberado['valor'], '500.00')

    def test_apuracao_pagina_e_o_extrato_sai_em_pdf(self):
        FuncionarioQuadro.objects.create(
            nome='BRUNO DA SILVA',
            cpf='39053344705',
            filial='Ibiporã (Matriz)',
            cargo='MOTORISTA',
            departamento='Motoristas',
            ativo=True,
        )
        pagina = self.client.get('/api/frota/desempenho/apuracao/?ano=2026&mes=8&page=1&page_size=1', **HEADERS)
        self.assertEqual(pagina.status_code, 200, pagina.data)
        self.assertEqual(pagina.data['count'], 2)
        self.assertEqual(len(pagina.data['motoristas']), 1)
        self.assertEqual(pagina.data['resumo']['motoristas'], 2)
        self.assertEqual(pagina.data['resumo']['totalPagar'], '1000.00')
        self.assertEqual(len(pagina.data['opcoes']), 2)
        segunda = self.client.get('/api/frota/desempenho/apuracao/?ano=2026&mes=8&page=2&page_size=1', **HEADERS)
        self.assertEqual(segunda.data['motoristas'][0]['nomeCompleto'], 'BRUNO DA SILVA')

        extrato = self.client.get('/api/frota/desempenho/extrato/?ano=2026&mes=8', **HEADERS)
        self.assertEqual(extrato.status_code, 200)
        self.assertEqual(extrato['Content-Type'], 'application/pdf')
        self.assertTrue(extrato.content.startswith(b'%PDF'))
        self.assertIn('Extrato_bonificacao_08_2026.pdf', extrato['Content-Disposition'])

    def test_operador_sem_funcao_nao_registra_ocorrencia(self):
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
        payload = {
            'funcionarioId': self.adalto.pk,
            'criterioId': self.checklist.pk,
            'data': '2026-06-02',
            'quantidade': 1,
        }
        negado = cliente.post('/api/frota/desempenho/ocorrencias/', payload, format='json', **HEADERS)
        self.assertEqual(negado.status_code, 403, negado.data)
        operador.funcoes = {'Frota': ['registrar-ocorrencias-desempenho']}
        operador.save(update_fields=['funcoes'])
        permitido = cliente.post('/api/frota/desempenho/ocorrencias/', payload, format='json', **HEADERS)
        self.assertEqual(permitido.status_code, 201, permitido.data)

    def test_sincronizacao_atualiza_so_quadro_e_catalogo(self):
        fora = FuncionarioQuadro.objects.create(
            nome='FORA DO ARQUIVO',
            cpf='11122233344',
            filial='Ibiporã (Matriz)',
            cargo='ANALISTA',
            ativo=True,
        )
        checklist = CriterioDesempenho.objects.get(nome='Checklist diário realizado')
        payload = {
            'quadro': [{
                'nome': 'ADALTO GOMES DE LIMA',
                'cpf': '481.014.949-87',
                'filial': 'Ibiporã (Matriz)',
                'cargo': 'MOTORISTA TRUCK',
                'departamento': 'Motoristas',
                'dataAdmissao': '2015-03-10',
                'dataDemissao': None,
                'ativo': True,
            }],
            'parametro': {'notaInicial': '100', 'valorBonus': '500', 'limitarPorGrupo': False},
            'faixas': [{'notaMin': '95', 'notaMax': '100', 'modo': 'integral', 'percentual': '100', 'ordem': 1}],
            'grupos': [{
                'nome': 'Documentação',
                'pontosMaximos': '0',
                'ordem': 2,
                'ativo': True,
                'criterios': [{
                    'nome': 'CT-e',
                    'descricao': 'Conhecimento eletrônico',
                    'pontos': '2',
                    'zeraBonus': False,
                    'ativo': True,
                    'ordem': 1,
                }],
            }],
        }
        aplicar(payload)
        aplicar(payload)
        self.adalto.refresh_from_db()
        self.assertEqual(self.adalto.departamento, 'Motoristas')
        self.assertEqual(self.adalto.cpf, '48101494987')
        self.assertTrue(FuncionarioQuadro.objects.filter(pk=fora.pk, nome='FORA DO ARQUIVO').exists())
        self.assertEqual(FuncionarioQuadro.objects.filter(nome='ADALTO GOMES DE LIMA').count(), 1)
        self.assertEqual(GrupoCriterioDesempenho.objects.filter(nome='Documentação').count(), 1)
        self.assertTrue(CriterioDesempenho.objects.filter(pk=checklist.pk).exists())
        self.assertEqual(FaixaBonificacao.objects.count(), 1)
