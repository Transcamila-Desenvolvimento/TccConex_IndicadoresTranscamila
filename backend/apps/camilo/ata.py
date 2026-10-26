"""Ata de reunião pedida no chat. O texto vem da fala; o documento, só das partes do agente."""

import json
import re
import unicodedata
from datetime import date

from django.utils import timezone

from apps.camilo.gemini import GeminiErro, configurado, gerar


def _sem_acento(texto: str) -> str:
    return ''.join(
        caractere for caractere in unicodedata.normalize('NFD', texto or '')
        if unicodedata.category(caractere) != 'Mn'
    )


PERGUNTA_O_QUE_FAZER = 'O que devo fazer com isso?'
_MINIMO_TRANSCRICAO = 220

_GATILHOS_ATA = (
    'crie uma ata', 'criar uma ata', 'cria uma ata', 'cria a ata',
    'faca uma ata', 'fazer uma ata', 'faz uma ata', 'faca a ata',
    'elaborar uma ata', 'elabora uma ata', 'elabore uma ata',
    'gere uma ata', 'gerar uma ata', 'gera uma ata',
    'monte uma ata', 'montar uma ata', 'monta uma ata',
    'ata desta reuniao', 'ata da reuniao', 'ata de reuniao', 'ata dessa reuniao',
    'consideracoes finais', 'consideracao final',
)

_PEDIDO_AO_CAMILO = re.compile(
    r'(?:'
    r'\b(?:crie|cria|criar|gere|gerar|gera|elabore|elaborar|resuma|resumir|resume|'
    r'explique|explicar|explica|relacione|relacionar|relacionando|redija|redigir|'
    r'escreva|monte|montar)\b|'
    r'\bfaca consider|'
    r'\bpor favor\b|'
    r'\b(?:me passa|me diz|me fala|me mostra|quero que)\b'
    r')'
)


def pedido_de_ata(texto: str) -> bool:
    base = _sem_acento(texto).lower()
    if 'consideracoes finais' in base or 'consideracao final' in base:
        return True
    if 'ata' not in base:
        return False
    return any(item in base for item in _GATILHOS_ATA)


def tem_instrucao(texto: str) -> bool:
    """Pergunta, pedido ou recado curto. Transcrição longa sem isso não é pedido."""
    bruto = (texto or '').strip()
    if pedido_de_ata(bruto):
        return True
    if len(bruto) < _MINIMO_TRANSCRICAO:
        return True
    base = _sem_acento(bruto).lower()
    if _PEDIDO_AO_CAMILO.search(base):
        return True
    return bruto.count('?') > 0 and len(bruto) < 1200


def transcricao_sem_instrucao(texto: str) -> bool:
    bruto = (texto or '').strip()
    return len(bruto) >= _MINIMO_TRANSCRICAO and not tem_instrucao(bruto)


def pediu_documento(texto: str) -> bool:
    base = _sem_acento(texto).lower()
    return any(sinal in base for sinal in ('documento', 'procedimento', 'anexad', 'matriz', 'norma'))


_PADROES_PARTICIPANTES = (
    r'com a participa[cç][aã]o de\s+(.+?)(?:\.|$)',
    r'estavam presentes\s+(.+?)(?:\.|$)',
    r'participaram\s+(.+?)(?:\.|$)',
    r'participantes?\s*(?:da reuni[aã]o)?\s*(?:s[aã]o|foram)?\s*[:\-]?\s*(.+?)(?:\.|$)',
)


def _quebrar_nomes(trecho: str) -> list[str]:
    trecho = re.split(r'[.;\n]', trecho, maxsplit=1)[0]
    nomes = []
    for parte in re.split(r'\s*,\s*|\s+e\s+', trecho):
        nome = ' '.join(parte.split()).strip(' .;:-')
        if not nome or len(nome) < 3 or len(nome) > 80:
            continue
        if not re.search(r'[A-ZÀ-Ú]', nome):
            continue
        baixo = _sem_acento(nome).lower()
        if baixo in {'eu', 'nos', 'a gente', 'todos', 'ninguem', 'reuniao', 'ata'}:
            continue
        if nome not in nomes:
            nomes.append(nome)
        if len(nomes) >= 12:
            break
    return nomes


def participantes_citados(texto: str) -> list[str]:
    nomes = []
    for padrao in _PADROES_PARTICIPANTES:
        for achado in re.finditer(padrao, texto or '', flags=re.IGNORECASE):
            for nome in _quebrar_nomes(achado.group(1)):
                if nome not in nomes:
                    nomes.append(nome)
    return nomes


