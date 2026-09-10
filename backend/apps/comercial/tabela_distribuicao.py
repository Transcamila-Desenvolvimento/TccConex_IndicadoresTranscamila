import re
import unicodedata
from copy import deepcopy
from decimal import Decimal, ROUND_HALF_UP

TWO = Decimal('0.01')
FATOR_FRETE_MINIMO_PADRAO = Decimal('0.499')

MODO_TARIFA_INCREMENTO = 'incremento_primeira_faixa'
MODO_TARIFA_LINEAR = 'linear_km_ate'

COLUNA_CALCULO_FIXO = 'fixo'
COLUNA_CALCULO_PERCENTUAL_NF = 'percentual_nf'
COLUNA_CALCULO_PERCENTUAL_FRETE = 'percentual_frete'
COLUNA_CALCULO_POR_TONELADA = 'por_tonelada'
COLUNA_CALCULO_POR_KM = 'por_km'
COLUNA_CALCULOS = (
    COLUNA_CALCULO_FIXO,
    COLUNA_CALCULO_PERCENTUAL_NF,
    COLUNA_CALCULO_PERCENTUAL_FRETE,
    COLUNA_CALCULO_POR_TONELADA,
    COLUNA_CALCULO_POR_KM,
)

DEFAULT_PASSOS = [
    {'ateKm': 200, 'passo': 50},
    {'ateKm': 1000, 'passo': 100},
    {'ateKm': 3600, 'passo': 200},
]

PASSOS_LEGADO = ((1000, 50), (3600, 200))

DEFAULT_BANDAS = [
    {'key': 'ate499', 'rotulo': 'Até 499 Kg', 'unidade': 'ton', 'fator': str(Decimal(1))},
    {'key': 'de500', 'rotulo': '500 a 999 Kgs', 'unidade': 'ton', 'fator': str(Decimal(5) / Decimal(6))},
    {'key': 'de1000', 'rotulo': '1.000 a 1.999 Kgs', 'unidade': 'ton', 'fator': str(Decimal(5) / Decimal(7))},
    {'key': 'de2000', 'rotulo': '2.000 a 3.999 Kgs', 'unidade': 'ton', 'fator': str(Decimal(5) / Decimal(8))},
    {'key': 'de4000', 'rotulo': '4.000 a 5.999 Kgs', 'unidade': 'ton', 'fator': str(Decimal(5) / Decimal(9))},
    {'key': 'de6000', 'rotulo': '6.000 a 8.999 Kgs', 'unidade': 'ton', 'fator': str(Decimal(5) / Decimal(10))},
    {'key': 'de9000', 'rotulo': '9.000 a 14.000 Kgs', 'unidade': 'veiculo', 'fator': '5'},
    {'key': 'de14001', 'rotulo': '14.001 a 26.000 Kgs', 'unidade': 'veiculo', 'fator': '7.5'},
    {'key': 'acima26001', 'rotulo': '> 26.001 Kgs', 'unidade': 'veiculo', 'fator': '8.25'},
]

CCAB_BANDAS = [
    {'key': 'ate499', 'rotulo': 'Até 499 Kg', 'unidade': 'ton', 'calculo': 'divisor', 'valor': '5'},
    {'key': 'de500', 'rotulo': '500 a 999 Kgs', 'unidade': 'ton', 'calculo': 'divisor', 'valor': '6'},
    {'key': 'de1000', 'rotulo': '1.000 a 1.999 Kgs', 'unidade': 'ton', 'calculo': 'divisor', 'valor': '7'},
    {'key': 'de2000', 'rotulo': '2.000 a 3.999 Kgs', 'unidade': 'ton', 'calculo': 'divisor', 'valor': '8'},
    {'key': 'de4000', 'rotulo': '4.000 a 5.999 Kgs', 'unidade': 'ton', 'calculo': 'divisor', 'valor': '9'},
    {'key': 'de6000', 'rotulo': '6.000 a 8.999 Kgs', 'unidade': 'ton', 'calculo': 'divisor', 'valor': '10'},
    {'key': 'de9000', 'rotulo': '9.000 a 14.000 Kgs', 'unidade': 'veiculo', 'calculo': 'referencia'},
    {'key': 'de14001', 'rotulo': '14.001 a 26.000 Kgs', 'unidade': 'veiculo', 'calculo': 'mult_anterior', 'valor': '1.5'},
    {'key': 'acima26001', 'rotulo': '> 26.001 Kgs', 'unidade': 'veiculo', 'calculo': 'mult_anterior', 'valor': '1.1'},
]

