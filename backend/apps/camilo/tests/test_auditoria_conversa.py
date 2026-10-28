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
        self.aberta.normas.add(self.norma)
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
            'instrucao': 'Conduzir o questionário',
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

    def test_conversa_grava_resposta_ponto_forte_e_segue_o_questionario(self):
        abertura = self.falar('Quero dar andamento na minha auditoria')
        self.assertIn('26-00001', abertura)
        self.assertIn('26-00002', abertura)
        self.assertNotIn('26-00003', abertura)
        self.assertNotIn('26-00009', abertura)
        self.assertIn('Qual delas você quer continuar?', abertura)

        pergunta = self.falar('a primeira')
        self.assertIn('Há política?', pergunta)
        self.assertIn('Como você responde?', pergunta)
        self.assertIn('Sim', pergunta)

        self.falar('Sim')
        self.aberta.refresh_from_db()
        self.assertEqual(self.aberta.status, 'execucao')
        salva = RespostaAuditoriaSGQ.objects.get(auditoria=self.aberta, item=self.primeira)
        self.assertEqual(salva.opcao_texto, 'Sim')
        self.assertEqual(salva.respondido_por, self.auditor)

        marcada = self.falar('ponto forte')
        self.assertIn('Marquei como ponto forte', marcada)
        salva.refresh_from_db()
        self.assertEqual(salva.destaque, 'forte')

        seguinte = self.falar('próxima')
        self.assertIn('Há procedimento?', seguinte)

        pedido = self.falar('Não aplicável')
        self.assertIn('Pode falar a observação.', pedido)
        self.assertFalse(
            RespostaAuditoriaSGQ.objects.filter(auditoria=self.aberta, item=self.segunda).exclude(opcao_codigo='').exists()
        )

        self.falar('A unidade não tem essa operação.')
        segunda = RespostaAuditoriaSGQ.objects.get(auditoria=self.aberta, item=self.segunda)
        self.assertEqual(segunda.opcao_texto, 'Não aplicável')
        self.assertEqual(segunda.observacoes, 'A unidade não tem essa operação.')
        self.assertIsNone(segunda.valor)

        anexo = self.falar('quero anexar')
        self.assertIn('não recebo arquivo', anexo)

        fim = self.falar('próxima')
        self.assertIn('está completo', fim)
        self.assertEqual(
            RespostaAuditoriaSGQ.objects.filter(auditoria=self.aberta).exclude(opcao_codigo='').count(),
            2,
        )

    def test_texto_reconhece_continuidade_da_auditoria(self):
        abertura = self.falar('Quero dar continuidade na minha auditoria', voz=False)
        self.assertIn('26-00001', abertura)
        self.assertIn('Qual delas você quer continuar?', abertura)
        self.assertNotIn('Matriz', abertura)

    def test_texto_resolver_auditoria_abre_o_questionario(self):
        abertura = self.falar('Queria resolver minha auditoria', voz=False)
        self.assertIn('26-00001', abertura)
        self.assertIn('Qual delas você quer continuar?', abertura)
        self.assertNotIn('Matriz', abertura)

    def test_pergunta_de_documento_nao_abre_o_questionario(self):
        abertura = self.falar('Tem procedimento de auditoria na matriz?', voz=False)
        self.assertNotIn('Qual delas você quer continuar?', abertura)

    def test_sim_com_ruido_de_voz_continua_a_auditoria(self):
        AuditoriaSGQ.objects.filter(codigo='26-00002').update(status='concluida')
        self.falar('Quero dar andamento na minha auditoria')
        pergunta = self.falar('sim não passa não direito mano')
        self.assertIn('Há política?', pergunta)
        self.assertNotIn('Quando quiser retomar', pergunta)

    def test_nao_sozinho_interrompe(self):
        AuditoriaSGQ.objects.filter(codigo='26-00002').update(status='concluida')
        self.falar('Quero dar andamento na minha auditoria')
        resposta = self.falar('não')
        self.assertIn('Quando quiser retomar', resposta)

    def test_sem_permissao_nao_grava(self):
        self.auditor.funcoes = {'SGQ': []}
        self.auditor.save(update_fields=['funcoes'])
        abertura = self.falar('Quero dar andamento na minha auditoria')
        self.assertIn('permissão de executar auditorias', abertura)
        self.assertNotIn('Como você responde?', abertura)
        self.assertEqual(RespostaAuditoriaSGQ.objects.count(), 0)

    def test_agente_sem_a_parte_nao_conduz_o_questionario(self):
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
        self.assertNotIn('Qual delas você quer continuar?', resposta.json()['resposta'])
        self.assertEqual(RespostaAuditoriaSGQ.objects.count(), 0)
