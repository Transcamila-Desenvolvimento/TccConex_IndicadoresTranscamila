from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

User = get_user_model()


class CamiloTermoTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.usuario = User.objects.create_user(
            username='camilo.termo',
            password='test123',
            name='Miguel Da Silva Ribeiro',
            role_id='2',
            status='ativo',
            environments=['CamiloIA'],
        )
        self.admin = User.objects.create_user(
            username='camilo.admin',
            password='test123',
            name='Administrador',
            role_id='1',
            status='ativo',
            environments=['Administração'],
        )
        self.sem_acesso = User.objects.create_user(
            username='camilo.sem',
            password='test123',
            name='Sem acesso',
            role_id='2',
            status='ativo',
            environments=['Comercial'],
        )

    def test_aceite_fica_registrado_e_o_segundo_nao_duplica(self):
        self.client.force_authenticate(user=self.usuario)
        antes = self.client.get('/api/camilo/termo/')
        self.assertEqual(antes.status_code, 200)
        self.assertFalse(antes.json()['aceito'])

        aceite = self.client.post('/api/camilo/termo/', {}, format='json')
        self.assertEqual(aceite.status_code, 201)
        corpo = aceite.json()
        self.assertTrue(corpo['aceito'])
        self.assertEqual(corpo['nome'], 'Miguel Da Silva Ribeiro')
        self.assertEqual(corpo['versao'], 'v1')

        from apps.camilo.models import TermoAceite

        self.usuario.cpf = '39053344705'
        self.usuario.save(update_fields=['cpf'])
        TermoAceite.objects.filter(pk=corpo['id']).update(cpf='')
        from apps.camilo.comprovante import cpf_do_aceite
        aceite = TermoAceite.objects.select_related('usuario').get(pk=corpo['id'])
        self.assertEqual(cpf_do_aceite(aceite), '390.533.447-05')

        de_novo = self.client.post('/api/camilo/termo/', {}, format='json')
        self.assertEqual(de_novo.status_code, 200)
        self.assertEqual(de_novo.json()['id'], corpo['id'])

    def test_operador_nao_consulta_a_lista(self):
        self.client.force_authenticate(user=self.usuario)
        response = self.client.get('/api/camilo/termos/')
        self.assertEqual(response.status_code, 403)

    def test_sem_acesso_ao_camilo_nao_aceita(self):
        self.client.force_authenticate(user=self.sem_acesso)
        response = self.client.post('/api/camilo/termo/', {}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_admin_lista_e_extrai_comprovante(self):
        self.client.force_authenticate(user=self.usuario)
        aceite = self.client.post('/api/camilo/termo/', {}, format='json')
        aceite_id = aceite.json()['id']

        self.client.force_authenticate(user=self.admin)
        lista = self.client.get('/api/camilo/termos/', {'search': 'Miguel'})
        self.assertEqual(lista.status_code, 200)
        self.assertEqual(lista.json()['count'], 1)
        self.assertEqual(lista.json()['results'][0]['username'], 'camilo.termo')

        vazio = self.client.get('/api/camilo/termos/', {'search': 'inexistente'})
        self.assertEqual(vazio.json()['count'], 0)

        pdf = self.client.get(f'/api/camilo/termos/{aceite_id}/comprovante/')
        self.assertEqual(pdf.status_code, 200)
        self.assertEqual(pdf['Content-Type'], 'application/pdf')
        self.assertTrue(pdf.content.startswith(b'%PDF'))

        self.client.force_authenticate(user=self.usuario)
        negado = self.client.get(f'/api/camilo/termos/{aceite_id}/comprovante/')
        self.assertEqual(negado.status_code, 403)

    def test_nova_versao_pede_aceite_de_novo(self):
        self.client.force_authenticate(user=self.usuario)
        primeiro = self.client.post('/api/camilo/termo/', {}, format='json')
        self.assertEqual(primeiro.json()['versao'], 'v1')

        payload = {
            'titulo': 'Termo atualizado',
            'introducao': 'Leia de novo.',
            'assinatura': 'CamiloIA - interno',
            'declaracao': 'Concordo com a versão nova.',
            'secoes': [{'titulo': 'Uso', 'texto': 'O chat continua visível para a empresa.'}],
        }
        negado = self.client.post('/api/camilo/termos/vigente/', payload, format='json')
        self.assertEqual(negado.status_code, 403)

        self.client.force_authenticate(user=self.admin)
        publicado = self.client.post('/api/camilo/termos/vigente/', payload, format='json')
        self.assertEqual(publicado.status_code, 201)
        self.assertEqual(publicado.json()['versao'], 'v2')

        self.client.force_authenticate(user=self.usuario)
        pendente = self.client.get('/api/camilo/termo/')
        self.assertEqual(pendente.status_code, 200)
        self.assertFalse(pendente.json()['aceito'])
        self.assertEqual(pendente.json()['versao'], 'v2')
        self.assertEqual(pendente.json()['titulo'], 'Termo de uso do Camilo IA')
        self.assertEqual(pendente.json()['introducao'], 'Antes de usar esta ferramenta, leia e aceite as condições abaixo.')
        self.assertIn('distribuído internamente', pendente.json()['assinatura'])
        self.assertEqual(pendente.json()['secoes'][0]['titulo'], 'Uso')

        aceite = self.client.post('/api/camilo/termo/', {}, format='json')
        self.assertEqual(aceite.status_code, 201)
        self.assertTrue(aceite.json()['aceito'])
        self.assertEqual(aceite.json()['versao'], 'v2')
        self.assertNotEqual(aceite.json()['id'], primeiro.json()['id'])
