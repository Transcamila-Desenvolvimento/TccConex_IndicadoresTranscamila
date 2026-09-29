"""Cálculo de trecho e snapshot comercial da tabela de frete na proposta."""

from __future__ import annotations

import re
from copy import deepcopy
from decimal import Decimal, ROUND_HALF_UP

from django.utils import timezone

from .icms_uf import resolver_aliquota_simulador
from .models import (
    STATUS_TABELA_PUBLICADA,
    TIPO_GENERALIDADE_ARMAZENAGEM,
    TIPO_GENERALIDADE_CHOICES,
    TIPO_TABELA_DISTRIBUICAO,
    TabelaFrete,
    ensure_matriz_icms,
)
from .tabela_distribuicao import (
    VEICULOS_TARIFA_MODELO_OFICIAL,
    _faixa_por_km,
    _indice_veiculos_tarifa,
    _item_antt_consulta,
    _money,
    _tarifa_veiculo_antt,
    gerar_faixas_distribuicao,
    merge_config,
    normalizar_veiculos_tarifa,
    preset_config_oficial_distribuicao,
)

UF_RE = re.compile(r'(?:^|[\s\-–,;/])([A-Za-z]{2})\s*$')
TWO = Decimal('0.01')
MODO_ENVIO_ERRATA = 'errata'
MODO_ENVIO_REVISAO = 'revisao'


def uf_de_endereco(texto: str) -> str:
    match = UF_RE.search((texto or '').strip())
    if not match:
        return ''
    return match.group(1).upper()


def aplicar_margens_config(config, margens):
    derivado = deepcopy(config or {})
    veiculos = normalizar_veiculos_tarifa(derivado.get('veiculosTarifa') or VEICULOS_TARIFA_MODELO_OFICIAL)
    mapa = {}
    if isinstance(margens, list):
        for item in margens:
            if isinstance(item, dict) and item.get('bandaKey'):
                mapa[str(item['bandaKey'])] = str(item.get('margem') or '')
    elif isinstance(margens, dict):
        mapa = {str(chave): str(valor) for chave, valor in margens.items()}
    for item in veiculos:
        if item['bandaKey'] in mapa and mapa[item['bandaKey']] not in ('', None):
            item['margem'] = mapa[item['bandaKey']]
    derivado['veiculosTarifa'] = veiculos
    return derivado


def _margem_decimal(valor):
    texto = str(valor or '').strip().replace(',', '.')
    if not texto:
        return None
    try:
        return Decimal(texto)
    except Exception:
        return None


def _fmt_margem_pct(valor: Decimal) -> str:
    pct = (valor * Decimal('100')).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)
    texto = f'{pct}'.rstrip('0').rstrip('.')
    return f'{texto}%'


def normalizar_margens_proposta(cliente_id, margens):
    """Mantém só overrides: remove itens iguais à margem da tabela vigente do cliente."""
    if not isinstance(margens, list):
        return []
    tabela = tabela_distribuicao_do_cliente(cliente_id) if cliente_id else None
    base_config = (tabela.config if tabela else None) or preset_config_oficial_distribuicao()
    padrao = {
        str(item.get('bandaKey')): _margem_decimal(item.get('margem'))
        for item in normalizar_veiculos_tarifa(base_config.get('veiculosTarifa') or VEICULOS_TARIFA_MODELO_OFICIAL)
        if item.get('bandaKey')
    }
    limpas = []
    for item in margens:
        if not isinstance(item, dict) or not item.get('bandaKey'):
            continue
        chave = str(item.get('bandaKey'))
        atual = _margem_decimal(item.get('margem'))
        if atual is None:
            continue
        referencia = padrao.get(chave)
        if referencia is not None and atual == referencia:
            continue
        limpas.append({
            'bandaKey': chave,
            'rotulo': item.get('rotulo') or chave,
            'margem': str(atual),
        })
    return limpas


def faixas_comerciais(faixas):
    limpas = []
    for faixa in faixas or []:
        if not isinstance(faixa, dict):
            continue
        row = dict(faixa)
        tarifas = []
        for tarifa in faixa.get('tarifas') or []:
            if not isinstance(tarifa, dict):
                continue
            item = dict(tarifa)
            item.pop('antt', None)
            item.pop('margem', None)
            tarifas.append(item)
        row['tarifas'] = tarifas
        limpas.append(row)
    return limpas


def tabela_distribuicao_do_cliente(cliente_id):
    if not cliente_id:
        return None
    return (
        TabelaFrete.objects.filter(
            tipo=TIPO_TABELA_DISTRIBUICAO,
            status=STATUS_TABELA_PUBLICADA,
            clientes__pk=cliente_id,
        )
        .order_by('-vigencia_inicio', '-revisao', '-pk')
        .first()
    )


