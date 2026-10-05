"""Monta o pedido ao Gemini. O chat padrão não vê o ERP; o agente só vê a consulta."""

from apps.camilo.consulta import consultar
from apps.camilo.gemini import configurado, gerar


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

SISTEMA_CAMILO = (
    'Você é o Camilo, assistente do ERP TccConex da Transcamila. '
    'Responda em português, de forma direta e curta. '
    'Neste chat você não consulta dados do ERP, documentos internos nem números da empresa. '
    'Se pedirem um dado do sistema, diga para usar um agente com essa parte liberada. '
    'Não invente cifras, nomes de clientes ou documentos. '
    + FORMATO_RESPOSTA
)


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


def responder_camilo(pergunta: str, historico: list[dict] | None = None) -> str:
    mensagens = historico_valido(historico)
    mensagens.append({'role': 'user', 'text': pergunta})
    return gerar(SISTEMA_CAMILO, mensagens)


def responder_agente(user, agente, pergunta: str, historico: list[dict] | None = None) -> dict:
    resultado = consultar(user, agente, pergunta)
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
    mensagens = historico_valido(historico)
    mensagens.append({'role': 'user', 'text': pergunta})
    resultado['resposta'] = gerar(sistema, mensagens)
    return resultado
