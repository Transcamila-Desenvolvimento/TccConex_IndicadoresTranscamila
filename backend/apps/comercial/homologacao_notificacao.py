"""Aviso no sininho/Windows quando o cliente entra em homologação ou tem a composição de produtos alterada.

Mesmos destinatários do e-mail de homologação (função "receber-email-homologacao"),
sem exigir Google vinculado; quem fez a alteração não recebe o próprio aviso.
"""

from __future__ import annotations

import logging

from django.contrib.auth import get_user_model

from apps.notificacoes.services import notificar

from .homologacao_email_service import _usuario_optou_email
from .models import ClienteComercial
from .proposta_email_service import _usuario_display

logger = logging.getLogger(__name__)

TIPO_HOMOLOGACAO_PENDENTE = 'comercial.homologacao.pendente'
TIPO_COMPOSICAO_ALTERADA = 'comercial.homologacao.composicao_alterada'


def destinatarios_homologacao(excluir=None) -> list:
    excluir_id = getattr(excluir, 'pk', excluir)
    usuarios = get_user_model().objects.filter(status='ativo').order_by('name', 'username')
    if excluir_id:
        usuarios = usuarios.exclude(pk=excluir_id)
    return [user for user in usuarios if _usuario_optou_email(user)]


def notificar_homologacao_cliente(cliente_id, usuario_id=None) -> None:
    try:
        _notificar(cliente_id, usuario_id)
    except Exception:
        # Aviso é acessório: nunca pode desfazer a alteração do cliente.
        logger.exception('Falha ao notificar homologação do cliente %s', cliente_id)


def _notificar(cliente_id, usuario_id=None) -> None:
    cliente = ClienteComercial.objects.filter(pk=cliente_id).first()
    if not cliente:
        return
    ator = get_user_model().objects.filter(pk=usuario_id).first() if usuario_id else None
    destinatarios = destinatarios_homologacao(excluir=ator)
    if not destinatarios:
        return

    from .homologacao import analisar_homologacao_produtos

    analise = analisar_homologacao_produtos(cliente)
    cliente_nome = (cliente.razao_social or cliente.nome_fantasia or '').strip() or f'Cliente {cliente.pk}'
    autor = _usuario_display(ator) if ator else 'Área Comercial'
    if analise.get('revalidacao'):
        qtd = len(analise.get('alteracoes') or [])
        detalhe = f'{qtd} alteração(ões) aguardando nova homologação' if qtd else 'Aguardando nova homologação'
        tipo = TIPO_COMPOSICAO_ALTERADA
        titulo = f'Composição de produtos alterada: {cliente_nome}'
        mensagem = f'{detalhe}. Alterado por {autor}.'
    else:
        tipo = TIPO_HOMOLOGACAO_PENDENTE
        titulo = f'Homologação pendente: {cliente_nome}'
        mensagem = f"{analise.get('resumoPendencia') or 'Pendente de validação'}. Solicitado por {autor}."

    notificar(
        destinatarios,
        tipo=tipo,
        titulo=titulo,
        mensagem=mensagem,
        link=f'/comercial/validacao-clientes?cliente={cliente.pk}',
        ambiente='Comercial',
    )
