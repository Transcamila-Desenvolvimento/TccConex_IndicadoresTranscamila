import json
from datetime import timedelta
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .google_chat import montar_mensagem
from .models import Notificacao, PushInscricao
from .reciclagem import reciclar_notificacoes
from .services import destinatarios_ambiente, notificar

User = get_user_model()
HEADERS = {'HTTP_X_PROTHON_ENVIRONMENT': 'Comercial'}
VAPID = {'WEBPUSH_VAPID_PUBLIC_KEY': 'BPublica', 'WEBPUSH_VAPID_PRIVATE_KEY': 'privada'}
INSCRICAO = {
    'endpoint': 'https://fcm.googleapis.com/fcm/send/abc123',
    'keys': {'p256dh': 'BChaveDoNavegador', 'auth': 'segredo'},
}


class NotificacoesTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.autor = User.objects.create_user(
            username='notif.autor', password='x', name='Marco Autor', role_id='2', status='ativo',
            environments=['Comercial'], funcoes={'Comercial': ['gerenciar-propostas']},
        )
        self.colega = User.objects.create_user(
            username='notif.colega', password='x', name='Colega Comercial', role_id='2', status='ativo',
            environments=['Comercial'], google_email='colega@transcamila.com.br',
        )
        self.admin_sem_comercial = User.objects.create_user(
            username='notif.admin', password='x', name='Admin Geral', role_id='1', status='ativo',
            environments=['Financeiro'],
        )
        self.admin_com_comercial = User.objects.create_user(
            username='notif.admin.com', password='x', name='Admin Comercial', role_id='1', status='ativo',
            environments=['Comercial'],
        )
        self.inativo = User.objects.create_user(
            username='notif.inativo', password='x', name='Inativo', role_id='2', status='inativo',
            environments=['Comercial'],
        )
        self.outro_ambiente = User.objects.create_user(
            username='notif.rh', password='x', name='Pessoa RH', role_id='2', status='ativo',
            environments=['RH'],
        )

    def test_destinatarios_so_quem_tem_ambiente_marcado(self):
        ids = {user.pk for user in destinatarios_ambiente('Comercial', excluir=self.autor)}
        self.assertEqual(ids, {self.colega.pk, self.admin_com_comercial.pk})

    def test_criar_proposta_notifica_comercial_menos_o_autor(self):
        self.api.force_authenticate(user=self.autor)
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.api.post(
                '/api/comercial/propostas/',
                {'tipo': 'armazenagem', 'titulo': 'Nova', 'clienteNome': 'CCAB AGRO S.A.', 'status': 'rascunho'},
                format='json',
                **HEADERS,
            )
        self.assertEqual(resp.status_code, 201, resp.content)
        notificacoes = Notificacao.objects.filter(tipo='comercial.proposta.criada')
        self.assertEqual(
            set(notificacoes.values_list('usuario_id', flat=True)),
            {self.colega.pk, self.admin_com_comercial.pk},
        )
        aviso = notificacoes.get(usuario=self.colega)
        self.assertEqual(aviso.titulo, f"Nova proposta {resp.json()['numeroIdentificacao']}")
        self.assertIn('CCAB AGRO S.A.', aviso.mensagem)
        self.assertIn('Marco Autor', aviso.mensagem)
        self.assertEqual(aviso.link, f"/comercial/propostas?proposta={resp.json()['id']}")

    def test_endpoints_lista_contagem_e_leitura_isolados_por_usuario(self):
        notificar([self.colega, self.admin_com_comercial], tipo='teste', titulo='Aviso 1')
        notificar([self.colega], tipo='teste', titulo='Aviso 2')
        self.api.force_authenticate(user=self.colega)

        self.assertEqual(self.api.get('/api/notificacoes/nao-lidas/').json(), {'total': 2})
        lista = self.api.get('/api/notificacoes/').json()
        self.assertEqual(lista['count'], 2)
        self.assertEqual(lista['results'][0]['titulo'], 'Aviso 2')
        self.assertFalse(lista['results'][0]['lida'])

        alheia = Notificacao.objects.get(usuario=self.admin_com_comercial)
        self.assertEqual(self.api.post(f'/api/notificacoes/{alheia.pk}/lida/').status_code, 404)

        primeira = lista['results'][0]['id']
        lida = self.api.post(f'/api/notificacoes/{primeira}/lida/')
        self.assertEqual(lida.status_code, 200, lida.content)
        self.assertTrue(lida.json()['lida'])
        self.assertEqual(self.api.get('/api/notificacoes/nao-lidas/').json(), {'total': 1})

        self.assertEqual(self.api.post('/api/notificacoes/marcar-todas-lidas/').json(), {'atualizadas': 1})
        self.assertEqual(self.api.get('/api/notificacoes/nao-lidas/').json(), {'total': 0})
        alheia.refresh_from_db()
        self.assertIsNone(alheia.lida_em)

    def test_sem_credencial_nao_chama_google_chat(self):
        with patch('apps.notificacoes.google_chat.enviar_mensagem_direta') as enviar:
            notificar([self.colega], tipo='teste', titulo='Sem chat')
        enviar.assert_not_called()
        self.assertEqual(Notificacao.objects.filter(usuario=self.colega).count(), 1)

    @override_settings(GOOGLE_CHAT_SERVICE_ACCOUNT_JSON=json.dumps({'client_email': 'app@x.iam', 'private_key': 'k'}))
    def test_com_credencial_envia_no_chat_e_falha_nao_quebra(self):
        with patch('apps.notificacoes.google_chat.enviar_mensagem_direta', side_effect=RuntimeError('Chat fora')) as enviar:
            criadas = notificar([self.colega], tipo='teste', titulo='Com chat', mensagem='Texto', link='/x')
        enviar.assert_called_once_with(self.colega, titulo='Com chat', mensagem='Texto', link='/x')
        self.assertEqual(len(criadas), 1)

    @override_settings(WEBPUSH_VAPID_PUBLIC_KEY='', WEBPUSH_VAPID_PRIVATE_KEY='')
    def test_push_desligado_sem_chaves(self):
        self.api.force_authenticate(user=self.colega)
        self.assertEqual(self.api.get('/api/notificacoes/push/config/').json(), {'habilitado': False, 'publicKey': ''})
        resp = self.api.post('/api/notificacoes/push/inscrever/', INSCRICAO, format='json')
        self.assertEqual(resp.status_code, 503)

    @override_settings(**VAPID)
    def test_push_inscrever_reinscrever_e_cancelar(self):
        self.api.force_authenticate(user=self.colega)
        self.assertEqual(
            self.api.get('/api/notificacoes/push/config/').json(),
            {'habilitado': True, 'publicKey': VAPID['WEBPUSH_VAPID_PUBLIC_KEY']},
        )
        self.assertEqual(self.api.post('/api/notificacoes/push/inscrever/', INSCRICAO, format='json').status_code, 201)

        # Mesmo navegador usado por outra pessoa passa a ser dela.
        self.api.force_authenticate(user=self.admin_com_comercial)
        self.api.post('/api/notificacoes/push/inscrever/', INSCRICAO, format='json')
        self.assertEqual(PushInscricao.objects.get().usuario, self.admin_com_comercial)

        self.api.force_authenticate(user=self.colega)
        self.assertEqual(self.api.post('/api/notificacoes/push/cancelar/', {'endpoint': INSCRICAO['endpoint']}, format='json').json(), {'removidas': 0})
        self.api.force_authenticate(user=self.admin_com_comercial)
        self.assertEqual(self.api.post('/api/notificacoes/push/cancelar/', {'endpoint': INSCRICAO['endpoint']}, format='json').json(), {'removidas': 1})

    @override_settings(**VAPID)
    def test_push_rejeita_endpoint_invalido(self):
        self.api.force_authenticate(user=self.colega)
        resp = self.api.post(
            '/api/notificacoes/push/inscrever/',
            {'endpoint': 'http://inseguro/x', 'keys': INSCRICAO['keys']},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)

    @override_settings(**VAPID)
    def test_notificar_envia_push_e_remove_inscricao_expirada(self):
        from pywebpush import WebPushException

        PushInscricao.objects.create(usuario=self.colega, endpoint='https://push.example/ok', p256dh='p', auth='a')
        PushInscricao.objects.create(usuario=self.colega, endpoint='https://push.example/expirada', p256dh='p', auth='a')

        class _Resp:
            status_code = 410

        def falso_webpush(subscription_info, data, **kwargs):
            if subscription_info['endpoint'].endswith('expirada'):
                raise WebPushException('Gone', response=_Resp())

        with patch('pywebpush.webpush', side_effect=falso_webpush) as envio:
            criadas = notificar([self.colega], tipo='teste', titulo='Nova proposta 9', mensagem='Olá', link='/comercial/propostas?proposta=9')

        self.assertEqual(envio.call_count, 2)
        payload = json.loads(envio.call_args_list[0].kwargs['data'])
        self.assertEqual(payload, {
            'id': str(criadas[0].pk),
            'titulo': 'Nova proposta 9',
            'mensagem': 'Olá',
            'link': '/comercial/propostas?proposta=9',
            'tag': f'notif-{criadas[0].pk}',
        })
        self.assertEqual(
            list(PushInscricao.objects.values_list('endpoint', flat=True)),
            ['https://push.example/ok'],
        )

    def test_reciclagem_remove_lidas_antigas_vencidas_e_inativos(self):
        agora = timezone.now()
        lida_velha, lida_nova, nao_lida_velha, nao_lida_nova = notificar(
            [self.colega, self.colega, self.colega, self.colega], tipo='teste', titulo='x',
        )
        Notificacao.objects.filter(pk=lida_velha.pk).update(lida_em=agora - timedelta(days=31))
        Notificacao.objects.filter(pk=lida_nova.pk).update(lida_em=agora - timedelta(days=2))
        Notificacao.objects.filter(pk=nao_lida_velha.pk).update(criada_em=agora - timedelta(days=91))
        push_velho = PushInscricao.objects.create(usuario=self.colega, endpoint='https://push.example/velho', p256dh='p', auth='a')
        PushInscricao.objects.create(usuario=self.colega, endpoint='https://push.example/novo', p256dh='p', auth='a')
        PushInscricao.objects.filter(pk=push_velho.pk).update(atualizada_em=agora - timedelta(days=91))

        resultado = reciclar_notificacoes()

        self.assertEqual(resultado, {'lidas': 1, 'antigas': 1, 'excedentes': 0, 'push': 1})
        self.assertEqual(
            set(Notificacao.objects.values_list('pk', flat=True)),
            {lida_nova.pk, nao_lida_nova.pk},
        )
        self.assertEqual(list(PushInscricao.objects.values_list('endpoint', flat=True)), ['https://push.example/novo'])

    @override_settings(NOTIFICACOES_MAX_POR_USUARIO=3)
    def test_reciclagem_mantem_so_as_mais_recentes_por_usuario(self):
        for indice in range(5):
            notificar([self.colega], tipo='teste', titulo=f'Aviso {indice}')
        notificar([self.admin_com_comercial], tipo='teste', titulo='Do outro')

        resultado = reciclar_notificacoes()

        self.assertEqual(resultado['excedentes'], 2)
        self.assertEqual(
            list(Notificacao.objects.filter(usuario=self.colega).values_list('titulo', flat=True)),
            ['Aviso 4', 'Aviso 3', 'Aviso 2'],
        )
        self.assertEqual(Notificacao.objects.filter(usuario=self.admin_com_comercial).count(), 1)

    def test_reciclagem_automatica_roda_uma_vez_por_intervalo(self):
        cache.clear()
        with patch('apps.notificacoes.reciclagem.reciclar_notificacoes', return_value={}) as reciclar:
            self.api.force_authenticate(user=self.colega)
            self.api.get('/api/notificacoes/nao-lidas/')
            self.api.get('/api/notificacoes/nao-lidas/')
            notificar([self.colega], tipo='teste', titulo='x')
        reciclar.assert_called_once()
        cache.clear()

    def test_comando_reciclar_notificacoes(self):
        saida = StringIO()
        call_command('reciclar_notificacoes', stdout=saida)
        self.assertIn('Reciclagem concluída', saida.getvalue())

    @override_settings(FRONTEND_BASE_URL='https://erp.transcamila.com.br')
    def test_card_do_chat_tem_botao_para_o_erp(self):
        corpo = montar_mensagem(titulo='Nova proposta 002-2026', mensagem='Transferência para CCAB', link='/comercial/propostas?proposta=7')
        self.assertIn('Nova proposta 002-2026', corpo['text'])
        card = corpo['cardsV2'][0]['card']
        self.assertEqual(card['header']['title'], 'Nova proposta 002-2026')
        botao = card['sections'][0]['widgets'][1]['buttonList']['buttons'][0]
        self.assertEqual(botao['onClick']['openLink']['url'], 'https://erp.transcamila.com.br/comercial/propostas?proposta=7')
