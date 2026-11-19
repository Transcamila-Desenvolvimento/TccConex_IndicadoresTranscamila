from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.sgq.models import AuditoriaSGQ, ItemNormaSGQ, NormaSGQ, RespostaAuditoriaSGQ, TipoRespostaSGQ

User = get_user_model()

IBIPORA = 'Ibiporã (Matriz)'
RONDONOPOLIS = 'Rondonópolis'


@override_settings(GEMINI_API_KEY='')
class AuditoriaConversaTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.auditor = User.objects.create_user(
            username='camilo.auditor',
            password='test123',
            name='Auditor',
            role_id='2',
            status='ativo',
            environments=['CamiloIA', 'SGQ'],
            abas={'SGQ': ['home', 'auditorias', 'auditorias-minhas-acoes']},
            filiais={'SGQ': [IBIPORA]},
            funcoes={'SGQ': ['executar-auditorias']},
        )
        self.tipo = TipoRespostaSGQ.objects.create(
            filial=IBIPORA, sequencia=1, nome='Sim/Não/X',
            opcoes=[
                {'codigo': '1', 'texto': 'Sim', 'valor': 100, 'exigeJustificativa': False},
                {'codigo': '0', 'texto': 'Não', 'valor': 0, 'exigeJustificativa': False},
                {'codigo': 'X', 'texto': 'Não aplicável', 'valor': None, 'exigeJustificativa': True},
            ],
        )
        self.norma = NormaSGQ.objects.create(
            filial=IBIPORA, nome='SASSMAQ', data_atualizacao='2026-10-01', emissor='X',
        )
        raiz = ItemNormaSGQ.objects.create(norma=self.norma, titulo='Gerenciamento', codigo='1')
        self.primeira = ItemNormaSGQ.objects.create(
            norma=self.norma, parent=raiz, codigo='1.1', titulo='Há política?', tipo='pergunta',
            tipo_resposta=self.tipo,
        )
        self.segunda = ItemNormaSGQ.objects.create(
            norma=self.norma, parent=raiz, codigo='1.2', titulo='Há procedimento?', tipo='pergunta',
            tipo_resposta=self.tipo,
        )
        self.aberta = AuditoriaSGQ.objects.create(
            filial=IBIPORA, ano=2026, sequencia=1, codigo='26-00001', categoria='Interna',
            titulo='SASSMAQ 2026', data_inicio='2026-10-01', data_termino='2026-10-30',
            auditor_lider='Ana', status='planejamento',
        )
        self.aberta.escopo = 'Transporte de produto químico perigoso.'
        self.aberta.metodologia = 'Entrevistas com os responsáveis e leitura de registros.'
        self.aberta.planejamento = [{
            'data': '2026-10-02', 'horaInicio': '08:00', 'horaFim': '09:00', 'atividade': 'Reunião de abertura',
        }]
        self.aberta.save()
        self.aberta.normas.add(self.norma)
        self.primeira.descricao = 'A unidade precisa manter a política de segurança publicada.'
        self.primeira.save(update_fields=['descricao'])
        RespostaAuditoriaSGQ.objects.create(
            auditoria=self.aberta,
            item=self.primeira,
            opcao_codigo='1',
            opcao_texto='Sim',
            observacoes='A política está publicada no mural da unidade.',
            respondido_por=self.auditor,
        )
        AuditoriaSGQ.objects.create(
            filial=IBIPORA, ano=2026, sequencia=2, codigo='26-00002', categoria='Interna',
            titulo='ISO da filial', data_inicio='2026-09-01', data_termino='2026-10-30',
            auditor_lider='Ana', status='execucao',
        )
        AuditoriaSGQ.objects.create(
            filial=IBIPORA, ano=2026, sequencia=3, codigo='26-00003', categoria='Interna',
            titulo='Já fechada', data_inicio='2026-08-01', data_termino='2026-08-30',
            auditor_lider='Ana', status='concluida',
        )
        AuditoriaSGQ.objects.create(
            filial=RONDONOPOLIS, ano=2026, sequencia=9, codigo='26-00009', categoria='Interna',
            titulo='Outra filial', data_inicio='2026-10-01', data_termino='2026-10-30',
            auditor_lider='Ana', status='planejamento',
        )
        self.client.force_authenticate(user=self.auditor)
        criado = self.client.post('/api/camilo/agentes/', {
            'nome': 'Auditor',
            'instrucao': 'Consultar auditorias',
            'escopos': [{'ambiente': 'SGQ', 'parte': 'auditorias'}],
        }, format='json')
        self.assertEqual(criado.status_code, 201, criado.content)
        self.url = f"/api/camilo/agentes/{criado.json()['id']}/consultar/"
        self.historico = []

    def falar(self, texto, voz=True):
        resposta = self.client.post(self.url, {
            'pergunta': texto,
            'historico': self.historico,
            'voz': voz,
        }, format='json')
        self.assertEqual(resposta.status_code, 200, resposta.content)
        corpo = resposta.json()
        self.historico.append({'papel': 'user', 'texto': texto})
        self.historico.append({'papel': 'assistant', 'texto': corpo['resposta']})
        return corpo['resposta']

    def test_parte_aparece_para_quem_tem_auditorias_ou_questionario(self):
        partes = self.client.get('/api/camilo/partes/')
        chaves = [
            item['parte']
            for grupo in partes.json()['grupos']
            for item in grupo['partes']
        ]
        self.assertIn('auditorias', chaves)

        so_questionario = User.objects.create_user(
            username='camilo.questionario',
            password='test123',
            name='Questionário',
            role_id='2',
            status='ativo',
            environments=['CamiloIA', 'SGQ'],
            abas={'SGQ': ['home', 'auditorias-minhas-acoes']},
            filiais={'SGQ': [IBIPORA]},
        )
        self.client.force_authenticate(user=so_questionario)
        partes = self.client.get('/api/camilo/partes/')
        chaves = [
            item['parte']
            for grupo in partes.json()['grupos']
            for item in grupo['partes']
        ]
        self.assertIn('auditorias', chaves)
        self.assertNotIn('normas', chaves)

    def test_consulta_le_registro_planejamento_resposta_e_observacao(self):
        texto = self.falar(
            'Qual a observação, o planejamento e o escopo da auditoria 26-00001?',
            voz=False,
        )
        self.assertIn('publicada no mural', texto)
        self.assertIn('Reunião de abertura', texto)
        self.assertIn('produto químico', texto)
        self.assertIn('Sim', texto)
        self.aberta.refresh_from_db()
        self.assertEqual(self.aberta.status, 'planejamento')
        self.assertEqual(RespostaAuditoriaSGQ.objects.count(), 1)

    def test_pedido_de_resolver_nao_grava_nem_conclui(self):
        antes = RespostaAuditoriaSGQ.objects.count()
        texto = self.falar('Queria resolver minha auditoria e marcar as respostas', voz=False)
        self.assertNotIn('Como você responde?', texto)
        self.assertNotIn('Qual delas você quer continuar?', texto)
        self.aberta.refresh_from_db()
        self.assertEqual(self.aberta.status, 'planejamento')
        self.assertEqual(RespostaAuditoriaSGQ.objects.count(), antes)

    def test_normas_liberam_a_leitura_do_texto(self):
        self.auditor.abas = {'SGQ': ['home', 'auditorias', 'auditorias-normas']}
        self.auditor.save(update_fields=['abas'])
        partes = self.client.get('/api/camilo/partes/')
        chaves = [
            item['parte']
            for grupo in partes.json()['grupos']
            for item in grupo['partes']
        ]
        self.assertIn('normas', chaves)
        criado = self.client.post('/api/camilo/agentes/', {
            'nome': 'Normas',
            'instrucao': 'Consultar normas',
            'escopos': [{'ambiente': 'SGQ', 'parte': 'normas'}],
        }, format='json')
        self.assertEqual(criado.status_code, 201, criado.content)
        resposta = self.client.post(
            f"/api/camilo/agentes/{criado.json()['id']}/consultar/",
            {'pergunta': 'O que a norma SASSMAQ diz sobre política?'},
            format='json',
        )
        self.assertEqual(resposta.status_code, 200, resposta.content)
        self.assertIn('Há política?', resposta.json()['resposta'])
        self.assertIn('publicada', resposta.json()['resposta'])

    def _agente_de_normas(self):
        self.auditor.abas = {'SGQ': ['home', 'auditorias', 'auditorias-normas']}
        self.auditor.save(update_fields=['abas'])
        criado = self.client.post('/api/camilo/agentes/', {
            'nome': 'Normas',
            'instrucao': 'Consultar normas',
            'escopos': [{'ambiente': 'SGQ', 'parte': 'normas'}],
        }, format='json')
        self.assertEqual(criado.status_code, 201, criado.content)
        return f"/api/camilo/agentes/{criado.json()['id']}/consultar/"

    def test_varias_normas_pede_qual_consultar_mesmo_com_uma_ativa(self):
        NormaSGQ.objects.create(
            filial=IBIPORA, nome='ISO 9001', data_atualizacao='2026-10-01', emissor='X', ativa=False,
            descricao='Item secreto da ISO que não deve aparecer antes da escolha.',
        )
        url = self._agente_de_normas()
        resposta = self.client.post(url, {
            'pergunta': 'Quais itens da norma estão relacionados com o meio ambiente?',
        }, format='json')
        self.assertEqual(resposta.status_code, 200, resposta.content)
        texto = resposta.json()['resposta']
        self.assertIn('qual consultar', texto)
        self.assertIn('SASSMAQ', texto)
        self.assertIn('ISO 9001', texto)
        self.assertIn('(ativa)', texto)
        self.assertIn('(inativa)', texto)
        self.assertIn('Só uma está ativa.', texto)
        self.assertNotIn('Há política?', texto)
        self.assertNotIn('secreto da ISO', texto)

    def test_norma_nomeada_responde_mesmo_com_outras_cadastradas(self):
        NormaSGQ.objects.create(
            filial=IBIPORA, nome='ISO 9001', data_atualizacao='2026-10-01', emissor='X', ativa=False,
            descricao='Segredo da ISO.',
        )
        url = self._agente_de_normas()
        resposta = self.client.post(url, {
            'pergunta': 'O que a norma SASSMAQ diz sobre política?',
        }, format='json')
        self.assertEqual(resposta.status_code, 200, resposta.content)
        texto = resposta.json()['resposta']
        self.assertIn('Há política?', texto)
        self.assertNotIn('Segredo da ISO', texto)
        self.assertNotIn('qual consultar', texto)

    def test_escolha_da_norma_ativa_libera_so_ela(self):
        NormaSGQ.objects.create(
            filial=IBIPORA, nome='ISO 9001', data_atualizacao='2026-10-01', emissor='X', ativa=False,
            descricao='Segredo da ISO.',
        )
        url = self._agente_de_normas()
        primeira = self.client.post(url, {
            'pergunta': 'O que a norma diz sobre política?',
        }, format='json')
        self.assertIn('qual consultar', primeira.json()['resposta'])
        segunda = self.client.post(url, {
            'pergunta': 'A norma ativa.',
            'historico': [
                {'papel': 'user', 'texto': 'O que a norma diz sobre política?'},
                {'papel': 'assistant', 'texto': primeira.json()['resposta']},
            ],
        }, format='json')
        self.assertEqual(segunda.status_code, 200, segunda.content)
        texto = segunda.json()['resposta']
        self.assertIn('Há política?', texto)
        self.assertNotIn('Segredo da ISO', texto)

    def test_edicao_e_area_contam_as_perguntas_de_meio_ambiente(self):
        areas = [
            {'sigla': 'MA', 'nome': 'Meio Ambiente'},
            {'sigla': 'SS', 'nome': 'Saúde e Segurança'},
        ]
        terceira = NormaSGQ.objects.create(
            filial=IBIPORA, nome='SASSMAQ Rodoviário 3ª edição', data_atualizacao='2026-10-01',
            emissor='X', areas=areas,
        )
        quarta = NormaSGQ.objects.create(
            filial=IBIPORA, nome='SASSMAQ Rodoviário 4ª edição', data_atualizacao='2026-10-01',
            emissor='X', areas=areas,
        )
        for titulo in ('Licença da unidade', 'Resíduos da operação'):
            ItemNormaSGQ.objects.create(
                norma=terceira, titulo=titulo, tipo='pergunta', areas=['MA'],
            )
        ItemNormaSGQ.objects.create(
            norma=terceira, titulo='Texto orientativo de meio ambiente', tipo='orientativo', areas=['MA'],
        )
        ItemNormaSGQ.objects.create(
            norma=terceira, titulo='Uso de EPI', tipo='pergunta', areas=['SS'],
        )
        ItemNormaSGQ.objects.create(
            norma=quarta, titulo='Pergunta só da quarta', tipo='pergunta', areas=['MA'],
        )
        url = self._agente_de_normas()
        primeira = self.client.post(url, {
            'pergunta': 'Quantas perguntas relacionadas ao meio ambiente tem na norma?',
        }, format='json')
        self.assertIn('qual consultar', primeira.json()['resposta'])
        segunda = self.client.post(url, {
            'pergunta': 'A SASSMAQ 3 edição',
            'historico': [
                {'papel': 'user', 'texto': 'Quantas perguntas relacionadas ao meio ambiente tem na norma?'},
                {'papel': 'assistant', 'texto': primeira.json()['resposta']},
            ],
        }, format='json')
        self.assertEqual(segunda.status_code, 200, segunda.content)
        texto = segunda.json()['resposta']
        self.assertIn('SASSMAQ Rodoviário 3ª edição: 2 perguntas da área Meio Ambiente (MA).', texto)
        self.assertNotIn('Pergunta só da quarta', texto)
        self.assertNotIn('qual consultar', texto)
        self.assertNotIn('nenhuma fala sobre isso', texto)

    def test_tabela_traz_a_lista_completa_da_area(self):
        terceira = NormaSGQ.objects.create(
            filial=IBIPORA, nome='SASSMAQ Rodoviário 3ª edição', data_atualizacao='2026-10-01',
            emissor='X', areas=[{'sigla': 'MA', 'nome': 'Meio Ambiente'}],
        )
        for numero in range(1, 32):
            ItemNormaSGQ.objects.create(
                norma=terceira,
                codigo=f'9.{numero}',
                titulo=f'Pergunta MA {numero:02d} ' + ('detalhe ' * 40),
                tipo='pergunta',
                areas=['MA'],
            )
        url = self._agente_de_normas()
        resposta = self.client.post(url, {
            'pergunta': 'A SASSMAQ 3 edição. Faça uma tabela com todas as perguntas de meio ambiente.',
        }, format='json')
        self.assertEqual(resposta.status_code, 200, resposta.content)
        texto = resposta.json()['resposta']
        self.assertIn('LISTA COMPLETA', texto)
        self.assertIn('31 perguntas da área Meio Ambiente (MA).', texto)
        self.assertIn('Pergunta MA 01', texto)
        self.assertIn('Pergunta MA 31', texto)
        self.assertNotIn('não listadas', texto)

    def test_agente_sem_a_parte_nao_le_a_auditoria(self):
        self.auditor.abas = {'SGQ': ['home', 'pesquisa-satisfacao', 'auditorias']}
        self.auditor.save(update_fields=['abas'])
        criado = self.client.post('/api/camilo/agentes/', {
            'nome': 'Pesquisa',
            'instrucao': '',
            'escopos': [{'ambiente': 'SGQ', 'parte': 'pesquisa-satisfacao'}],
        }, format='json')
        self.assertEqual(criado.status_code, 201, criado.content)
        resposta = self.client.post(
            f"/api/camilo/agentes/{criado.json()['id']}/consultar/",
            {'pergunta': 'Quero dar andamento na minha auditoria'},
            format='json',
        )
        self.assertEqual(resposta.status_code, 200, resposta.content)
        self.assertNotIn('Como você responde?', resposta.json()['resposta'])
        self.assertNotIn('publicada no mural', resposta.json()['resposta'])
        self.assertEqual(RespostaAuditoriaSGQ.objects.count(), 1)
