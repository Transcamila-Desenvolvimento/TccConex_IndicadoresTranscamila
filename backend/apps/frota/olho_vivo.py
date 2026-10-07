"""Catálogo e regras do questionário Olho vivo na estrada."""

from __future__ import annotations

from django.utils import timezone

COMPORTAMENTOS: tuple[tuple[str, str], ...] = (
    ('velocidade-acima-limite', 'Velocidade acima do limite'),
    ('sinalizacao-regras', 'Não respeitar a sinalização e regras de trânsito'),
    ('sono-cansaco-atencao', 'Sono/cansaço/falta de atenção'),
    ('sem-cinto', 'Dirigir sem cinto de segurança'),
    ('distancia-insegura', 'Não deixar distância segura do veículo da frente'),
    ('comendo-fumando', 'Comendo ou fumando enquanto dirige'),
    ('radio-celular', 'Atendendo rádio, celular ou nextel'),
    ('ultrapassagem-insegura', 'Ultrapassagens inseguras ou em local inadequado'),
    ('velocidade-trecho', 'Velocidade inadequada para o trecho'),
    ('sem-seta', 'Não utilizar a seta para troca de faixa de rolamento'),
)

CHAVES_COMPORTAMENTO = {chave for chave, _ in COMPORTAMENTOS}
ANO_MINIMO = 2019


def ano_maximo() -> int:
    return timezone.localdate().year


def period_key_de(ano: int, mes: int) -> str:
    return f'{ano}-{int(mes):02d}'


def validar_ano(ano) -> int:
    try:
        ano_int = int(ano)
    except (TypeError, ValueError):
        raise ValueError('Informe o ano.') from None
    if ano_int < ANO_MINIMO or ano_int > ano_maximo():
        raise ValueError(f'O ano deve estar entre {ANO_MINIMO} e {ano_maximo()}.')
    return ano_int


def validar_periodo(ano, mes) -> tuple[int, int]:
    ano_int = validar_ano(ano)
    try:
        mes_int = int(mes)
    except (TypeError, ValueError):
        raise ValueError('Informe o mês.') from None
    if mes_int < 1 or mes_int > 12:
        raise ValueError('Informe um mês válido.')
    return ano_int, mes_int


def validar_itens(itens) -> dict[str, int]:
    if not isinstance(itens, list):
        raise ValueError('Informe a recorrência de cada comportamento.')
    recebidos: dict[str, int] = {}
    for item in itens:
        if not isinstance(item, dict):
            raise ValueError('Informe a recorrência de cada comportamento.')
        chave = item.get('comportamento')
        if chave not in CHAVES_COMPORTAMENTO:
            raise ValueError('Há um comportamento que não faz parte do questionário.')
        if chave in recebidos:
            raise ValueError('Cada comportamento deve aparecer uma vez.')
        recorrencia = item.get('recorrencia')
        if isinstance(recorrencia, bool) or not isinstance(recorrencia, int):
            raise ValueError('A recorrência deve ser um número inteiro.')
        if recorrencia < 0:
            raise ValueError('A recorrência não pode ser negativa.')
        recebidos[chave] = recorrencia
    faltantes = CHAVES_COMPORTAMENTO - recebidos.keys()
    if faltantes:
        raise ValueError('Informe a recorrência de todos os comportamentos.')
    return recebidos