DEFAULT_PRAZOS_FRACIONADO = [
    {'ateKm': 200, 'dias': 4},
    {'ateKm': 400, 'dias': 5},
    {'ateKm': 1200, 'dias': 6},
    {'ateKm': 1800, 'dias': 7},
    {'ateKm': 2600, 'dias': 8},
    {'ateKm': 3000, 'dias': 9},
    {'ateKm': 99999, 'dias': 10},
]

DEFAULT_PRAZOS_FECHADO = [
    {'ateKm': 400, 'dias': 2},
    {'ateKm': 2000, 'dias': 4},
    {'ateKm': 2600, 'dias': 5},
    {'ateKm': 3000, 'dias': 6},
    {'ateKm': 99999, 'dias': 7},
]

CCAB_TARIFA_FIXA = str((Decimal('630') * Decimal('1.065') * Decimal('1.06')).quantize(Decimal('0.001'), rounding=ROUND_HALF_UP))
CCAB_TARIFA_POR_KM = str(
    ((Decimal('7.69') * Decimal('1.13')) * Decimal('1.065') * Decimal('1.06')).quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)
)


def default_config_distribuicao():
    return {
        'kmInicio': 0,
        'kmFim': 3600,
        'modoTarifa': MODO_TARIFA_INCREMENTO,
        'passos': deepcopy(DEFAULT_PASSOS),
        'tarifaBase': '240.34',
        'incrementoPorKm': '1.96196',
        'tarifaFixa': CCAB_TARIFA_FIXA,
        'tarifaPorKm': CCAB_TARIFA_POR_KM,
        'fatorFreteMinimo': str(FATOR_FRETE_MINIMO_PADRAO),
        'pedagioBase': '17',
        'pedagioFator': '1.05',
        'grisPercent': '0.05',
        'advPercent': '0.09',
        'grisAdvPercent': '',
        'grisAdvUnificado': False,
        'bandas': deepcopy(DEFAULT_BANDAS),
        'prazosFracionado': deepcopy(DEFAULT_PRAZOS_FRACIONADO),
        'prazosFechado': deepcopy(DEFAULT_PRAZOS_FECHADO),
        'colunasExtras': [],
        'overrides': {},
    }


def preset_config_ccab():
    config = default_config_distribuicao()
    config.update({
        'modoTarifa': MODO_TARIFA_LINEAR,
        'tarifaFixa': CCAB_TARIFA_FIXA,
        'tarifaPorKm': CCAB_TARIFA_POR_KM,
        'fatorFreteMinimo': str(FATOR_FRETE_MINIMO_PADRAO),
        'grisAdvPercent': '0.0015',
        'grisPercent': '0.0015',
        'advPercent': '0.0015',
        'grisAdvUnificado': True,
        'bandas': deepcopy(CCAB_BANDAS),
    })
    return config


