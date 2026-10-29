"""Consulta pública do CAEPI (Certificado de Aprovação de EPI).

O Ministério do Trabalho não publica uma API JSON. A consulta oficial é o
formulário em https://caepi.trabalho.gov.br/internet/ConsultaCAInternet.aspx.
"""

import html
import re
import urllib.error
import urllib.parse
import urllib.request

URL = 'https://caepi.trabalho.gov.br/internet/ConsultaCAInternet.aspx'
_USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
)
_TIMEOUT = 25
_SELECIONE = '*******Selecione*******'

_LISTA = re.compile(
    r'id="PlaceHolderConteudo_grdListaResultado_lblNrCA_(\d+)"[^>]*>(.*?)</span>',
    re.S,
)
_HISTORICO_DATA = re.compile(
    r'id="PlaceHolderConteudo_grdListaHistoricoAlteracao_lblDataHistoricoAlteracao_(\d+)"[^>]*>(.*?)</span>',
    re.S,
)
_HISTORICO_SITUACAO = re.compile(
    r'id="PlaceHolderConteudo_grdListaHistoricoAlteracao_lblSituacaoHistoricoAlteracao_(\d+)"[^>]*>(.*?)</span>',
    re.S,
)


class CaepiIndisponivel(Exception):
    pass


def _texto(fragmento: str) -> str:
    sem_tags = re.sub(r'<[^>]+>', ' ', fragmento)
    return ' '.join(html.unescape(sem_tags).replace('\xa0', ' ').split())


def _span(pagina: str, element_id: str) -> str:
    encontrado = re.search(
        rf'id="{re.escape(element_id)}"[^>]*>(.*?)</span>',
        pagina,
        re.S,
    )
    return _texto(encontrado.group(1)) if encontrado else ''


def _data(valor: str) -> str:
    texto = valor.strip()
    if ' ' in texto:
        return texto.split(' ', 1)[0]
    return texto


def _campo_oculto(pagina: str, nome: str) -> str:
    match = re.search(rf'name="{re.escape(nome)}"[^>]*value="([^"]*)"', pagina)
    if match:
        return match.group(1)
    match = re.search(rf'value="([^"]*)"[^>]*name="{re.escape(nome)}"', pagina)
    return match.group(1) if match else ''


def campos_delta(texto: str) -> dict[str, str]:
    """Lê os hidden fields de uma resposta AJAX do ASP.NET."""
    campos: dict[str, str] = {}
    cursor = 0
    tamanho = len(texto)
    while cursor < tamanho:
        marcador = texto.find('|', cursor)
        if marcador < 0:
            break
        declarado = texto[cursor:marcador]
        if not declarado.isdigit():
            break
        cursor = marcador + 1
        marcador = texto.find('|', cursor)
        if marcador < 0:
            break
        tipo = texto[cursor:marcador]
        cursor = marcador + 1
        marcador = texto.find('|', cursor)
        if marcador < 0:
            break
        nome = texto[cursor:marcador]
        cursor = marcador + 1
        valor = texto[cursor:cursor + int(declarado)]
        cursor += int(declarado)
        if cursor < tamanho and texto[cursor] == '|':
            cursor += 1
        if tipo == 'hiddenField':
            campos[nome] = valor
    return campos


def certificado_da_pagina(pagina: str, numero: str) -> dict | None:
    if not _span(pagina, 'PlaceHolderConteudo_lblNRRegistroCA'):
        return None
    datas = {indice: _texto(valor) for indice, valor in _HISTORICO_DATA.findall(pagina)}
    situacoes = {indice: _texto(valor) for indice, valor in _HISTORICO_SITUACAO.findall(pagina)}
    historico = [
        {'data': _data(datas[indice]), 'situacao': situacoes.get(indice, '')}
        for indice in sorted(datas, key=int)
    ]
    return {
        'numero': _span(pagina, 'PlaceHolderConteudo_lblNRRegistroCA') or numero,
        'situacao': _span(pagina, 'PlaceHolderConteudo_lblSituacao'),
        'validade': _data(_span(pagina, 'PlaceHolderConteudo_lblDTValidade')),
        'processo': _span(pagina, 'PlaceHolderConteudo_lblNRProcesso'),
        'cnpj': _span(pagina, 'PlaceHolderConteudo_lblNRCNPJ'),
        'razaoSocial': _span(pagina, 'PlaceHolderConteudo_lblNORazaoSocial'),
        'natureza': _span(pagina, 'PlaceHolderConteudo_lblNatureza'),
        'equipamento': _span(pagina, 'PlaceHolderConteudo_lblNOEquipamento'),
        'descricao': _span(pagina, 'PlaceHolderConteudo_lblDSAprovadoParaLaudo'),
        'historico': historico,
        'fonte': 'CAEPI — Ministério do Trabalho e Emprego',
    }


