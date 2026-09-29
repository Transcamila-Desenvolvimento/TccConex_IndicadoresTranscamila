"""Reciclagem periódica dos avisos para a tabela não crescer sem limite.

Sem agendador no projeto: `reciclar_se_devido()` roda no máximo uma vez por
intervalo, disparada pelo uso normal (novo aviso ou polling do sininho).
"""

from __future__ import annotations

import logging
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.db.models import Count
from django.utils import timezone

from .models import Notificacao, PushInscricao

logger = logging.getLogger(__name__)

CACHE_ULTIMA_RECICLAGEM = 'notificacoes:reciclagem:ultima'


def _config(nome: str, padrao: int) -> int:
    try:
        return max(1, int(getattr(settings, nome, padrao)))
    except (TypeError, ValueError):
        return padrao


def reciclar_notificacoes(agora=None) -> dict:
    agora = agora or timezone.now()
    reter_lidas_dias = _config('NOTIFICACOES_RETER_LIDAS_DIAS', 30)
    reter_dias = _config('NOTIFICACOES_RETER_DIAS', 90)
    max_por_usuario = _config('NOTIFICACOES_MAX_POR_USUARIO', 200)
    reter_push_dias = _config('NOTIFICACOES_PUSH_RETER_DIAS', 90)

    lidas, _ = Notificacao.objects.filter(
        lida_em__lt=agora - timedelta(days=reter_lidas_dias),
    ).delete()
    antigas, _ = Notificacao.objects.filter(
        criada_em__lt=agora - timedelta(days=reter_dias),
    ).delete()

    excedentes = 0
    usuarios_acima = (
        Notificacao.objects.values('usuario_id')
        .annotate(total=Count('id'))
        .filter(total__gt=max_por_usuario)
        .values_list('usuario_id', flat=True)
    )
    for usuario_id in list(usuarios_acima):
        manter = list(
            Notificacao.objects.filter(usuario_id=usuario_id)
            .order_by('-criada_em', '-id')
            .values_list('id', flat=True)[:max_por_usuario]
        )
        removidas, _ = Notificacao.objects.filter(usuario_id=usuario_id).exclude(id__in=manter).delete()
        excedentes += removidas

    push, _ = PushInscricao.objects.filter(
        atualizada_em__lt=agora - timedelta(days=reter_push_dias),
    ).delete()

    return {'lidas': lidas, 'antigas': antigas, 'excedentes': excedentes, 'push': push}


def reciclar_se_devido() -> None:
    intervalo = _config('NOTIFICACOES_RECICLAGEM_INTERVALO_HORAS', 24) * 60 * 60
    if not cache.add(CACHE_ULTIMA_RECICLAGEM, timezone.now().isoformat(), intervalo):
        return
    try:
        resultado = reciclar_notificacoes()
        if any(resultado.values()):
            logger.info('Reciclagem de notificações: %s', resultado)
    except Exception:
        cache.delete(CACHE_ULTIMA_RECICLAGEM)
        logger.exception('Falha na reciclagem de notificações')