# Grade Hortolândia — TABELA 2022 ALBAUGH Rev.31 (col. Carreta 27 vigente)
ALBAUGH_FAIXAS_REFERENCIA = (
    (0, 50, '1999.02', '1299.36', '206.29', '160.45'),
    (51, 100, '2505.96', '1628.88', '258.11', '203.12'),
    (101, 150, '3069.76', '1995.34', '292.90', '244.08'),
    (151, 200, '3617.36', '2351.28', '340.47', '283.73'),
    (201, 300, '4806.36', '3233.23', '480.64', '373.82'),
    (301, 400, '5903.76', '3989.03', '590.37', '459.18'),
    (401, 500, '7001.16', '4809.04', '700.12', '544.54'),
    (501, 600, '8098.56', '5524.98', '809.85', '629.90'),
    (601, 700, '9195.95', '6248.87', '919.60', '715.24'),
    (701, 800, '10293.35', '7046.91', '1029.34', '800.59'),
    (801, 900, '11390.75', '7898.03', '1139.07', '885.95'),
    (901, 1000, '12488.15', '8686.24', '1248.82', '971.30'),
    (1001, 1100, '13585.54', '9509.88', '1358.55', '1056.66'),
    (1101, 1200, '14682.94', '10278.06', '1468.30', '1142.00'),
    (1201, 1300, '15780.33', '11046.23', '1578.03', '1227.36'),
    (1301, 1400, '16877.73', '11814.41', '1687.77', '1312.71'),
    (1401, 1500, '17975.13', '12582.59', '1797.52', '1398.06'),
    (1501, 1600, '19072.54', '13350.77', '1907.25', '1483.42'),
    (1601, 1700, '20169.93', '14002.95', '2016.99', '1568.77'),
    (1701, 1800, '21267.32', '14552.46', '2126.73', '1654.13'),
    (1801, 2000, '23462.11', '15753.01', '2346.20', '1824.84'),
    (2001, 2200, '25656.92', '17254.15', '2565.70', '1995.54'),
    (2201, 2300, '26754.32', '17947.15', '2675.42', '2080.89'),
    (2301, 2400, '27851.71', '18692.66', '2785.17', '2166.24'),
    (2401, 2500, '28949.10', '19440.37', '2894.91', '2251.59'),
    (2501, 2600, '30046.50', '20217.99', '3004.66', '2336.94'),
    (2601, 2800, '32241.30', '21026.70', '3224.13', '2507.66'),
    (2801, 2900, '33338.70', '21867.77', '3333.88', '2593.02'),
    (2901, 3000, '34436.09', '22378.80', '3443.60', '2678.36'),
    (3001, 3400, '38825.68', '25362.34', '3882.56', '3019.78'),
)

# Pedágio R$/ton — rota Paulínia×RO (Rev.31)
ALBAUGH_PEDAGIO_REFERENCIA_TON = '51.70'

ALBAUGH_BANDAS = [
    {
        'key': 'fracionado_ate5t',
        'rotulo': 'Fracionado 0 a 5 ton',
        'unidade': 'ton',
        'calculo': 'referencia',
    },
    {
        'key': 'fracionado_5a10t',
        'rotulo': 'Fracionado 5 a 10 ton',
        'unidade': 'ton',
        'calculo': 'referencia',
    },
    {
        'key': 'fechada_carreta27',
        'rotulo': 'Carga fechada Carreta 27',
        'unidade': 'veiculo',
        'calculo': 'referencia',
    },
    {
        'key': 'fechada_carreta30',
        'rotulo': 'Carga fechada Carreta 30',
        'unidade': 'veiculo',
        'calculo': 'referencia',
    },
    {
        'key': 'fechada_truck',
        'rotulo': 'Carga fechada Truck',
        'unidade': 'veiculo',
        'calculo': 'referencia',
    },
]

ALBAUGH_LIMITES_PESO = (
    ('fracionado_ate5t', 4999),
    ('fracionado_5a10t', 9999),
    ('fechada_carreta27', 14000),
    ('fechada_carreta30', 26000),
    ('fechada_truck', None),
)


def _albaugh_overrides():
    overrides = {}
    for km_de, km_ate, carreta27, truck, frac05, frac510 in ALBAUGH_FAIXAS_REFERENCIA:
        carreta30 = _money(_dec(carreta27) * Decimal('30') / Decimal('27'))
        overrides[chave_faixa(km_de, km_ate)] = {
            'pedagioTon': ALBAUGH_PEDAGIO_REFERENCIA_TON,
            'freteMinimo': frac05,
            'tarifas': {
                'fracionado_ate5t': frac05,
                'fracionado_5a10t': frac510,
                'fechada_carreta27': carreta27,
                'fechada_carreta30': carreta30,
                'fechada_truck': truck,
            },
        }
    return overrides


