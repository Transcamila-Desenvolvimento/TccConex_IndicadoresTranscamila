from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

User = get_user_model()
FILIAL = 'Ibiporã (Matriz)'
HEADERS = {
    'HTTP_X_PROTHON_ENVIRONMENT': 'SGQ',
    'HTTP_X_PROTHON_FILIAL': FILIAL,
}


class SipocSGQTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='sgq.sipoc',
            password='x',
            name='Gestor SGQ',
            role_id='1',
            status='ativo',
            environments=['SGQ'],
        )
        self.client.force_authenticate(self.user)

    def test_cadastra_procedimento_por_setor_e_grava_a_lousa(self):
        setor = self.client.post('/api/sgq/sipoc-setores/', {'nome': 'Qualidade'}, format='json', **HEADERS)
        self.assertEqual(setor.status_code, 201, setor.data)
        repetido = self.client.post('/api/sgq/sipoc-setores/', {'nome': 'qualidade'}, format='json', **HEADERS)
        self.assertEqual(repetido.status_code, 400)

        criado = self.client.post('/api/sgq/sipoc-procedimentos/', {
            'nome': 'Recebimento de matéria-prima',
            'setorId': setor.data['id'],
            'descricao': 'Da chegada ao estoque',
        }, format='json', **HEADERS)
        self.assertEqual(criado.status_code, 201, criado.data)
        self.assertEqual(criado.data['setorNome'], 'Qualidade')
        self.assertEqual(criado.data['criadoPor'], 'Gestor SGQ')
        self.assertEqual(criado.data['esquema'], {'nos': [], 'ligacoes': []})

        esquema = {
            'nos': [{'id': 'etapa-1', 'tipo': 'etapa', 'texto': 'Almoxarifado', 'x': 40, 'y': 40}],
            'ligacoes': [],
        }
        salvo = self.client.patch(
            f"/api/sgq/sipoc-procedimentos/{criado.data['id']}/",
            {'esquema': esquema},
            format='json',
            **HEADERS,
        )
        self.assertEqual(salvo.status_code, 200, salvo.data)
        self.assertEqual(salvo.data['esquema']['nos'][0]['texto'], 'Almoxarifado')

        lista = self.client.get('/api/sgq/sipoc-procedimentos/', {'setor': setor.data['id']}, **HEADERS)
        self.assertEqual(lista.data['count'], 1)
        ocupado = self.client.delete(f"/api/sgq/sipoc-setores/{setor.data['id']}/", **HEADERS)
        self.assertEqual(ocupado.status_code, 400)

        outra = dict(HEADERS)
        outra['HTTP_X_PROTHON_FILIAL'] = 'Rondonópolis'
        isolado = self.client.get('/api/sgq/sipoc-procedimentos/', **outra)
        self.assertEqual(isolado.data['count'], 0)

    @override_settings(SGQ_SIPOC_LIBERADO=False)
    def test_sipoc_fica_bloqueado_ate_a_rotina_ser_gravada(self):
        negado = self.client.get('/api/sgq/sipoc-setores/', **HEADERS)
        self.assertEqual(negado.status_code, 403)

        self.user.abas = {'SGQ': ['home', 'sipoc']}
        self.user.save(update_fields=['abas'])
        liberado = self.client.get('/api/sgq/sipoc-setores/', **HEADERS)
        self.assertEqual(liberado.status_code, 200)