def rotulos_veiculo_cliente(cliente_id):
    """bandaKey (código do veículo no catálogo) -> nome do veículo como o cliente o conhece."""
    if not cliente_id:
        return {}
    from .models import VeiculoRotuloCliente

    return dict(
        VeiculoRotuloCliente.objects.filter(cliente_id=cliente_id).values_list('veiculo__codigo', 'rotulo')
    )


def _aplicar_rotulos_cliente(faixas, veiculos, rotulos):
    if not rotulos:
        return
    for faixa in faixas:
        for tarifa in faixa.get('tarifas') or []:
            if tarifa.get('key') in rotulos:
                tarifa['rotulo'] = rotulos[tarifa['key']]
    for item in veiculos:
        if item.get('bandaKey') in rotulos:
            item['rotulo'] = rotulos[item['bandaKey']]


def snapshot_distribuicao(cliente_id, margens=None, tabela=None):
    tabela = tabela or tabela_distribuicao_do_cliente(cliente_id)
    if not tabela:
        return None
    config = aplicar_margens_config(tabela.config, margens)
    faixas = faixas_comerciais(gerar_faixas_distribuicao(config))
    veiculos = deepcopy(config.get('veiculosTarifa') or [])
    _aplicar_rotulos_cliente(faixas, veiculos, rotulos_veiculo_cliente(cliente_id))
    return {
        'tabelaId': str(tabela.pk),
        'nome': tabela.nome,
        'codigo': tabela.codigo,
        'revisaoTabela': tabela.revisao,
        'veiculosTarifa': [
            {
                'bandaKey': item.get('bandaKey'),
                'rotulo': item.get('rotulo'),
                'margem': item.get('margem'),
            }
            for item in veiculos
        ],
        'faixas': faixas,
        'grisAdvUnificado': bool(config.get('grisAdvUnificado')),
    }


def _item_veiculo(config, veiculo_key):
    indice = _indice_veiculos_tarifa(config)
    chave = str(veiculo_key or '').strip()
    if chave in indice:
        return indice[chave]
    rotulo = chave.lower()
    for item in indice.values():
        if (item.get('rotulo') or '').lower() == rotulo or item.get('bandaKey') == chave:
            return item
    if '7' in rotulo:
        return indice.get('acima26001')
    if '6' in rotulo or 'carreta' in rotulo:
        return indice.get('de14001')
    if 'truck' in rotulo:
        return indice.get('de9000')
    return indice.get('de9000') or (next(iter(indice.values())) if indice else None)


def _pct_fator(fator) -> str:
    valor = (Decimal(str(fator or '0')) * Decimal('100')).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
    inteiro, decimais = f'{valor:.4f}'.split('.')
    decimais = decimais.rstrip('0').ljust(2, '0')
    return f'{inteiro},{decimais}%'


def calcular_trecho(*, cliente_id, origem, destino, veiculo_key, km, margens=None):
    """Frete no padrão Transferência Oficial: VLOOKUP na faixa (usa kmAte), não no km exato.

    Pedágio na planilha de transferência é valor de rota (manual) — não usa R$/ton da grade.
    """
    tabela = tabela_distribuicao_do_cliente(cliente_id)
    base_config = (tabela.config if tabela else None) or preset_config_oficial_distribuicao()
    config = aplicar_margens_config(base_config, margens)
    config = merge_config(config)
    if not config.get('veiculosTarifa'):
        config['veiculosTarifa'] = deepcopy(VEICULOS_TARIFA_MODELO_OFICIAL)
    rotulos_cliente = rotulos_veiculo_cliente(cliente_id)
    chave_por_rotulo = {rotulo.strip().lower(): chave for chave, rotulo in rotulos_cliente.items()}
    veiculo_key = chave_por_rotulo.get(str(veiculo_key or '').strip().lower(), veiculo_key)
    item = _item_veiculo(config, veiculo_key)
    if not item:
        return {'erro': 'Informe o tipo de veículo da tabela de frete.'}
    try:
        km_int = int(Decimal(str(km).replace(',', '.')))
    except Exception:
        return {'erro': 'Informe a quantidade de km.'}
    if km_int < 0:
        return {'erro': 'Informe a quantidade de km.'}

    indice = _indice_veiculos_tarifa(config)
    faixas = gerar_faixas_distribuicao(config)
    faixa = _faixa_por_km(faixas, km_int)

    tarifa = None
    if faixa:
        for tarifa_item in faixa.get('tarifas') or []:
            if not isinstance(tarifa_item, dict):
                continue
            if tarifa_item.get('key') == item.get('bandaKey') and tarifa_item.get('valor') not in (None, ''):
                tarifa = Decimal(str(tarifa_item['valor']))
                break
    if tarifa is None:
        km_calc = int(faixa['kmAte']) if faixa and faixa.get('kmAte') is not None else km_int
        bruto, _antt, _margem = _tarifa_veiculo_antt(item, km_calc, _item_antt_consulta(item, indice))
        tarifa = bruto.quantize(TWO, rounding=ROUND_HALF_UP)

    gris = ''
    adv = ''
    prazo = ''
    unificado = bool(config.get('grisAdvUnificado'))
    if faixa:
        gris = _pct_fator(faixa.get('grisPercent'))
        adv = gris if unificado else _pct_fator(faixa.get('advPercent'))
        prazo_num = faixa.get('prazoFechado') or faixa.get('prazoFracionado') or ''
        prazo = f'{prazo_num} dias úteis' if prazo_num not in ('', None) else ''

    uf_origem = uf_de_endereco(origem)
    uf_destino = uf_de_endereco(destino)
    icms_txt = ''
    if uf_origem and uf_destino:
        matriz = ensure_matriz_icms()
        aliquota, tipo = resolver_aliquota_simulador(uf_origem, uf_destino, getattr(matriz, 'matriz', None))
        icms_txt = f'{aliquota}%'

    return {
        'veiculo': rotulos_cliente.get(item.get('bandaKey')) or item.get('rotulo') or item.get('bandaKey'),
        'veiculoKey': item.get('bandaKey'),
        'km': km_int,
        'kmFaixaAte': int(faixa['kmAte']) if faixa and faixa.get('kmAte') is not None else km_int,
        'tarifaFrete': _money(tarifa),
        # Transferência oficial: pedágio é valor de rota (preenchido manualmente).
        'pedagio': '',
        'gris': gris,
        'adValorem': adv,
        'grisAdvUnificado': unificado,
        'icms': icms_txt,
        'prazoDias': prazo,
        'ufOrigem': uf_origem,
        'ufDestino': uf_destino,
    }


