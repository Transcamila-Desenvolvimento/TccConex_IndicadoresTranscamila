import tempfile
from datetime import timedelta
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.faturamento.models import ClienteProtocolo

from .models import (
    AuditoriaSGQ,
    CategoriaAuditoriaSGQ,
    ItemNormaSGQ,
    NormaSGQ,
    PesquisaSatisfacao,
    RespostaAuditoriaSGQ,
    TipoRespostaSGQ,
)

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
        for nome in ('CCAB', 'PRENTISS', 'ALBAUGH', 'Braskem'):
            ClienteProtocolo.objects.create(
                nome=nome,
                razao_social=nome,
                nome_interno=nome,
                considerar_pesquisa_satisfacao=True,
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
            {'prazoEntrega': 'ruim', 'analise': 'Atraso na entrega.', 'escopoAnalise': {
                'prazo_entrega': ['entregas_fora_prazo_contratual'],
            }},
            format='json',
            **ENV_HEADER,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['prazoEntrega'], 'ruim')
        self.assertEqual(response.data['escopoAnalise'], {
            'prazo_entrega': ['entregas_fora_prazo_contratual'],
        })

        response = self.client.delete(
            f'/api/sgq/pesquisas-satisfacao/{pesquisa_id}/', **ENV_HEADER
        )
        self.assertEqual(response.status_code, 204)
        self.assertEqual(PesquisaSatisfacao.objects.count(), 0)

    def test_analise_exige_escopo(self):
        response = self._create(analise='Atraso na descarga.', cte='ESCOPO-1')
        self.assertEqual(response.status_code, 400)
        self.assertIn('escopoAnalise', response.data)

        response = self._create(
            analise='Atraso na descarga.',
            escopoAnalise={'prazo_entrega': ['entregas_fora_prazo_contratual', 'motorista_recusou_ajudar_descarga']},
            cte='ESCOPO-2',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.data['escopoAnalise'],
            {'prazo_entrega': ['entregas_fora_prazo_contratual', 'motorista_recusou_ajudar_descarga']},
        )

        response = self._create(
            analise='',
            escopoAnalise={'prazo_entrega': ['entregas_fora_prazo_contratual']},
            cte='ESCOPO-3',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['analise'], '')
        self.assertEqual(response.data['escopoAnalise'], {})

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

    def test_filial_percent_encoded_no_header_e_aceita(self):
        """Azure/proxies podem exigir ASCII no header — frontend envia encodeURIComponent."""
        from urllib.parse import quote

        encoded = quote(IBIPORA, safe='')
        response = self.client.get(
            '/api/sgq/pesquisas-satisfacao/',
            HTTP_X_PROTHON_ENVIRONMENT='SGQ',
            HTTP_X_PROTHON_FILIAL=encoded,
        )
        self.assertEqual(response.status_code, 200)

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

    def test_sugestoes_motoristas_compartilhadas_entre_filiais(self):
        self.client.force_authenticate(self.operador)
        self._create(filial=IBIPORA, motorista='Motorista Ibiporã')
        self._create(filial=RONDONOPOLIS, motorista='Motorista Rondonópolis')

        response = self.client.get('/api/sgq/pesquisas-satisfacao/motoristas/', **_headers(IBIPORA))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, ['Motorista Ibiporã', 'Motorista Rondonópolis'])

        response_rondonopolis = self.client.get(
            '/api/sgq/pesquisas-satisfacao/motoristas/', **_headers(RONDONOPOLIS)
        )
        self.assertEqual(response_rondonopolis.data, ['Motorista Ibiporã', 'Motorista Rondonópolis'])

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

    def test_enviar_resumo_consolida_filiais_sgq(self):
        from datetime import date

        from django.core import mail

        self._create(filial=IBIPORA, cte='111')
        self._create(
            filial=IBIPORA,
            cte='BLANK',
            clienteRecusouAssinar=True,
            prazoEntrega='',
            condicoesMercadoria='',
            condicoesVeiculo='',
            apresentacaoMotorista='',
            atendimentoDispensado='',
        )
        self._create(filial=RONDONOPOLIS, cte='222')
        PesquisaSatisfacao.objects.filter(filial=IBIPORA).update(data_inclusao=date(2026, 7, 10))
        PesquisaSatisfacao.objects.filter(filial=RONDONOPOLIS).update(data_inclusao=date(2026, 8, 5))

        response = self.client.post(
            '/api/sgq/pesquisas-satisfacao/enviar-resumo/',
            {'to': ['destino@example.com']},
            format='json',
            **_headers(IBIPORA),
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['success'])
        self.assertEqual(len(mail.outbox), 1)

        message = mail.outbox[0]
        self.assertIn('Pesquisa de Satisfação — Ibiporã e Rondonópolis', message.subject)
        self.assertIn('Admin SGQ', message.body)
        self.assertIn('indicadores/gestao-qualidade/satisfacao-clientes', message.body)
        self.assertIn('Por Filial', message.body)
        self.assertIn('Última inclusão', message.body)
        self.assertIn('10/07/2026', message.body)
        self.assertIn('05/08/2026', message.body)
        self.assertIn('Em branco', message.body)
        self.assertIn('>3<', message.body)
        self.assertIn('>1<', message.body)
        self.assertEqual(message.to, ['destino@example.com'])
        self.assertEqual(len(message.attachments), 0)

    def test_enviar_resumo_consolida_mesmo_sem_acesso_as_duas_filiais(self):
        """Operador só com Ibiporã no SGQ ainda envia o consolidado das duas unidades."""
        from django.core import mail

        self._create(filial=IBIPORA, cte='111')
        self._create(filial=RONDONOPOLIS, cte='222')

        so_ibipora = User.objects.create_user(
            username='sgq.resumo.ibipora',
            password='x',
            name='Operador Só Ibiporã',
            role_id='2',
            status='ativo',
            environments=['SGQ'],
            filiais={'SGQ': [IBIPORA]},
        )
        self.client.force_authenticate(so_ibipora)
        response = self.client.post(
            '/api/sgq/pesquisas-satisfacao/enviar-resumo/',
            {'to': ['destino@example.com']},
            format='json',
            **_headers(IBIPORA),
        )
        self.assertEqual(response.status_code, 200, response.data)
        message = mail.outbox[0]
        self.assertIn('Pesquisa de Satisfação — Ibiporã e Rondonópolis', message.subject)
        self.assertIn('>2<', message.body)

    def test_enviar_resumo_ignora_filtros_da_tabela(self):
        from django.core import mail

        self._create(filial=IBIPORA, cte='111', cliente='CCAB')
        self._create(filial=IBIPORA, cte='222', cliente='Braskem')

        response = self.client.post(
            '/api/sgq/pesquisas-satisfacao/enviar-resumo/',
            {'to': ['destino@example.com'], 'cliente': 'CCAB'},
            format='json',
            **_headers(IBIPORA),
        )
        self.assertEqual(response.status_code, 200, response.data)

        message = mail.outbox[0]
        self.assertIn('>2<', message.body)

    def test_enviar_resumo_agrupa_cliente_pelo_cadastro(self):
        from datetime import date

        from django.core import mail

        ClienteProtocolo.objects.filter(nome='PRENTISS').update(
            codigo='002431',
            loja='01',
            nome_interno='Prentiss Química Ltda.',
        )
        for cte, cliente in (
            ('A', '002431|01'),
            ('B', 'PRENTISS QUIMICA LTDA'),
            ('C', 'Prentiss Química Ltda.'),
        ):
            PesquisaSatisfacao.objects.create(
                filial=IBIPORA,
                data_inclusao=date(2026, 7, 10),
                motorista='João da Silva',
                cte=cte,
                data_entrega=date(2026, 7, 1),
                nota_fiscal=cte,
                cliente=cliente,
                prazo_entrega='otimo',
                condicoes_mercadoria='otimo',
                condicoes_veiculo='bom',
                apresentacao_motorista='otimo',
                atendimento_dispensado='bom',
                criado_por='Admin SGQ',
            )

        response = self.client.post(
            '/api/sgq/pesquisas-satisfacao/enviar-resumo/',
            {'to': ['destino@example.com'], 'ano': 2026},
            format='json',
            **_headers(IBIPORA),
        )
        self.assertEqual(response.status_code, 200, response.data)
        body = mail.outbox[0].body
        self.assertIn('Prentiss Química Ltda.', body)
        self.assertNotIn('002431|01', body)
        self.assertNotIn('PRENTISS QUIMICA LTDA', body)

    def test_enviar_resumo_filtra_por_ano(self):
        from datetime import date

        from django.core import mail

        self._create(cte='2025', cliente='CCAB')
        self._create(cte='2026', cliente='Braskem')
        PesquisaSatisfacao.objects.filter(cte='2025').update(data_inclusao=date(2025, 3, 1))
        PesquisaSatisfacao.objects.filter(cte='2026').update(data_inclusao=date(2026, 8, 1))

        response = self.client.post(
            '/api/sgq/pesquisas-satisfacao/enviar-resumo/',
            {'to': ['destino@example.com'], 'ano': 2026},
            format='json',
            **_headers(IBIPORA),
        )
        self.assertEqual(response.status_code, 200, response.data)
        body = mail.outbox[0].body
        self.assertIn('Ano 2026', body)
        self.assertIn('>1<', body)
        self.assertIn('BRASKEM', body)
        self.assertNotIn('CCAB', body)

    def test_anos_resumo_lista_lancamentos_e_ano_atual(self):
        from datetime import date

        self._create(cte='2025')
        PesquisaSatisfacao.objects.update(data_inclusao=date(2025, 1, 10))
        response = self.client.get('/api/sgq/pesquisas-satisfacao/anos-resumo/', **ENV_HEADER)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn(2025, response.data['anos'])
        self.assertEqual(response.data['anoPadrao'], timezone.localdate().year)
        self.assertIn(timezone.localdate().year, response.data['anos'])

    def test_enviar_resumo_exige_destinatario(self):
        response = self.client.post(
            '/api/sgq/pesquisas-satisfacao/enviar-resumo/',
            {'to': []},
            format='json',
            **_headers(IBIPORA),
        )
        self.assertEqual(response.status_code, 400)

    def test_clientes_endpoint_lista_apenas_habilitados(self):
        ClienteProtocolo.objects.filter(nome__iexact='CCAB').update(considerar_pesquisa_satisfacao=False)
        response = self.client.get('/api/sgq/pesquisas-satisfacao/clientes/', **ENV_HEADER)
        self.assertEqual(response.status_code, 200)
        valores = {item['value'] for item in response.data}
        rotulos = {item['label'] for item in response.data}
        self.assertNotIn('OUTROS', valores)
        self.assertTrue(any('prentiss' in texto.casefold() for texto in valores | rotulos))
        self.assertFalse(any('ccab' in texto.casefold() for texto in valores | rotulos))

    def test_nao_cria_pesquisa_manual_com_outros(self):
        response = self._create(cliente='OUTROS')
        self.assertEqual(response.status_code, 400)

    def test_nao_cria_pesquisa_para_cliente_desabilitado(self):
        ClienteProtocolo.objects.filter(nome__iexact='CCAB').update(considerar_pesquisa_satisfacao=False)
        response = self._create(cliente='CCAB')
        self.assertEqual(response.status_code, 400)

    def test_edicao_mantem_cliente_legado_desabilitado(self):
        created = self._create(cte='legado-1', cliente='CCAB')
        self.assertEqual(created.status_code, 201, created.data)
        ClienteProtocolo.objects.filter(nome__iexact='CCAB').update(considerar_pesquisa_satisfacao=False)
        pesquisa_id = created.data['id']
        response = self.client.patch(
            f'/api/sgq/pesquisas-satisfacao/{pesquisa_id}/',
            {'motorista': 'João Atualizado'},
            format='json',
            **ENV_HEADER,
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['cliente'], 'CCAB')
        self.assertEqual(response.data['motorista'], 'João Atualizado')

    def test_filtro_com_historico_inclui_cadastro_mesmo_desligado(self):
        ClienteProtocolo.objects.filter(nome__iexact='CCAB').update(
            codigo='002431',
            loja='01',
            nome_interno='CCAB AGRO S.A.',
            razao_social='CCAB AGRO S.A.',
            nome='CCAB AGRO S.A.',
            considerar_pesquisa_satisfacao=False,
        )
        PesquisaSatisfacao.objects.create(
            filial=IBIPORA,
            motorista='João da Silva',
            cte='hist-ccab',
            data_inclusao=timezone.localdate(),
            data_entrega='2026-07-01',
            nota_fiscal='1',
            cliente='Ccab Agro S.a.',
            prazo_entrega='otimo',
            condicoes_mercadoria='otimo',
            condicoes_veiculo='bom',
            apresentacao_motorista='otimo',
            atendimento_dispensado='bom',
            criado_por='Admin SGQ',
        )

        lancamento = self.client.get('/api/sgq/pesquisas-satisfacao/clientes/', **ENV_HEADER)
        self.assertEqual(lancamento.status_code, 200)
        self.assertFalse(any('ccab' in item['label'].casefold() for item in lancamento.data))

        filtro = self.client.get(
            '/api/sgq/pesquisas-satisfacao/clientes/?incluirHistorico=true',
            **ENV_HEADER,
        )
        self.assertEqual(filtro.status_code, 200)
        rotulos = [item['label'] for item in filtro.data]
        self.assertIn('CCAB AGRO S.A.', rotulos)
        self.assertNotIn('Ccab Agro S.a.', rotulos)

    def test_lista_e_filtro_usam_nome_atual_do_cadastro(self):
        ClienteProtocolo.objects.filter(nome__iexact='PRENTISS').update(
            codigo='002450',
            loja='01',
            nome_interno='PRENTISS QUIMICA LTDA',
            razao_social='PRENTISS QUIMICA LTDA',
            nome='PRENTISS QUIMICA LTDA',
        )
        created = self._create(cte='nf-legado', cliente='Prentiss Química Ltda.')
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data['clienteLabel'], 'PRENTISS QUIMICA LTDA')

        listagem = self.client.get(
            '/api/sgq/pesquisas-satisfacao/?search=nf-legado',
            **ENV_HEADER,
        )
        self.assertEqual(listagem.status_code, 200)
        item = next(row for row in listagem.data['results'] if row['cte'] == 'nf-legado')
        self.assertEqual(item['clienteLabel'], 'PRENTISS QUIMICA LTDA')

        filtro = self.client.get(
            '/api/sgq/pesquisas-satisfacao/clientes/?incluirHistorico=true',
            **ENV_HEADER,
        )
        self.assertEqual(filtro.status_code, 200)
        rotulos = [item['label'] for item in filtro.data]
        self.assertEqual(sum(1 for rotulo in rotulos if 'prentiss' in rotulo.casefold()), 1)
        self.assertIn('PRENTISS QUIMICA LTDA', rotulos)
        self.assertNotIn('Prentiss Química Ltda.', rotulos)


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


