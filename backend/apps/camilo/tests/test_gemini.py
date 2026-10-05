import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

User = get_user_model()


class _RespostaGemini:
    def __init__(self, texto):
        self._corpo = json.dumps({
            'candidates': [{'content': {'parts': [{'text': texto}]}}],
        }).encode('utf-8')

    def read(self):
        return self._corpo

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


@override_settings(GEMINI_API_KEY='chave-teste', GEMINI_MODEL='gemini-3.8-flash')
class CamiloGeminiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='camilo.gemini',
            password='test123',
            name='Camilo',
            role_id='2',
            status='ativo',
            environments=['CamiloIA'],
        )
        self.client.force_authenticate(user=self.user)

    @patch('apps.camilo.gemini.urllib.request.urlopen')
    def test_chat_padrao_chama_o_gemini_sem_dados_do_erp(self, urlopen):
        urlopen.side_effect = [
            _RespostaGemini('Posso ajudar a escrever o texto.'),
            _RespostaGemini('Recado interno'),
        ]
        response = self.client.post(
            '/api/camilo/conversar/',
            {'pergunta': 'Escreva um recado curto.', 'historico': []},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.json()['resposta'], 'Posso ajudar a escrever o texto.')
        self.assertEqual(response.json()['titulo'], 'Recado interno')
        pedido = json.loads(urlopen.call_args_list[0].args[0].data.decode('utf-8'))
        sistema = pedido['systemInstruction']['parts'][0]['text']
        self.assertIn('não consulta dados do ERP', sistema)
        self.assertIn('tabela Markdown', sistema)
        self.assertEqual(pedido['generationConfig']['maxOutputTokens'], 8192)
        self.assertEqual(pedido['generationConfig']['thinkingConfig']['thinkingLevel'], 'low')
        self.assertNotIn('responseMimeType', pedido['generationConfig'])
        self.assertEqual(pedido['contents'][-1]['parts'][0]['text'], 'Escreva um recado curto.')

    @patch('apps.camilo.gemini.urllib.request.urlopen')
    def test_admin_configura_o_chat_padrao(self, urlopen):
        urlopen.side_effect = [
            _RespostaGemini('Texto pronto.'),
            _RespostaGemini('Texto interno'),
        ]
        admin = User.objects.create_user(
            username='camilo.admin',
            password='test123',
            name='Admin',
            role_id='1',
            status='ativo',
            environments=['Administração'],
        )
        self.client.force_authenticate(user=admin)
        salvo = self.client.put(
            '/api/camilo/chat-padrao/',
            {'nome': 'Camilo da casa', 'instrucao': 'Seja bem objetivo.'},
            format='json',
        )
        self.assertEqual(salvo.status_code, 200, salvo.data)
        self.assertEqual(salvo.json()['nome'], 'Camilo da casa')
        self.assertEqual(salvo.json()['instrucao'], 'Seja bem objetivo.')

        self.client.force_authenticate(user=self.user)
        leitura = self.client.get('/api/camilo/chat-padrao/')
        self.assertEqual(leitura.status_code, 200)
        self.assertEqual(leitura.json()['nome'], 'Camilo da casa')
        self.assertNotIn('instrucao', leitura.json())
        recusado = self.client.put(
            '/api/camilo/chat-padrao/',
            {'nome': 'Outro', 'instrucao': ''},
            format='json',
        )
        self.assertEqual(recusado.status_code, 403)

        resposta = self.client.post(
            '/api/camilo/conversar/',
            {'pergunta': 'Escreva um aviso.', 'historico': []},
            format='json',
        )
        self.assertEqual(resposta.status_code, 200, resposta.data)
        sistema = json.loads(urlopen.call_args_list[0].args[0].data.decode('utf-8'))
        sistema = sistema['systemInstruction']['parts'][0]['text']
        self.assertIn('Camilo da casa', sistema)
        self.assertIn('Seja bem objetivo.', sistema)
        self.assertIn('não consulta dados do ERP', sistema)

    def test_sem_chave_o_chat_avisa(self):
        with override_settings(GEMINI_API_KEY=''):
            response = self.client.post(
                '/api/camilo/conversar/',
                {'pergunta': 'Oi'},
                format='json',
            )
        self.assertEqual(response.status_code, 503)
        self.assertIn('GEMINI_API_KEY', response.json()['detail'])