def _relato(texto: str) -> str:
    sem_pedido = re.sub(
        r'(?i)(?:eu quero que voc[eê]\s+|quero que voc[eê]\s+|por favor[,]?\s+)?'
        r'(?:crie|cria|criar|fa[cç]a|fazer|elabore|elaborar|gere|gerar|monte|montar)'
        r'\s+uma ata[^.]*\.?',
        ' ',
        texto or '',
    )
    sem_pedido = re.sub(
        r'(?i)(?:eu quero que voc[eê]\s+|quero que voc[eê]\s+|por favor[,]?\s+)?'
        r'(?:fa[cç]a|fazer|elabore|elaborar)\s+considera[cç][oõ]es finais[^.]*\.?',
        ' ',
        sem_pedido,
    )
    return ' '.join(sem_pedido.split())


def fala_da_reuniao(pergunta: str, historico: list[dict] | None = None) -> str:
    """Junta a transcrição já enviada com o pedido que veio depois."""
    trechos = []
    for item in historico or []:
        if item.get('role') != 'user':
            continue
        texto = ' '.join(str(item.get('text') or '').split()).strip()
        if len(texto) < 80 or texto == PERGUNTA_O_QUE_FAZER:
            continue
        if texto not in trechos:
            trechos.append(texto)
    atual = ' '.join((pergunta or '').split()).strip()
    if atual and atual not in trechos:
        trechos.append(atual)
    return '\n\n'.join(trechos)


def assuntos_do_relato(texto: str) -> list[str]:
    """Tudo o que foi falado, sem teto. Frase longa sem ponto vira parágrafos curtos."""
    relato = _relato(texto)
    if not relato:
        return []
    frases = [frase.strip() for frase in re.split(r'(?<=[.!?])\s+', relato) if frase.strip()]
    if len(frases) <= 1 and len(relato) > 420:
        frases = []
        atual = ''
        for palavra in relato.split():
            if atual and len(atual) + len(palavra) + 1 > 420:
                frases.append(atual)
                atual = palavra
            else:
                atual = f'{atual} {palavra}'.strip()
        if atual:
            frases.append(atual)
    uteis = []
    for frase in frases:
        base = _sem_acento(frase).lower()
        if 'ata' in base and 'reuni' in base:
            continue
        if len(frase) > 8:
            uteis.append(frase)
    return uteis or [relato]


def _sem_palavra_repetida(texto: str) -> str:
    saida = []
    for palavra in texto.split():
        if saida and _sem_acento(saida[-1]).lower() == _sem_acento(palavra).lower():
            continue
        saida.append(palavra)
    return ' '.join(saida)


def _corrigir_frase(frase: str) -> str:
    frase = _sem_palavra_repetida(' '.join((frase or '').split())).strip(' .')
    if len(frase) < 8:
        return ''
    frase = frase[0].upper() + frase[1:]
    if frase[-1] not in '.!?':
        frase += '.'
    return frase


def _e_decisao(frase: str) -> bool:
    base = _sem_acento(frase).lower()
    return any(sinal in base for sinal in (
        'ficou combinado', 'ficou decidido', 'ficou acertado',
        'decidimos', 'decidiu', 'encaminh', 'proximo passo',
    ))


def registro_da_ata(assuntos: list[str]) -> list[str]:
    """Frases corrigidas, no miolo de uma ata: sem repetir palavra e com ponto."""
    corrigidas = []
    for assunto in assuntos:
        frase = _corrigir_frase(assunto)
        if frase and frase not in corrigidas:
            corrigidas.append(frase)
    if len(corrigidas) <= 8:
        return corrigidas
    escolhidos = []
    for frase in (corrigidas[0], *[item for item in corrigidas if _e_decisao(item)], corrigidas[-1]):
        if frase not in escolhidos:
            escolhidos.append(frase)
        if len(escolhidos) >= 8:
            break
    return escolhidos


def deliberacoes_do_relato(assuntos: list[str]) -> list[str]:
    return [_corrigir_frase(assunto) for assunto in assuntos if _e_decisao(assunto)][:6]


def _titulo(assuntos: list[str]) -> str:
    base = assuntos[0] if assuntos else 'Ata de reunião'
    base = re.sub(
        r'(?i)^estamos come[cç]ando agora(?:\s+uma reuni[aã]o)?(?:\s+para)?\s*',
        '',
        base,
    ).strip(' .')
    if not base:
        return 'Ata de reunião'
    if len(base) > 80:
        base = base[:80].rsplit(' ', 1)[0]
    return base[:1].upper() + base[1:]