class PesquisaSatisfacaoFormDraftTests(APITestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(
            username='sgq.form.draft.a',
            password='x',
            name='Operador Form A',
            role_id='2',
            status='ativo',
            environments=['SGQ'],
            filiais={'SGQ': [IBIPORA, RONDONOPOLIS]},
            funcoes={'SGQ': ['criar-pesquisas']},
        )
        self.user_b = User.objects.create_user(
            username='sgq.form.draft.b',
            password='x',
            name='Operador Form B',
            role_id='2',
            status='ativo',
            environments=['SGQ'],
            filiais={'SGQ': [IBIPORA, RONDONOPOLIS]},
            funcoes={'SGQ': ['criar-pesquisas']},
        )
        self.user_consulta = User.objects.create_user(
            username='sgq.form.draft.consulta',
            password='x',
            name='Operador Consulta Form Draft',
            role_id='2',
            status='ativo',
            environments=['SGQ'],
            filiais={'SGQ': [IBIPORA, RONDONOPOLIS]},
            funcoes={},
        )

    def test_put_get_isolado_por_usuario(self):
        self.client.force_authenticate(self.user_a)
        response = self.client.put(
            '/api/sgq/pesquisas-satisfacao/form-draft/',
            {'form': {'motorista': 'Motorista A', 'cliente': 'CCAB', 'cte': '1', 'notaFiscal': '',
                      'dataEntrega': '2026-08-26', 'clienteRecusouAssinar': False, 'prazoEntrega': '',
                      'condicoesMercadoria': '', 'condicoesVeiculo': '', 'apresentacaoMotorista': '',
                      'atendimentoDispensado': '', 'analise': ''}},
            format='json',
            **_headers(IBIPORA),
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['hasDraft'])
        self.assertEqual(response.data['form']['motorista'], 'Motorista A')

        self.client.force_authenticate(self.user_b)
        response_b = self.client.get('/api/sgq/pesquisas-satisfacao/form-draft/', **_headers(IBIPORA))
        self.assertEqual(response_b.status_code, 200)
        self.assertFalse(response_b.data['hasDraft'])

    def test_somente_data_entrega_nao_persiste(self):
        self.client.force_authenticate(self.user_a)
        response = self.client.put(
            '/api/sgq/pesquisas-satisfacao/form-draft/',
            {'form': {'dataEntrega': '2026-08-26'}},
            format='json',
            **_headers(IBIPORA),
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['hasDraft'])

    def test_draft_isolado_por_filial(self):
        self.client.force_authenticate(self.user_a)
        self.client.put(
            '/api/sgq/pesquisas-satisfacao/form-draft/',
            {'form': {'motorista': 'Só Ibiporã', 'cliente': '', 'cte': '', 'notaFiscal': '',
                      'dataEntrega': '', 'clienteRecusouAssinar': False}},
            format='json',
            **_headers(IBIPORA),
        )
        response = self.client.get('/api/sgq/pesquisas-satisfacao/form-draft/', **_headers(RONDONOPOLIS))
        self.assertFalse(response.data['hasDraft'])

    def test_delete_descarta_rascunho(self):
        self.client.force_authenticate(self.user_a)
        self.client.put(
            '/api/sgq/pesquisas-satisfacao/form-draft/',
            {'form': {'motorista': 'X'}},
            format='json',
            **_headers(IBIPORA),
        )
        deleted = self.client.delete('/api/sgq/pesquisas-satisfacao/form-draft/', **_headers(IBIPORA))
        self.assertEqual(deleted.status_code, 204)
        response = self.client.get('/api/sgq/pesquisas-satisfacao/form-draft/', **_headers(IBIPORA))
        self.assertFalse(response.data['hasDraft'])

    def test_operador_sem_funcao_criar_nao_pode_salvar_rascunho(self):
        self.client.force_authenticate(self.user_consulta)
        response = self.client.put(
            '/api/sgq/pesquisas-satisfacao/form-draft/',
            {'form': {'motorista': 'Bloqueado'}},
            format='json',
            **_headers(IBIPORA),
        )
        self.assertEqual(response.status_code, 403)


class PesquisaImportacaoTests(APITestCase):
    def setUp(self):
        from .pesquisa_import_service import build_pesquisa_import_template

        self.template_bytes = build_pesquisa_import_template()
        self.importador = User.objects.create_user(
            username='sgq.importador',
            password='x',
            name='Importador SGQ',
            role_id='2',
            status='ativo',
            environments=['SGQ'],
            filiais={'SGQ': [IBIPORA]},
            funcoes={'SGQ': ['importar-pesquisas']},
        )
        self.sem_importacao = User.objects.create_user(
            username='sgq.sem.import',
            password='x',
            name='Sem Import',
            role_id='2',
            status='ativo',
            environments=['SGQ'],
            filiais={'SGQ': [IBIPORA]},
            funcoes={'SGQ': ['criar-pesquisas']},
        )

    def _upload(self, user, data: bytes, dry_run=False, extra=None):
        from django.core.files.uploadedfile import SimpleUploadedFile

        self.client.force_authenticate(user)
        file = SimpleUploadedFile(
            'pesquisas.xlsx',
            data,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        payload = {'file': file}
        if dry_run:
            payload['dryRun'] = 'true'
        if extra:
            payload.update(extra)
        return self.client.post(
            '/api/sgq/pesquisas-satisfacao/import-spreadsheet/',
            payload,
            format='multipart',
            **_headers(IBIPORA),
        )

    def test_operador_sem_funcao_importar_recebe_403(self):
        response = self._upload(self.sem_importacao, self.template_bytes)
        self.assertEqual(response.status_code, 403)

    def test_importador_grava_com_criado_por_importacao(self):
        before = PesquisaSatisfacao.objects.filter(filial=IBIPORA).count()
        response = self._upload(self.importador, self.template_bytes)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['created'], 1)
        self.assertEqual(PesquisaSatisfacao.objects.filter(filial=IBIPORA).count(), before + 1)
        created = PesquisaSatisfacao.objects.order_by('-id').first()
        self.assertEqual(created.criado_por, 'Importação')

    def test_admin_importa_vinculando_lancado_por(self):
        admin = User.objects.create_user(
            username='sgq.import.admin',
            password='x',
            name='Admin Importador',
            role_id='1',
            status='ativo',
            environments=['SGQ'],
        )
        alvo = User.objects.create_user(
            username='miguel.ribeiro',
            password='x',
            name='Miguel Ribeiro',
            role_id='2',
            status='ativo',
            environments=['SGQ'],
            filiais={'SGQ': [IBIPORA]},
        )
        response = self._upload(admin, self.template_bytes, extra={'criadoPorUserId': str(alvo.pk)})
        self.assertEqual(response.status_code, 200, response.data)
        created = PesquisaSatisfacao.objects.order_by('-id').first()
        self.assertEqual(created.criado_por, 'Miguel Ribeiro')
        self.assertEqual(response.data['criadoPor'], 'Miguel Ribeiro')

    def test_admin_sem_selecao_usa_proprio_nome(self):
        admin = User.objects.create_user(
            username='sgq.import.admin2',
            password='x',
            name='Admin Importador',
            role_id='1',
            status='ativo',
            environments=['SGQ'],
        )
        response = self._upload(admin, self.template_bytes)
        self.assertEqual(response.status_code, 200, response.data)
        created = PesquisaSatisfacao.objects.order_by('-id').first()
        self.assertEqual(created.criado_por, 'Admin Importador')

    def test_operador_ignora_criado_por_user_id(self):
        response = self._upload(
            self.importador,
            self.template_bytes,
            extra={'criadoPorUserId': str(self.importador.pk)},
        )
        self.assertEqual(response.status_code, 200, response.data)
        created = PesquisaSatisfacao.objects.order_by('-id').first()
        self.assertEqual(created.criado_por, 'Importação')

    def test_exportar_modelo_exige_funcao_importar(self):
        self.client.force_authenticate(self.sem_importacao)
        denied = self.client.get('/api/sgq/pesquisas-satisfacao/exportar-modelo/', **_headers(IBIPORA))
        self.assertEqual(denied.status_code, 403)

        self.client.force_authenticate(self.importador)
        ok = self.client.get('/api/sgq/pesquisas-satisfacao/exportar-modelo/', **_headers(IBIPORA))
        self.assertEqual(ok.status_code, 200)
        self.assertIn(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ok['Content-Type'],
        )

    def test_importa_planilha_com_linhas_vazias_antes_do_cabecalho(self):
        import openpyxl
        from io import BytesIO

        from .pesquisa_import_service import _TEMPLATE_HEADERS, _TEMPLATE_SAMPLE_ROW

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append([])
        ws.append(['Relatório de pesquisas'])
        ws.append([])
        ws.append(_TEMPLATE_HEADERS)
        ws.append(_TEMPLATE_SAMPLE_ROW)
        buffer = BytesIO()
        wb.save(buffer)

        response = self._upload(self.importador, buffer.getvalue())
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['created'], 1)

    def test_preview_retorna_linhas_antes_de_importar(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        self.client.force_authenticate(self.importador)
        file = SimpleUploadedFile(
            'pesquisas.xlsx',
            self.template_bytes,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response = self.client.post(
            '/api/sgq/pesquisas-satisfacao/import-preview/',
            {'file': file},
            format='multipart',
            **_headers(IBIPORA),
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['validRows'], 1)
        self.assertEqual(len(response.data['rows']), 1)
        self.assertEqual(response.data['rows'][0]['motorista'], 'EVALDO JOSE')
        stats = response.data['stats']
        self.assertEqual(stats['validRows'], 1)
        self.assertEqual(stats['processedRows'], 1)
        self.assertEqual(stats['validRate'], 100.0)
        self.assertTrue(stats['readyToImport'])
        self.assertEqual(stats['uniqueMotoristas'], 1)
        self.assertEqual(len(stats['byCliente']), 1)

    def test_importa_pesquisa_em_branco_como_recusa_de_avaliacao(self):
        import openpyxl
        from io import BytesIO
        from django.core.files.uploadedfile import SimpleUploadedFile

        from .pesquisa_import_service import _TEMPLATE_HEADERS

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(_TEMPLATE_HEADERS)
        ws.append([
            '10/08/2026',
            'JOAO SILVA',
            '99001',
            '03/08/2026',
            '7777',
            '',
            '',
            '',
            '',
            '',
            'OUTROS',
            'Cliente não assinou a pesquisa',
            'Prazo de Entrega: Entregas fora do prazo contratual',
        ])
        buffer = BytesIO()
        wb.save(buffer)
        data = buffer.getvalue()

        self.client.force_authenticate(self.importador)
        preview_file = SimpleUploadedFile(
            'pesquisas.xlsx',
            data,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        preview = self.client.post(
            '/api/sgq/pesquisas-satisfacao/import-preview/',
            {'file': preview_file},
            format='multipart',
            **_headers(IBIPORA),
        )
        self.assertEqual(preview.status_code, 200, preview.data)
        self.assertTrue(preview.data['success'])
        self.assertTrue(preview.data['rows'][0]['clienteRecusouAssinar'])
        self.assertEqual(preview.data['stats']['rowsClienteRecusou'], 1)

        response = self._upload(self.importador, data)
        self.assertEqual(response.status_code, 200, response.data)
        created = PesquisaSatisfacao.objects.order_by('-id').first()
        self.assertTrue(created.cliente_recusou_assinar)
        self.assertEqual(created.prazo_entrega, '')
        self.assertEqual(created.analise, 'Cliente não assinou a pesquisa')
        self.assertEqual(created.escopo_analise, {'prazo_entrega': ['entregas_fora_prazo_contratual']})
        self.assertEqual(created.motorista, 'JOAO SILVA')
        self.assertEqual(created.cte, '99001')

    def test_importa_analise_sem_escopo(self):
        import openpyxl
        from io import BytesIO

        from .pesquisa_import_service import _TEMPLATE_HEADERS

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(_TEMPLATE_HEADERS)
        ws.append([
            '10/08/2026',
            'MARIA SOUZA',
            '99002',
            '03/08/2026',
            '8888',
            'BOM',
            'OTIMO',
            'OTIMO',
            'OTIMO',
            'OTIMO',
            'OUTROS',
            'Atraso pontual no descarregamento.',
            '',
        ])
        buffer = BytesIO()
        wb.save(buffer)

        response = self._upload(self.importador, buffer.getvalue())
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['success'])
        created = PesquisaSatisfacao.objects.order_by('-id').first()
        self.assertEqual(created.analise, 'Atraso pontual no descarregamento.')
        self.assertEqual(created.escopo_analise, {})


class EscopoAnaliseCadastroTests(APITestCase):
    def setUp(self):
        self.operador = User.objects.create_user(
            username='sgq.escopo.op',
            password='x',
            name='Operador Escopo',
            role_id='2',
            status='ativo',
            environments=['SGQ'],
            filiais={'SGQ': [IBIPORA, RONDONOPOLIS]},
            funcoes={'SGQ': ['gerenciar-escopos']},
        )
        self.consulta = User.objects.create_user(
            username='sgq.escopo.consulta',
            password='x',
            name='Consulta Escopo',
            role_id='2',
            status='ativo',
            environments=['SGQ'],
            filiais={'SGQ': [IBIPORA, RONDONOPOLIS]},
            funcoes={},
        )

    def test_catalogo_igual_nas_duas_filiais(self):
        self.client.force_authenticate(self.operador)
        ibi = self.client.get('/api/sgq/escopos-analise/', **_headers(IBIPORA))
        ron = self.client.get('/api/sgq/escopos-analise/', **_headers(RONDONOPOLIS))
        self.assertEqual(ibi.status_code, 200, ibi.data)
        self.assertEqual(ron.status_code, 200, ron.data)
        self.assertGreaterEqual(len(ibi.data), 5)
        self.assertEqual(ibi.data, ron.data)

    def test_opcao_criada_em_ibipora_aparece_em_rondonopolis(self):
        self.client.force_authenticate(self.operador)
        catalogo = self.client.get('/api/sgq/escopos-analise/', **_headers(IBIPORA))
        escopo_id = catalogo.data[0]['id']
        created = self.client.post(
            '/api/sgq/escopos-analise-opcoes/',
            {'escopoId': escopo_id, 'label': 'Atraso no pátio do cliente'},
            format='json',
            **_headers(IBIPORA),
        )
        self.assertEqual(created.status_code, 201, created.data)

        ron = self.client.get('/api/sgq/escopos-analise/', **_headers(RONDONOPOLIS))
        labels = [opcao['label'] for grupo in ron.data for opcao in grupo['opcoes']]
        self.assertIn('Atraso no pátio do cliente', labels)

    def test_consulta_pode_ler_mas_nao_alterar(self):
        self.client.force_authenticate(self.consulta)
        listed = self.client.get('/api/sgq/escopos-analise/', **_headers(IBIPORA))
        self.assertEqual(listed.status_code, 200)
        denied = self.client.post(
            '/api/sgq/escopos-analise/',
            {'label': 'Novo grupo'},
            format='json',
            **_headers(IBIPORA),
        )
        self.assertEqual(denied.status_code, 403)

    def test_criar_pesquisas_nao_libera_cadastro_de_escopos(self):
        so_criar = User.objects.create_user(
            username='sgq.escopo.criar',
            password='x',
            name='Só criar pesquisas',
            role_id='2',
            status='ativo',
            environments=['SGQ'],
            filiais={'SGQ': [IBIPORA]},
            funcoes={'SGQ': ['criar-pesquisas']},
        )
        self.client.force_authenticate(so_criar)
        denied = self.client.post(
            '/api/sgq/escopos-analise/',
            {'label': 'Novo grupo'},
            format='json',
            **_headers(IBIPORA),
        )
        self.assertEqual(denied.status_code, 403)

    def test_nao_exclui_opcao_ja_usada_em_pesquisa(self):
        from .models import EscopoAnaliseOpcao

        opcao = EscopoAnaliseOpcao.objects.get(escopo__chave='condicoes_mercadoria', chave='pallets_tombaram')
        PesquisaSatisfacao.objects.create(
            filial=IBIPORA,
            motorista='X',
            cte='ESC-USO',
            data_entrega=timezone.localdate(),
            nota_fiscal='1',
            cliente='OUTROS',
            analise='Pallets tombados.',
            escopo_analise={'condicoes_mercadoria': ['pallets_tombaram']},
        )
        self.client.force_authenticate(self.operador)
        denied = self.client.delete(
            f'/api/sgq/escopos-analise-opcoes/{opcao.pk}/',
            **_headers(IBIPORA),
        )
        self.assertEqual(denied.status_code, 400, denied.data)
        self.assertTrue(EscopoAnaliseOpcao.objects.filter(pk=opcao.pk).exists())


class MatrizSGQTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='sgq.matriz',
            password='x',
            name='Matriz SGQ',
            role_id='2',
            status='ativo',
            environments=['SGQ', 'CamiloIA'],
            filiais={'SGQ': [IBIPORA]},
        )
        self.client.force_authenticate(self.user)

    def test_pastas_guardam_arquivo_para_a_ia(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        from apps.camilo.consulta import resumo_matriz_sgq

        pasta = self.client.post('/api/sgq/pastas/', {'nome': 'Procedimentos'}, format='json', **_headers())
        self.assertEqual(pasta.status_code, 201, pasta.data)
        criado = self.client.post(
            '/api/sgq/documentos/',
            {
                'titulo': 'Descarga na doca',
                'arquivo': SimpleUploadedFile('descarga.txt', 'O procedimento de descarga na doca exige conferência.'.encode(), content_type='text/plain'),
                'pastaId': pasta.json()['id'],
            },
            format='multipart',
            **_headers(),
        )
        self.assertEqual(criado.status_code, 201, criado.data)
        self.assertEqual(criado.json()['pastaId'], pasta.json()['id'])
        self.assertIn('descarga', resumo_matriz_sgq(self.user, 'procedimento de descarga').lower())

        cheia = self.client.delete(f"/api/sgq/pastas/{pasta.json()['id']}/", **_headers())
        self.assertEqual(cheia.status_code, 400, cheia.data)


def _auditoria(**overrides):
    data = {
        'titulo': 'Auditoria interna - ISO 9001:2015',
        'categoria': 'Auditoria interna',
        'dataInicio': '2026-09-24',
        'dataTermino': '2026-09-29',
        'auditorLider': 'Ana Luiza Juliani',
        'status': 'execucao',
        'escopo': '',
    }
    data.update(overrides)
    return data


class AuditoriaSGQTests(APITestCase):
    URL = '/api/sgq/auditorias/'

    def setUp(self):
        self.gestor = User.objects.create_user(
            username='sgq.auditor', password='x', name='Gestor Auditorias', role_id='2', status='ativo',
            environments=['SGQ'], filiais={'SGQ': [IBIPORA, RONDONOPOLIS]},
            funcoes={'SGQ': ['gerenciar-auditorias']},
        )
        self.leitor = User.objects.create_user(
            username='sgq.leitor', password='x', name='Leitor Auditorias', role_id='2', status='ativo',
            environments=['SGQ'], filiais={'SGQ': [IBIPORA]}, funcoes={},
        )
        for filial in (IBIPORA, RONDONOPOLIS):
            CategoriaAuditoriaSGQ.objects.create(filial=filial, nome='Auditoria interna')
        self.client.force_authenticate(self.gestor)

    @override_settings(SGQ_AUDITORIAS_LIBERADAS=False)
    def test_auditorias_no_azure_liberam_admin_e_quem_tem_a_rotina(self):
        negado = self.client.get(self.URL, **_headers())
        self.assertEqual(negado.status_code, 403)

        admin = User.objects.create_user(
            username='admin.aud.bloqueio', password='x', name='Admin Bloqueio', role_id='1', status='ativo',
            environments=['SGQ', 'Administração/Manutenção'], filiais={'SGQ': [IBIPORA]},
        )
        self.client.force_authenticate(admin)
        self.assertEqual(self.client.get(self.URL, **_headers()).status_code, 200)
        self.assertEqual(self.client.get('/api/sgq/normas/', **_headers()).status_code, 200)

        liberado = User.objects.create_user(
            username='sgq.auditor.liberado', password='x', name='Auditor Liberado', role_id='2', status='ativo',
            environments=['SGQ'], filiais={'SGQ': [IBIPORA]},
            abas={'SGQ': ['home', 'auditorias']},
            funcoes={'SGQ': ['gerenciar-auditorias']},
        )
        self.client.force_authenticate(liberado)
        self.assertEqual(self.client.get(self.URL, **_headers()).status_code, 200)
        self.assertEqual(self.client.get('/api/sgq/normas/', **_headers()).status_code, 403)

    def test_grava_auditores_sem_repetir_o_lider(self):
        criada = self.client.post(self.URL, _auditoria(auditores=[
            'Miguel Ribeiro', 'Ana Luiza Juliani', 'Miguel Ribeiro', '  ',
        ]), format='json', **_headers())
        self.assertEqual(criada.status_code, 201, criada.data)
        self.assertEqual(criada.data['auditores'], ['Miguel Ribeiro'])

    def test_cria_com_codigo_sequencial_por_ano_e_filial_da_sessao(self):
        primeira = self.client.post(self.URL, _auditoria(), format='json', **_headers())
        segunda = self.client.post(self.URL, _auditoria(titulo='Auditoria V&Z'), format='json', **_headers())
        outro_ano = self.client.post(self.URL, _auditoria(dataInicio='2027-01-10', dataTermino='2027-01-12'), format='json', **_headers())
        self.assertEqual(primeira.status_code, 201, primeira.data)
        self.assertEqual(primeira.data['codigo'], '26-00001')
        self.assertEqual(segunda.data['codigo'], '26-00002')
        self.assertEqual(outro_ano.data['codigo'], '27-00001')
        self.assertEqual(primeira.data['filial'], IBIPORA)
        self.assertEqual(primeira.data['criadoPor'], 'Gestor Auditorias')

    def test_lista_paginada_segregada_por_filial_com_filtros(self):
        self.client.post(self.URL, _auditoria(), format='json', **_headers())
        self.client.post(self.URL, _auditoria(titulo='5S Julho', status='concluida'), format='json', **_headers())
        self.client.post(self.URL, _auditoria(titulo='De Rondonópolis'), format='json', **_headers(RONDONOPOLIS))

        lista = self.client.get(self.URL, **_headers())
        self.assertEqual(lista.status_code, 200)
        self.assertEqual(lista.data['count'], 2)
        self.assertNotIn('De Rondonópolis', [a['titulo'] for a in lista.data['results']])

        concluidas = self.client.get(self.URL, {'status': 'concluida'}, **_headers())
        self.assertEqual([a['titulo'] for a in concluidas.data['results']], ['5S Julho'])
        busca = self.client.get(self.URL, {'search': '9001'}, **_headers())
        self.assertEqual(busca.data['count'], 1)

    def test_atrasada_e_resumo(self):
        self.client.post(self.URL, _auditoria(dataInicio='2020-01-01', dataTermino='2020-01-05'), format='json', **_headers())
        self.client.post(self.URL, _auditoria(dataInicio='2020-02-01', dataTermino='2020-02-05', status='concluida'), format='json', **_headers())
        atrasadas = self.client.get(self.URL, {'status': 'atrasada'}, **_headers())
        self.assertEqual(atrasadas.data['count'], 1)
        self.assertTrue(atrasadas.data['results'][0]['atrasada'])
        resumo = self.client.get(f'{self.URL}resumo/', **_headers())
        self.assertEqual(resumo.data, {'total': 2, 'planejamento': 0, 'execucao': 1, 'concluida': 1, 'atrasada': 1})

    def test_termino_antes_do_inicio_e_rejeitado(self):
        resposta = self.client.post(self.URL, _auditoria(dataTermino='2026-09-01'), format='json', **_headers())
        self.assertEqual(resposta.status_code, 400)
        self.assertIn('dataTermino', resposta.data)

    def test_sem_funcao_so_consulta(self):
        criada = self.client.post(self.URL, _auditoria(), format='json', **_headers())
        self.client.force_authenticate(self.leitor)
        self.assertEqual(self.client.get(self.URL, **_headers()).status_code, 200)
        self.assertEqual(self.client.post(self.URL, _auditoria(), format='json', **_headers()).status_code, 403)
        excluir = self.client.post(f'{self.URL}excluir-lote/', {'ids': [criada.data['id']]}, format='json', **_headers())
        self.assertEqual(excluir.status_code, 403)

    def test_edita_e_exclui_em_lote(self):
        a = self.client.post(self.URL, _auditoria(), format='json', **_headers()).data
        b = self.client.post(self.URL, _auditoria(titulo='Outra'), format='json', **_headers()).data
        editada = self.client.patch(f"{self.URL}{a['id']}/", {'status': 'concluida'}, format='json', **_headers())
        self.assertEqual(editada.status_code, 200, editada.data)
        self.assertFalse(editada.data['atrasada'])
        excluir = self.client.post(f'{self.URL}excluir-lote/', {'ids': [a['id'], b['id']]}, format='json', **_headers())
        self.assertEqual(excluir.data, {'excluidas': 2})
        self.assertEqual(self.client.get(self.URL, **_headers()).data['count'], 0)

    def test_normas_avulsas_sao_ignoradas(self):
        hoje = timezone.localdate()
        iso = NormaSGQ.objects.create(filial=IBIPORA, nome='ISO 9001:2015', data_atualizacao=hoje)
        sassmaq = NormaSGQ.objects.create(filial=IBIPORA, nome='SASSMAQ', data_atualizacao=hoje)
        CategoriaAuditoriaSGQ.objects.get(filial=IBIPORA).normas.set([iso])

        criada = self.client.post(self.URL, _auditoria(normaIds=[str(sassmaq.pk)]), format='json', **_headers())
        self.assertEqual(criada.status_code, 201, criada.data)
        self.assertEqual([n['nome'] for n in criada.data['normas']], ['ISO 9001:2015'])
        self.assertEqual(self.client.get(self.URL, {'search': '9001:2015'}, **_headers()).data['count'], 1)

        editada = self.client.patch(
            f"{self.URL}{criada.data['id']}/", {'normaIds': [str(sassmaq.pk)]}, format='json', **_headers(),
        )
        self.assertEqual(editada.status_code, 200, editada.data)
        self.assertEqual([n['nome'] for n in editada.data['normas']], ['ISO 9001:2015'])

    def test_trocar_categoria_troca_as_normas(self):
        hoje = timezone.localdate()
        iso = NormaSGQ.objects.create(filial=IBIPORA, nome='ISO 9001:2015', data_atualizacao=hoje)
        sassmaq = NormaSGQ.objects.create(filial=IBIPORA, nome='SASSMAQ', data_atualizacao=hoje)
        CategoriaAuditoriaSGQ.objects.get(filial=IBIPORA).normas.set([iso])
        externa = CategoriaAuditoriaSGQ.objects.create(filial=IBIPORA, nome='Auditoria externa')
        externa.normas.set([sassmaq])

        criada = self.client.post(self.URL, _auditoria(), format='json', **_headers())
        trocada = self.client.patch(
            f"{self.URL}{criada.data['id']}/", {'categoria': 'Auditoria externa'}, format='json', **_headers(),
        )
        self.assertEqual(trocada.status_code, 200, trocada.data)
        self.assertEqual([n['nome'] for n in trocada.data['normas']], ['SASSMAQ'])

    def test_edicao_sem_trocar_categoria_mantem_normas_vinculadas(self):
        hoje = timezone.localdate()
        iso = NormaSGQ.objects.create(filial=IBIPORA, nome='ISO 9001:2015', data_atualizacao=hoje)
        CategoriaAuditoriaSGQ.objects.get(filial=IBIPORA).normas.set([iso])
        criada = self.client.post(self.URL, _auditoria(), format='json', **_headers())
        NormaSGQ.objects.filter(pk=iso.pk).update(ativa=False)

        mantida = self.client.patch(
            f"{self.URL}{criada.data['id']}/", {'categoria': 'Auditoria interna', 'status': 'concluida'},
            format='json', **_headers(),
        )
        self.assertEqual(mantida.status_code, 200, mantida.data)
        self.assertEqual([n['nome'] for n in mantida.data['normas']], ['ISO 9001:2015'])

    def test_categoria_deve_ser_cadastrada_e_ativa(self):
        criada = self.client.post(self.URL, _auditoria(categoria='auditoria INTERNA'), format='json', **_headers())
        self.assertEqual(criada.status_code, 201, criada.data)
        self.assertEqual(criada.data['categoria'], 'Auditoria interna')

        sem_cadastro = self.client.post(self.URL, _auditoria(categoria='Inventada'), format='json', **_headers())
        self.assertEqual(sem_cadastro.status_code, 400)
        self.assertIn('categoria', sem_cadastro.data)

        CategoriaAuditoriaSGQ.objects.filter(filial=IBIPORA).update(ativa=False)
        inativa = self.client.post(self.URL, _auditoria(), format='json', **_headers())
        self.assertEqual(inativa.status_code, 400)
        mantida = self.client.patch(
            f"{self.URL}{criada.data['id']}/", {'categoria': 'Auditoria interna', 'status': 'concluida'},
            format='json', **_headers(),
        )
        self.assertEqual(mantida.status_code, 200, mantida.data)
        self.assertEqual(self.client.get(f'{self.URL}sugestoes/', **_headers()).data['categorias'], [])

    def test_sugere_auditores_com_sgq_liberado_na_filial(self):
        User.objects.create_user(
            username='sgq.so.rondonopolis', password='x', name='Só Rondonópolis', role_id='2', status='ativo',
            environments=['SGQ'], filiais={'SGQ': [RONDONOPOLIS]},
        )
        User.objects.create_user(
            username='sem.sgq.auditor', password='x', name='Sem SGQ', role_id='2', status='ativo',
            environments=['Financeiro'], filiais={'Financeiro': [IBIPORA]},
        )
        User.objects.create_user(
            username='sgq.inativo', password='x', name='Inativo SGQ', role_id='2', status='inativo',
            environments=['SGQ'], filiais={'SGQ': [IBIPORA]},
        )

        auditores = self.client.get(f'{self.URL}sugestoes/', **_headers()).data['auditores']
        self.assertEqual(auditores, ['Gestor Auditorias', 'Leitor Auditorias'])

    def test_herda_normas_ativas_da_categoria(self):
        hoje = timezone.localdate()
        iso = NormaSGQ.objects.create(filial=IBIPORA, nome='ISO 9001:2015', data_atualizacao=hoje)
        bpf = NormaSGQ.objects.create(filial=IBIPORA, nome='BPF', data_atualizacao=hoje)
        antiga = NormaSGQ.objects.create(filial=IBIPORA, nome='Antiga', data_atualizacao=hoje, ativa=False)
        CategoriaAuditoriaSGQ.objects.get(filial=IBIPORA).normas.set([iso, bpf, antiga])

        sugestoes = self.client.get(f'{self.URL}sugestoes/', **_headers()).data
        self.assertEqual([n['nome'] for n in sugestoes['categorias'][0]['normas']], ['BPF', 'ISO 9001:2015'])
        self.assertNotIn('normas', sugestoes)

        herdada = self.client.post(self.URL, _auditoria(), format='json', **_headers())
        self.assertEqual(herdada.status_code, 201, herdada.data)
        self.assertEqual({n['nome'] for n in herdada.data['normas']}, {'ISO 9001:2015', 'BPF'})


class CategoriaAuditoriaSGQTests(APITestCase):
    URL = '/api/sgq/auditorias-categorias/'

    def setUp(self):
        self.gestor = User.objects.create_user(
            username='sgq.categorias', password='x', name='Gestor Categorias', role_id='2', status='ativo',
            environments=['SGQ'], filiais={'SGQ': [IBIPORA, RONDONOPOLIS]},
            funcoes={'SGQ': ['gerenciar-categorias', 'gerenciar-auditorias']},
        )
        self.client.force_authenticate(self.gestor)

    def _categoria(self, filial=IBIPORA, **overrides):
        data = {'nome': 'Auditoria interna', 'ativa': True}
        data.update(overrides)
        return self.client.post(self.URL, data, format='json', **_headers(filial))

    def test_cria_com_emissor_e_lista_segregada_com_filtros(self):
        criada = self._categoria()
        self.assertEqual(criada.status_code, 201, criada.data)
        self.assertEqual(
            (criada.data['filial'], criada.data['emissor'], criada.data['atualizadoPor']),
            (IBIPORA, 'Gestor Categorias', 'Gestor Categorias'),
        )
        self._categoria(nome='Auditoria V&S', ativa=False)
        self._categoria(RONDONOPOLIS, nome='Auditoria externa')

        lista = self.client.get(self.URL, **_headers())
        self.assertEqual([c['nome'] for c in lista.data['results']], ['Auditoria interna', 'Auditoria V&S'])
        self.assertEqual(self.client.get(self.URL, {'situacao': 'inativa'}, **_headers()).data['count'], 1)
        self.assertEqual(self.client.get(f'{self.URL}resumo/', **_headers()).data, {'total': 2, 'ativa': 1, 'inativa': 1})

    def test_titulo_duplicado_na_mesma_filial_e_rejeitado(self):
        self._categoria()
        self.assertEqual(self._categoria(nome='auditoria interna').status_code, 400)
        self.assertEqual(self._categoria(RONDONOPOLIS).status_code, 201)

    def test_vincula_normas_da_filial(self):
        hoje = timezone.localdate()
        iso = NormaSGQ.objects.create(filial=IBIPORA, nome='ISO 9001:2015', data_atualizacao=hoje)
        inativa = NormaSGQ.objects.create(filial=IBIPORA, nome='Antiga', data_atualizacao=hoje, ativa=False)
        de_outra_filial = NormaSGQ.objects.create(filial=RONDONOPOLIS, nome='ISO 14001', data_atualizacao=hoje)

        criada = self._categoria(normaIds=[str(iso.pk)])
        self.assertEqual(criada.status_code, 201, criada.data)
        self.assertEqual([n['nome'] for n in criada.data['normas']], ['ISO 9001:2015'])
        self.assertEqual(self.client.get(self.URL, {'search': '9001'}, **_headers()).data['count'], 1)
        self.assertEqual(self._categoria(nome='X', normaIds=[str(inativa.pk)]).status_code, 400)
        self.assertEqual(self._categoria(nome='Y', normaIds=[str(de_outra_filial.pk)]).status_code, 400)

        opcoes = self.client.get(f'{self.URL}sugestoes/', **_headers()).data['normas']
        self.assertEqual([n['nome'] for n in opcoes], ['ISO 9001:2015'])

    def test_renomear_propaga_e_em_uso_nao_exclui(self):
        categoria = self._categoria().data
        auditoria = self.client.post('/api/sgq/auditorias/', _auditoria(), format='json', **_headers())
        self.assertEqual(auditoria.status_code, 201, auditoria.data)

        editor = User.objects.create_user(
            username='sgq.categorias.editor', password='x', name='Editor Categorias', role_id='2', status='ativo',
            environments=['SGQ'], filiais={'SGQ': [IBIPORA]}, funcoes={'SGQ': ['gerenciar-categorias']},
        )
        self.client.force_authenticate(editor)
        renomeada = self.client.patch(f"{self.URL}{categoria['id']}/", {'nome': 'Auditoria interna - ISO'}, format='json', **_headers())
        self.assertEqual(renomeada.status_code, 200, renomeada.data)
        self.assertEqual(renomeada.data['atualizadoPor'], 'Editor Categorias')
        self.assertEqual(renomeada.data['emissor'], 'Gestor Categorias')
        self.assertEqual(renomeada.data['totalAuditorias'], 1)
        self.assertEqual(AuditoriaSGQ.objects.get(pk=auditoria.data['id']).categoria, 'Auditoria interna - ISO')

        self.assertEqual(self.client.delete(f"{self.URL}{categoria['id']}/", **_headers()).status_code, 400)
        lote = self.client.post(f'{self.URL}excluir-lote/', {'ids': [categoria['id']]}, format='json', **_headers())
        self.assertEqual(lote.status_code, 400)

        AuditoriaSGQ.objects.all().delete()
        self.assertEqual(self.client.delete(f"{self.URL}{categoria['id']}/", **_headers()).status_code, 204)

    def test_sem_funcao_so_consulta(self):
        leitor = User.objects.create_user(
            username='sgq.categorias.leitor', password='x', name='Leitor', role_id='2', status='ativo',
            environments=['SGQ'], filiais={'SGQ': [IBIPORA]}, funcoes={},
        )
        self.client.force_authenticate(leitor)
        self.assertEqual(self.client.get(self.URL, **_headers()).status_code, 200)
        self.assertEqual(self._categoria().status_code, 403)


def _opcoes(*pares):
    return [{'codigo': texto[:10].strip(), 'texto': texto, 'valor': valor, 'exigeJustificativa': False} for texto, valor in pares]


_OPCOES_CONFORMIDADE = _opcoes(('Conforme', 100), ('Não conforme', 0), ('Não se aplica', None))


class TipoRespostaSGQTests(APITestCase):
    URL = '/api/sgq/auditorias-tipos-resposta/'

    def setUp(self):
        self.gestor = User.objects.create_user(
            username='sgq.tipos', password='x', name='Gestor Tipos', role_id='2', status='ativo',
            environments=['SGQ'], filiais={'SGQ': [IBIPORA, RONDONOPOLIS]},
            funcoes={'SGQ': ['gerenciar-tipos-resposta']},
        )
        self.client.force_authenticate(self.gestor)

    def _tipo(self, filial=IBIPORA, **overrides):
        data = {'nome': 'Padrão', 'opcoes': _OPCOES_CONFORMIDADE, 'publica': True}
        data.update(overrides)
        return self.client.post(self.URL, data, format='json', **_headers(filial))

    def test_cria_com_codigo_sequencial_por_filial_e_emissor(self):
        primeiro = self._tipo()
        segundo = self._tipo(nome='Respostas Auditoria 5S', opcoes=_opcoes(('Não atende', 0), ('Atende', 100)), publica=False)
        outra_filial = self._tipo(RONDONOPOLIS)
        self.assertEqual(primeiro.status_code, 201, primeiro.data)
        self.assertEqual(
            (primeiro.data['codigo'], segundo.data['codigo'], outra_filial.data['codigo']), ('001', '002', '001'),
        )
        self.assertEqual((primeiro.data['emissor'], primeiro.data['filial']), ('Gestor Tipos', IBIPORA))
        self.assertEqual(primeiro.data['opcoes'], _OPCOES_CONFORMIDADE)

        lista = self.client.get(self.URL, **_headers())
        self.assertEqual([t['codigo'] for t in lista.data['results']], ['002', '001'])
        self.assertEqual(self.client.get(self.URL, {'publica': 'nao'}, **_headers()).data['count'], 1)
        self.assertEqual(self.client.get(self.URL, {'search': 'atende'}, **_headers()).data['count'], 1)
        self.assertEqual(self.client.get(f'{self.URL}resumo/', **_headers()).data, {'total': 2, 'sim': 1, 'nao': 1})

    def test_valida_nome_e_opcoes(self):
        self._tipo()
        self.assertEqual(self._tipo(nome='padrão').status_code, 400)
        self.assertEqual(self._tipo(RONDONOPOLIS).status_code, 201)

        uma_opcao = self._tipo(nome='Uma', opcoes=_opcoes(('Sim', 100), ('  ', 0)))
        self.assertEqual(uma_opcao.status_code, 400)
        self.assertIn('opcoes', uma_opcao.data)
        repetida = self._tipo(nome='Repetida', opcoes=_opcoes(('Sim', 100), ('sim', 0)))
        self.assertEqual(repetida.status_code, 400)
        fora_da_faixa = self._tipo(nome='Faixa', opcoes=_opcoes(('Sim', 101), ('Não', 0)))
        self.assertEqual(fora_da_faixa.status_code, 400)
        so_nao_se_aplica = self._tipo(nome='N/A', opcoes=_opcoes(('N/A', None), ('Não avaliado', None)))
        self.assertEqual(so_nao_se_aplica.status_code, 400)

        sassmaq = [
            {'codigo': '1', 'texto': 'Sim', 'valor': 100},
            {'codigo': '0', 'texto': 'Não', 'valor': 0},
            {'codigo': 'x', 'texto': 'Não aplicável', 'valor': None, 'exigeJustificativa': True},
        ]
        criado = self._tipo(nome='SASSMAQ', opcoes=sassmaq)
        self.assertEqual(criado.status_code, 201, criado.data)
        self.assertEqual(
            [(o['codigo'], o['exigeJustificativa']) for o in criado.data['opcoes']], [('1', False), ('0', False), ('x', True)],
        )
        codigo_repetido = self._tipo(nome='Repetido', opcoes=[{**sassmaq[0]}, {**sassmaq[1], 'codigo': '1'}])
        self.assertEqual(codigo_repetido.status_code, 400)

        limpa = self._tipo(nome='Sim/Não', opcoes=_opcoes((' Sim ', 100), ('', 0), ('Parcial', 50), ('Não', 0)))
        self.assertEqual(limpa.status_code, 201, limpa.data)
        self.assertEqual(limpa.data['opcoes'], _opcoes(('Sim', 100), ('Parcial', 50), ('Não', 0)))

    def test_edita_e_exclui_em_lote(self):
        tipo = self._tipo().data
        outro = self._tipo(nome='Outro', opcoes=_opcoes(('A', 100), ('B', 0))).data
        novas = _opcoes(('Conforme', 100), ('Não conforme', 0))
        editado = self.client.patch(
            f"{self.URL}{tipo['id']}/", {'opcoes': novas, 'publica': False}, format='json', **_headers(),
        )
        self.assertEqual(editado.status_code, 200, editado.data)
        self.assertEqual((editado.data['opcoes'], editado.data['publica'], editado.data['codigo']), (novas, False, '001'))

        excluir = self.client.post(f'{self.URL}excluir-lote/', {'ids': [tipo['id'], outro['id']]}, format='json', **_headers())
        self.assertEqual(excluir.data, {'excluidos': 2})
        self.assertEqual(self.client.get(self.URL, **_headers()).data['count'], 0)

    def test_tipo_em_uso_nas_perguntas_nao_pode_ser_excluido(self):
        tipo = TipoRespostaSGQ.objects.get(pk=self._tipo().data['id'])
        norma = NormaSGQ.objects.create(filial=IBIPORA, nome='N', data_atualizacao=timezone.localdate(), emissor='X')
        ItemNormaSGQ.objects.create(norma=norma, titulo='P?', tipo='pergunta', tipo_resposta=tipo)
        lote = self.client.post(f'{self.URL}excluir-lote/', {'ids': [str(tipo.pk)]}, format='json', **_headers())
        self.assertEqual(lote.status_code, 400)
        self.assertEqual(self.client.delete(f'{self.URL}{tipo.pk}/', **_headers()).status_code, 400)
        self.assertTrue(TipoRespostaSGQ.objects.filter(pk=tipo.pk).exists())

    def test_sem_funcao_so_consulta(self):
        criado = self._tipo().data
        leitor = User.objects.create_user(
            username='sgq.tipos.leitor', password='x', name='Leitor', role_id='2', status='ativo',
            environments=['SGQ'], filiais={'SGQ': [IBIPORA]}, funcoes={},
        )
        self.client.force_authenticate(leitor)
        self.assertEqual(self.client.get(self.URL, **_headers()).status_code, 200)
        self.assertEqual(self._tipo(nome='Novo').status_code, 403)
        self.assertEqual(self.client.delete(f"{self.URL}{criado['id']}/", **_headers()).status_code, 403)


_AREA_SS = {'sigla': 'SS', 'nome': 'Saúde e Segurança'}

_CLASSIFICACOES_SASSMAQ = [
    {'sigla': 'M', 'nome': 'Mandatória', 'critica': True, 'metaPrimeira': 100, 'metaReavaliacao': 100},
    {'sigla': 'I', 'nome': 'Indústria', 'critica': False, 'metaPrimeira': 70, 'metaReavaliacao': 85},
    {'sigla': 'D', 'nome': 'Desejável', 'critica': False, 'metaPrimeira': 0, 'metaReavaliacao': 40},
]


def _norma(**overrides):
    data = {
        'nome': 'ISO 9001:2015',
        'descricao': 'Sistemas de gestão da qualidade - Requisitos',
        'publica': True,
        'ativa': True,
    }
    data.update(overrides)
    return data


class NormaSGQTests(APITestCase):
    URL = '/api/sgq/normas/'

    def setUp(self):
        self.gestor = User.objects.create_user(
            username='sgq.normas', password='x', name='Gestor Normas', role_id='2', status='ativo',
            environments=['SGQ'], filiais={'SGQ': [IBIPORA, RONDONOPOLIS]},
            funcoes={'SGQ': ['gerenciar-normas']},
        )
        self.client.force_authenticate(self.gestor)

    def test_cria_na_filial_da_sessao_e_lista_segregada_com_filtros(self):
        criada = self.client.post(self.URL, _norma(), format='json', **_headers())
        self.assertEqual(criada.status_code, 201, criada.data)
        self.assertEqual(criada.data['filial'], IBIPORA)
        self.client.post(self.URL, _norma(nome='CheckList - BPF', publica=False, ativa=False), format='json', **_headers())
        self.client.post(self.URL, _norma(nome='PALC 2025'), format='json', **_headers(RONDONOPOLIS))

        lista = self.client.get(self.URL, **_headers())
        self.assertEqual([n['nome'] for n in lista.data['results']], ['CheckList - BPF', 'ISO 9001:2015'])
        self.assertEqual(self.client.get(self.URL, {'situacao': 'inativa'}, **_headers()).data['count'], 1)
        self.assertEqual(self.client.get(self.URL, {'publica': 'sim'}, **_headers()).data['count'], 1)
        self.assertEqual(self.client.get(self.URL, {'search': 'qualidade'}, **_headers()).data['count'], 2)
        resumo = self.client.get(f'{self.URL}resumo/', **_headers())
        self.assertEqual(resumo.data, {'total': 2, 'ativa': 1, 'inativa': 1})

    def test_data_e_emissor_sao_definidos_pelo_servidor(self):
        criada = self.client.post(
            self.URL, _norma(dataAtualizacao='2020-09-02', emissor='Outra pessoa'), format='json', **_headers(),
        )
        self.assertEqual(criada.status_code, 201, criada.data)
        self.assertEqual(criada.data['dataAtualizacao'], timezone.localdate().isoformat())
        self.assertEqual(criada.data['emissor'], 'Gestor Normas')

        NormaSGQ.objects.filter(pk=criada.data['id']).update(data_atualizacao='2020-01-01', emissor='Antigo')
        editor = User.objects.create_user(
            username='sgq.normas.editor', password='x', name='Editor Normas', role_id='2', status='ativo',
            environments=['SGQ'], filiais={'SGQ': [IBIPORA]}, funcoes={'SGQ': ['gerenciar-normas']},
        )
        self.client.force_authenticate(editor)
        item = self.client.post(
            '/api/sgq/normas-itens/', {'normaId': criada.data['id'], 'titulo': 'REQUISITO 1', 'tipo': 'orientativo'},
            format='json', **_headers(),
        )
        self.assertEqual(item.status_code, 201, item.data)
        norma = NormaSGQ.objects.get(pk=criada.data['id'])
        self.assertEqual(norma.data_atualizacao, timezone.localdate())
        self.assertEqual(norma.emissor, 'Editor Normas')

    def test_nome_duplicado_na_mesma_filial_e_rejeitado(self):
        self.client.post(self.URL, _norma(), format='json', **_headers())
        repetida = self.client.post(self.URL, _norma(nome='iso 9001:2015'), format='json', **_headers())
        self.assertEqual(repetida.status_code, 400)
        self.assertIn('nome', repetida.data)
        outra_filial = self.client.post(self.URL, _norma(), format='json', **_headers(RONDONOPOLIS))
        self.assertEqual(outra_filial.status_code, 201, outra_filial.data)

    def test_sem_funcao_so_consulta(self):
        leitor = User.objects.create_user(
            username='sgq.normas.leitor', password='x', name='Leitor', role_id='2', status='ativo',
            environments=['SGQ'], filiais={'SGQ': [IBIPORA]}, funcoes={},
        )
        self.client.force_authenticate(leitor)
        self.assertEqual(self.client.get(self.URL, **_headers()).status_code, 200)
        self.assertEqual(self.client.post(self.URL, _norma(), format='json', **_headers()).status_code, 403)

class ItemNormaSGQTests(APITestCase):
    URL = '/api/sgq/normas-itens/'

    def setUp(self):
        self.gestor = User.objects.create_user(
            username='sgq.itens', password='x', name='Gestor Itens', role_id='2', status='ativo',
            environments=['SGQ'], filiais={'SGQ': [IBIPORA, RONDONOPOLIS]},
            funcoes={'SGQ': ['gerenciar-normas']},
        )
        self.client.force_authenticate(self.gestor)
        self.norma = self.client.post(
            '/api/sgq/normas/', _norma(classificacoes=_CLASSIFICACOES_SASSMAQ, areas=[_AREA_SS]), format='json', **_headers(),
        ).data['id']
        self.tipo_resposta = TipoRespostaSGQ.objects.create(
            filial=IBIPORA, sequencia=1, nome='Conformidade', opcoes=_OPCOES_CONFORMIDADE, emissor='X',
        )

    def _item(self, **overrides):
        data = {'normaId': self.norma, 'titulo': 'REQUISITO 1', 'tipo': 'orientativo'}
        data.update(overrides)
        return self.client.post(self.URL, data, format='json', **_headers())

    def _pergunta(self, **overrides):
        return self._item(titulo='Pergunta?', tipo='pergunta', tipoRespostaId=str(self.tipo_resposta.pk), **overrides)

    def test_cria_requisitos_e_subitens_em_ordem(self):
        r1 = self._item().data
        r2 = self._item(titulo='REQUISITO 2').data
        sub = self._pergunta(parentId=r1['id'], peso=2)
        self.assertEqual(sub.status_code, 201, sub.data)
        self.assertEqual((r1['ordem'], r2['ordem'], sub.data['ordem']), (0, 1, 0))
        self.assertEqual(sub.data['parentId'], r1['id'])
        self.assertEqual(sub.data['peso'], 2)
        self.assertEqual(sub.data['tipoRespostaId'], str(self.tipo_resposta.pk))

        arvore = self.client.get(self.URL, {'norma': self.norma}, **_headers())
        self.assertEqual(len(arvore.data), 3)

    def test_pergunta_exige_tipo_de_resposta_e_orientativo_limpa(self):
        sem_tipo = self._item(tipo='pergunta')
        self.assertEqual(sem_tipo.status_code, 400)
        self.assertIn('tipoRespostaId', sem_tipo.data)
        orientativo = self._item(tipoRespostaId=str(self.tipo_resposta.pk), classificacao='M', areas=['SS'])
        self.assertEqual(orientativo.status_code, 201, orientativo.data)
        self.assertEqual(
            (orientativo.data['tipoRespostaId'], orientativo.data['classificacao'], orientativo.data['areas']), (None, '', []),
        )

    def test_tipo_de_resposta_precisa_ser_da_filial_da_norma(self):
        de_fora = TipoRespostaSGQ.objects.create(
            filial=RONDONOPOLIS, sequencia=1, nome='Outra', opcoes=_OPCOES_CONFORMIDADE, emissor='X',
        )
        r = self._item(titulo='P?', tipo='pergunta', tipoRespostaId=str(de_fora.pk))
        self.assertEqual(r.status_code, 400)
        self.assertIn('tipoRespostaId', r.data)

    def test_classificacao_da_norma_e_critica_forca_obrigatorio(self):
        critica = self._pergunta(classificacao='m', areas=['ss', 'SS'], obrigatorio=False)
        self.assertEqual(critica.status_code, 201, critica.data)
        self.assertEqual((critica.data['classificacao'], critica.data['areas'], critica.data['obrigatorio']), ('M', ['SS'], True))
        area_inexistente = self._pergunta(areas=['XX'])
        self.assertEqual(area_inexistente.status_code, 400)
        self.assertIn('areas', area_inexistente.data)
        industria = self._pergunta(classificacao='I', obrigatorio=False)
        self.assertFalse(industria.data['obrigatorio'])
        inexistente = self._pergunta(classificacao='X')
        self.assertEqual(inexistente.status_code, 400)
        self.assertIn('classificacao', inexistente.data)

    def test_classificacao_em_uso_nao_sai_da_norma(self):
        self._pergunta(classificacao='I')
        url = f'/api/sgq/normas/{self.norma}/'
        sem_i = [c for c in _CLASSIFICACOES_SASSMAQ if c['sigla'] != 'I']
        bloqueada = self.client.patch(url, {'classificacoes': sem_i}, format='json', **_headers())
        self.assertEqual(bloqueada.status_code, 400)
        self.assertIn('classificacoes', bloqueada.data)
        sem_d = [c for c in _CLASSIFICACOES_SASSMAQ if c['sigla'] != 'D']
        self.assertEqual(self.client.patch(url, {'classificacoes': sem_d}, format='json', **_headers()).status_code, 200)

    def test_area_em_uso_nao_sai_da_norma(self):
        self._pergunta(areas=['SS'])
        url = f'/api/sgq/normas/{self.norma}/'
        bloqueada = self.client.patch(url, {'areas': []}, format='json', **_headers())
        self.assertEqual(bloqueada.status_code, 400)
        self.assertIn('areas', bloqueada.data)
        repetida = self.client.patch(url, {'areas': [_AREA_SS, {'sigla': 'ss', 'nome': 'Outra'}]}, format='json', **_headers())
        self.assertEqual(repetida.status_code, 400)
        mais_uma = self.client.patch(url, {'areas': [_AREA_SS, {'sigla': 'q', 'nome': 'Qualidade'}]}, format='json', **_headers())
        self.assertEqual(mais_uma.status_code, 200, mais_uma.data)
        self.assertEqual([a['sigla'] for a in mais_uma.data['areas']], ['SS', 'Q'])

    def test_tipos_de_resposta_da_norma(self):
        r = self.client.get(f'/api/sgq/normas/{self.norma}/tipos-resposta/', **_headers())
        self.assertEqual(r.status_code, 200)
        self.assertEqual([(t['id'], t['opcoes']) for t in r.data], [(str(self.tipo_resposta.pk), _OPCOES_CONFORMIDADE)])

    def test_nao_aceita_ciclo_nem_pai_de_outra_norma(self):
        r1 = self._item().data
        sub = self._item(titulo='Sub', parentId=r1['id']).data
        ciclo = self.client.patch(f"{self.URL}{r1['id']}/", {'parentId': sub['id']}, format='json', **_headers())
        self.assertEqual(ciclo.status_code, 400)
        outra = self.client.post('/api/sgq/normas/', _norma(nome='ISO 14001:2015'), format='json', **_headers()).data['id']
        cruzado = self.client.post(self.URL, {'normaId': outra, 'titulo': 'X', 'parentId': r1['id']}, format='json', **_headers())
        self.assertEqual(cruzado.status_code, 400)

    def test_mover_e_excluir_em_cascata(self):
        r1 = self._item().data
        r2 = self._item(titulo='REQUISITO 2').data
        self._item(titulo='Sub', parentId=r1['id'])
        self.client.post(f"{self.URL}{r2['id']}/mover/", {'direcao': 'cima'}, format='json', **_headers())
        titulos = [i['titulo'] for i in self.client.get(self.URL, {'norma': self.norma}, **_headers()).data if i['parentId'] is None]
        self.assertEqual(titulos, ['REQUISITO 2', 'REQUISITO 1'])
        self.client.delete(f"{self.URL}{r1['id']}/", **_headers())
        self.assertEqual(len(self.client.get(self.URL, {'norma': self.norma}, **_headers()).data), 1)

    def test_norma_de_outra_filial_fica_inacessivel(self):
        self._item()
        lista = self.client.get(self.URL, {'norma': self.norma}, **_headers(RONDONOPOLIS))
        self.assertEqual(lista.data, [])
        criar = self.client.post(self.URL, {'normaId': self.norma, 'titulo': 'X'}, format='json', **_headers(RONDONOPOLIS))
        self.assertEqual(criar.status_code, 400)

    def _planilha(self):
        import openpyxl
        from django.core.files.uploadedfile import SimpleUploadedFile

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(['Lista de Verificação'])
        cabecalho = ['AR', 'EC/RO', 'Requisito', 'Lista de verificação ', 'Guia de orientações', 'Tipo', 'AM1', 'SS', 'MA']
        ws.append(cabecalho)
        ws.append([None, None, '1', 'Gerenciamento'])
        ws.append([None, None, '1.1', 'Política Geral', 'Política Geral'])
        ws.append(['5.2.1', 'EC', '1.1.1', 'Há política formal?', 'Evidenciar a política.', 'M', '1', '1', None])
        ws.append(['9.3', 'EC', '1.1.2', 'Reuniões de análise crítica', None, *cabecalho[5:]])
        ws.append(['9.3', 'EC', '1.1.2.a', 'Constatações registradas?', 'Ver atas.', 'i - Indústria', None, '1', '1'])
        ws.append([None, None, None, 'NOTA: observação solta'])
        ws.append([None, None, '3.1', 'Capítulo sem pai na planilha', None, *cabecalho[5:]])
        buffer = BytesIO()
        wb.save(buffer)
        return SimpleUploadedFile('lista.xlsx', buffer.getvalue())

    def test_importa_lista_de_verificacao_em_arvore(self):
        url = f'/api/sgq/normas/{self.norma}/importar-itens/'
        previa = self.client.post(url, self._dados_importacao(dryRun='true'), format='multipart', **_headers())
        self.assertEqual(previa.status_code, 200, previa.data)
        self.assertEqual((previa.data['total'], previa.data['perguntas'], previa.data['requisitos']), (6, 3, 2))
        self.assertEqual(len(previa.data['linhasIgnoradas']), 1)
        self.assertEqual(previa.data['linhaCabecalho'], 2)
        papeis = {c['cabecalho']: c['papel'] for c in previa.data['colunas']}
        self.assertEqual(
            [papeis[h] for h in ('Requisito', 'Lista de verificação', 'Guia de orientações', 'Tipo', 'AM1', 'SS', 'MA')],
            ['codigo', 'titulo', 'descricao', 'classificacao', 'ignorar', 'area', 'ignorar'],
        )
        self.assertEqual((previa.data['porArea'], previa.data['areasNovas']), ({'SS': 2}, []))
        self.assertFalse(ItemNormaSGQ.objects.filter(norma_id=self.norma).exists())

        self._item(titulo='Já existente')
        r = self.client.post(url, self._dados_importacao(), format='multipart', **_headers())
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['porClassificacao'], {'M': 1, 'I': 1})
        itens = {i['codigo']: i for i in self.client.get(self.URL, {'norma': self.norma}, **_headers()).data}
        self.assertEqual(len(itens), 7)
        self.assertEqual(itens['1.1.2.a']['parentId'], itens['1.1.2']['id'])
        self.assertEqual(itens['1.1.2']['tipo'], 'orientativo')
        self.assertEqual((itens['1.1.1']['tipo'], itens['1.1.1']['tipoRespostaId']), ('pergunta', str(self.tipo_resposta.pk)))
        self.assertEqual((itens['1.1.1']['classificacao'], itens['1.1.1']['areas'], itens['1.1.1']['obrigatorio']), ('M', ['SS'], True))
        self.assertEqual((itens['1.1.2.a']['classificacao'], itens['1.1.2.a']['obrigatorio']), ('I', False))
        self.assertEqual((itens['3.1']['classificacao'], itens['3.1']['areas'], itens['3.1']['obrigatorio']), ('', [], True))
        self.assertEqual(itens['1.1.1']['descricao'], 'Evidenciar a política.')
        self.assertEqual(itens['1.1']['descricao'], '')
        self.assertEqual((itens['1']['ordem'], itens['3.1']['ordem']), (1, 2))

        substituir = self.client.post(url, self._dados_importacao(substituir='true'), format='multipart', **_headers())
        self.assertEqual(substituir.status_code, 200)
        self.assertEqual(ItemNormaSGQ.objects.filter(norma_id=self.norma).count(), 6)

    def _dados_importacao(self, **extra):
        return {'file': self._planilha(), 'tipoRespostaId': str(self.tipo_resposta.pk), **extra}

    def test_importacao_exige_tipo_de_resposta(self):
        url = f'/api/sgq/normas/{self.norma}/importar-itens/'
        sem_tipo = self.client.post(url, {'file': self._planilha()}, format='multipart', **_headers())
        self.assertEqual(sem_tipo.status_code, 400)
        self.assertIn('tipo de resposta', sem_tipo.data['detail'])

    def test_importacao_cria_as_classificacoes_novas_da_planilha(self):
        import json

        url = f'/api/sgq/normas/{self.norma}/importar-itens/'
        so_m = [c for c in _CLASSIFICACOES_SASSMAQ if c['sigla'] == 'M']
        self.client.patch(f'/api/sgq/normas/{self.norma}/', {'classificacoes': so_m}, format='json', **_headers())

        previa = self.client.post(url, self._dados_importacao(dryRun='true'), format='multipart', **_headers())
        self.assertEqual(previa.data['classificacoesNovas'], ['I'])

        sem_definir = self.client.post(url, self._dados_importacao(), format='multipart', **_headers())
        self.assertEqual(sem_definir.status_code, 400)
        self.assertIn('I', sem_definir.data['detail'])
        self.assertFalse(ItemNormaSGQ.objects.filter(norma_id=self.norma).exists())

        invalida = [{'sigla': 'I', 'nome': 'Indústria', 'metaPrimeira': 150}]
        r = self.client.post(url, self._dados_importacao(classificacoes=json.dumps(invalida)), format='multipart', **_headers())
        self.assertEqual(r.status_code, 400)

        industria = [c for c in _CLASSIFICACOES_SASSMAQ if c['sigla'] == 'I']
        r = self.client.post(url, self._dados_importacao(classificacoes=json.dumps(industria)), format='multipart', **_headers())
        self.assertEqual(r.status_code, 200, r.data)
        norma = NormaSGQ.objects.get(pk=self.norma)
        self.assertEqual([c['sigla'] for c in norma.classificacoes], ['M', 'I'])
        self.assertEqual(norma.classificacao_por_sigla('I')['metaReavaliacao'], 85)
        self.assertEqual(ItemNormaSGQ.objects.get(norma=norma, codigo='1.1.2.a').classificacao, 'I')

    def test_mapeamento_de_colunas_cria_areas_e_fica_salvo_na_norma(self):
        import json

        url = f'/api/sgq/normas/{self.norma}/importar-itens/'
        colunas = self.client.post(url, self._dados_importacao(dryRun='true'), format='multipart', **_headers()).data['colunas']
        indice = {c['cabecalho']: c['indice'] for c in colunas}
        mapeamento = json.dumps([{'indice': indice['MA'], 'papel': 'area', 'area': 'MA'}])

        previa = self.client.post(url, self._dados_importacao(dryRun='true', mapeamento=mapeamento), format='multipart', **_headers())
        self.assertEqual((previa.data['porArea'], previa.data['areasNovas']), ({'SS': 2, 'MA': 1}, ['MA']))
        sem_definir = self.client.post(url, self._dados_importacao(mapeamento=mapeamento), format='multipart', **_headers())
        self.assertEqual(sem_definir.status_code, 400)

        areas = json.dumps([{'sigla': 'MA', 'nome': 'Meio Ambiente'}])
        r = self.client.post(url, self._dados_importacao(mapeamento=mapeamento, areas=areas), format='multipart', **_headers())
        self.assertEqual(r.status_code, 200, r.data)
        norma = NormaSGQ.objects.get(pk=self.norma)
        self.assertEqual(norma.areas, [_AREA_SS, {'sigla': 'MA', 'nome': 'Meio Ambiente'}])
        self.assertEqual(ItemNormaSGQ.objects.get(norma=norma, codigo='1.1.2.a').areas, ['SS', 'MA'])

        reaproveitado = self.client.post(url, self._dados_importacao(dryRun='true'), format='multipart', **_headers())
        self.assertEqual({c['cabecalho']: c['papel'] for c in reaproveitado.data['colunas']}['MA'], 'area')

        duas_de_codigo = json.dumps([{'indice': indice['AM1'], 'papel': 'codigo'}])
        erro = self.client.post(url, self._dados_importacao(dryRun='true', mapeamento=duas_de_codigo), format='multipart', **_headers())
        self.assertEqual(erro.status_code, 400)
        self.assertIn('Só uma coluna', erro.data['detail'])

    def test_planilha_com_cabecalho_desconhecido_pede_o_mapeamento(self):
        import json

        import openpyxl
        from django.core.files.uploadedfile import SimpleUploadedFile

        wb = openpyxl.Workbook()
        wb.active.append(['Coluna A', 'Coluna B'])
        wb.active.append(['1', 'Pergunta única?'])
        buffer = BytesIO()
        wb.save(buffer)
        url = f'/api/sgq/normas/{self.norma}/importar-itens/'

        def enviar(**extra):
            arquivo = SimpleUploadedFile('x.xlsx', buffer.getvalue())
            dados = {'file': arquivo, 'tipoRespostaId': str(self.tipo_resposta.pk), **extra}
            return self.client.post(url, dados, format='multipart', **_headers())

        previa = enviar(dryRun='true')
        self.assertEqual(previa.status_code, 200)
        self.assertIn('código do item', previa.data['pendencia'])
        self.assertEqual(enviar().status_code, 400)

        mapeamento = json.dumps([{'indice': 0, 'papel': 'codigo'}, {'indice': 1, 'papel': 'titulo'}])
        r = enviar(mapeamento=mapeamento)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['perguntas'], 1)

    def test_modelo_de_requisitos_serve_para_iso_e_sassmaq(self):
        import openpyxl
        from django.core.files.uploadedfile import SimpleUploadedFile

        from .norma_itens_import_service import COLUNAS_MODELO_ITENS

        resposta = self.client.get('/api/sgq/normas/exportar-modelo-itens/', **_headers())
        self.assertEqual(resposta.status_code, 200)
        self.assertIn('spreadsheet', resposta['Content-Type'])
        wb = openpyxl.load_workbook(BytesIO(resposta.content))
        self.assertEqual(wb.sheetnames, ['Lista', 'Exemplo ISO 9001', 'Exemplo SASSMAQ', 'Instruções'])
        self.assertEqual([celula.value for celula in wb['Lista'][1]], list(COLUNAS_MODELO_ITENS))
        self.assertEqual(wb['Lista'].max_row, 1)

        def arquivo_da_aba(nome: str):
            origem = wb[nome]
            novo = openpyxl.Workbook()
            destino = novo.active
            for linha in origem.iter_rows(values_only=True):
                destino.append(list(linha))
            buffer = BytesIO()
            novo.save(buffer)
            return SimpleUploadedFile(f'{nome}.xlsx', buffer.getvalue())

        url = f'/api/sgq/normas/{self.norma}/importar-itens/'
        iso = self.client.post(
            url,
            {'file': arquivo_da_aba('Exemplo ISO 9001'), 'tipoRespostaId': str(self.tipo_resposta.pk), 'dryRun': 'true'},
            format='multipart',
            **_headers(),
        )
        self.assertEqual(iso.status_code, 200, iso.data)
        self.assertEqual((iso.data['orientativos'], iso.data['perguntas']), (2, 3))
        self.assertEqual(iso.data['porClassificacao'], {})
        self.assertEqual(iso.data['porArea'], {})

        sassmaq = self.client.post(
            url,
            {'file': arquivo_da_aba('Exemplo SASSMAQ'), 'tipoRespostaId': str(self.tipo_resposta.pk), 'dryRun': 'true'},
            format='multipart',
            **_headers(),
        )
        self.assertEqual(sassmaq.status_code, 200, sassmaq.data)
        self.assertEqual(sassmaq.data['porClassificacao'], {'M': 1, 'I': 1, 'D': 1})
        self.assertEqual(sassmaq.data['porArea'], {'SS': 1})

        sem_funcao = User.objects.create_user(
            username='sgq.sem.modelo', password='x', name='Sem Função', role_id='2', status='ativo',
            environments=['SGQ'], filiais={'SGQ': [IBIPORA]}, funcoes={},
        )
        self.client.force_authenticate(sem_funcao)
        negado = self.client.get('/api/sgq/normas/exportar-modelo-itens/', **_headers())
        self.assertEqual(negado.status_code, 403)


