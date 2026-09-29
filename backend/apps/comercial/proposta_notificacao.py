"""Avisa quem tem o ambiente Comercial quando uma proposta nova é criada."""

from __future__ import annotations

import logging

from django.contrib.auth import get_user_model

from apps.notificacoes.services import destinatarios_ambiente, notificar

from .models import PropostaComercial
from .proposta_email_service import _servico_label, _usuario_display

logger = logging.getLogger(__name__)

TIPO_PROPOSTA_CRIADA = 'comercial.proposta.criada'


def notificar_proposta_criada(proposta_id, autor_id=None) -> None:
    try:
        proposta = PropostaComercial.objects.select_related('cliente').get(pk=proposta_id)
    except PropostaComercial.DoesNotExist:
        return
    autor = get_user_model().objects.filter(pk=autor_id).first() if autor_id else None
    destinatarios = destinatarios_ambiente('Comercial', excluir=autor)
    if not destinatarios:
        return
    numero = proposta.numero_identificacao or ''
    cliente = (
        proposta.cliente_nome
        or (proposta.cliente.razao_social if proposta.cliente_id else '')
        or 'cliente não informado'
    )
    titulo = f'Nova proposta {numero}'.strip()
    mensagem = f'{_servico_label(proposta)} para {cliente}, criada por {_usuario_display(autor)}.'
    try:
        notificar(
            destinatarios,
            tipo=TIPO_PROPOSTA_CRIADA,
            titulo=titulo,
            mensagem=mensagem,
            link=f'/comercial/propostas?proposta={proposta.pk}',
            ambiente='Comercial',
        )
    except Exception:
        # Aviso é acessório: nunca pode desfazer a criação da proposta.
        logger.exception('Falha ao notificar criação da proposta %s', proposta_id)
