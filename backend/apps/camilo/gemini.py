"""Chamada ao Gemini. A chave fica no ambiente e não volta para o navegador."""

import json
import urllib.error
import urllib.request

from django.conf import settings


class GeminiErro(Exception):
    def __init__(self, mensagem: str, status: int = 502):
        super().__init__(mensagem)
        self.status = status


def configurado() -> bool:
    return bool(getattr(settings, 'GEMINI_API_KEY', ''))


def _alternar(mensagens: list[dict]) -> list[dict]:
    saida = []
    for item in mensagens:
        papel = item.get('role')
        texto = str(item.get('text') or '').strip()
        if papel not in {'user', 'model'} or not texto:
            continue
        if saida and saida[-1]['role'] == papel:
            saida[-1]['text'] = f"{saida[-1]['text']}\n{texto}"[:4000]
            continue
        saida.append({'role': papel, 'text': texto[:4000]})
    if saida and saida[0]['role'] != 'user':
        saida.insert(0, {'role': 'user', 'text': 'Olá.'})
    return saida


def gerar(sistema: str, mensagens: list[dict], max_tokens: int = 2048) -> str:
    chave = getattr(settings, 'GEMINI_API_KEY', '')
    if not chave:
        raise GeminiErro(
            'O Gemini ainda não está configurado. Defina GEMINI_API_KEY no servidor.',
            status=503,
        )
    conteudo = _alternar(mensagens)
    if not conteudo:
        raise GeminiErro('Escreva a pergunta.', status=400)

    modelo = getattr(settings, 'GEMINI_MODEL', '') or 'gemini-3.8-flash'
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent'
    corpo = json.dumps({
        'systemInstruction': {'parts': [{'text': sistema[:12000]}]},
        'contents': [
            {'role': item['role'], 'parts': [{'text': item['text']}]}
            for item in conteudo
        ],
        'generationConfig': {'maxOutputTokens': max_tokens},
    }).encode('utf-8')
    pedido = urllib.request.Request(
        url,
        data=corpo,
        headers={
            'Content-Type': 'application/json',
            'x-goog-api-key': chave,
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(pedido, timeout=45) as resposta:
            payload = json.loads(resposta.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        detalhe = exc.read().decode('utf-8', errors='replace')
        try:
            mensagem = json.loads(detalhe).get('error', {}).get('message') or ''
        except json.JSONDecodeError:
            mensagem = ''
        raise GeminiErro(mensagem or 'O Gemini não respondeu. Tente de novo.') from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise GeminiErro('O Gemini não respondeu. Tente de novo.') from exc

    textos = []
    for candidato in payload.get('candidates') or []:
        for parte in (candidato.get('content') or {}).get('parts') or []:
            if parte.get('thought'):
                continue
            trecho = str(parte.get('text') or '').strip()
            if trecho:
                textos.append(trecho)
    if not textos:
        raise GeminiErro('O Gemini não devolveu texto. Tente de novo.')
    return '\n'.join(textos).strip()