def proxima_revisao(atual: str) -> str:
    texto = ''.join(ch for ch in str(atual or '') if ch.isdigit())
    if not texto:
        return '01'
    return f'{int(texto) + 1:02d}'


def rotulo_revisao(proposta) -> str:
    numero = proposta.numero_identificacao or '—'
    revisao = (getattr(proposta, 'revisao', None) or '').strip()
    if not revisao:
        return numero
    return f'{numero} Rev. {revisao}'


def _juntar_numeros_assunto(propostas) -> str:
    numeros = [rotulo_revisao(item) for item in propostas]
    if len(numeros) == 1:
        return numeros[0]
    if len(numeros) == 2:
        return f'{numeros[0]} e {numeros[1]}'
    return f'{", ".join(numeros[:-1])} e {numeros[-1]}'


def assunto_envio_propostas(propostas) -> str:
    if len(propostas) > 1:
        numeros = _juntar_numeros_assunto(propostas)
        prefixos = {getattr(item, 'modo_envio', '') or '' for item in propostas}
        prefixo = ''
        if prefixos == {MODO_ENVIO_ERRATA}:
            prefixo = 'Errata — '
        elif prefixos == {MODO_ENVIO_REVISAO}:
            prefixo = 'Revisão — '
        return f'{prefixo}Propostas comerciais nº {numeros} — Transcamila Cargas e Armazéns Gerais Ltda.'
    proposta = propostas[0]
    modo = getattr(proposta, 'modo_envio', '') or ''
    prefixo = ''
    if modo == MODO_ENVIO_ERRATA:
        prefixo = 'Errata — '
    elif modo == MODO_ENVIO_REVISAO:
        prefixo = 'Revisão — '
    return f'{prefixo}Proposta comercial nº {rotulo_revisao(proposta)} — Transcamila Cargas e Armazéns Gerais Ltda.'


def _valor_txt_para_decimal(texto):
    """'R$ 14.013,77 (aumento de 1,4%)' → Decimal('14013.77')."""
    bruto = str(texto or '').split('(', 1)[0]
    bruto = bruto.replace('R$', '').replace(' ', '').strip()
    if not bruto or bruto == '—':
        return None
    if ',' in bruto:
        bruto = bruto.replace('.', '').replace(',', '.')
    try:
        return Decimal(bruto)
    except Exception:
        return None


def _sem_variacao(texto) -> str:
    return str(texto or '').split(' (', 1)[0].strip()


def consolidar_alteracoes(alteracoes) -> list:
    """
    Várias edições dentro da mesma revisão viram uma linha por campo:
    valor que o cliente viu por último → valor atual (sem degraus intermediários).
    """
    ordem: list[str] = []
    por_campo: dict[str, dict] = {}
    for alt in alteracoes or []:
        if not isinstance(alt, dict):
            continue
        campo = alt.get('campo') or ''
        if campo in por_campo:
            por_campo[campo]['para'] = alt.get('para')
        else:
            ordem.append(campo)
            por_campo[campo] = {**alt}

    resultado = []
    for campo in ordem:
        alt = por_campo[campo]
        de_txt = _sem_variacao(alt.get('de'))
        para_txt = _sem_variacao(alt.get('para'))
        if de_txt == para_txt:
            continue
        # Trecho incluído e removido antes de enviar: nunca existiu para o cliente.
        if de_txt == '—' and para_txt == 'removido':
            continue
        if campo.endswith('· Frete'):
            de_num = _valor_txt_para_decimal(de_txt)
            para_num = _valor_txt_para_decimal(para_txt)
            if de_num is not None and para_num is not None:
                if de_num == para_num:
                    continue
                alt['de'], alt['para'] = _fmt_frete_revisao(de_num, para_num)
        resultado.append(alt)
    return resultado


