from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import PesquisaSatisfacao

User = get_user_model()

ENV_HEADER = {'HTTP_X_PROTHON_ENVIRONMENT': 'SGQ'}


def _payload(**overrides):
    data = {
        'motorista': 'João da Silva',
        'cte': '12345',
        'data': '2026-07-01',
        'notaFiscal': '98765',
        'cliente': 'CCAB',
        'prazoEntrega': 'otimo',
        'condicoesMercadoria': 'otimo',
        'condicoesVeiculo': 'bom',
        'apresentacaoMotorista': 'otimo',
        'atendimentoDispensado': 'bom',
    }
    data.update(overrides)
    return data


class PesquisaSatisfacaoTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='sgq.admin',
            password='x',
            name='Admin SGQ',
            role_id='1',
            status='ativo',
            environments=['SGQ'],
            filiais={},
        )
        self.client.force_authenticate(self.admin)

    def _create(self, **overrides):
        return self.client.post(
            '/api/sgq/pesquisas-satisfacao/', _payload(**overrides), format='json', **ENV_HEADER
        )

    def test_crud_pesquisa(self):
        response = self._create()
        self.assertEqual(response.status_code, 201)
        pesquisa_id = response.data['id']
        self.assertEqual(response.data['notaFiscal'], '98765')
        self.assertEqual(response.data['criadoPor'], 'Admin SGQ')

        response = self.client.patch(
            f'/api/sgq/pesquisas-satisfacao/{pesquisa_id}/',
            {'prazoEntrega': 'ruim', 'analise': 'Atraso na entrega.'},
            format='json',
            **ENV_HEADER,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['prazoEntrega'], 'ruim')

        response = self.client.delete(
            f'/api/sgq/pesquisas-satisfacao/{pesquisa_id}/', **ENV_HEADER
        )
        self.assertEqual(response.status_code, 204)
        self.assertEqual(PesquisaSatisfacao.objects.count(), 0)

    def test_lista_paginada_com_filtros(self):
        self._create(cte='111', cliente='CCAB', data='2026-07-01')
        self._create(cte='222', cliente='PRENTISS', data='2026-07-10', prazoEntrega='ruim')
        self._create(cte='333', cliente='CCAB', data='2026-06-15')

        response = self.client.get('/api/sgq/pesquisas-satisfacao/', **ENV_HEADER)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 3)

        response = self.client.get(
            '/api/sgq/pesquisas-satisfacao/', {'cliente': 'CCAB'}, **ENV_HEADER
        )
        self.assertEqual(response.data['count'], 2)

        response = self.client.get(
            '/api/sgq/pesquisas-satisfacao/', {'search': '222'}, **ENV_HEADER
        )
        self.assertEqual(response.data['count'], 1)

        response = self.client.get(
            '/api/sgq/pesquisas-satisfacao/', {'avaliacao': 'ruim'}, **ENV_HEADER
        )
        self.assertEqual(response.data['count'], 1)

        response = self.client.get(
            '/api/sgq/pesquisas-satisfacao/',
            {'dataInicio': '2026-07-01', 'dataFim': '2026-07-31'},
            **ENV_HEADER,
        )
        self.assertEqual(response.data['count'], 2)

    def test_stats(self):
        # 1ª pesquisa: 3 ótimo + 2 bom; 2ª: 5 ruim.
        self._create()
        self._create(
            cte='999',
            prazoEntrega='ruim',
            condicoesMercadoria='ruim',
            condicoesVeiculo='ruim',
            apresentacaoMotorista='ruim',
            atendimentoDispensado='ruim',
        )

        response = self.client.get('/api/sgq/pesquisas-satisfacao/stats/', **ENV_HEADER)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['totalPesquisas'], 2)
        self.assertEqual(response.data['totalAvaliacoes'], 10)
        self.assertEqual(response.data['contagem']['otimo'], 3)
        self.assertEqual(response.data['contagem']['ruim'], 5)
        self.assertEqual(response.data['percentual']['otimo'], 30.0)
        self.assertEqual(response.data['pontosAtencao'], 5)
        prazo = next(c for c in response.data['criterios'] if c['campo'] == 'prazo_entrega')
        self.assertEqual(prazo['otimo'], 1)
        self.assertEqual(prazo['ruim'], 1)
        self.assertEqual(prazo['score'], 2.5)

    def test_avaliacao_obrigatoria(self):
        response = self._create(prazoEntrega='')
        self.assertEqual(response.status_code, 400)

    def test_acesso_negado_sem_ambiente_sgq(self):
        operador = User.objects.create_user(
            username='sem.sgq',
            password='x',
            name='Sem SGQ',
            role_id='2',
            status='ativo',
            environments=['Financeiro'],
            filiais={},
        )
        self.client.force_authenticate(operador)
        response = self.client.get('/api/sgq/pesquisas-satisfacao/', **ENV_HEADER)
        self.assertEqual(response.status_code, 403)