def documentos_no_material(material: str) -> list[dict]:
    documentos = []
    lendo = False
    for linha in (material or '').splitlines():
        if 'Trechos lidos da Matriz' in linha:
            lendo = True
            continue
        if not lendo or ':' not in linha:
            continue
        rotulo, _, resto = linha.partition(':')
        titulo = rotulo.strip(' …')
        trecho = resto.strip()
        if not titulo or not trecho or trecho.startswith('o arquivo não tem texto'):
            continue
        documentos.append({'titulo': titulo, 'relacao': trecho[:700]})
        if len(documentos) >= 3:
            break
    return documentos


def _data_hoje() -> str:
    hoje = timezone.localdate() if timezone.is_aware(timezone.now()) else date.today()
    return hoje.strftime('%d/%m/%Y')


def _aviso(pediu: bool, documentos: list[dict], chat_padrao: bool, pergunta: str) -> str:
    if not pediu or documentos:
        return ''
    if chat_padrao and 'sgq' in _sem_acento(pergunta).lower():
        return (
            'O chat padrão não consulta documentos do SGQ. '
            'A ata ficou só com o que foi falado. '
            'Para relacionar com a matriz do SGQ, use um agente com essa parte.'
        )
    return (
        'O documento pedido não está nas partes deste agente. '
        'A ata não relaciona um arquivo que ele não consultou.'
    )


def _encurtar(texto: str, limite: int = 320) -> str:
    texto = ' '.join((texto or '').split()).strip()
    if len(texto) <= limite:
        return texto
    return texto[:limite].rsplit(' ', 1)[0].rstrip('.,;') + '…'


