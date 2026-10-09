import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
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
class MatrizEmpresarialTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='matriz.admin',
            password='test123',
            name='Admin',
            role_id='1',
            status='ativo',
            environments=['Administração'],
        )
        self.usuario = User.objects.create_user(
            username='matriz.camilo',
            password='test123',
            name='Camilo',
            role_id='2',
            status='ativo',
            environments=['CamiloIA'],
        )

    def test_operador_nao_altera_a_matriz(self):
        self.client.force_authenticate(user=self.usuario)
        response = self.client.get('/api/camilo/matriz-empresarial/pastas/')
        self.assertEqual(response.status_code, 403)

    @patch('apps.camilo.gemini.urllib.request.urlopen')
    def test_chat_padrao_le_o_documento_da_matriz(self, urlopen):
        urlopen.side_effect = [
            _RespostaGemini('A jornada citada é de 44 horas.'),
            _RespostaGemini('Jornada padrão'),
        ]
        self.client.force_authenticate(user=self.admin)
        pasta = self.client.post('/api/camilo/matriz-empresarial/pastas/', {'nome': 'Normas'}, format='json')
        self.assertEqual(pasta.status_code, 201, pasta.data)
        arquivo = SimpleUploadedFile(
            'jornada.txt',
            'A jornada padrão da empresa é de 44 horas semanais.'.encode('utf-8'),
            content_type='text/plain',
        )
        documento = self.client.post(
            '/api/camilo/matriz-empresarial/documentos/',
            {'titulo': 'Jornada', 'pastaId': pasta.json()['id'], 'arquivo': arquivo},
            format='multipart',
        )
        self.assertEqual(documento.status_code, 201, documento.data)

        self.client.force_authenticate(user=self.usuario)
        resposta = self.client.post(
            '/api/camilo/conversar/',
            {'pergunta': 'Qual é a jornada padrão?', 'historico': []},
            format='json',
        )
        self.assertEqual(resposta.status_code, 200, resposta.data)
        pedido = json.loads(urlopen.call_args_list[0].args[0].data.decode('utf-8'))
        texto = pedido['contents'][-1]['parts'][0]['text']
        self.assertIn('Matriz empresarial', texto)
        self.assertIn('44 horas', texto)
        self.assertIn('Normas / Jornada', texto)