def registrar_historico(proposta, tipo, usuario=None, resumo='', alteracoes=None):
    historico = list(proposta.historico_revisoes or [])
    nome = ''
    if usuario is not None:
        nome = (
            (getattr(usuario, 'name', None) or '')
            or (getattr(usuario, 'get_full_name', lambda: '')() or '')
            or (getattr(usuario, 'username', '') or '')
        ).strip()
    revisao = (proposta.revisao or '').strip()
    novas = list(alteracoes or [])

    # Mesma revisão (ainda não enviada): uma linha por campo, do valor enviado ao atual.
    for item in reversed(historico):
        if item.get('tipo') == tipo and (item.get('revisao') or '') == revisao:
            existentes = consolidar_alteracoes(list(item.get('alteracoes') or []) + novas)
            item['alteracoes'] = existentes[:60]
            if resumo:
                item['resumo'] = resumo
            elif existentes:
                item['resumo'] = resumo_alteracoes(existentes)
            if nome:
                item['usuario'] = nome
            item['data'] = timezone.localdate().isoformat()
            proposta.historico_revisoes = historico
            return historico

    historico.append({
        'tipo': tipo,
        'revisao': revisao,
        'data': timezone.localdate().isoformat(),
        'usuario': nome,
        'resumo': resumo or resumo_alteracoes(novas),
        'alteracoes': novas[:60],
    })
    proposta.historico_revisoes = historico
    return historico


def marcar_envio_historico(proposta, tipo, usuario=None, resumo=''):
    """Associa o envio à entrada de revisão já existente (não cria trilha vazia)."""
    historico = list(proposta.historico_revisoes or [])
    revisao = (proposta.revisao or '').strip()
    nome = ''
    if usuario is not None:
        nome = (
            (getattr(usuario, 'name', None) or '')
            or (getattr(usuario, 'get_full_name', lambda: '')() or '')
            or (getattr(usuario, 'username', '') or '')
        ).strip()
    for item in reversed(historico):
        if item.get('tipo') == tipo and (item.get('revisao') or '') == revisao:
            if resumo:
                item['resumo'] = resumo
            if nome and not (item.get('usuario') or '').strip():
                item['usuario'] = nome
            item['enviado'] = True
            item['dataEnvio'] = timezone.localdate().isoformat()
            proposta.historico_revisoes = historico
            return historico
    # Sem alterações de valor registradas: não polui a trilha do cliente.
    return historico


# Campos de cabeçalho na trilha do PDF: só margens e trechos (não o total estimado).
CAMPOS_AUDITORIA = ()

# Valores de trecho (não inclui textos longos / observações / rota).
LINHA_AUDITORIA = (
    ('veiculo', 'Veículo'),
    ('km', 'Km'),
    ('tarifa_frete', 'Frete'),
    ('pedagio', 'Pedágio'),
    ('retirada_ctnt', 'Retirada CTNT'),
    ('desova_ctnt', 'Desova CTNT'),
    ('gris', 'GRIS'),
    ('ad_valorem', 'Ad-VL'),
    ('icms', 'ICMS'),
    ('prazo_dias', 'Prazo'),
)

LINHA_AUDITORIA_DINHEIRO = frozenset({
    'tarifa_frete',
    'pedagio',
    'retirada_ctnt',
    'desova_ctnt',
})


def _fmt_auditoria(valor) -> str:
    if valor is None:
        return '—'
    if isinstance(valor, bool):
        return 'Sim' if valor else 'Não'
    if isinstance(valor, Decimal):
        texto = f'{valor.quantize(TWO, rounding=ROUND_HALF_UP)}'
        return texto
    texto = str(valor).strip()
    return texto if texto else '—'


def _fmt_money_auditoria(valor) -> str:
    if valor is None:
        return '—'
    try:
        num = valor if isinstance(valor, Decimal) else Decimal(str(valor).strip().replace(',', '.'))
    except Exception:
        texto = str(valor).strip()
        return texto if texto else '—'
    q = num.quantize(TWO, rounding=ROUND_HALF_UP)
    sinal = '-' if q < 0 else ''
    inteiro, frac = f'{abs(q):.2f}'.split('.')
    grupos = []
    while inteiro:
        grupos.insert(0, inteiro[-3:])
        inteiro = inteiro[:-3]
    return f'{sinal}R$ {".".join(grupos)},{frac}'


def _money_decimal(valor):
    if valor is None:
        return None
    if isinstance(valor, Decimal):
        return valor
    texto = str(valor).strip().replace(',', '.')
    if not texto:
        return None
    try:
        return Decimal(texto)
    except Exception:
        return None