def preset_config_albaugh():
    faixas_km = [{'kmDe': km_de, 'kmAte': km_ate} for km_de, km_ate, *_ in ALBAUGH_FAIXAS_REFERENCIA]
    config = default_config_distribuicao()
    config.update({
        'kmInicio': 0,
        'kmFim': 3400,
        'modoTarifa': MODO_TARIFA_LINEAR,
        'tarifaFixa': '1447.957',
        'tarifaPorKm': '11.021267',
        'fatorFreteMinimo': '0.1',
        'pedagioBase': '160.45',
        'pedagioFator': '1',
        'advPercent': '0.0013',
        'grisPercent': '0',
        'grisAdvPercent': '',
        'grisAdvUnificado': False,
        'bandas': deepcopy(ALBAUGH_BANDAS),
        'faixasKmExplicitas': faixas_km,
        'limitesPesoBanda': [[key, limite] for key, limite in ALBAUGH_LIMITES_PESO],
        'selecaoBanda': {'fechado': 'fechada_carreta27'},
        'overrides': _albaugh_overrides(),
    })
    return config


def _chave_passos(passos):
    return tuple((int(item['ateKm']), int(item['passo'])) for item in (passos or []) if isinstance(item, dict))


def normalizar_passos(passos):
    if _chave_passos(passos) in ((), PASSOS_LEGADO):
        return deepcopy(DEFAULT_PASSOS)
    return passos


def _slug_coluna(rotulo, index, usadas):
    nfkd = unicodedata.normalize('NFKD', rotulo or '')
    ascii_text = ''.join(char for char in nfkd if not unicodedata.combining(char))
    slug = re.sub(r'[^a-z0-9]+', '_', ascii_text.lower()).strip('_') or f'extra_{index + 1}'
    base = slug
    sufixo = 2
    while slug in usadas:
        slug = f'{base}_{sufixo}'
        sufixo += 1
    usadas.add(slug)
    return slug


def _formato_coluna(calculo):
    if calculo in (COLUNA_CALCULO_PERCENTUAL_NF, COLUNA_CALCULO_PERCENTUAL_FRETE):
        return 'percentual'
    return 'moeda'


def normalizar_colunas_extras(colunas):
    if not isinstance(colunas, list):
        return []
    normalizadas = []
    usadas = set()
    for index, coluna in enumerate(colunas):
        if not isinstance(coluna, dict):
            continue
        rotulo = str(coluna.get('rotulo') or '').strip() or f'Coluna {index + 1}'
        calculo = coluna.get('calculo') if coluna.get('calculo') in COLUNA_CALCULOS else COLUNA_CALCULO_FIXO
        key = str(coluna.get('key') or '').strip()
        if not key or key in usadas:
            key = _slug_coluna(rotulo, index, usadas)
        else:
            usadas.add(key)
        incluir = coluna.get('incluirNoTotal')
        normalizadas.append({
            'key': key,
            'rotulo': rotulo,
            'calculo': calculo,
            'valor': str(coluna.get('valor') if coluna.get('valor') not in (None, '') else '0'),
            'incluirNoTotal': True if incluir is None else bool(incluir),
            'formato': _formato_coluna(calculo),
        })
    return normalizadas


def normalizar_bandas(bandas):
    if not isinstance(bandas, list) or not bandas:
        return deepcopy(DEFAULT_BANDAS)
    normalizadas = []
    for index, banda in enumerate(bandas):
        if not isinstance(banda, dict):
            continue
        item = dict(banda)
        if not item.get('key'):
            item['key'] = f'banda_{index + 1}'
        if not item.get('rotulo'):
            item['rotulo'] = item['key']
        if not item.get('unidade'):
            item['unidade'] = 'ton'
        if not item.get('calculo') and item.get('fator') is not None:
            item['calculo'] = 'multiplicador'
        if item.get('calculo') == 'multiplicador' and item.get('fator') is None:
            item['fator'] = '1'
        normalizadas.append(item)
    return normalizadas or deepcopy(DEFAULT_BANDAS)


