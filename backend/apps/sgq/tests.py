from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import PesquisaSatisfacao

User = get_user_model()

IBIPORA = 'Ibiporã (Matriz)'
RONDONOPOLIS = 'Rondonópolis'


def _headers(filial: str | None = IBIPORA) -> dict:
    headers = {'HTTP_X_PROTHON_ENVIRONMENT': 'SGQ'}
    if filial:
        headers['HTTP_X_PROTHON_FILIAL'] = filial
    return headers


ENV_HEADER = _headers()


def _payload(**overrides):
    data = {
        'motorista': 'João da Silva',
        'cte': '12345',
        'dataEntrega': '2026-07-01',
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

        # Operador com acesso ao SGQ nas duas filiais — usado para validar que o
        # escopo por filial (não o bypass de admin) restringe os dados corretamente.
        self.operador = User.objects.create_user(
            username='sgq.operador',
            password='x',
            name='Operador SGQ',
            role_id='2',
            status='ativo',
            environments=['SGQ'],
            filiais={'SGQ': [IBIPORA, RONDONOPOLIS]},
            funcoes={'SGQ': ['criar-pesquisas', 'editar-pesquisas', 'excluir-pesquisas']},
        )
        self.operador_consulta = User.objects.create_user(
            username='sgq.consulta',
            password='x',
            name='Operador Consulta SGQ',
            role_id='2',
            status='ativo',
            environments=['SGQ'],
            filiais={'SGQ': [IBIPORA, RONDONOPOLIS]},
            funcoes={},
        )

    def _create(self, filial=IBIPORA, **overrides):
        return self.client.post(
            '/api/sgq/pesquisas-satisfacao/', _payload(**overrides), format='json', **_headers(filial)
        )

    def test_crud_pesquisa(self):
        response = self._create()
        self.assertEqual(response.status_code, 201)
        pesquisa_id = response.data['id']
        self.assertEqual(response.data['notaFiscal'], '98765')
        self.assertEqual(response.data['criadoPor'], 'Admin SGQ')
        self.assertEqual(response.data['filial'], IBIPORA)
        self.assertEqual(response.data['dataInclusao'], timezone.localdate().isoformat())
        # Cliente não pode sobrescrever dataInclusao via payload.
        self.assertEqual(
            PesquisaSatisfacao.objects.get(pk=pesquisa_id).data_inclusao,
            timezone.localdate(),
        )

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
        self._create(cte='111', cliente='CCAB', dataEntrega='2026-07-01')
        self._create(cte='222', cliente='PRENTISS', dataEntrega='2026-07-10', prazoEntrega='ruim')
        self._create(cte='333', cliente='CCAB', dataEntrega='2026-06-15')

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

    def test_ordenacao_por_data_entrega(self):
        self._create(cte='OLD', dataEntrega='2026-06-01')
        self._create(cte='NEW', dataEntrega='2026-07-20')

        asc = self.client.get(
            '/api/sgq/pesquisas-satisfacao/',
            {'ordering': 'data_entrega_asc'},
            **ENV_HEADER,
        )
        self.assertEqual(asc.status_code, 200)
        self.assertEqual([r['cte'] for r in asc.data['results']], ['OLD', 'NEW'])

        desc = self.client.get(
            '/api/sgq/pesquisas-satisfacao/',
            {'ordering': 'data_entrega_desc'},
            **ENV_HEADER,
        )
        self.assertEqual([r['cte'] for r in desc.data['results']], ['NEW', 'OLD'])

    def test_filtro_por_motorista(self):
        self._create(cte='111', motorista='João da Silva')
        self._create(cte='222', motorista='Maria Souza')

        response = self.client.get(
            '/api/sgq/pesquisas-satisfacao/', {'motorista': 'joão da silva'}, **ENV_HEADER
        )
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['cte'], '111')

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

    def test_bulk_create_sucesso(self):
        response = self.client.post(
            '/api/sgq/pesquisas-satisfacao/bulk_create/',
            [_payload(cte='111'), _payload(cte='222', cliente='PRENTISS')],
            format='json',
            **ENV_HEADER,
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(PesquisaSatisfacao.objects.count(), 2)
        self.assertTrue(all(item['filial'] == IBIPORA for item in response.data))

    def test_bulk_create_tudo_ou_nada(self):
        # Segunda linha inválida (sem prazoEntrega) — nenhuma das duas deve ser salva.
        response = self.client.post(
            '/api/sgq/pesquisas-satisfacao/bulk_create/',
            [_payload(cte='111'), _payload(cte='222', prazoEntrega='')],
            format='json',
            **ENV_HEADER,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('1', {str(k) for k in response.data['errors'].keys()})
        self.assertEqual(PesquisaSatisfacao.objects.count(), 0)

    def test_bulk_create_lista_vazia(self):
        response = self.client.post(
            '/api/sgq/pesquisas-satisfacao/bulk_create/', [], format='json', **ENV_HEADER
        )
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

    def test_acesso_negado_sem_filial_na_sessao(self):
        """SGQ não é mais global — exige filial na sessão, como o Indicadores."""
        response = self.client.get('/api/sgq/pesquisas-satisfacao/', **_headers(filial=None))
        self.assertEqual(response.status_code, 403)

    def test_acesso_negado_filial_fora_do_sgq(self):
        """Paranaguá existe para outros módulos, mas não é uma filial válida do SGQ."""
        response = self.client.get('/api/sgq/pesquisas-satisfacao/', **_headers(filial='Paranaguá'))
        self.assertEqual(response.status_code, 403)

    def test_pesquisas_isoladas_por_filial(self):
        """Pesquisa lançada em uma filial não aparece para outra filial — visão de operador."""
        self.client.force_authenticate(self.operador)
        self._create(filial=IBIPORA, cte='IBI-1')
        self._create(filial=RONDONOPOLIS, cte='RDN-1')

        resp_ibipora = self.client.get('/api/sgq/pesquisas-satisfacao/', **_headers(IBIPORA))
        self.assertEqual(resp_ibipora.data['count'], 1)
        self.assertEqual(resp_ibipora.data['results'][0]['cte'], 'IBI-1')

        resp_rondonopolis = self.client.get('/api/sgq/pesquisas-satisfacao/', **_headers(RONDONOPOLIS))
        self.assertEqual(resp_rondonopolis.data['count'], 1)
        self.assertEqual(resp_rondonopolis.data['results'][0]['cte'], 'RDN-1')

    def test_pesquisas_isoladas_por_filial_mesmo_para_admin(self):
        """Diferente de Financeiro/Indicadores, o SGQ não tem visão consolidada:
        nem o admin vê o consolidado — cada filial fica sempre segregada."""
        self._create(filial=IBIPORA, cte='IBI-ADM')
        self._create(filial=RONDONOPOLIS, cte='RDN-ADM')

        resp_ibipora = self.client.get('/api/sgq/pesquisas-satisfacao/', **_headers(IBIPORA))
        self.assertEqual(resp_ibipora.data['count'], 1)
        self.assertEqual(resp_ibipora.data['results'][0]['cte'], 'IBI-ADM')

        resp_rondonopolis = self.client.get('/api/sgq/pesquisas-satisfacao/', **_headers(RONDONOPOLIS))
        self.assertEqual(resp_rondonopolis.data['count'], 1)
        self.assertEqual(resp_rondonopolis.data['results'][0]['cte'], 'RDN-ADM')

    def test_stats_respeita_filial_da_sessao(self):
        self.client.force_authenticate(self.operador)
        self._create(filial=IBIPORA, prazoEntrega='otimo')
        self._create(
            filial=RONDONOPOLIS,
            cte='999',
            prazoEntrega='ruim',
            condicoesMercadoria='ruim',
            condicoesVeiculo='ruim',
            apresentacaoMotorista='ruim',
            atendimentoDispensado='ruim',
        )

        response = self.client.get('/api/sgq/pesquisas-satisfacao/stats/', **_headers(IBIPORA))
        self.assertEqual(response.data['totalPesquisas'], 1)
        self.assertEqual(response.data['contagem']['ruim'], 0)

    def test_operador_sem_acesso_a_filial_nao_configurada(self):
        """Operador com SGQ liberado só em Ibiporã não pode consultar com sessão Rondonópolis."""
        operador_ibipora = User.objects.create_user(
            username='sgq.ibipora',
            password='x',
            name='Operador Ibiporã',
            role_id='2',
            status='ativo',
            environments=['SGQ'],
            filiais={'SGQ': [IBIPORA]},
        )
        self.client.force_authenticate(operador_ibipora)
        response = self.client.get('/api/sgq/pesquisas-satisfacao/', **_headers(RONDONOPOLIS))
        self.assertEqual(response.status_code, 403)

    def test_cliente_recusou_assinar_dispensa_avaliacoes(self):
        """Com a recusa marcada, os critérios de avaliação podem ficar vazios."""
        response = self._create(
            clienteRecusouAssinar=True,
            prazoEntrega='',
            condicoesMercadoria='',
            condicoesVeiculo='',
            apresentacaoMotorista='',
            atendimentoDispensado='',
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['clienteRecusouAssinar'])
        self.assertEqual(response.data['prazoEntrega'], '')

    def test_avaliacoes_obrigatorias_quando_nao_recusou(self):
        """Sem a recusa marcada, os critérios continuam obrigatórios."""
        response = self._create(clienteRecusouAssinar=False, prazoEntrega='')
        self.assertEqual(response.status_code, 400)
        self.assertIn('prazoEntrega', response.data)

    def test_sugestoes_motoristas_deduplica_variacoes_de_escrita(self):
        """Nomes digitados de formas diferentes (caixa/espaços) contam como o mesmo
        motorista — a sugestão retorna a grafia mais usada, sem duplicar."""
        self._create(motorista='João da Silva', cte='1')
        self._create(motorista='João da Silva', cte='2')
        self._create(motorista='João da Silva', cte='3')
        self._create(motorista='joão da silva ', cte='4')
        self._create(motorista='Maria Souza', cte='5')

        response = self.client.get('/api/sgq/pesquisas-satisfacao/motoristas/', **ENV_HEADER)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        self.assertIn('João da Silva', response.data)
        self.assertIn('Maria Souza', response.data)

    def test_sugestoes_motoristas_respeitam_filial_da_sessao(self):
        self.client.force_authenticate(self.operador)
        self._create(filial=IBIPORA, motorista='Motorista Ibiporã')
        self._create(filial=RONDONOPOLIS, motorista='Motorista Rondonópolis')

        response = self.client.get('/api/sgq/pesquisas-satisfacao/motoristas/', **_headers(IBIPORA))
        self.assertEqual(response.data, ['Motorista Ibiporã'])

    def test_filial_gravada_pela_sessao_e_nao_pelo_payload(self):
        """O cliente não pode escolher a filial via payload — só a sessão define."""
        response = self.client.post(
            '/api/sgq/pesquisas-satisfacao/',
            _payload(filial=RONDONOPOLIS),
            format='json',
            **_headers(IBIPORA),
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['filial'], IBIPORA)

    def test_operador_sem_funcao_pode_listar(self):
        self._create(cte='CONSULTA-1')
        self.client.force_authenticate(self.operador_consulta)
        response = self.client.get('/api/sgq/pesquisas-satisfacao/', **ENV_HEADER)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)

    def test_operador_sem_funcao_nao_pode_criar(self):
        self.client.force_authenticate(self.operador_consulta)
        response = self._create(cte='BLOQ-1')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(PesquisaSatisfacao.objects.count(), 0)

    def test_operador_sem_funcao_nao_pode_editar(self):
        created = self._create(cte='BLOQ-ED')
        pesquisa_id = created.data['id']
        self.client.force_authenticate(self.operador_consulta)
        response = self.client.patch(
            f'/api/sgq/pesquisas-satisfacao/{pesquisa_id}/',
            {'analise': 'Tentativa sem permissão'},
            format='json',
            **ENV_HEADER,
        )
        self.assertEqual(response.status_code, 403)

    def test_operador_sem_funcao_nao_pode_excluir(self):
        created = self._create(cte='BLOQ-EX')
        pesquisa_id = created.data['id']
        self.client.force_authenticate(self.operador_consulta)
        response = self.client.delete(
            f'/api/sgq/pesquisas-satisfacao/{pesquisa_id}/', **ENV_HEADER
        )
        self.assertEqual(response.status_code, 403)
        self.assertTrue(PesquisaSatisfacao.objects.filter(pk=pesquisa_id).exists())

    def test_operador_sem_funcao_nao_pode_bulk_create(self):
        self.client.force_authenticate(self.operador_consulta)
        response = self.client.post(
            '/api/sgq/pesquisas-satisfacao/bulk_create/',
            [_payload(cte='BLOQ-Lote')],
            format='json',
            **ENV_HEADER,
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(PesquisaSatisfacao.objects.count(), 0)

    def test_operador_com_funcao_criar_pode_criar(self):
        self.client.force_authenticate(self.operador)
        response = self._create(cte='OK-CRIAR')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['criadoPor'], 'Operador SGQ')


class PesquisaSatisfacaoLoteDraftTests(APITestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(
            username='sgq.draft.a',
            password='x',
            name='Operador A',
            role_id='2',
            status='ativo',
            environments=['SGQ'],
            filiais={'SGQ': [IBIPORA, RONDONOPOLIS]},
            funcoes={'SGQ': ['criar-pesquisas']},
        )
        self.user_b = User.objects.create_user(
            username='sgq.draft.b',
            password='x',
            name='Operador B',
            role_id='2',
            status='ativo',
            environments=['SGQ'],
            filiais={'SGQ': [IBIPORA, RONDONOPOLIS]},
            funcoes={'SGQ': ['criar-pesquisas']},
        )
        self.user_consulta = User.objects.create_user(
            username='sgq.draft.consulta',
            password='x',
            name='Operador Consulta Draft',
            role_id='2',
            status='ativo',
            environments=['SGQ'],
            filiais={'SGQ': [IBIPORA, RONDONOPOLIS]},
            funcoes={},
        )

    def test_put_get_isolado_por_usuario(self):
        self.client.force_authenticate(self.user_a)
        response = self.client.put(
            '/api/sgq/pesquisas-satisfacao/lote-draft/',
            {'rows': [{'motorista': 'Motorista A', 'cliente': 'CCAB', 'cte': '1', 'notaFiscal': '',
                       'dataEntrega': '', 'clienteRecusouAssinar': False, 'prazoEntrega': '',
                       'condicoesMercadoria': '', 'condicoesVeiculo': '', 'apresentacaoMotorista': '',
                       'atendimentoDispensado': '', 'analise': ''}]},
            format='json',
            **_headers(IBIPORA),
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['hasDraft'])
        self.assertEqual(response.data['rows'][0]['motorista'], 'Motorista A')

        self.client.force_authenticate(self.user_b)
        response_b = self.client.get('/api/sgq/pesquisas-satisfacao/lote-draft/', **_headers(IBIPORA))
        self.assertEqual(response_b.status_code, 200)
        self.assertFalse(response_b.data['hasDraft'])
        self.assertEqual(response_b.data['rows'], [])

    def test_draft_isolado_por_filial(self):
        self.client.force_authenticate(self.user_a)
        self.client.put(
            '/api/sgq/pesquisas-satisfacao/lote-draft/',
            {'rows': [{'motorista': 'Só Ibiporã', 'cliente': 'OUTROS', 'cte': '9', 'notaFiscal': '',
                       'dataEntrega': '', 'clienteRecusouAssinar': False, 'prazoEntrega': '',
                       'condicoesMercadoria': '', 'condicoesVeiculo': '', 'apresentacaoMotorista': '',
                       'atendimentoDispensado': '', 'analise': ''}]},
            format='json',
            **_headers(IBIPORA),
        )
        response = self.client.get('/api/sgq/pesquisas-satisfacao/lote-draft/', **_headers(RONDONOPOLIS))
        self.assertFalse(response.data['hasDraft'])

    def test_delete_descarta_rascunho(self):
        self.client.force_authenticate(self.user_a)
        self.client.put(
            '/api/sgq/pesquisas-satisfacao/lote-draft/',
            {'rows': [{'motorista': 'X', 'cliente': 'OUTROS', 'cte': '', 'notaFiscal': '',
                       'dataEntrega': '', 'clienteRecusouAssinar': False, 'prazoEntrega': '',
                       'condicoesMercadoria': '', 'condicoesVeiculo': '', 'apresentacaoMotorista': '',
                       'atendimentoDispensado': '', 'analise': ''}]},
            format='json',
            **_headers(IBIPORA),
        )
        deleted = self.client.delete('/api/sgq/pesquisas-satisfacao/lote-draft/', **_headers(IBIPORA))
        self.assertEqual(deleted.status_code, 204)
        response = self.client.get('/api/sgq/pesquisas-satisfacao/lote-draft/', **_headers(IBIPORA))
        self.assertFalse(response.data['hasDraft'])

    def test_operador_sem_funcao_criar_nao_pode_salvar_rascunho(self):
        self.client.force_authenticate(self.user_consulta)
        response = self.client.put(
            '/api/sgq/pesquisas-satisfacao/lote-draft/',
            {'rows': [{'motorista': 'Bloqueado', 'cliente': 'OUTROS', 'cte': '', 'notaFiscal': '',
                       'dataEntrega': '', 'clienteRecusouAssinar': False, 'prazoEntrega': '',
                       'condicoesMercadoria': '', 'condicoesVeiculo': '', 'apresentacaoMotorista': '',
                       'atendimentoDispensado': '', 'analise': ''}]},
            format='json',
            **_headers(IBIPORA),
        )
        self.assertEqual(response.status_code, 403)