def _fmt_variacao_frete(de, para) -> str | None:
    """Rótulo de variação: aumento/desconto com % em formato brasileiro."""
    de_num = _money_decimal(de)
    para_num = _money_decimal(para)
    if de_num is None or para_num is None:
        return None
    if de_num == 0:
        return None
    if de_num == para_num:
        return None
    delta = ((para_num - de_num) / abs(de_num)) * Decimal('100')
    pct = abs(delta).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)
    texto = f'{pct}'.replace('.', ',').rstrip('0').rstrip(',')
    if delta > 0:
        return f'aumento de {texto}%'
    return f'desconto de {texto}%'


def _fmt_frete_revisao(de, para) -> tuple[str, str]:
    """de = valor anterior; para = valor atual + variação %."""
    de_txt = _fmt_money_auditoria(de)
    para_txt = _fmt_money_auditoria(para)
    variacao = _fmt_variacao_frete(de, para)
    if variacao:
        return de_txt, f'{para_txt} ({variacao})'
    return de_txt, para_txt


def _fmt_frete_inicial(de, para) -> tuple[str, str]:
    de_txt, para_txt = _fmt_frete_revisao(de, para)
    return (
        de_txt,
        para_txt
        .replace('(aumento de ', '(aumento inicial de ')
        .replace('(desconto de ', '(desconto inicial de '),
    )


def _fretes_originais_da_trilha(proposta) -> dict:
    """Frete de cada trecho na versão original: o primeiro 'de' registrado na trilha."""
    originais: dict[str, str] = {}
    for item in proposta.historico_revisoes or []:
        if not isinstance(item, dict):
            continue
        for alt in item.get('alteracoes') or []:
            campo = (alt or {}).get('campo') or ''
            if campo.endswith('· Frete') and campo not in originais:
                originais[campo] = alt.get('de') or ''
    return originais


def _margens_originais_da_trilha(proposta):
    """Margens efetivas da versão original: base guardada na primeira revisão."""
    for item in proposta.historico_revisoes or []:
        if isinstance(item, dict) and isinstance(item.get('baseConteudo'), dict):
            return item['baseConteudo'].get('margens')
    return None


def ajustes_iniciais_proposta(proposta) -> list:
    """
    Ajustes da versão original em relação à tabela. Fixos depois do primeiro envio:
    revisões posteriores não os alteram.
    """
    congelados = list(getattr(proposta, 'ajustes_iniciais', None) or [])
    if congelados:
        return congelados
    if not (getattr(proposta, 'revisao', None) or '').strip():
        return ajustes_iniciais_distribuicao(proposta) + ajustes_iniciais_frete(proposta)
    # Proposta revisada antes do congelamento existir: reconstrói com os valores originais da trilha.
    return (
        ajustes_iniciais_distribuicao(proposta, margens_originais=_margens_originais_da_trilha(proposta))
        + ajustes_iniciais_frete(proposta, fretes_originais=_fretes_originais_da_trilha(proposta))
    )


def _preco_relativo_margem(margem):
    """Tarifa da distribuição = ANTT / (1 − margem): mesmo fator em todas as faixas de km."""
    m = _margem_decimal(margem)
    if m is None:
        return None
    m = min(max(m, Decimal('0')), Decimal('0.99'))
    return Decimal('1') / (Decimal('1') - m)


def variacao_margem_distribuicao(margem_de, margem_para) -> str | None:
    """'desconto de 2,8%' / 'aumento de 1,5%' no preço, ou None se não muda."""
    return _fmt_variacao_frete(_preco_relativo_margem(margem_de), _preco_relativo_margem(margem_para))


def _margens_padrao_cliente(cliente_id) -> list:
    tabela = tabela_distribuicao_do_cliente(cliente_id) if cliente_id else None
    base_config = (tabela.config if tabela else None) or preset_config_oficial_distribuicao()
    return [
        item
        for item in normalizar_veiculos_tarifa(base_config.get('veiculosTarifa') or VEICULOS_TARIFA_MODELO_OFICIAL)
        if item.get('bandaKey')
    ]


def linha_distribuicao(rotulo, variacao, referencia) -> dict:
    """Linha resumida por veículo (o PDF mostra sem 'de' riscado)."""
    return {
        'campo': f'Distribuição · {rotulo}',
        'de': '',
        'para': f'{variacao[:1].upper()}{variacao[1:]} {referencia}, em todas as faixas de km',
    }