def merge_config(raw):
    config = default_config_distribuicao()
    if not isinstance(raw, dict):
        return config
    for key in (
        'kmInicio',
        'kmFim',
        'modoTarifa',
        'tarifaBase',
        'incrementoPorKm',
        'tarifaFixa',
        'tarifaPorKm',
        'fatorFreteMinimo',
        'pedagioBase',
        'pedagioFator',
        'grisPercent',
        'advPercent',
        'grisAdvPercent',
    ):
        if raw.get(key) is not None and raw.get(key) != '':
            config[key] = raw[key]
    if _dec(config.get('incrementoPorKm'), '1.96196') == Decimal('1.962'):
        config['incrementoPorKm'] = '1.96196'
    for key in ('passos', 'bandas', 'prazosFracionado', 'prazosFechado'):
        if isinstance(raw.get(key), list) and raw[key]:
            config[key] = raw[key]
    config['passos'] = normalizar_passos(config.get('passos'))
    config['bandas'] = normalizar_bandas(config.get('bandas'))
    if config.get('modoTarifa') not in (MODO_TARIFA_INCREMENTO, MODO_TARIFA_LINEAR):
        config['modoTarifa'] = MODO_TARIFA_INCREMENTO
    if 'grisAdvUnificado' in raw:
        config['grisAdvUnificado'] = _as_bool(raw.get('grisAdvUnificado'))
    else:
        config['grisAdvUnificado'] = bool(str(config.get('grisAdvPercent') or '').strip())
    if config.get('grisAdvUnificado'):
        unificado = str(config.get('grisAdvPercent') or '').strip() or str(config.get('grisPercent') or '').strip()
        if unificado:
            config['grisAdvPercent'] = unificado
            config['grisPercent'] = unificado
            config['advPercent'] = unificado
    else:
        config['grisAdvPercent'] = ''
    if isinstance(raw.get('overrides'), dict):
        config['overrides'] = raw['overrides']
    if isinstance(raw.get('faixasKmExplicitas'), list) and raw['faixasKmExplicitas']:
        config['faixasKmExplicitas'] = raw['faixasKmExplicitas']
    if isinstance(raw.get('limitesPesoBanda'), list) and raw['limitesPesoBanda']:
        config['limitesPesoBanda'] = raw['limitesPesoBanda']
    if isinstance(raw.get('selecaoBanda'), dict):
        config['selecaoBanda'] = raw['selecaoBanda']
    config['colunasExtras'] = normalizar_colunas_extras(
        raw.get('colunasExtras') if isinstance(raw.get('colunasExtras'), list) else config.get('colunasExtras')
    )
    return config


def _dec(value, default='0'):
    if value is None or value == '':
        value = default
    return Decimal(str(value).replace(',', '.').replace('%', ''))


def _money(value):
    return str(_dec(value).quantize(TWO, rounding=ROUND_HALF_UP))


def _passo_para(km_de, passos):
    ordered = sorted(passos, key=lambda regra: int(regra['ateKm']))
    for regra in ordered:
        if int(km_de) <= int(regra['ateKm']):
            return max(1, int(regra['passo']))
    return max(1, int(ordered[-1]['passo']))


def _prazo_para(km_ate, regras):
    ordered = sorted(regras, key=lambda regra: int(regra['ateKm']))
    for regra in ordered:
        if int(km_ate) <= int(regra['ateKm']):
            return int(regra['dias'])
    return int(ordered[-1]['dias'])


def iter_faixas_km(km_inicio, km_fim, passos, faixas_explicitas=None):
    if faixas_explicitas:
        for item in faixas_explicitas:
            if not isinstance(item, dict):
                continue
            km_de = item.get('kmDe')
            km_ate = item.get('kmAte')
            if km_de is None or km_ate is None:
                continue
            yield int(km_de), int(km_ate)
        return
    de = int(km_inicio)
    fim = int(km_fim)
    inicio = de
    if not passos or fim < de:
        return
    while de <= fim:
        passo = _passo_para(de, passos)
        offset = 0 if de == inicio else 1
        ate = min(de + passo - offset, fim)
        yield de, ate
        de = ate + 1


def chave_faixa(km_de, km_ate):
    return f'{km_de}-{km_ate}'


