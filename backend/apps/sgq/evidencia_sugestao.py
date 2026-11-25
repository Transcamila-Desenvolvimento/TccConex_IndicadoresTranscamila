"""Rascunhos do Camilo para a evidência de uma pergunta da auditoria."""

from io import BytesIO

from apps.camilo.gemini import gerar
from apps.rh.documento_texto import extrair_texto
from apps.rh.drive_documento import baixar_conteudo_drive

_LIMITE_ANEXO = 2_000
_LIMITE_CONTEXTO = 6_000
_SISTEMAS = {
    'escrever': (
        'Você redige a evidência de uma auditoria de SGQ. '
        'Escreva em português, em um parágrafo curto, como quem verificou o item em campo. '
        'Use somente a pergunta, o guia de orientação e o texto dos anexos. '
        'Não invente documento, data, nome ou fato que não esteja nesse material. '
        'Se não houver anexo legível, descreva o que a evidência ainda precisa registrar. '
        'Devolva só o texto da evidência, sem título e sem markdown.'
    ),
    'validar': (
        'Você confere se os anexos de uma auditoria de SGQ atendem o que a pergunta e o guia de orientação pedem. '
        'Escreva em português, em poucos parágrafos curtos. '
        'Diga se os anexos estão conformes, parciais ou insuficientes, e o que falta em relação à norma. '
        'Use somente a pergunta, o guia e o texto dos anexos. '
        'Não invente documento que não esteja nesse material. '
        'Devolva só o parecer, sem título e sem markdown.'
    ),
    'melhorar': (
        'Você melhora a escrita da evidência de uma auditoria de SGQ. '
        'Reescreva o texto que o auditor já escreveu, de forma mais clara e resumida, em um parágrafo curto. '
        'Mantenha somente os fatos que já estão nesse texto. '
        'Use a pergunta só para organizar o que foi escrito e deixar de fora o que não responde a ela. '
        'Não invente documento, data, nome ou fato que não esteja no texto. '
        'Devolva só a evidência reescrita, sem título e sem markdown.'
    ),
}


def _conteudo_anexo(anexo) -> bytes:
    if anexo.arquivo:
        with anexo.arquivo.open('rb') as arquivo:
            return arquivo.read()
    if not anexo.drive_file_id or not anexo.incluido_por_id:
        return b''
    dados = baixar_conteudo_drive(anexo.incluido_por, anexo.drive_file_id)
    return dados.get('conteudo') or b''


def _trecho_anexo(anexo) -> str:
    try:
        conteudo = _conteudo_anexo(anexo)
        if not conteudo:
            return ''
        texto = extrair_texto(BytesIO(conteudo), anexo.nome_original, len(conteudo))
    except Exception:
        return ''
    return ' '.join(texto.split())[:_LIMITE_ANEXO]


def _limpar_saida(texto: str) -> str:
    linhas = []
    for linha in (texto or '').replace('\r\n', '\n').split('\n'):
        linha = linha.strip().lstrip('#').strip('*').strip()
        if linha:
            linhas.append(linha)
    return '\n'.join(linhas)[:2000].strip()


def _contexto(item, resposta) -> str:
    guia = (item.descricao or '').strip()
    opcao = ''
    anexos = []
    if resposta is not None:
        if resposta.opcao_texto:
            opcao = resposta.opcao_texto
        for anexo in resposta.anexos.all():
            trecho = _trecho_anexo(anexo)
            anexos.append(f'- {anexo.nome_original}' + (f': {trecho}' if trecho else ' (sem texto legível)'))
    contexto_anexos = '\n'.join(anexos)[:_LIMITE_CONTEXTO] or 'Nenhum anexo nesta pergunta.'
    return (
        f'Pergunta: {item.codigo} {item.titulo}'.strip() + '\n'
        f'Guia de orientação: {guia or "Não informado."}\n'
        f'Resposta marcada: {opcao or "Ainda não marcada."}\n'
        f'Anexos:\n{contexto_anexos}'
    )


def _contexto_melhoria(item, texto: str) -> str:
    return (
        f'Pergunta: {item.codigo} {item.titulo}'.strip() + '\n'
        f'Texto escrito:\n{texto.strip()}'
    )


def sugerir_evidencia(item, resposta, acao: str = 'escrever', texto: str = '') -> str:
    sistema = _SISTEMAS.get(acao) or _SISTEMAS['escrever']
    pedido = _contexto_melhoria(item, texto) if acao == 'melhorar' else _contexto(item, resposta)
    return _limpar_saida(gerar(sistema, [{'role': 'user', 'text': pedido}], max_tokens=512, pensar='low'))
