"""Edição e envio simultâneos de propostas por vários usuários."""
from contextlib import contextmanager
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime

# Trava de envio expira sozinha se o processo cair no meio do Gmail.
ENVIO_TRAVA = timedelta(minutes=5)

MENSAGEM_PROPOSTA_ALTERADA = (
    'A proposta {numero} foi alterada por outro usuário (ou por um envio já concluído) depois que a tela '
    'carregou. Atualize a lista e confira a proposta antes de tentar de novo.'
)
MENSAGEM_PROPOSTA_EM_ENVIO = (
    'A proposta {numero} está sendo enviada por outro usuário neste momento. '
    'Aguarde alguns segundos e atualize a lista.'
)


class PropostaConflito(Exception):
    """Proposta alterada ou em envio por outro usuário (HTTP 409)."""


def _numero(proposta) -> str:
    return proposta.numero_identificacao or str(proposta.pk)


def versao_confere(proposta, versao) -> bool:
    """Compara a `dataAtualizacao` que a tela carregou com a atual. Sem versão informada não há checagem."""
    texto = str(versao or '').strip()
    if not texto:
        return True
    quando = parse_datetime(texto)
    if quando is None:
        return False
    if timezone.is_naive(quando):
        quando = timezone.make_aware(quando)
    return quando == proposta.data_atualizacao


def exigir_versao(proposta, versao):
    if not versao_confere(proposta, versao):
        raise PropostaConflito(MENSAGEM_PROPOSTA_ALTERADA.format(numero=_numero(proposta)))


def envio_em_andamento(proposta, agora=None) -> bool:
    inicio = getattr(proposta, 'envio_iniciado_em', None)
    return bool(inicio and inicio > (agora or timezone.now()) - ENVIO_TRAVA)


def exigir_sem_envio(proposta):
    if envio_em_andamento(proposta):
        raise PropostaConflito(MENSAGEM_PROPOSTA_EM_ENVIO.format(numero=_numero(proposta)))


@contextmanager
def reservar_envio(propostas):
    """Marca as propostas como em envio (UPDATE condicional, vale entre usuários e servidores) e recarrega do banco."""
    from .models import PropostaComercial

    agora = timezone.now()
    livre = Q(envio_iniciado_em__isnull=True) | Q(envio_iniciado_em__lt=agora - ENVIO_TRAVA)
    reservadas = []
    try:
        for proposta in propostas:
            if not PropostaComercial.objects.filter(pk=proposta.pk).filter(livre).update(envio_iniciado_em=agora):
                raise PropostaConflito(MENSAGEM_PROPOSTA_EM_ENVIO.format(numero=_numero(proposta)))
            reservadas.append(proposta.pk)
            proposta.refresh_from_db()
        yield
    finally:
        if reservadas:
            PropostaComercial.objects.filter(pk__in=reservadas, envio_iniciado_em=agora).update(envio_iniciado_em=None)


def request_versoes(data, chave: str = 'versoes') -> list[str] | None:
    """Versão (`dataAtualizacao`) com que cada proposta foi exibida, na mesma ordem dos ids."""
    if hasattr(data, 'getlist') and chave in data:
        return [str(item or '').strip() for item in data.getlist(chave)]
    value = data.get(chave) if hasattr(data, 'get') else None
    if isinstance(value, list):
        return [str(item or '').strip() for item in value]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return None