def ajustes_iniciais_distribuicao(proposta, margens_originais=None) -> list:
    """Desconto/aumento inicial por veículo em relação à margem da tabela do cliente."""
    if not getattr(proposta, 'inclui_distribuicao', False):
        return []
    cliente_id = getattr(proposta, 'cliente_id', None)
    if not cliente_id:
        return []
    efetivas = margens_originais if margens_originais is not None else _margens_efetivas_auditoria(proposta)
    mapa = {str(item.get('bandaKey')): item.get('margem') for item in efetivas or [] if isinstance(item, dict)}
    alteracoes = []
    for item in _margens_padrao_cliente(cliente_id):
        chave = str(item['bandaKey'])
        if chave not in mapa:
            continue
        variacao = variacao_margem_distribuicao(item.get('margem'), mapa[chave])
        if variacao:
            variacao = variacao.replace(' de ', ' inicial de ', 1)
            alteracoes.append(linha_distribuicao(item.get('rotulo') or chave, variacao, 'sobre a tabela padrão'))
    return alteracoes


def ajustes_iniciais_frete(proposta, fretes_originais: dict | None = None) -> list:
    """Diferença tabela (margem oficial) × frete da proposta."""
    cliente_id = getattr(proposta, 'cliente_id', None)
    margens = list(getattr(proposta, 'margens_veiculo', None) or [])
    if not cliente_id or not margens:
        return []
    if not normalizar_margens_proposta(cliente_id, margens):
        return []

    alteracoes = []
    linhas = list(proposta.linhas.all().order_by('ordem', 'pk'))
    for indice, linha in enumerate(linhas, start=1):
        modalidade = (getattr(linha, 'modalidade', None) or 'transferencia').strip() or 'transferencia'
        if modalidade not in ('transferencia', 'op_portuaria'):
            continue
        veiculo_key = (getattr(linha, 'veiculo_key', None) or '').strip()
        if not veiculo_key or linha.km in (None, ''):
            continue
        base = calcular_trecho(
            cliente_id=cliente_id,
            origem=linha.origem or '',
            destino=linha.entrega or '',
            veiculo_key=veiculo_key,
            km=linha.km,
            margens=None,
        )
        if base.get('erro'):
            continue
        prefixo = _rotulo_trecho(
            {'origem': linha.origem or '', 'entrega': linha.entrega or ''},
            indice,
        )
        campo = f'{prefixo} · Frete'
        tarifa_tabela = base.get('tarifaFrete')
        tarifa_atual = linha.tarifa_frete
        if fretes_originais and campo in fretes_originais:
            original = _valor_txt_para_decimal(fretes_originais[campo])
            if original is None:
                # Trecho incluído numa revisão: não fazia parte da versão original.
                continue
            tarifa_atual = original
        de_num = _money_decimal(tarifa_tabela)
        para_num = _money_decimal(tarifa_atual)
        if de_num is None or para_num is None or de_num == para_num:
            continue
        de_txt, para_txt = _fmt_frete_inicial(tarifa_tabela, tarifa_atual)
        alteracoes.append({
            'campo': campo,
            'de': de_txt,
            'para': para_txt,
        })
    return alteracoes[:60]


def _linha_snapshot(linha) -> dict:
    return {
        'origem': linha.origem or '',
        'entrega': linha.entrega or '',
        'veiculo': linha.veiculo or '',
        'km': linha.km or '',
        'tarifa_frete': linha.tarifa_frete,
        'pedagio': linha.pedagio,
        'retirada_ctnt': linha.retirada_ctnt,
        'desova_ctnt': linha.desova_ctnt,
        'gris': linha.gris or '',
        'ad_valorem': linha.ad_valorem or '',
        'icms': linha.icms or '',
        'prazo_dias': linha.prazo_dias or '',
        'devolucao_container': linha.devolucao_container or '',
        'observacoes': linha.observacoes or '',
        'modalidade': linha.modalidade or 'transferencia',
    }


def _margens_efetivas_auditoria(proposta) -> list:
    """Margens reais usadas no cálculo (tabela do cliente + overrides da proposta)."""
    cliente_id = getattr(proposta, 'cliente_id', None)
    tabela = tabela_distribuicao_do_cliente(cliente_id) if cliente_id else None
    base_config = (tabela.config if tabela else None) or preset_config_oficial_distribuicao()
    # Snapshot já salvo na proposta pode refletir a tabela no momento do vínculo.
    snap = getattr(proposta, 'tabela_distribuicao', None) or {}
    if isinstance(snap, dict) and snap.get('veiculosTarifa') and not tabela:
        base_config = {'veiculosTarifa': snap.get('veiculosTarifa')}
    config = aplicar_margens_config(base_config, proposta.margens_veiculo or [])
    veiculos = normalizar_veiculos_tarifa(config.get('veiculosTarifa') or VEICULOS_TARIFA_MODELO_OFICIAL)
    return [
        {
            'bandaKey': item.get('bandaKey'),
            'rotulo': item.get('rotulo') or item.get('bandaKey'),
            'margem': str(item.get('margem') or ''),
        }
        for item in veiculos
        if item.get('bandaKey')
    ]


