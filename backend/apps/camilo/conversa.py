"""Monta o pedido ao Gemini. O chat padrão não vê o ERP; o agente só vê a consulta."""

from apps.camilo.consulta import consultar
from apps.camilo.gemini import GeminiErro, configurado, gerar
from apps.camilo.models import INSTRUCAO_CHAT_PADRAO, ChatPadrao


# A API devolve texto. O formato visual (tópicos, tabela) vai na system instruction,
# como a documentação indica. responseMimeType application/json é só para schema.
FORMATO_RESPOSTA = (
    'Formate em Markdown. '
    'Resposta curta fica em um parágrafo. '
    'Enumere tópicos com hífen. '
    'Quando comparar vários itens, períodos ou pessoas, use uma tabela Markdown '
    'com linha de cabeçalho e a linha separadora de traços. '
    'Negrito só no rótulo que importa. Não use HTML.'
)

def sistema_camilo() -> str:
    config = ChatPadrao.atual()
    instrucao = config.instrucao_efetiva or INSTRUCAO_CHAT_PADRAO
    return (
        f'Você é {config.nome_efetivo}, assistente do ERP TccConex da Transcamila. '
        f'{instrucao} '
        'Neste chat você não consulta dados do ERP, documentos internos nem números da empresa. '
        'Se pedirem um dado do sistema, diga para usar um agente com essa parte liberada. '
        'Não invente cifras, nomes de clientes ou documentos. '
        + FORMATO_RESPOSTA
    )


def _limpar_titulo(texto: str) -> str:
    linha = ' '.join((texto or '').replace('\n', ' ').split())
    linha = linha.strip(' "\'“”‘’#*-')
    if linha.lower().startswith('título:'):
        linha = linha.split(':', 1)[1].strip()
    if linha.endswith('.'):
        linha = linha[:-1].rstrip()
    return linha


def titulo_local(pergunta: str) -> str:
    linha = _limpar_titulo(pergunta)
    baixo = linha.lower()
    for prefixo in (
        'oi, ', 'oi ', 'olá, ', 'olá ', 'ola, ', 'ola ',
        'bom dia, ', 'bom dia ', 'boa tarde, ', 'boa tarde ',
        'boa noite, ', 'boa noite ',
    ):
        if baixo.startswith(prefixo):
            linha = linha[len(prefixo):].strip(' ,')
            break
    if not linha:
        return 'Nova conversa'
    if len(linha) > 48:
        return f'{linha[:48].rstrip()}…'
    return linha


def titulo_da_conversa(pergunta: str, resposta: str) -> str:
    """Título curto a partir da pergunta e da resposta, sem depender do começo cru da frase."""
    fallback = titulo_local(pergunta)
    if not configurado():
        return fallback
    try:
        bruto = gerar(
            'Escreva somente um título curto, em português, com no máximo 6 palavras, '
            'sobre o assunto da conversa. Sem aspas, sem ponto final e sem Markdown.',
            [{'role': 'user', 'text': f'Pergunta: {pergunta[:400]}\nResposta: {resposta[:400]}'}],
            max_tokens=32,
        )
    except GeminiErro:
        return fallback
    titulo = _limpar_titulo(bruto.split('\n')[0])
    if not titulo or len(titulo.split()) > 8 or len(titulo) > 60:
        return fallback
    return titulo


def historico_valido(bruto, limite: int = 8) -> list[dict]:
    itens = []
    if not isinstance(bruto, list):
        return itens
    for item in bruto[-limite:]:
        if not isinstance(item, dict):
            continue
        papel = str(item.get('papel') or item.get('role') or '').strip()
        texto = str(item.get('texto') or item.get('text') or '').strip()
        if papel not in {'user', 'assistant', 'model'} or not texto:
            continue
        itens.append({
            'role': 'user' if papel == 'user' else 'model',
            'text': texto[:1500],
        })
    return itens


def responder_camilo(pergunta: str, historico: list[dict] | None = None) -> dict:
    anteriores = historico_valido(historico)
    mensagens = [*anteriores, {'role': 'user', 'text': pergunta}]
    resposta = gerar(sistema_camilo(), mensagens)
    titulo = titulo_da_conversa(pergunta, resposta) if not anteriores else ''
    return {'resposta': resposta, 'titulo': titulo}


def responder_agente(user, agente, pergunta: str, historico: list[dict] | None = None) -> dict:
    resultado = consultar(user, agente, pergunta)
    anteriores = historico_valido(historico)
    if not anteriores:
        resultado['titulo'] = titulo_local(pergunta)
    if not configurado() or not resultado.get('fontes'):
        return resultado

    blocos = '\n'.join(
        f"{fonte['ambiente']} / {fonte['rotulo']}: {fonte['resumo']}"
        for fonte in resultado['fontes']
    )
    instrucao = (agente.instrucao or '').strip() or 'Responda só com o material consultado.'
    sistema = (
        f'Você é {agente.nome}, um agente do ERP TccConex. Responda em português, de forma direta. '
        f'Instrução: {instrucao[:2000]} '
        'Use somente o material abaixo. Não invente números nem documentos. '
        'Se a pergunta usar um nome e o material trouxer o dado equivalente, '
        'responda com os valores que estão escritos e diga o nome que o documento usa. '
        'Exemplo: perguntaram diária e o texto traz piso mensal — mostre os pisos, não omita as cifras. '
        'Diga que não há a informação só quando o material não tiver nem o termo nem um valor equivalente. '
        f'{FORMATO_RESPOSTA}\n'
        f'Material:\n{blocos[:12000]}'
    )
    mensagens = [*anteriores, {'role': 'user', 'text': pergunta}]
    resultado['resposta'] = gerar(sistema, mensagens)
    return resultado
