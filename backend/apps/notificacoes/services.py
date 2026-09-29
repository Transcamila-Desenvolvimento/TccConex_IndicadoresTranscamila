"""Notificações internas do ERP (sininho) com envio espelhado no Google Chat e Web Push."""

from __future__ import annotations

import logging

from django.contrib.auth import get_user_model

from apps.accounts.constants import normalize_environment, sanitize_environments

from .models import Notificacao

logger = logging.getLogger(__name__)


def destinatarios_ambiente(ambiente: str, excluir=None) -> list:
    """Usuários ativos com o ambiente marcado no cadastro.

    Admin não entra só por ser admin: precisa ter o ambiente marcado.
    """
    ambiente = normalize_environment(ambiente)
    excluir_id = getattr(excluir, 'pk', excluir)
    User = get_user_model()
    usuarios = User.objects.filter(status='ativo').order_by('name', 'username')
    if excluir_id:
        usuarios = usuarios.exclude(pk=excluir_id)
    return [user for user in usuarios if ambiente in sanitize_environments(user.environments or [])]


def notificar(usuarios, *, tipo: str, titulo: str, mensagem: str = '', link: str = '', ambiente: str = '') -> list:
    usuarios = [user for user in usuarios if getattr(user, 'pk', None)]
    if not usuarios:
        return []
    criadas = Notificacao.objects.bulk_create([
        Notificacao(
            usuario=user,
            ambiente=ambiente,
            tipo=tipo,
            titulo=titulo[:200],
            mensagem=mensagem,
            link=link[:300],
        )
        for user in usuarios
    ])

    from .google_chat import chat_habilitado, enviar_mensagem_direta

    if chat_habilitado():
        for user in usuarios:
            try:
                enviar_mensagem_direta(user, titulo=titulo, mensagem=mensagem, link=link)
            except Exception:
                # O aviso continua no sininho mesmo se o Chat falhar.
                logger.exception('Falha ao enviar notificação no Google Chat para o usuário %s', user.pk)

    from .web_push import enviar_para_usuario, montar_payload, push_habilitado

    if push_habilitado():
        for notificacao in criadas:
            payload = montar_payload(
                notificacao_id=notificacao.pk,
                titulo=titulo,
                mensagem=mensagem,
                link=link,
            )
            enviar_para_usuario(notificacao.usuario, payload)

    from .reciclagem import reciclar_se_devido

    reciclar_se_devido()
    return criadas