def snapshot_proposta(proposta) -> dict:
    return {
        'campos': {chave: getattr(proposta, chave) for chave, _rotulo in CAMPOS_AUDITORIA},
        'linhas': [_linha_snapshot(linha) for linha in proposta.linhas.all().order_by('ordem', 'pk')],
        'margens': _margens_efetivas_auditoria(proposta),
        'condicoes': [
            {
                'rotulo': item.get('rotulo') or '',
                'valor': item.get('valor') or '',
                'tipo': item.get('tipo') or '',
            }
            for item in (proposta.condicoes or [])
            if isinstance(item, dict)
        ],
        'armazenagem': [
            {
                'rotulo': item.get('rotulo') or '',
                'valor': item.get('valor') or '',
            }
            for item in ((proposta.tabela_armazenagem or {}).get('itens') or [])
            if isinstance(item, dict)
        ],
    }


CAMPOS_CONTEUDO_PDF = (
    'validade',
    'vigencia',
    'faturamento',
    'reajuste',
    'observacoes',
    'local_emissao',
    'inclui_transferencia',
    'inclui_distribuicao',
    'inclui_armazenagem',
    'inclui_op_portuaria',
)


def conteudo_proposta(proposta) -> dict:
    """
    O que muda o PDF do cliente mas não aparece na trilha de valores
    (generalidades, prazos comerciais, margens da distribuição).
    """
    campos = {}
    for chave in CAMPOS_CONTEUDO_PDF:
        valor = getattr(proposta, chave, None)
        campos[chave] = valor if isinstance(valor, bool) else str(valor or '').strip()
    return {
        'campos': campos,
        'condicoes': [
            {
                'rotulo': str(item.get('rotulo') or '').strip(),
                'valor': str(item.get('valor') or '').strip(),
                'tipo': str(item.get('tipo') or '').strip(),
            }
            for item in (proposta.condicoes or [])
            if isinstance(item, dict)
        ],
        'margens': _margens_efetivas_auditoria(proposta),
    }


ROTULOS_CABECALHO_REVISAO = (
    ('validade', 'Validade da proposta'),
    ('vigencia', 'Vigência do contrato'),
    ('faturamento', 'Faturamento'),
    ('reajuste', 'Reajuste'),
    ('local_emissao', 'Local de emissão'),
    ('observacoes', 'Observações'),
)

_ROTULO_TIPO_GENERALIDADE = dict(TIPO_GENERALIDADE_CHOICES)


def _diff_margens_distribuicao(base, atual) -> list:
    campos_atual = (atual or {}).get('campos') or {}
    if not campos_atual.get('inclui_distribuicao'):
        return []
    anteriores = {
        str(item.get('bandaKey')): item.get('margem')
        for item in (base or {}).get('margens') or []
        if isinstance(item, dict)
    }
    alteracoes = []
    for item in (atual or {}).get('margens') or []:
        if not isinstance(item, dict):
            continue
        chave = str(item.get('bandaKey'))
        if chave not in anteriores:
            continue
        variacao = variacao_margem_distribuicao(anteriores[chave], item.get('margem'))
        if variacao:
            alteracoes.append(linha_distribuicao(item.get('rotulo') or chave, variacao, 'em relação à versão anterior'))
    return alteracoes


def diff_conteudo_revisao(base, atual) -> tuple[list, list, list]:
    """
    Cabeçalho, preços da distribuição e generalidades entre a versão enviada
    (baseConteudo) e a seguinte. Retorna (cabecalho, distribuicao, generalidades).
    """
    campos_base = (base or {}).get('campos') or {}
    campos_atual = (atual or {}).get('campos') or {}
    cabecalho = []
    for chave, rotulo in ROTULOS_CABECALHO_REVISAO:
        if chave not in campos_base:
            continue
        de = str(campos_base.get(chave) or '').strip()
        para = str(campos_atual.get(chave) or '').strip()
        if de != para:
            cabecalho.append({'campo': rotulo, 'de': de or '—', 'para': para or '—'})

    def _indexar(conteudo):
        indice = {}
        for item in (conteudo or {}).get('condicoes') or []:
            rotulo = str(item.get('rotulo') or '').strip()
            if rotulo:
                indice[(str(item.get('tipo') or '').strip(), rotulo)] = str(item.get('valor') or '').strip()
        return indice

    cond_base = _indexar(base)
    cond_atual = _indexar(atual)
    chaves = list(cond_base) + [chave for chave in cond_atual if chave not in cond_base]
    tipos_por_rotulo: dict[str, set] = {}
    for tipo, rotulo in chaves:
        tipos_por_rotulo.setdefault(rotulo, set()).add(tipo)
    generalidades = []
    for tipo, rotulo in chaves:
        de = cond_base.get((tipo, rotulo), '')
        para = cond_atual.get((tipo, rotulo), '')
        if de == para:
            continue
        nome = rotulo
        if len(tipos_por_rotulo[rotulo]) > 1 and tipo:
            nome = f'{rotulo} ({_ROTULO_TIPO_GENERALIDADE.get(tipo, tipo)})'
        secao = 'Observações' if tipo == TIPO_GENERALIDADE_ARMAZENAGEM else 'Generalidades'
        generalidades.append({'campo': f'{secao} · {nome}', 'de': de or '—', 'para': para or '—'})
    return cabecalho, _diff_margens_distribuicao(base, atual), generalidades


