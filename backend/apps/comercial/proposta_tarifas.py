"""Cálculo de trecho e snapshot comercial da tabela de frete na proposta."""

from __future__ import annotations

import re
from copy import deepcopy
from decimal import Decimal, ROUND_HALF_UP

from django.utils import timezone

from .icms_uf import resolver_aliquota_simulador
from .models import (
    STATUS_TABELA_PUBLICADA,
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


def snapshot_distribuicao(cliente_id, margens=None, tabela=None):
    tabela = tabela or tabela_distribuicao_do_cliente(cliente_id)
    if not tabela:
        return None
    config = aplicar_margens_config(tabela.config, margens)
    faixas = faixas_comerciais(gerar_faixas_distribuicao(config))
    veiculos = config.get('veiculosTarifa') or []
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
    texto = f'{valor:.4f}'.rstrip('0').rstrip('.')
    return texto.replace('.', ',') + '%'


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
        'veiculo': item.get('rotulo') or item.get('bandaKey'),
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

    # Consolida na mesma revisão: acumula alterações em vez de criar entradas repetidas.
    for item in reversed(historico):
        if item.get('tipo') == tipo and (item.get('revisao') or '') == revisao:
            existentes = list(item.get('alteracoes') or [])
            chaves = {(alt.get('campo'), alt.get('de'), alt.get('para')) for alt in existentes}
            for alt in novas:
                chave = (alt.get('campo'), alt.get('de'), alt.get('para'))
                if chave not in chaves:
                    existentes.append(alt)
                    chaves.add(chave)
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


# Campos comerciais relevantes para a trilha de revisão de valores (visível ao cliente).
CAMPOS_AUDITORIA = (
    ('valor_estimado', 'Valor estimado'),
)

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

    margens_antes = {(item.get('bandaKey') or item.get('rotulo')): item for item in (antes or {}).get('margens') or []}
    margens_depois = {(item.get('bandaKey') or item.get('rotulo')): item for item in (depois or {}).get('margens') or []}
    for chave in sorted(set(margens_antes) | set(margens_depois), key=lambda item: str(item or '')):
        antigo = margens_antes.get(chave) or {}
        novo = margens_depois.get(chave) or {}
        rotulo = novo.get('rotulo') or antigo.get('rotulo') or chave
        de_num = _margem_decimal(antigo.get('margem'))
        para_num = _margem_decimal(novo.get('margem'))
        if de_num is None and para_num is None:
            continue
        if de_num is not None and para_num is not None and de_num == para_num:
            continue
        _push_alt(
            alteracoes,
            f'Margem {rotulo}',
            _fmt_margem_pct(de_num) if de_num is not None else '—',
            _fmt_margem_pct(para_num) if para_num is not None else '—',
        )

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
