from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from unittest.mock import patch

from apps.sgq.models import DocumentoSGQ

User = get_user_model()

FALA = (
    'Estamos começando agora uma reunião para alinhar os procedimentos da logística. '
    'Participantes: Ana Lima e João Souza. '
    'Ficou combinado conferir a doca antes da carga. '
    'Eu quero que você crie uma ata desta reunião relacionando o que foi abordado '
    'com o documento do procedimento da logística anexado no ambiente do SGQ.'
)


@override_settings(GEMINI_API_KEY='')
class CamiloAtaTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.sgq = User.objects.create_user(
            username='camilo.sgq',
            password='test123',
            name='Qualidade',
            role_id='2',
            status='ativo',
            environments=['CamiloIA', 'SGQ'],
            abas={'SGQ': ['home', 'matriz']},
        )
        self.comercial = User.objects.create_user(
            username='camilo.comercial.ata',
            password='test123',
            name='Comercial',
            role_id='2',
            status='ativo',
            environments=['CamiloIA', 'Comercial'],
            abas={'Comercial': ['home', 'propostas-comerciais']},
        )
        DocumentoSGQ.objects.create(
            titulo='Procedimento de logística',
            nome_original='procedimento.txt',
            texto='O procedimento de logística exige conferência na doca antes da carga.',
            texto_extraido=True,
        )

    def _agente(self, user, nome, escopos):
        self.client.force_authenticate(user=user)
        criado = self.client.post('/api/camilo/agentes/', {
            'nome': nome,
            'instrucao': 'Registrar a reunião.',
            'escopos': escopos,
        }, format='json')
        self.assertEqual(criado.status_code, 201, criado.content)
        return criado.json()['id']

    def test_agente_com_sgq_poe_participantes_e_o_documento_na_ata(self):
        agente_id = self._agente(self.sgq, 'Qualidade', [{'ambiente': 'SGQ', 'parte': 'matriz'}])
        resposta = self.client.post(
            f'/api/camilo/agentes/{agente_id}/consultar/',
            {'pergunta': FALA},
            format='json',
        )
        self.assertEqual(resposta.status_code, 200, resposta.content)
        corpo = resposta.json()
        ata = corpo['ata']
        self.assertEqual(ata['participantes'], ['Ana Lima', 'João Souza'])
        self.assertTrue(any('conferir a doca' in assunto for assunto in ata['assuntos']))
        self.assertTrue(any('Procedimento de logística' in item for item in ata['consideracoes']))
        self.assertTrue(any('doca' in item.lower() for item in ata['consideracoes']))
        self.assertIn('Procedimento de logística', corpo['resposta'])
        self.assertNotIn('Carlos', corpo['resposta'])
        self.assertIn('doca', corpo['resposta'].lower())

    def test_agente_sem_sgq_nao_inventa_o_documento(self):
        agente_id = self._agente(
            self.comercial,
            'Comercial',
            [{'ambiente': 'Comercial', 'parte': 'propostas-comerciais'}],
        )
        resposta = self.client.post(
            f'/api/camilo/agentes/{agente_id}/consultar/',
            {'pergunta': FALA},
            format='json',
        )
        self.assertEqual(resposta.status_code, 200, resposta.content)
        corpo = resposta.json()
        self.assertEqual(corpo['ata']['participantes'], ['Ana Lima', 'João Souza'])
        self.assertEqual(corpo['ata']['documentos'], [])
        self.assertEqual(corpo['ata']['consideracoes'], [])
        self.assertIn('não está nas partes deste agente', corpo['resposta'])
        self.assertNotIn('conferência na doca', corpo['resposta'])

    def test_chat_padrao_nao_abre_o_sgq(self):
        self.client.force_authenticate(user=self.sgq)
        resposta = self.client.post('/api/camilo/conversar/', {'pergunta': FALA}, format='json')
        self.assertEqual(resposta.status_code, 200, resposta.content)
        corpo = resposta.json()
        self.assertEqual(corpo['ata']['documentos'], [])
        self.assertEqual(corpo['ata']['consideracoes'], [])
        self.assertIn('chat padrão não consulta documentos do SGQ', corpo['resposta'])
        self.assertEqual(corpo['ata']['participantes'], ['Ana Lima', 'João Souza'])

    def test_email_exige_google_vinculado(self):
        self.client.force_authenticate(user=self.sgq)
        pdf = SimpleUploadedFile('ata.pdf', b'%PDF-1.4 ata', content_type='application/pdf')
        resposta = self.client.post('/api/camilo/atas/enviar-email/', {
            'to': 'ana@transcamila.com.br',
            'titulo': 'Alinhamento',
            'pdf': pdf,
        })
        self.assertEqual(resposta.status_code, 400)
        self.assertIn('Google', resposta.json()['detail'])

    @patch('apps.camilo.ata_email.send_gmail_as_user')
    def test_email_sai_pelo_gmail_da_pessoa(self, enviar):
        self.sgq.google_email = 'qualidade@transcamila.com.br'
        self.sgq.save(update_fields=['google_email'])
        self.client.force_authenticate(user=self.sgq)
        pdf = SimpleUploadedFile('ata.pdf', b'%PDF-1.4 ata', content_type='application/pdf')
        resposta = self.client.post('/api/camilo/atas/enviar-email/', {
            'to': 'ana@transcamila.com.br',
            'cc': 'joao@transcamila.com.br',
            'titulo': 'Alinhamento da logística',
            'pdf': pdf,
        })
        self.assertEqual(resposta.status_code, 200, resposta.content)
        self.assertIn('ana@transcamila.com.br', resposta.json()['message'])
        mensagem = enviar.call_args.args[1]
        self.assertEqual(mensagem.to, ['ana@transcamila.com.br'])
        self.assertEqual(mensagem.cc, ['joao@transcamila.com.br'])
        self.assertEqual(mensagem.attachments[0][0], 'ata-reuniao.pdf')