def _tarifa_referencia_k(km_ate, primeira_ate, config):
    modo = config.get('modoTarifa', MODO_TARIFA_INCREMENTO)
    if modo == MODO_TARIFA_LINEAR:
        fixo = _dec(config.get('tarifaFixa', CCAB_TARIFA_FIXA))
        por_km = _dec(config.get('tarifaPorKm', CCAB_TARIFA_POR_KM))
        return fixo + por_km * Decimal(int(km_ate))
    base = _dec(config.get('tarifaBase', '240.34'))
    incremento = _dec(config.get('incrementoPorKm', '1.96196'))
    return base + incremento * Decimal(int(km_ate) - int(primeira_ate))


def _tarifa_coluna_principal(km_ate, primeira_ate, config, bandas):
    referencia_k = _tarifa_referencia_k(km_ate, primeira_ate, config)
    primeira = bandas[0] if bandas else {}
    calculo = primeira.get('calculo') or 'multiplicador'
    if calculo == 'divisor':
        divisor = _dec(primeira.get('valor') or primeira.get('divisor') or '1')
        if divisor == 0:
            divisor = Decimal('1')
        return referencia_k / divisor
    if calculo == 'referencia':
        return referencia_k
    return referencia_k * _dec(primeira.get('fator', '1'))


def _valor_banda(referencia_k, tarifa_principal, banda, valor_anterior):
    calculo = banda.get('calculo') or 'multiplicador'
    if calculo == 'divisor':
        divisor = _dec(banda.get('valor') or banda.get('divisor') or '1')
        if divisor == 0:
            divisor = Decimal('1')
        return referencia_k / divisor
    if calculo == 'referencia':
        return referencia_k
    if calculo == 'mult_anterior':
        base = valor_anterior if valor_anterior is not None else referencia_k
        return base * _dec(banda.get('valor', '1'))
    if calculo == 'mult_referencia':
        return referencia_k * _dec(banda.get('valor', '1'))
    return tarifa_principal * _dec(banda.get('fator', '1'))


def gerar_faixas_distribuicao(raw_config):
    config = merge_config(raw_config)
    km_inicio = int(config['kmInicio'])
    km_fim = int(config['kmFim'])
    pedagio = _dec(config['pedagioBase'], '17').quantize(TWO, rounding=ROUND_HALF_UP)
    pedagio_fator = _dec(config['pedagioFator'], '1.05')
    gris = str(config['grisPercent']).replace('%', '')
    adv = str(config['advPercent']).replace('%', '')
    bandas = config['bandas']
    overrides = config.get('overrides') or {}
    fator_minimo = _dec(config.get('fatorFreteMinimo', str(FATOR_FRETE_MINIMO_PADRAO)), str(FATOR_FRETE_MINIMO_PADRAO))
    faixas = []
    primeira_ate = None

    faixas_explicitas = config.get('faixasKmExplicitas')
    for index, (km_de, km_ate) in enumerate(
        iter_faixas_km(km_inicio, km_fim, config['passos'], faixas_explicitas=faixas_explicitas)
    ):
        if primeira_ate is None:
            primeira_ate = km_ate
        referencia_k = _tarifa_referencia_k(km_ate, primeira_ate, config)
        tarifa_principal = _tarifa_coluna_principal(km_ate, primeira_ate, config, bandas)
        tarifa_e = tarifa_principal.quantize(TWO, rounding=ROUND_HALF_UP)
        if index:
            pedagio = (pedagio * pedagio_fator).quantize(TWO, rounding=ROUND_HALF_UP)

        tarifas = []
        valor_anterior = None
        for banda in bandas:
            bruto = _valor_banda(referencia_k, tarifa_principal, banda, valor_anterior)
            valor_anterior = bruto
            tarifas.append({
                'key': banda.get('key') or '',
                'rotulo': banda.get('rotulo') or '',
                'unidade': banda.get('unidade') or 'ton',
                'valor': _money(bruto),
            })

        row = {
            'kmDe': km_de,
            'kmAte': km_ate,
            'freteMinimo': _money(tarifa_e * fator_minimo),
            'tarifas': tarifas,
            'pedagioTon': str(pedagio),
            'grisPercent': gris,
            'advPercent': adv,
            'prazoFracionado': _prazo_para(km_ate, config['prazosFracionado']),
            'prazoFechado': _prazo_para(km_ate, config['prazosFechado']),
            'extras': [
                {
                    'key': coluna['key'],
                    'rotulo': coluna['rotulo'],
                    'calculo': coluna['calculo'],
                    'formato': coluna['formato'],
                    'valor': coluna['valor'] if coluna['formato'] == 'percentual' else _money(coluna['valor']),
                    'incluirNoTotal': coluna['incluirNoTotal'],
                }
                for coluna in config.get('colunasExtras') or []
            ],
        }
        extra = overrides.get(chave_faixa(km_de, km_ate))
        if isinstance(extra, dict):
            for campo in ('freteMinimo', 'pedagioTon', 'grisPercent', 'advPercent', 'prazoFracionado', 'prazoFechado'):
                if extra.get(campo) not in (None, ''):
                    row[campo] = extra[campo]
            if isinstance(extra.get('tarifas'), dict):
                for tarifa in row['tarifas']:
                    if extra['tarifas'].get(tarifa['key']) not in (None, ''):
                        tarifa['valor'] = extra['tarifas'][tarifa['key']]
            extras_override = extra.get('extras')
            if isinstance(extras_override, dict):
                for item in row['extras']:
                    if extras_override.get(item['key']) not in (None, ''):
                        item['valor'] = extras_override[item['key']]
        faixas.append(row)
    return faixas