def _indice_do_resultado(pagina: str, numero: str) -> str | None:
    encontrados = [(indice, _texto(valor)) for indice, valor in _LISTA.findall(pagina)]
    if not encontrados:
        return None
    for indice, valor in encontrados:
        if valor.lstrip('0') == numero.lstrip('0'):
            return indice
    return encontrados[0][0]


def _formulario(campos: dict[str, str], numero: str) -> dict[str, str]:
    return {
        '__VIEWSTATE': campos.get('__VIEWSTATE', ''),
        '__VIEWSTATEGENERATOR': campos.get('__VIEWSTATEGENERATOR', ''),
        '__EVENTVALIDATION': campos.get('__EVENTVALIDATION', ''),
        '__EVENTTARGET': '',
        '__EVENTARGUMENT': '',
        'ctl00$PlaceHolderConteudo$txtNumeroCA': numero,
        'ctl00$PlaceHolderConteudo$cboEquipamento': _SELECIONE,
        'ctl00$PlaceHolderConteudo$cboFabricante': _SELECIONE,
        'ctl00$PlaceHolderConteudo$cboTipoProtecao': _SELECIONE,
    }


def _abrir(opener, dados: dict[str, str] | None = None, *, ajax: bool = False) -> str:
    headers = {
        'User-Agent': _USER_AGENT,
        'Origin': 'https://caepi.trabalho.gov.br',
        'Referer': URL,
    }
    body = None
    if dados is not None:
        body = urllib.parse.urlencode(dados).encode()
        headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
    if ajax:
        headers['X-MicrosoftAjax'] = 'Delta=true'
        headers['X-Requested-With'] = 'XMLHttpRequest'
    requisicao = urllib.request.Request(URL, data=body, headers=headers)
    try:
        with opener.open(requisicao, timeout=_TIMEOUT) as resposta:
            return resposta.read().decode('utf-8', 'replace')
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise CaepiIndisponivel(
            'A consulta pública de CA está indisponível no momento. Tente novamente em instantes.'
        ) from exc


def consultar_ca(numero: str) -> dict | None:
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
    inicial = _abrir(opener)
    campos = {
        '__VIEWSTATE': _campo_oculto(inicial, '__VIEWSTATE'),
        '__VIEWSTATEGENERATOR': _campo_oculto(inicial, '__VIEWSTATEGENERATOR'),
        '__EVENTVALIDATION': _campo_oculto(inicial, '__EVENTVALIDATION'),
    }
    if not campos['__VIEWSTATE']:
        raise CaepiIndisponivel(
            'A consulta pública de CA está indisponível no momento. Tente novamente em instantes.'
        )
    busca = _formulario(campos, numero)
    busca['ctl00$PlaceHolderConteudo$btnConsultar'] = 'Consultar'
    busca['ctl00$ScriptManager1'] = (
        'ctl00$PlaceHolderConteudo$panel|ctl00$PlaceHolderConteudo$btnConsultar'
    )
    resultado = _abrir(opener, busca, ajax=True)
    indice = _indice_do_resultado(resultado, numero)
    if indice is None:
        return None
    atualizados = campos_delta(resultado) or campos
    detalhe = _formulario(atualizados, numero)
    botao = f'ctl00$PlaceHolderConteudo$grdListaResultado$ctl{int(indice) + 2:02d}$btnDetalhar'
    detalhe[f'{botao}.x'] = '8'
    detalhe[f'{botao}.y'] = '8'
    detalhe['ctl00$ScriptManager1'] = f'ctl00$PlaceHolderConteudo$panel|{botao}'
    pagina = _abrir(opener, detalhe, ajax=True)
    certificado = certificado_da_pagina(pagina, numero)
    if certificado is None:
        raise CaepiIndisponivel(
            'A consulta pública de CA não devolveu o certificado. Tente novamente.'
        )
    return certificado
