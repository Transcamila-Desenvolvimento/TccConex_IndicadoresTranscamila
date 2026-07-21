from __future__ import annotations

from django.db import transaction
from django.db.models import Max

from .constants import (
    EXPEDICAO_PREFIXO_COMUM,
    EXPEDICAO_VALUES,
    MAX_EXPEDICOES_POR_PROTOCOLO,
    MAX_NOTAS_FISCAIS,
)
from .models import ClienteProtocolo, ProtocoloEnvio


def parse_notas_fiscais(raw: str) -> list[str]:
    if not raw or not str(raw).strip():
        raise ValueError('Informe ao menos uma nota fiscal.')
    notas = [nf.strip() for nf in str(raw).split(',') if nf.strip()]
    if not notas:
        raise ValueError('Informe ao menos uma nota fiscal.')
    if len(notas) > MAX_NOTAS_FISCAIS:
        raise ValueError(f'O protocolo aceita no máximo {MAX_NOTAS_FISCAIS} notas fiscais.')
    return notas


def normalize_notas_fiscais(raw: str) -> str:
    return ', '.join(parse_notas_fiscais(raw))


def gerar_numero_sequencial(cliente: ClienteProtocolo) -> int:
    """Gera o próximo número de protocolo para o cliente, de forma atômica.

    O próximo número é sempre o maior número existente no banco + 1 — a
    sequência continua do último protocolo real, mesmo que o contador do
    cliente tenha divergido por exclusões antigas. Cada cliente possui sua
    própria sequência numérica, independente dos demais.
    """
    with transaction.atomic():
        cliente_bloqueado = ClienteProtocolo.objects.select_for_update().get(pk=cliente.pk)
        maior_existente = (
            ProtocoloEnvio.objects.filter(cliente=cliente_bloqueado)
            .aggregate(maior=Max('numero_sequencial'))['maior']
            or 0
        )
        proximo = maior_existente + 1
        cliente_bloqueado.ultimo_numero_protocolo = proximo
        cliente_bloqueado.save(update_fields=['ultimo_numero_protocolo'])
        return proximo


def liberar_numeros_sequenciais(cliente: ClienteProtocolo, numeros_excluidos: list[int]) -> None:
    """Devolve à sequência do cliente apenas os números excluídos que estavam
    no topo do contador (o último criado, ou os últimos, se contíguos).

    Ex.: contador em 22 e exclusão do 22 → contador volta a 21 e o próximo
    protocolo criado reutiliza o 22. Números excluídos no meio da sequência
    (ex.: 20 com o contador em 22) ficam queimados de forma permanente, para
    que um número nunca identifique dois protocolos diferentes.
    """
    excluidos = set(numeros_excluidos)
    if not excluidos:
        return
    with transaction.atomic():
        cliente_bloqueado = ClienteProtocolo.objects.select_for_update().get(pk=cliente.pk)
        contador = cliente_bloqueado.ultimo_numero_protocolo
        while contador > 0 and contador in excluidos:
            contador -= 1
        if contador != cliente_bloqueado.ultimo_numero_protocolo:
            cliente_bloqueado.ultimo_numero_protocolo = contador
            cliente_bloqueado.save(update_fields=['ultimo_numero_protocolo'])


def notas_fiscais_duplicadas(
    *, cliente: ClienteProtocolo, notas: list[str], protocolo_atual_id: int | None = None,
) -> list[str]:
    """Retorna as NFs da lista que já estão registradas em outro protocolo do mesmo
    cliente. NFs repetidas em protocolos de clientes diferentes são permitidas."""
    qs = ProtocoloEnvio.objects.filter(cliente=cliente)
    if protocolo_atual_id:
        qs = qs.exclude(pk=protocolo_atual_id)
    usadas: set[str] = set()
    for nota_fiscal_raw in qs.values_list('nota_fiscal', flat=True):
        usadas.update(nf.strip() for nf in nota_fiscal_raw.split(',') if nf.strip())

    duplicadas = []
    vistas: set[str] = set()
    for nf in notas:
        if nf in usadas and nf not in vistas:
            vistas.add(nf)
            duplicadas.append(nf)
    return duplicadas


def combinar_expedicoes(nomes: list[str]) -> str:
    """Combina até MAX_EXPEDICOES_POR_PROTOCOLO expedições selecionadas em uma
    única string de exibição/armazenamento.

    Ex.: ['Transcamila Barueri', 'Transcamila Ibiporã'] -> 'Transcamila Barueri/Ibiporã'
    """
    nomes = [nome for nome in nomes if nome]
    if len(nomes) <= 1:
        return nomes[0] if nomes else ''
    sufixos = [
        nome[len(EXPEDICAO_PREFIXO_COMUM):] if nome.startswith(EXPEDICAO_PREFIXO_COMUM) else nome
        for nome in nomes
    ]
    return EXPEDICAO_PREFIXO_COMUM + '/'.join(sufixos)


def separar_expedicoes(valor: str | None) -> list[str]:
    """Reverte combinar_expedicoes, recuperando a lista de expedições
    originalmente selecionadas a partir do valor combinado armazenado."""
    if not valor:
        return []
    if '/' not in valor:
        return [valor]
    if valor.startswith(EXPEDICAO_PREFIXO_COMUM):
        resto = valor[len(EXPEDICAO_PREFIXO_COMUM):]
        return [f'{EXPEDICAO_PREFIXO_COMUM}{parte}' for parte in resto.split('/')]
    return valor.split('/')


def validate_protocolo_payload(
    *,
    cliente: ClienteProtocolo,
    expedicoes: list[str] | None,
    nota_fiscal: str,
    protocolo_atual_id: int | None = None,
) -> tuple[str, str]:
    notas = parse_notas_fiscais(nota_fiscal)

    duplicadas = notas_fiscais_duplicadas(
        cliente=cliente, notas=notas, protocolo_atual_id=protocolo_atual_id,
    )
    if duplicadas:
        raise ValueError(
            f'As seguintes NFs já foram registradas para o cliente "{cliente.nome}": '
            f'{", ".join(duplicadas)}'
        )

    notas_normalizadas = ', '.join(notas)

    expedicoes = [expedicao for expedicao in (expedicoes or []) if expedicao]

    if len(expedicoes) > MAX_EXPEDICOES_POR_PROTOCOLO:
        raise ValueError(f'Selecione no máximo {MAX_EXPEDICOES_POR_PROTOCOLO} expedições.')
    if any(expedicao not in EXPEDICAO_VALUES for expedicao in expedicoes):
        raise ValueError('Expedição inválida.')
    if cliente.requer_expedicao and not expedicoes:
        raise ValueError('Este cliente requer seleção de expedição.')

    return notas_normalizadas, combinar_expedicoes(expedicoes)
