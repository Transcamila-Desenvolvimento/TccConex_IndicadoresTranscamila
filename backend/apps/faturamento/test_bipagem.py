from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.tests import auth_headers

from .models import BipagemDocumento, BipagemImportacao

User = get_user_model()

CSV_LUFT = (
    ';;;;;;;;;Vencidos;;;;;;;;;;;;;;;;;;;;;;\n'
    'Cod.Cliente;Loja;Cliente;CGC Cliente;Origem;Regiao;Docto;Serie/Prefixo;Tipo;C/F;Emissao;Vencto.;'
    'Debito;A vencer;01 a 30 dias;31 a 60 dias;61 a 90 dias;91 a 120 dias;+ de 120 dias;Total;'
    'Pre-Fatura;OTO;Ult Ocorrencia; CGC Rem.;Desc. Remetente;CGC Des.;Desc. Destinatario;'
    'Tp. Movimento;Data EDI;Notas;Tabela;Observacao\n'
    '2450;1;PRENTISS QUIMICA LTDA         ;00.729.422/0001-00;1;SUL;74118;1;C  ;C;14/09/2026;14/09/2026;'
    '1;0;0;7.003,32;0;0;0;7.003,32;               ;; ;00.729.422/0001-00;PRENTISS;37.827.383/0004-29;'
    'BOI FORTE;TCC DISTRIBUIÇÃO    ;  /  /    ;35631;TCC - PR;\n'
    '2431;8;CCAB AGRO S/A                 ;08.938.255/0008-88;9;SUDESTE;40794;8;F  ;F;21/09/2026;21/09/2026;'
    '9;0;25.833,59;0;0;0;0;25.833,59;FT123          ;; ;08.938.255/0011-83;CCAB;08.938.255/0008-88;'
    'CCAB;0002 IMPORTACAO     ;  /  /    ;000035155 / 000035151 ;TCC - CC;\n'
    ';;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;\n'
)


class BipagemDocumentoTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='fat_bip',
            password='senha123',
            role_id='2',
            name='Faturamento Bipagem',
            environments=['Faturamento'],
        )
        self.headers = auth_headers(self.user, env='Faturamento')
        self.importacao = BipagemImportacao.objects.create(arquivo='ltmsr472.csv', linhas=2)
        self._doc('2450', '1', '1', '73957', '25/08/2026', '38305.58')
        self._doc('2450', '2', '5', '073957', '01/07/2026', '10.00')

    def _doc(self, cod, loja, origem, docto, emissao, total, cliente='PRENTISS QUIM'):
        return BipagemDocumento.objects.create(
            importacao=self.importacao,
            cod_cliente=cod,
            loja=loja,
            cliente=cliente,
            origem=origem,
            docto=docto,
            emissao=emissao,
            vencimento='',
            total=Decimal(total),
            notas='35578',
        )

    def _buscar(self, codigo, cod_cliente=''):
        params = {'codigo': codigo}
        if cod_cliente:
            params['codCliente'] = cod_cliente
        return self.client.get('/api/faturamento/bipagem/documento/', params, **self.headers)

    def test_encontra_docto_na_base_importada(self):
        response = self._buscar('73957')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['lote']['label'], 'ltmsr472.csv')
        self.assertTrue(response.data['lote']['updatedAt'])
        self.assertEqual(
            [item['docto'] for item in response.data['encontrados']],
            ['73957', '073957'],
        )
        doc = response.data['encontrados'][0]
        self.assertEqual(doc['codCliente'], '2450')
        self.assertEqual(doc['total'], '38305.58')
        self.assertEqual(doc['notas'], '35578')

    def test_leitor_com_prefixo_encontra_o_numero(self):
        response = self._buscar('CTE 73957')
        self.assertEqual(
            [item['docto'] for item in response.data['encontrados']],
            ['73957', '073957'],
        )

    def test_documento_ausente(self):
        response = self._buscar('99999')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['encontrados'], [])

    def test_sem_base_importada(self):
        BipagemImportacao.objects.all().delete()
        response = self._buscar('73957')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['lote'])
        self.assertEqual(response.data['encontrados'], [])

    def test_codigo_vazio(self):
        response = self.client.get('/api/faturamento/bipagem/documento/', **self.headers)
        self.assertEqual(response.status_code, 400)

    def test_lista_a_base(self):
        response = self.client.get('/api/faturamento/bipagem/base/', **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        self.assertTrue(response.data['lote']['updatedAt'])

    def test_base_fica_restrita_ao_cliente_selecionado(self):
        self._doc('1184', '1', '1', '88001', '01/09/2026', '50.00', cliente='AMBEV')
        response = self.client.get('/api/faturamento/bipagem/base/', {'codCliente': '2450'}, **self.headers)
        self.assertEqual({item['codCliente'] for item in response.data['results']}, {'2450'})
        self.assertEqual(response.data['count'], 2)

    def test_bipagem_recusa_documento_de_outro_cliente(self):
        self._doc('1184', '1', '1', '88001', '01/09/2026', '50.00', cliente='AMBEV')
        response = self._buscar('88001', '2450')
        self.assertEqual(response.data['encontrados'], [])
        self.assertEqual([item['codCliente'] for item in response.data['outroCliente']], ['1184'])

    def test_importa_csv_do_relatorio_e_substitui_a_base(self):
        arquivo = SimpleUploadedFile('ltmsr472_teste.csv', CSV_LUFT.encode('cp1252'), content_type='text/csv')
        response = self.client.post(
            '/api/faturamento/bipagem/importar/',
            {'file': arquivo},
            format='multipart',
            **self.headers,
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['linhas'], 2)
        self.assertEqual(BipagemImportacao.objects.count(), 1)
        self.assertFalse(BipagemDocumento.objects.filter(docto='73957').exists())

        ccab = BipagemDocumento.objects.get(docto='40794')
        self.assertEqual(ccab.cod_cliente, '2431')
        self.assertEqual(ccab.loja, '8')
        self.assertEqual(ccab.cliente, 'CCAB AGRO S/A')
        self.assertEqual(ccab.origem, '9')
        self.assertEqual(ccab.emissao, '21/09/2026')
        self.assertEqual(ccab.total, Decimal('25833.59'))
        self.assertEqual(ccab.notas, '000035155 / 000035151')
        self.assertEqual(ccab.fatura, 'FT123')

    def test_importacao_recusa_arquivo_sem_cabecalho(self):
        arquivo = SimpleUploadedFile('qualquer.csv', b'a;b;c\n1;2;3\n', content_type='text/csv')
        response = self.client.post(
            '/api/faturamento/bipagem/importar/',
            {'file': arquivo},
            format='multipart',
            **self.headers,
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(BipagemDocumento.objects.count(), 2)

    def test_outro_modulo_nao_consulta(self):
        outro = User.objects.create_user(
            username='fin_bip',
            password='senha123',
            role_id='2',
            name='Financeiro',
            environments=['Financeiro'],
        )
        response = self.client.get(
            '/api/faturamento/bipagem/documento/',
            {'codigo': '73957'},
            **auth_headers(outro, env='Financeiro'),
        )
        self.assertEqual(response.status_code, 403)