def revisao_anterior(atual: str) -> str:
    texto = ''.join(ch for ch in str(atual or '') if ch.isdigit())
    if not texto or int(texto) <= 1:
        return ''
    return f'{int(texto) - 1:02d}'


def entrada_historico_revisao(proposta, tipo='revisao'):
    revisao = (proposta.revisao or '').strip()
    for item in reversed(list(proposta.historico_revisoes or [])):
        if isinstance(item, dict) and item.get('tipo') == tipo and (item.get('revisao') or '') == revisao:
            return item
    return None


def _push_alt(alteracoes, campo, de, para):
    de_txt = _fmt_auditoria(de)
    para_txt = _fmt_auditoria(para)
    if de_txt == para_txt:
        return
    alteracoes.append({'campo': campo, 'de': de_txt, 'para': para_txt})


def _rotulo_trecho(linha, indice) -> str:
    origem = (linha.get('origem') or '').strip()
    destino = (linha.get('entrega') or '').strip()
    if origem or destino:
        return f'Trecho {indice} ({origem or "—"} → {destino or "—"})'
    return f'Trecho {indice}'


def diff_proposta(antes, depois) -> list:
    """Diff focado em valores comerciais para a trilha de revisão do cliente."""
    alteracoes = []
    campos_antes = (antes or {}).get('campos') or {}
    campos_depois = (depois or {}).get('campos') or {}
    for chave, rotulo in CAMPOS_AUDITORIA:
        de = campos_antes.get(chave)
        para = campos_depois.get(chave)
        if chave == 'valor_estimado':
            de_txt = _fmt_money_auditoria(de)
            para_txt = _fmt_money_auditoria(para)
            if de_txt == para_txt:
                continue
            alteracoes.append({'campo': rotulo, 'de': de_txt, 'para': para_txt})
        else:
            _push_alt(alteracoes, rotulo, de, para)

    linhas_antes = list((antes or {}).get('linhas') or [])
    linhas_depois = list((depois or {}).get('linhas') or [])
    total = max(len(linhas_antes), len(linhas_depois))
    for indice in range(total):
        if indice >= len(linhas_antes):
            _push_alt(alteracoes, _rotulo_trecho(linhas_depois[indice], indice + 1), '—', 'incluído')
            continue
        if indice >= len(linhas_depois):
            _push_alt(alteracoes, _rotulo_trecho(linhas_antes[indice], indice + 1), 'existente', 'removido')
            continue
        prefixo = _rotulo_trecho(linhas_depois[indice], indice + 1)
        for chave, rotulo in LINHA_AUDITORIA:
            de = linhas_antes[indice].get(chave)
            para = linhas_depois[indice].get(chave)
            if chave == 'tarifa_frete':
                de_txt, para_txt = _fmt_frete_revisao(de, para)
                if de_txt == para_txt:
                    continue
                alteracoes.append({
                    'campo': f'{prefixo} · Frete',
                    'de': de_txt,
                    'para': para_txt,
                })
                continue
            if chave in LINHA_AUDITORIA_DINHEIRO:
                de_txt = _fmt_money_auditoria(de)
                para_txt = _fmt_money_auditoria(para)
                if de_txt == para_txt:
                    continue
                alteracoes.append({
                    'campo': f'{prefixo} · {rotulo}',
                    'de': de_txt,
                    'para': para_txt,
                })
            else:
                _push_alt(
                    alteracoes,
                    f'{prefixo} · {rotulo}',
                    de,
                    para,
                )

    # Margem comercial não entra na trilha do cliente — o efeito aparece no % do frete.

    arm_antes = {item.get('rotulo'): item.get('valor') for item in (antes or {}).get('armazenagem') or []}
    arm_depois = {item.get('rotulo'): item.get('valor') for item in (depois or {}).get('armazenagem') or []}
    for rotulo in sorted(set(arm_antes) | set(arm_depois), key=lambda item: str(item or '')):
        de = arm_antes.get(rotulo)
        para = arm_depois.get(rotulo)
        de_txt = _fmt_auditoria(de)
        para_txt = _fmt_auditoria(para)
        if de_txt == para_txt:
            continue
        alteracoes.append({
            'campo': f'Armazenagem · {rotulo or "item"}',
            'de': de_txt,
            'para': para_txt,
        })

    return alteracoes[:60]


def resumo_alteracoes(alteracoes) -> str:
    if not alteracoes:
        return ''
    partes = [f'{item["campo"]}: {item["de"]} → {item["para"]}' for item in alteracoes]
    texto = '; '.join(partes[:12])
    if len(partes) > 12:
        texto += f'; +{len(partes) - 12} alteração(ões)'
    return texto
