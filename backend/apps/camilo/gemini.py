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


def _alternar(mensagens: list[dict], limite_texto: int = 8000) -> list[dict]:
    saida = []
    for item in mensagens:
        papel = item.get('role')
        texto = str(item.get('text') or '').strip()
        if papel not in {'user', 'model'} or not texto:
            continue
        if saida and saida[-1]['role'] == papel:
            saida[-1]['text'] = f"{saida[-1]['text']}\n{texto}"[:limite_texto]
            continue
        saida.append({'role': papel, 'text': texto[:limite_texto]})
    if saida and saida[0]['role'] != 'user':
        saida.insert(0, {'role': 'user', 'text': 'Olá.'})
    return saida


def gerar(
    sistema: str,
    mensagens: list[dict],
    max_tokens: int = 8192,
    limite_texto: int = 8000,
    pensar: str = 'low',
) -> str:
    chave = getattr(settings, 'GEMINI_API_KEY', '')
    if not chave:
        raise GeminiErro(
            'O Gemini ainda não está configurado. Defina GEMINI_API_KEY no servidor.',
            status=503,
        )
    conteudo = _alternar(mensagens, limite_texto)
    if not conteudo:
        raise GeminiErro('Escreva a pergunta.', status=400)

    modelo = getattr(settings, 'GEMINI_MODEL', '') or 'gemini-3.8-flash'
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent'
    corpo = json.dumps({
        'systemInstruction': {'parts': [{'text': sistema[:4000]}]},
        'contents': [
            {'role': item['role'], 'parts': [{'text': item['text']}]}
            for item in conteudo
        ],
        # O teto vale para o raciocínio e para o texto visível. No 3.8 Flash o
        # padrão pensa o bastante para cortar a resposta no meio da tabela.
        'generationConfig': {
            'maxOutputTokens': max_tokens,
            'thinkingConfig': {'thinkingLevel': pensar},
        },
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


def _wav_pcm(pcm: bytes, taxa: int) -> bytes:
    import struct
    taxa = taxa if taxa > 0 else 24000
    cabecalho = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF',
        36 + len(pcm),
        b'WAVE',
        b'fmt ',
        16,
        1,
        1,
        taxa,
        taxa * 2,
        2,
        16,
        b'data',
        len(pcm),
    )
    return cabecalho + pcm


def sintetizar_voz(texto: str) -> bytes:
    """Áudio natural em português. O navegador só entra se esta chamada falhar."""
    import base64
    import re

    chave = getattr(settings, 'GEMINI_API_KEY', '')
    if not chave:
        raise GeminiErro(
            'O Gemini ainda não está configurado. Defina GEMINI_API_KEY no servidor.',
            status=503,
        )
    fala = ' '.join((texto or '').split())[:1200]
    if len(fala) < 2:
        raise GeminiErro('Nada para falar.', status=400)
    modelo = getattr(settings, 'GEMINI_TTS_MODEL', '') or 'gemini-2.5-flash-preview-tts'
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent'
    corpo = json.dumps({
        'contents': [{'role': 'user', 'parts': [{'text': fala}]}],
        'generationConfig': {
            'responseModalities': ['AUDIO'],
            'speechConfig': {
                'voiceConfig': {
                    'prebuiltVoiceConfig': {'voiceName': 'Sulafat'},
                },
            },
        },
    }).encode('utf-8')
    pedido = urllib.request.Request(
        url,
        data=corpo,
        headers={'Content-Type': 'application/json', 'x-goog-api-key': chave},
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
        raise GeminiErro(mensagem or 'A voz não respondeu. Tente de novo.') from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise GeminiErro('A voz não respondeu. Tente de novo.') from exc

    for candidato in payload.get('candidates') or []:
        for parte in (candidato.get('content') or {}).get('parts') or []:
            inline = parte.get('inlineData') or parte.get('inline_data') or {}
            bruto = inline.get('data')
            if not bruto:
                continue
            audio = base64.b64decode(bruto)
            if audio[:4] == b'RIFF':
                return audio
            mime = str(inline.get('mimeType') or inline.get('mime_type') or '')
            taxa = 24000
            achado = re.search(r'rate=(\d+)', mime)
            if achado:
                taxa = int(achado.group(1))
            return _wav_pcm(audio, taxa)
    raise GeminiErro('A voz não devolveu áudio. Tente de novo.')
