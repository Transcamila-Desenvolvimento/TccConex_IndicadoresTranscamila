"""Alíquotas ICMS por UF — cadastro simplificado (percentual por estado)."""

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

UFS_BRASIL = (
    'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
    'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
)

REGIOES_BR = (
    {'key': 'norte', 'label': 'Norte', 'ufs': ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO']},
    {'key': 'nordeste', 'label': 'Nordeste', 'ufs': ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE']},
    {'key': 'centro-oeste', 'label': 'Centro-Oeste', 'ufs': ['DF', 'GO', 'MT', 'MS']},
    {'key': 'sudeste', 'label': 'Sudeste', 'ufs': ['ES', 'MG', 'RJ', 'SP']},
    {'key': 'sul', 'label': 'Sul', 'ufs': ['PR', 'RS', 'SC']},
)

# Alíquota interna de referência por UF (padrão Brasil).
ALIQUOTAS_POR_UF_PADRAO = {
    'AC': 17,
    'AL': 18,
    'AM': 18,
    'AP': 18,
    'BA': 18,
    'CE': 18,
    'DF': 18,
    'ES': 17,
    'GO': 17,
    'MA': 18,
    'MG': 18,
    'MS': 17,
    'MT': 17,
    'PA': 17,
    'PB': 18,
    'PE': 18,
    'PI': 18,
    'PR': 18,
    'RJ': 20,
    'RN': 18,
    'RO': 18,
    'RR': 17,
    'RS': 18,
    'SC': 17,
    'SE': 18,
    'SP': 18,
    'TO': 18,
}

# Regras interestaduais — reservadas para cálculo futuro no simulador.
REGIAO_ALIQUOTA_12_ORIGEM = frozenset({
    'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MS', 'MT',
    'PA', 'PB', 'PE', 'PI', 'RN', 'RO', 'RR', 'SE', 'TO',
})
ORIGEM_SUL_SUDESTE = frozenset({'MG', 'PR', 'RJ', 'RS', 'SC', 'SP'})


def _parse_percentual(value, default: int) -> int:
    try:
        numero = int(Decimal(str(value).replace(',', '.')))
    except (InvalidOperation, ValueError, TypeError):
        numero = default
    return max(0, min(100, numero))


def aliquotas_por_uf_padrao() -> dict[str, int]:
    return dict(ALIQUOTAS_POR_UF_PADRAO)


def aliquota_interestadual_padrao(origem: str, destino: str) -> int:
    """Lookup interestadual conforme legislação."""
    origem = origem.upper()
    destino = destino.upper()
    if origem == destino:
        return ALIQUOTAS_POR_UF_PADRAO[origem]
    if origem in REGIAO_ALIQUOTA_12_ORIGEM:
        return 12
    if origem in ORIGEM_SUL_SUDESTE:
        if destino in REGIAO_ALIQUOTA_12_ORIGEM:
            return 7
        return 12
    return 12


def resolver_aliquota_simulador(origem: str, destino: str, aliquotas_cadastro: dict | None = None) -> tuple[int, str]:
    """Retorna (alíquota %, tipo: interno|interestadual)."""
    origem = (origem or '').strip().upper()[:2]
    destino = (destino or '').strip().upper()[:2]
    if origem not in UFS_BRASIL or destino not in UFS_BRASIL:
        raise ValueError('UF inválida.')

    if origem == destino:
        aliquotas = normalizar_aliquotas(aliquotas_cadastro)
        return aliquotas.get(origem, ALIQUOTAS_POR_UF_PADRAO[origem]), 'interno'
    return aliquota_interestadual_padrao(origem, destino), 'interestadual'


# Planilha CCAB Rev.61: origem PR aplica ICMS só no subtotal; pedágio entra depois.
UF_ICMS_SEM_PEDAGIO = 'PR'


def calcular_icms_frete(
    total: Decimal,
    uf_origem: str,
    uf_destino: str,
    aliquotas_cadastro: dict | None = None,
    subtotal: Decimal | None = None,
    pedagio: Decimal | None = None,
) -> dict | None:
    """ICMS por dentro — mesma regra da planilha CCAB Rev.61.

    FRETE TOTAL = SE(origem=PR; subtotal/(1−alíquota)+pedágio; (subtotal+pedágio)/(1−alíquota))
    ICMS = FRETE TOTAL − subtotal − pedágio
    """
    origem = (uf_origem or '').strip().upper()[:2]
    destino = (uf_destino or '').strip().upper()[:2]
    if not origem or not destino:
        return None
    try:
        aliquota, tipo = resolver_aliquota_simulador(origem, destino, aliquotas_cadastro)
    except ValueError:
        return None

    two = Decimal('0.01')
    if subtotal is not None and pedagio is not None:
        base_sem_pedagio = subtotal.quantize(two, rounding=ROUND_HALF_UP)
        valor_pedagio = pedagio.quantize(two, rounding=ROUND_HALF_UP)
    else:
        base_sem_pedagio = total.quantize(two, rounding=ROUND_HALF_UP)
        valor_pedagio = Decimal('0')

    inclui_pedagio_na_base = origem != UF_ICMS_SEM_PEDAGIO
    if inclui_pedagio_na_base:
        base = base_sem_pedagio + valor_pedagio
    else:
        base = base_sem_pedagio

    if aliquota <= 0:
        total_com_icms = base_sem_pedagio + valor_pedagio
        return {
            'ufOrigem': origem,
            'ufDestino': destino,
            'tipo': tipo,
            'aliquotaPercent': aliquota,
            'valor': Decimal('0'),
            'totalComIcms': total_com_icms,
            'incluiPedagioNaBase': inclui_pedagio_na_base,
        }

    divisor = Decimal('1') - (Decimal(aliquota) / Decimal('100'))
    if inclui_pedagio_na_base:
        total_com_icms = (base / divisor).quantize(two, rounding=ROUND_HALF_UP)
    else:
        total_com_icms = (base / divisor).quantize(two, rounding=ROUND_HALF_UP) + valor_pedagio
    icms_valor = (total_com_icms - base_sem_pedagio - valor_pedagio).quantize(two, rounding=ROUND_HALF_UP)
    return {
        'ufOrigem': origem,
        'ufDestino': destino,
        'tipo': tipo,
        'aliquotaPercent': aliquota,
        'valor': icms_valor,
        'totalComIcms': total_com_icms,
        'incluiPedagioNaBase': inclui_pedagio_na_base,
    }


def normalizar_aliquotas(raw: dict | None) -> dict[str, int]:
    padrao = aliquotas_por_uf_padrao()
    if not isinstance(raw, dict):
        return padrao

    # Formato legado: matriz origem → destino (usa diagonal como alíquota da UF).
    if any(isinstance(valor, dict) for valor in raw.values()):
        aliquotas: dict[str, int] = {}
        for uf in UFS_BRASIL:
            linha = raw.get(uf)
            if isinstance(linha, dict):
                aliquotas[uf] = _parse_percentual(linha.get(uf), padrao[uf])
            else:
                aliquotas[uf] = padrao[uf]
        return aliquotas

    aliquotas = {}
    for uf in UFS_BRASIL:
        aliquotas[uf] = _parse_percentual(raw.get(uf), padrao[uf])
    return aliquotas
