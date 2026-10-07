from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.frota.models import ItemRespostaOlhoVivo, RespostaOlhoVivo
from apps.frota.olho_vivo import COMPORTAMENTOS

User = get_user_model()
HEADERS = {
    'HTTP_X_PROTHON_ENVIRONMENT': 'Frota',
    'HTTP_X_PROTHON_FILIAL': 'Ibiporã (Matriz)',
}


def _itens(valor=0, **overrides):
    valores = {chave: valor for chave, _descricao in COMPORTAMENTOS}
    valores.update(overrides)
    return [{'comportamento': chave, 'recorrencia': recorrencia} for chave, recorrencia in valores.items()]


class OlhoVivoTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.ano = timezone.localdate().year
        self.admin = User.objects.create_user(
            username='olho.admin',
            password='test123',
            name='Admin Olho',
            role_id='1',
            status='ativo',
            environments=['Frota'],
        )
        self.operador = User.objects.create_user(
            username='olho.op',
            password='test123',
            name='Operador Olho',
            role_id='2',
            status='ativo',
            environments=['Frota'],
            filiais={'Frota': ['Ibiporã (Matriz)']},
            funcoes={'Frota': ['responder-olho-vivo']},
        )
        self.leitura = User.objects.create_user(
            username='olho.view',
            password='test123',
            name='Leitura Olho',
            role_id='2',
            status='ativo',
            environments=['Frota'],
            filiais={'Frota': ['Ibiporã (Matriz)']},
        )

    def test_get_sem_resposta_lista_comportamentos(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            '/api/frota/olho-vivo/',
            {'ano': self.ano, 'mes': 10},
            **HEADERS,
        )
        self.assertEqual(response.status_code, 200, response.content)
        body = response.json()
        self.assertFalse(body['respondido'])
        self.assertEqual(len(body['itens']), len(COMPORTAMENTOS))
        self.assertEqual(body['itens'][0]['descricao'], 'Velocidade acima do limite')
        self.assertTrue(all(item['recorrencia'] == 0 for item in body['itens']))

    def test_put_mensal_grava_e_regrava_o_mesmo_periodo(self):
        self.client.force_authenticate(user=self.operador)
        payload = {
            'ano': self.ano,
            'mes': 10,
            'itens': _itens(1, **{'velocidade-acima-limite': 4}),
        }
        created = self.client.put('/api/frota/olho-vivo/', payload, format='json', **HEADERS)
        self.assertEqual(created.status_code, 200, created.content)
        self.assertTrue(created.json()['respondido'])
        self.assertEqual(created.json()['itens'][0]['recorrencia'], 4)
        self.assertEqual(RespostaOlhoVivo.objects.count(), 1)

        payload['itens'] = _itens(2)
        updated = self.client.put('/api/frota/olho-vivo/', payload, format='json', **HEADERS)
        self.assertEqual(updated.status_code, 200, updated.content)
        self.assertEqual(RespostaOlhoVivo.objects.count(), 1)
        self.assertEqual(ItemRespostaOlhoVivo.objects.count(), len(COMPORTAMENTOS))
        self.assertTrue(all(item['recorrencia'] == 2 for item in updated.json()['itens']))

    def test_leitura_nao_responde(self):
        self.client.force_authenticate(user=self.leitura)
        response = self.client.put(
            '/api/frota/olho-vivo/',
            {'ano': self.ano, 'mes': 3, 'itens': _itens()},
            format='json',
            **HEADERS,
        )
        self.assertEqual(response.status_code, 403)

    def test_filial_da_sessao_isola_a_resposta(self):
        self.client.force_authenticate(user=self.admin)
        self.client.put(
            '/api/frota/olho-vivo/',
            {'ano': self.ano, 'mes': 5, 'itens': _itens(7)},
            format='json',
            **HEADERS,
        )
        outra = self.client.get(
            '/api/frota/olho-vivo/',
            {'ano': self.ano, 'mes': 5},
            HTTP_X_PROTHON_ENVIRONMENT='Frota',
            HTTP_X_PROTHON_FILIAL='Rondonópolis',
        )
        self.assertEqual(outra.status_code, 200, outra.content)
        self.assertFalse(outra.json()['respondido'])
        self.assertTrue(all(item['recorrencia'] == 0 for item in outra.json()['itens']))

    def test_lista_os_meses_do_ano(self):
        self.client.force_authenticate(user=self.admin)
        self.client.put(
            '/api/frota/olho-vivo/',
            {'ano': self.ano, 'mes': 1, 'itens': _itens(**{'sem-cinto': 2})},
            format='json',
            **HEADERS,
        )
        response = self.client.get('/api/frota/olho-vivo/', {'ano': self.ano}, **HEADERS)
        self.assertEqual(response.status_code, 200, response.content)
        meses = response.json()['meses']
        self.assertEqual(len(meses), 12)
        janeiro = meses[0]
        self.assertTrue(janeiro['respondido'])
        self.assertEqual(janeiro['total'], 2)
        self.assertFalse(meses[1]['respondido'])

    def test_meses_do_mesmo_ano_ficam_separados(self):
        self.client.force_authenticate(user=self.admin)
        janeiro = self.client.put(
            '/api/frota/olho-vivo/',
            {'ano': self.ano, 'mes': 1, 'itens': _itens(**{'sem-cinto': 2})},
            format='json',
            **HEADERS,
        )
        fevereiro = self.client.put(
            '/api/frota/olho-vivo/',
            {'ano': self.ano, 'mes': 2, 'itens': _itens(**{'sem-cinto': 3})},
            format='json',
            **HEADERS,
        )
        self.assertEqual(janeiro.status_code, 200, janeiro.content)
        self.assertEqual(fevereiro.status_code, 200, fevereiro.content)
        self.assertEqual(RespostaOlhoVivo.objects.filter(ano=self.ano).count(), 2)
        de_novo = self.client.get('/api/frota/olho-vivo/', {'ano': self.ano, 'mes': 1}, **HEADERS)
        cinto = next(item for item in de_novo.json()['itens'] if item['comportamento'] == 'sem-cinto')
        self.assertEqual(cinto['recorrencia'], 2)

    def test_rejeita_recorrencia_negativa(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.put(
            '/api/frota/olho-vivo/',
            {
                'ano': self.ano,
                'mes': 4,
                'itens': _itens(**{'sem-seta': -1}),
            },
            format='json',
            **HEADERS,
        )
        self.assertEqual(response.status_code, 400)