class AuditoriasIniciaisTests(APITestCase):
    def test_importa_o_cadastro_uma_vez_sem_repetir(self):
        call_command('importar_auditorias_iniciais')
        self.assertEqual(NormaSGQ.objects.count(), 3)
        self.assertGreater(ItemNormaSGQ.objects.count(), 2000)
        antes = ItemNormaSGQ.objects.count()
        call_command('importar_auditorias_iniciais')
        self.assertEqual(ItemNormaSGQ.objects.count(), antes)
        self.assertEqual(TipoRespostaSGQ.objects.count(), 2)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class ExecucaoAuditoriaSGQTests(APITestCase):
    URL = '/api/sgq/auditorias/'

    def setUp(self):
        self.auditor = User.objects.create_user(
            username='sgq.executor', password='x', name='Auditor Campo', role_id='2', status='ativo',
            environments=['SGQ'], filiais={'SGQ': [IBIPORA]}, funcoes={'SGQ': ['executar-auditorias']},
        )
        self.norma = NormaSGQ.objects.create(
            filial=IBIPORA, nome='SASSMAQ', data_atualizacao='2026-10-01', emissor='X',
            classificacoes=_CLASSIFICACOES_SASSMAQ, areas=[_AREA_SS],
        )
        tipo = TipoRespostaSGQ.objects.create(
            filial=IBIPORA, sequencia=1, nome='Sim/Não/X',
            opcoes=[
                {'codigo': '1', 'texto': 'Sim', 'valor': 100, 'exigeJustificativa': False},
                {'codigo': '0', 'texto': 'Não', 'valor': 0, 'exigeJustificativa': False},
                {'codigo': 'X', 'texto': 'Não aplicável', 'valor': None, 'exigeJustificativa': True},
            ],
        )
        raiz = ItemNormaSGQ.objects.create(norma=self.norma, titulo='Gerenciamento', codigo='1')
        self.pergunta = ItemNormaSGQ.objects.create(
            norma=self.norma, parent=raiz, codigo='1.1', titulo='Há política?', tipo='pergunta',
            tipo_resposta=tipo, classificacao='M', areas=['SS'],
        )
        self.auditoria = AuditoriaSGQ.objects.create(
            filial=IBIPORA, ano=2026, sequencia=1, codigo='26-00001', categoria='Interna', titulo='SASSMAQ 2026',
            data_inicio='2026-10-01', data_termino='2026-10-30', auditor_lider='Ana', status='planejamento',
        )
        self.auditoria.normas.add(self.norma)
        self.base = f'{self.URL}{self.auditoria.pk}/'
        self.client.force_authenticate(self.auditor)

    def _responder(self, **dados):
        return self.client.post(
            f'{self.base}responder/', {'itemId': str(self.pergunta.pk), **dados}, format='json', **_headers(),
        )

    def test_visao_conta_status_atraso_do_semestre_e_nao_conformidade(self):
        hoje = timezone.localdate()
        inicio = hoje.replace(month=1 if hoje.month <= 6 else 7, day=1)
        termo = max(inicio, hoje - timedelta(days=1))
        AuditoriaSGQ.objects.filter(pk=self.auditoria.pk).update(status='execucao', data_termino=termo)
        self._responder(opcaoCodigo='0')
        resposta = self.client.get(f'{self.URL}visao/', **_headers())
        self.assertEqual(resposta.status_code, 200, resposta.data)
        self.assertEqual(resposta.data['execucao'], 1)
        self.assertEqual(resposta.data['ocorrencias'], [{'label': 'SASSMAQ 2026', 'valor': 1}])
        self.assertEqual(resposta.data['atrasadas'], 1 if termo < hoje else 0)
        self.assertIn(str(hoje.year), resposta.data['semestre'])

    def test_lista_traz_progresso_do_questionario(self):
        outra = ItemNormaSGQ.objects.create(
            norma=self.norma, parent=self.pergunta.parent, codigo='1.2', titulo='Há procedimento?',
            tipo='pergunta', tipo_resposta=self.pergunta.tipo_resposta, classificacao='M', areas=['SS'],
        )
        self._responder(opcaoCodigo='1')
        RespostaAuditoriaSGQ.objects.create(auditoria=self.auditoria, item=outra, opcao_codigo='', observacoes='só anexo')
        lista = self.client.get(self.URL, **_headers())
        self.assertEqual(lista.status_code, 200)
        item = next(a for a in lista.data['results'] if a['id'] == str(self.auditoria.pk))
        self.assertEqual((item['totalPerguntas'], item['perguntasRespondidas']), (2, 1))

    def test_execucao_traz_perguntas_tipos_e_respostas(self):
        self._responder(opcaoCodigo='1', destaque='forte')
        r = self.client.get(f'{self.base}execucao/', **_headers())
        self.assertEqual(r.status_code, 200)
        self.assertEqual([i['codigo'] for i in r.data['itens']], ['1', '1.1'])
        self.assertEqual(r.data['normas'][0]['areas'], [_AREA_SS])
        self.assertEqual(len(r.data['tiposResposta'][0]['opcoes']), 3)
        self.assertEqual(r.data['respostas'][0]['opcaoTexto'], 'Sim')
        self.assertEqual(r.data['respostas'][0]['destaque'], 'forte')

    def test_responde_copia_opcao_inicia_execucao_e_exige_justificativa(self):
        r = self._responder(opcaoCodigo='0', observacoes='Sem política escrita', destaque='fraco')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data['opcaoCodigo'], r.data['opcaoTexto'], r.data['valor']), ('0', 'Não', 0))
        self.assertEqual(r.data['respondidoPor'], 'Auditor Campo')
        self.auditoria.refresh_from_db()
        self.assertEqual(self.auditoria.status, 'execucao')

        sem_justificativa = self._responder(opcaoCodigo='x')
        self.assertEqual(sem_justificativa.status_code, 400)
        self.assertIn('observacoes', sem_justificativa.data)
        na = self._responder(opcaoCodigo='x', observacoes='Não transporta a granel')
        self.assertEqual((na.data['opcaoCodigo'], na.data['valor']), ('X', None))
        self.assertEqual(RespostaAuditoriaSGQ.objects.count(), 1)

        self.assertEqual(self._responder(opcaoCodigo='9').status_code, 400)
        self.assertEqual(self._responder(destaque='otimo').status_code, 400)
        orientativo = self.client.post(
            f'{self.base}responder/', {'itemId': str(self.pergunta.parent_id), 'opcaoCodigo': '1'}, format='json', **_headers(),
        )
        self.assertEqual(orientativo.status_code, 400)

    def test_anexos_incluir_baixar_excluir(self):
        envio = self.client.post(
            f'{self.base}anexos/',
            {'itemId': str(self.pergunta.pk), 'arquivo': SimpleUploadedFile('evidencia.pdf', b'%PDF-1.4 teste')},
            format='multipart', **_headers(),
        )
        self.assertEqual(envio.status_code, 200, envio.data)
        anexo = envio.data['anexos'][0]
        self.assertEqual((anexo['nome'], anexo['incluidoPor']), ('evidencia.pdf', 'Auditor Campo'))
        self.assertEqual(envio.data['opcaoCodigo'], '')

        baixado = self.client.get(f"{self.base}anexos/{anexo['id']}/", **_headers())
        self.assertEqual(baixado.status_code, 200)
        self.assertEqual(b''.join(baixado.streaming_content), b'%PDF-1.4 teste')

        invalido = self.client.post(
            f'{self.base}anexos/',
            {'itemId': str(self.pergunta.pk), 'arquivo': SimpleUploadedFile('script.exe', b'x')},
            format='multipart', **_headers(),
        )
        self.assertEqual(invalido.status_code, 400)

        excluido = self.client.delete(f"{self.base}anexos/{anexo['id']}/", **_headers())
        self.assertEqual(excluido.status_code, 200)
        self.assertEqual(excluido.data['anexos'], [])

    def test_concluida_bloqueia_e_permissoes(self):
        AuditoriaSGQ.objects.filter(pk=self.auditoria.pk).update(status='concluida')
        self.assertEqual(self._responder(opcaoCodigo='1').status_code, 400)

        AuditoriaSGQ.objects.filter(pk=self.auditoria.pk).update(status='execucao')
        self.assertEqual(self.client.patch(self.base, {'titulo': 'Outro'}, format='json', **_headers()).status_code, 403)
        leitor = User.objects.create_user(
            username='sgq.so.leitura', password='x', name='Leitor', role_id='2', status='ativo',
            environments=['SGQ'], filiais={'SGQ': [IBIPORA]}, funcoes={},
        )
        self.client.force_authenticate(leitor)
        self.assertEqual(self.client.get(f'{self.base}execucao/', **_headers()).status_code, 200)
        self.assertEqual(self._responder(opcaoCodigo='1').status_code, 403)

    def test_perguntas_respondidas_protegem_norma_e_itens(self):
        self._responder(opcaoCodigo='1')
        gestor = User.objects.create_user(
            username='sgq.gestor.normas', password='x', name='Gestor', role_id='2', status='ativo',
            environments=['SGQ'], filiais={'SGQ': [IBIPORA]}, funcoes={'SGQ': ['gerenciar-normas']},
        )
        self.client.force_authenticate(gestor)
        item = self.client.delete(f'/api/sgq/normas-itens/{self.pergunta.parent_id}/', **_headers())
        self.assertEqual(item.status_code, 400)
        norma = self.client.delete(f'/api/sgq/normas/{self.norma.pk}/', **_headers())
        self.assertEqual(norma.status_code, 400)
        self.assertTrue(ItemNormaSGQ.objects.filter(pk=self.pergunta.pk).exists())
