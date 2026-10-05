from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

User = get_user_model()


@override_settings(GEMINI_API_KEY='')
class CamiloAgenteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.comercial = User.objects.create_user(
            username='camilo.comercial',
            password='test123',
            name='Comercial',
            role_id='2',
            status='ativo',
            environments=['CamiloIA', 'Comercial'],
            abas={'Comercial': ['home', 'propostas-comerciais']},
        )
        self.outro = User.objects.create_user(
            username='camilo.outro',
            password='test123',
            name='Outro',
            role_id='2',
            status='ativo',
            environments=['CamiloIA', 'Frota'],
        )

    def test_partes_respeitam_o_acesso_da_pessoa(self):
        self.client.force_authenticate(user=self.comercial)
        response = self.client.get('/api/camilo/partes/')
        self.assertEqual(response.status_code, 200)
        partes = [
            item['parte']
            for grupo in response.json()['grupos']
            for item in grupo['partes']
        ]
        self.assertEqual(partes, ['propostas-comerciais'])

    def test_nao_libera_parte_de_outro_ambiente(self):
        self.client.force_authenticate(user=self.comercial)
        response = self.client.post('/api/camilo/agentes/', {
            'nome': 'Frota indevida',
            'instrucao': '',
            'escopos': [{'ambiente': 'Frota', 'parte': 'cadastro-veiculos'}],
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_consulta_so_a_parte_liberada(self):
        self.client.force_authenticate(user=self.comercial)
        criado = self.client.post('/api/camilo/agentes/', {
            'nome': 'Propostas',
            'instrucao': 'Apoiar o comercial',
            'escopos': [{'ambiente': 'Comercial', 'parte': 'propostas-comerciais'}],
        }, format='json')
        self.assertEqual(criado.status_code, 201)
        agente_id = criado.json()['id']

        consulta = self.client.post(
            f'/api/camilo/agentes/{agente_id}/consultar/',
            {'pergunta': 'Como está o financeiro?'},
            format='json',
        )
        self.assertEqual(consulta.status_code, 200)
        corpo = consulta.json()
        self.assertEqual(corpo['fontes'][0]['parte'], 'propostas-comerciais')
        self.assertIn('Financeiro', corpo['resposta'])
        self.assertNotIn('veículo', corpo['resposta'].lower())

    def test_edita_nome_e_recusa_parte_fora_do_acesso(self):
        self.client.force_authenticate(user=self.comercial)
        criado = self.client.post('/api/camilo/agentes/', {
            'nome': 'Propostas',
            'instrucao': 'Apoiar o comercial',
            'escopos': [{'ambiente': 'Comercial', 'parte': 'propostas-comerciais'}],
        }, format='json')
        agente_id = criado.json()['id']

        editado = self.client.patch(f'/api/camilo/agentes/{agente_id}/', {
            'nome': 'Analista Comercial',
            'instrucao': 'Responder só sobre propostas',
        }, format='json')
        self.assertEqual(editado.status_code, 200)
        self.assertEqual(editado.json()['nome'], 'Analista Comercial')
        self.assertEqual(editado.json()['escopos'][0]['parte'], 'propostas-comerciais')

        recusado = self.client.patch(f'/api/camilo/agentes/{agente_id}/', {
            'escopos': [{'ambiente': 'Frota', 'parte': 'cadastro-veiculos'}],
        }, format='json')
        self.assertEqual(recusado.status_code, 400)

    def test_outro_usuario_nao_consulta_o_agente(self):
        self.client.force_authenticate(user=self.comercial)
        criado = self.client.post('/api/camilo/agentes/', {
            'nome': 'Propostas',
            'escopos': [{'ambiente': 'Comercial', 'parte': 'propostas-comerciais'}],
        }, format='json')
        self.client.force_authenticate(user=self.outro)
        response = self.client.post(
            f"/api/camilo/agentes/{criado.json()['id']}/consultar/",
            {'pergunta': 'Quantas propostas?'},
            format='json',
        )
        self.assertEqual(response.status_code, 404)

    def test_movimentacao_separa_mes_e_alteracao_de_salario(self):
        from apps.camilo.consulta import resumo_movimentacoes
        from apps.rh.models import InconsistenciaColaborador, LoteMovimentacaoRH, MovimentacaoColaborador

        admin = User.objects.create_user(
            username='camilo.rh',
            password='test123',
            name='RH',
            role_id='1',
            status='ativo',
            environments=['CamiloIA', 'RH'],
        )
        junho = LoteMovimentacaoRH.objects.create(mes=6, ano=2026)
        MovimentacaoColaborador.objects.create(lote=junho, nome='Ana Lima', cpf='111', salario='1500.00')
        InconsistenciaColaborador.objects.create(
            lote=junho,
            cpf='111',
            nome='Ana Lima',
            tipo='salario',
            valor_anterior='1500.00',
            valor_atual='1800.00',
        )

        setembro = resumo_movimentacoes(admin, 'Tiveram alterações de salario em Setembro?')
        self.assertIn('Não há movimentação importada em 09/2026', setembro)
        self.assertIn('06/2026: 1 colaborador no mês, 1 alteração de salário', setembro)
        self.assertNotIn('Ana Lima', setembro)

        junho_texto = resumo_movimentacoes(admin, 'Quem teve alteração de salário em junho de 2026?')
        self.assertIn('Ana Lima', junho_texto)
        self.assertIn('1500.00', junho_texto)
        self.assertIn('1800.00', junho_texto)

        from apps.camilo.consulta import _trecho
        preambulo = 'SINDICATO DOS MOTORISTAS de Ibiporã, convenção coletiva. ' * 40
        pisos = 'pisos salariais: Motorista Carreteiro R$ 3.350,00 Motorista de Truck R$ 2.658,50'
        trecho = _trecho(
            preambulo + pisos,
            ['diária', 'motoristas', 'convenção', 'ibiporã', 'quanto'],
        )
        self.assertIn('3.350,00', trecho)
        self.assertLess(trecho.count('SINDICATO DOS MOTORISTAS'), 8)

        ficha = resumo_movimentacoes(admin, 'Com base nas movimentações do RH, quem é Ana Lima?')
        self.assertIn('Colaboradores encontrados pelo nome', ficha)
        self.assertIn('Ana Lima, em 06/2026', ficha)
        self.assertIn('salário 1500.00', ficha)
        self.assertNotIn('111', ficha)