def amostra_reuniao(texto: str) -> str:
    """Começo, meio e fim, para a consideração alcançar a reunião inteira."""
    texto = ' '.join((texto or '').split())
    if len(texto) <= 12000:
        return texto
    tamanho = 3500
    inicios = (0, max(0, len(texto) // 2 - tamanho // 2), max(0, len(texto) - tamanho))
    vistos = []
    fatias = []
    for inicio in inicios:
        if inicio in vistos:
            continue
        vistos.append(inicio)
        fatias.append(texto[inicio:inicio + tamanho])
    return '\n[...]\n'.join(fatias)


def _dito_para_relacao(assuntos: list[str]) -> str:
    if not assuntos:
        return ''
    if len(assuntos) == 1:
        return _encurtar(assuntos[0], 500)
    return f'{_encurtar(assuntos[0], 240)} […] {_encurtar(assuntos[-1], 240)}'


def consideracoes_do_documento(assuntos: list[str], documentos: list[dict]) -> list[str]:
    """Liga o que foi dito ao trecho do documento, sem misturar os dois textos."""
    dito = _dito_para_relacao(assuntos)
    if not dito or not documentos:
        return []
    itens = []
    for documento in documentos:
        trecho = _encurtar(documento.get('relacao') or '', 360)
        if not trecho:
            continue
        itens.append(
            f"O documento {documento['titulo']} registra: {trecho} "
            f"Isso se relaciona ao que foi dito na reunião: {dito}"
        )
    return itens


def _consideracoes_validas(valor, documentos: list[dict]) -> list[str]:
    textos = _lista_textos(valor, limite=6, tamanho=700)
    if not documentos:
        return []
    chaves = [
        documento['titulo'].split('/')[-1].strip().lower()[:24]
        for documento in documentos
    ]
    return [
        texto for texto in textos
        if any(chave and chave in texto.lower() for chave in chaves)
    ]


def _resumo(assuntos, participantes, consideracoes, aviso) -> str:
    frases = []
    tamanho = sum(len(assunto) for assunto in assuntos)
    if assuntos and tamanho > 1200:
        frases.append(f'A reunião foi longa. No início: {_encurtar(assuntos[0], 220)}')
        frases.append(f'No fim: {_encurtar(assuntos[-1], 220)}')
    elif assuntos:
        frases.append('Na reunião foi dito: ' + ' '.join(assuntos)[:500])
    if participantes:
        frases.append('Participaram ' + ', '.join(participantes) + '.')
    if consideracoes:
        frases.append(consideracoes[0][:500])
    if aviso:
        frases.append(aviso)
    return ' '.join(frases).strip() or 'A ata foi montada com o que foi falado na reunião.'


def _lista_textos(valor, limite: int = 8, tamanho: int = 500) -> list[str]:
    if isinstance(valor, str):
        valor = [valor]
    if not isinstance(valor, list):
        return []
    saida = []
    for item in valor:
        texto = ' '.join(str(item).split()).strip()
        if texto:
            saida.append(texto[:tamanho])
        if len(saida) >= limite:
            break
    return saida


def _json_da_resposta(texto: str) -> dict | None:
    bruto = (texto or '').strip()
    if bruto.startswith('```'):
        bruto = re.sub(r'^```(?:json)?\s*|\s*```$', '', bruto, flags=re.IGNORECASE).strip()
    inicio = bruto.find('{')
    fim = bruto.rfind('}')
    if inicio < 0 or fim <= inicio:
        return None
    try:
        data = json.loads(bruto[inicio:fim + 1])
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _completar_com_modelo(ata: dict, pergunta: str, documentos: list[dict]) -> dict:
    if not configurado():
        return ata
    blocos = [
        f"Fala da reunião:\n{amostra_reuniao(pergunta)}",
        'Participantes citados, e só estes podem aparecer: '
        + (', '.join(ata['participantes']) or 'nenhum'),
    ]
    if documentos:
        blocos.append('Documentos consultados nas partes do agente:\n' + '\n'.join(
            f"{documento['titulo']}: {documento['relacao']}" for documento in documentos
        ))
    else:
        blocos.append('Nenhum documento das partes do agente corresponde ao pedido.')
    try:
        bruto = gerar(
            'Você corrige a ata de uma reunião da Transcamila no padrão de uma ata do Gemini. '
            'Responda somente um JSON com as chaves titulo, registro, deliberacoes, consideracoes e resumo. '
            'registro é uma lista de até 8 frases corridas. Corrija vício de fala, palavra repetida e pontuação. '
            'Cubra o começo, o meio e o fim. Não copie a transcrição crua e não invente fato. '
            'deliberacoes lista só decisão, combinação ou próximo passo que a fala trouxe. Sem isso, fica vazia. '
            'consideracoes é uma lista. Cada item relaciona um ponto dito na reunião com um trecho do documento e cita o título do documento. '
            'Se não houver documento, consideracoes fica vazia. '
            'Não invente participante, cifra ou documento. '
            'resumo é um parágrafo curto, em português, para ser lido em voz alta. '
            'Se houver documento, o resumo separa o que foi dito e a consideração sobre o documento. '
            'Se não houver, o resumo não cita arquivo nenhum.',
            [{'role': 'user', 'text': '\n\n'.join(blocos)}],
            max_tokens=2048,
            limite_texto=16000,
        )
    except GeminiErro:
        return ata
    modelo = _json_da_resposta(bruto)
    if not modelo:
        return ata
    titulo = ' '.join(str(modelo.get('titulo') or '').split()).strip()
    if titulo:
        ata['titulo'] = titulo[:80]
    registro = _lista_textos(modelo.get('registro'), limite=8, tamanho=500)
    if registro:
        ata['registro'] = registro
    deliberacoes = _lista_textos(modelo.get('deliberacoes'))
    if deliberacoes:
        ata['deliberacoes'] = deliberacoes
    validas = _consideracoes_validas(modelo.get('consideracoes'), documentos)
    if validas:
        ata['consideracoes'] = validas
    resumo = ' '.join(str(modelo.get('resumo') or '').split()).strip()
    if len(resumo) >= 40:
        ata['resumo'] = resumo
    return ata


def redigir_ata(pergunta: str, material: str = '', *, chat_padrao: bool = False) -> dict:
    pediu = pediu_documento(pergunta)
    cita_sgq = 'sgq' in _sem_acento(pergunta).lower()
    documentos = [] if chat_padrao and pediu and cita_sgq else documentos_no_material(material)
    if not pediu:
        documentos = []
    aviso = _aviso(pediu, documentos, chat_padrao, pergunta)
    assuntos = assuntos_do_relato(pergunta)
    consideracoes = consideracoes_do_documento(assuntos, documentos)
    ata = {
        'titulo': _titulo(assuntos),
        'data': _data_hoje(),
        'participantes': participantes_citados(pergunta),
        'resumo': '',
        'registro': registro_da_ata(assuntos),
        'deliberacoes': deliberacoes_do_relato(assuntos),
        'assuntos': assuntos,
        'documentos': documentos,
        'consideracoes': consideracoes,
        'aviso': aviso,
    }
    ata = _completar_com_modelo(ata, pergunta, documentos)
    ata['assuntos'] = assuntos
    ata['participantes'] = participantes_citados(pergunta)
    ata['documentos'] = documentos
    ata['aviso'] = aviso
    if not ata.get('consideracoes'):
        ata['consideracoes'] = consideracoes
    resumo = ata['resumo']
    if not resumo:
        resumo = _resumo(ata['assuntos'], ata['participantes'], ata['consideracoes'], aviso)
    elif aviso and aviso not in resumo:
        resumo = f'{resumo} {aviso}'.strip()
    ata['resumo'] = resumo
    return ata
