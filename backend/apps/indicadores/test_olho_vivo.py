from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import auth_headers
from apps.frota.models import ItemRespostaOlhoVivo, RespostaOlhoVivo

User = get_user_model()


class IndicadoresOlhoVivoTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='ind_olho_vivo',
            password='ind123',
            role_id='2',
            environments=['Indicadores'],
            filiais={'Indicadores': ['Ibiporã (Matriz)']},
        )
        self.headers = auth_headers(self.user, 'Indicadores', 'Ibiporã (Matriz)')
        RespostaOlhoVivo.objects.all().delete()
        self._gravar('Ibiporã (Matriz)', 2026, 10, {
            'velocidade-acima-limite': 3,
            'sem-seta': 1,
        })
        self._gravar('Rondonópolis', 2026, 1, {'velocidade-acima-limite': 0})
        self._gravar('Rondonópolis', 2026, 5, {'velocidade-acima-limite': 78})

    def _gravar(self, filial, ano, mes, valores):
        resposta = RespostaOlhoVivo.objects.create(
            filial=filial,
            periodicidade=RespostaOlhoVivo.PERIODICIDADE_MENSAL,
            ano=ano,
            mes=mes,
            period_key=f'{ano}-{mes:02d}',
        )
        for chave, recorrencia in valores.items():
            ItemRespostaOlhoVivo.objects.create(
                resposta=resposta,
                comportamento=chave,
                recorrencia=recorrencia,
            )

    def test_consolida_as_duas_filiais(self):
        response = self.client.get(
            '/api/indicadores/frota/olho-vivo/',
            {'ano': 2026},
            **self.headers,
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data['resumo']['total'], 82)
        self.assertEqual(response.data['resumo']['mesesRespondidos'], 3)
        self.assertEqual(response.data['resumo']['comportamentoDestaque']['key'], 'velocidade-acima-limite')
        self.assertEqual(response.data['resumo']['comportamentoDestaque']['recorrencia'], 81)

        filiais = {item['filial']: item for item in response.data['filiais']}
        self.assertEqual(set(filiais), {'Ibiporã (Matriz)', 'Rondonópolis'})

        ibipora = {mes['mes']: mes for mes in filiais['Ibiporã (Matriz)']['meses']}
        self.assertFalse(ibipora[1]['respondido'])
        self.assertIsNone(ibipora[1]['total'])
        self.assertEqual(ibipora[10]['total'], 4)
        self.assertEqual(filiais['Ibiporã (Matriz)']['mesesRespondidos'], 1)

        rondonopolis = {mes['mes']: mes for mes in filiais['Rondonópolis']['meses']}
        self.assertTrue(rondonopolis[1]['respondido'])
        self.assertEqual(rondonopolis[1]['total'], 0)
        self.assertEqual(rondonopolis[5]['total'], 78)
        velocidade = next(
            item for item in rondonopolis[5]['itens'] if item['comportamento'] == 'velocidade-acima-limite'
        )
        self.assertEqual(velocidade['recorrencia'], 78)
        cinto = next(item for item in rondonopolis[5]['itens'] if item['comportamento'] == 'sem-cinto')
        self.assertEqual(cinto['recorrencia'], 0)

    def test_filtra_uma_filial_e_rejeita_recorte_invalido(self):
        filtrado = self.client.get(
            '/api/indicadores/frota/olho-vivo/',
            {'ano': 2026, 'filial': 'Ibiporã (Matriz)'},
            **self.headers,
        )
        self.assertEqual(filtrado.status_code, 200, filtrado.content)
        self.assertEqual(len(filtrado.data['filiais']), 1)
        self.assertEqual(filtrado.data['filiais'][0]['total'], 4)

        ano = self.client.get('/api/indicadores/frota/olho-vivo/', {'ano': 2018}, **self.headers)
        self.assertEqual(ano.status_code, 400)

        filial = self.client.get(
            '/api/indicadores/frota/olho-vivo/',
            {'ano': 2026, 'filial': 'Paranaguá'},
            **self.headers,
        )
        self.assertEqual(filial.status_code, 400)