PESO_BANDA_LIMITES = (
    ('ate499', 499),
    ('de500', 999),
    ('de1000', 1999),
    ('de2000', 3999),
    ('de4000', 5999),
    ('de6000', 8999),
    ('de9000', 14000),
    ('de14001', 26000),
    ('acima26001', None),
)


def _limites_peso_banda(config):
    custom = config.get('limitesPesoBanda') if isinstance(config, dict) else None
    if custom:
        return tuple((item[0], item[1]) for item in custom if isinstance(item, (list, tuple)) and len(item) >= 2)
    return PESO_BANDA_LIMITES


def _banda_key_por_peso(peso_kg, modalidade='fracionado', config=None):
    config = config or {}
    selecao = config.get('selecaoBanda') if isinstance(config.get('selecaoBanda'), dict) else {}
    if modalidade == 'fechado' and selecao.get('fechado'):
        return selecao['fechado']
    peso = int(_dec(peso_kg).to_integral_value(rounding=ROUND_HALF_UP))
    for key, limite in _limites_peso_banda(config):
        if limite is None or peso <= int(limite):
            return key
    ultimo = _limites_peso_banda(config)[-1][0]
    return ultimo


def _faixa_por_km(faixas, km):
    distancia = int(km)
    for faixa in faixas:
        if int(faixa['kmDe']) <= distancia <= int(faixa['kmAte']):
            return faixa
    if not faixas:
        return None
    if distancia < int(faixas[0]['kmDe']):
        return faixas[0]
    return faixas[-1]


def _as_bool(value):
    if isinstance(value, bool):
        return value
    if value in (None, ''):
        return False
    if isinstance(value, (int, float, Decimal)):
        return bool(value)
    texto = str(value).strip().lower()
    return texto in ('1', 'true', 'yes', 'sim', 'on')


def _gris_adv_unificado(config):
    if 'grisAdvUnificado' in (config or {}):
        return _as_bool(config.get('grisAdvUnificado'))
    return bool(str((config or {}).get('grisAdvPercent') or '').strip())


def _valor_coluna_extra(coluna, *, km, toneladas, frete_base, valor_nf):
    taxa = _dec(coluna.get('valor'))
    calculo = coluna.get('calculo') or COLUNA_CALCULO_FIXO
    if calculo == COLUNA_CALCULO_PERCENTUAL_NF:
        if valor_nf in (None, ''):
            return Decimal('0')
        return _dec(valor_nf) * taxa / Decimal('100')
    if calculo == COLUNA_CALCULO_PERCENTUAL_FRETE:
        return frete_base * taxa / Decimal('100')
    if calculo == COLUNA_CALCULO_POR_TONELADA:
        return taxa * toneladas
    if calculo == COLUNA_CALCULO_POR_KM:
        return taxa * Decimal(int(km))
    return taxa


def simular_cotacao_distribuicao(raw_config, km, peso_kg, modalidade='fracionado', valor_nf=None):
    config = merge_config(raw_config)
    gris_adv_unificado = _gris_adv_unificado(config)
    faixas = gerar_faixas_distribuicao(config)
    faixa = _faixa_por_km(faixas, km)
    if not faixa:
        return {'erro': 'Nenhuma faixa de km disponível para simulação.'}

    banda_key = _banda_key_por_peso(peso_kg, modalidade=modalidade, config=config)
    tarifa = next((item for item in faixa['tarifas'] if item.get('key') == banda_key), None)
    if not tarifa and faixa['tarifas']:
        tarifa = faixa['tarifas'][0]
    if not tarifa:
        return {'erro': 'Nenhuma banda de peso disponível para simulação.'}

    peso = _dec(peso_kg)
    toneladas = peso / Decimal('1000')
    valor_unitario = _dec(tarifa['valor'])
    frete_peso = valor_unitario * toneladas if (tarifa.get('unidade') or 'ton') == 'ton' else valor_unitario
    frete_minimo = _dec(faixa['freteMinimo'])
    frete_base = max(frete_peso, frete_minimo)
    pedagio = _dec(faixa['pedagioTon']) * toneladas

    gris_valor = Decimal('0')
    adv_valor = Decimal('0')
    if valor_nf not in (None, ''):
        base_nf = _dec(valor_nf)
        if gris_adv_unificado:
            gris_valor = base_nf * _dec(faixa['grisPercent'])
        else:
            gris_valor = base_nf * _dec(faixa['grisPercent'])
            adv_valor = base_nf * _dec(faixa['advPercent'])

    subtotal = frete_base + gris_valor + adv_valor
    extras_resultado = []
    extras_soma = Decimal('0')
    for coluna in faixa.get('extras') or []:
        valor = _valor_coluna_extra(
            coluna,
            km=km,
            toneladas=toneladas,
            frete_base=frete_base,
            valor_nf=valor_nf,
        ).quantize(TWO, rounding=ROUND_HALF_UP)
        extras_resultado.append({
            'key': coluna.get('key') or '',
            'rotulo': coluna.get('rotulo') or '',
            'valor': _money(valor),
            'incluirNoTotal': bool(coluna.get('incluirNoTotal', True)),
        })
        if coluna.get('incluirNoTotal', True):
            extras_soma += valor
    total = subtotal + pedagio + extras_soma
    km_int = int(km)
    valor_por_km = (
        (frete_base / Decimal(km_int)).quantize(TWO, rounding=ROUND_HALF_UP)
        if km_int > 0
        else Decimal('0')
    )
    prazo = faixa['prazoFracionado'] if modalidade == 'fracionado' else faixa['prazoFechado']

    return {
        'km': int(km),
        'pesoKg': float(peso),
        'modalidade': modalidade,
        'faixaKm': {'de': faixa['kmDe'], 'ate': faixa['kmAte']},
        'bandaPeso': {'key': banda_key, 'rotulo': tarifa.get('rotulo') or banda_key},
        'tarifa': {
            'valor': _money(valor_unitario),
            'unidade': tarifa.get('unidade') or 'ton',
        },
        'fretePeso': _money(frete_peso),
        'freteMinimo': _money(frete_minimo),
        'freteBase': _money(frete_base),
        'pedagio': _money(pedagio),
        'grisAdvUnificado': gris_adv_unificado,
        'grisAdv': _money(gris_valor) if gris_adv_unificado else None,
        'gris': _money(gris_valor if not gris_adv_unificado else Decimal('0')),
        'adv': _money(adv_valor),
        'subtotal': _money(subtotal),
        'extras': extras_resultado,
        'valorPorKm': _money(valor_por_km),
        'total': _money(total),
        'prazoDias': prazo,
    }
