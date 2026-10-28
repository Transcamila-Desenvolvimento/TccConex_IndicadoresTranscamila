"""Conduz o questionário de auditoria do SGQ em conversa, inclusive por voz.

O agente só entra aqui quando a parte Auditorias está liberada para ele e para a pessoa.
As respostas passam pelo mesmo validador do endpoint de execução.
"""

import re
import unicodedata

from django.db import transaction

from apps.audit.services import record_audit
from apps.camilo.catalogo import escopos_publicos, partes_do_usuario
from apps.camilo.consulta import _filtra_filial
from apps.sgq.models import AuditoriaSGQ, ItemNormaSGQ, RespostaAuditoriaSGQ
from apps.sgq.serializers import ResponderItemAuditoriaSerializer

_ORDINAIS = (
    'primeira', 'segunda', 'terceira', 'quarta', 'quinta',
    'sexta', 'setima', 'oitava', 'nona', 'decima',
)
_REF = re.compile(
    r'Auditoria\s+(\d{2}-\d{5}),\s+item\s+([0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)',
    re.I,
)
_OPCAO_DITA = re.compile(r'opção\s+([^.]+?)\.', re.I)
_PULOU = re.compile(r'Pulei o item\s+([0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)', re.I)
_CODIGO = re.compile(r'\b(\d{2}-\d{5})\b')
_PREFIXO_OBS = re.compile(
    r'^\s*(?:a\s+)?observa(?:ç|c)(?:ã|a)o(?:\s+é)?\s*[:,-]?\s*',
    re.I,
)
_FECHO_DEPOIS = 'Diga ponto forte, ponto fraco, observação, anexo ou próxima.'
_FECHO_ANEXO = 'Diga próxima quando quiser seguir.'


def conduzir_auditoria(user, agente, pergunta: str, historico: list[dict] | None) -> dict | None:
    fonte = _parte_do_agente(user, agente)
    if fonte is None:
        return None
    anteriores = historico or []
    ultimo = _ultimo_modelo(anteriores)
    passo = _passo(ultimo)
    texto = _norm(pergunta)
    if not passo and not _pediu_andamento(texto):
        return None
    if not _pode_gravar(user):
        if passo:
            return _resultado(
                pergunta, anteriores, fonte,
                'Falta a permissão de executar auditorias no SGQ. Parei o questionário.',
            )
        abertas = _abertas(_auditorias(user))
        return _resultado(pergunta, anteriores, fonte, _lista(abertas, perguntar=False) + (
            ' Para eu gravar as respostas, falta a permissão de executar auditorias no SGQ.'
        ))
    if _quer_parar(texto):
        return _resultado(
            pergunta, anteriores, fonte,
            'Parei o questionário. Quando quiser retomar, peça para dar andamento na auditoria.',
        )

    auditorias = _auditorias(user)
    if passo == 'escolher':
        return _escolher_e_seguir(user, pergunta, anteriores, fonte, auditorias, ultimo)
    if passo in {'responder', 'depois', 'anexo', 'observacao'}:
        if _quer_outra(texto):
            return _resultado(pergunta, anteriores, fonte, _lista(_abertas(auditorias), perguntar=True))
        auditoria, item = _contexto(auditorias, anteriores)
        if auditoria is None or item is None:
            return _resultado(pergunta, anteriores, fonte, _lista(_abertas(auditorias), perguntar=True))
        if auditoria.status == 'concluida':
            return _resultado(
                pergunta, anteriores, fonte,
                f'A auditoria {auditoria.codigo} já está concluída. ' + _lista(_abertas(auditorias), perguntar=True),
            )
        if passo == 'observacao':
            return _receber_observacao(user, pergunta, anteriores, fonte, auditoria, item, ultimo)
        if passo == 'responder':
            return _receber_resposta(user, pergunta, anteriores, fonte, auditoria, item)
        return _receber_depois(user, pergunta, anteriores, fonte, auditoria, item)

    escolhida = _escolher(pergunta, _abertas(auditorias), unica=False)
    if isinstance(escolhida, AuditoriaSGQ):
        return _seguir_para_pergunta(pergunta, anteriores, fonte, escolhida, anteriores)
    return _resultado(pergunta, anteriores, fonte, _lista(_abertas(auditorias), perguntar=True))


def _parte_do_agente(user, agente):
    if ('SGQ', 'auditorias') not in {(item['ambiente'], item['parte']) for item in partes_do_usuario(user)}:
        return None
    for item in escopos_publicos(getattr(agente, 'escopos', None)):
        if (item['ambiente'], item['parte']) == ('SGQ', 'auditorias'):
            return item
    return None


def _pode_gravar(user) -> bool:
    return bool(user.has_funcao('SGQ', 'executar-auditorias'))


def _auditorias(user) -> list:
    return list(
        _filtra_filial(AuditoriaSGQ.objects.all(), user, 'SGQ', 'filial').order_by('-data_inicio', '-sequencia')
    )


def _abertas(auditorias: list) -> list:
    return [auditoria for auditoria in auditorias if auditoria.status != 'concluida']


def _lista(abertas: list, perguntar: bool) -> str:
    if not abertas:
        return 'Não há auditoria em aberto no seu acesso.'
    if len(abertas) == 1:
        auditoria = abertas[0]
        frase = f'Você tem uma auditoria em aberto: {auditoria.codigo}, {auditoria.titulo}.'
        if perguntar:
            frase += ' Quer continuar nela?'
        return frase
    frases = [f'Você tem {len(abertas)} auditorias em aberto.']
    for indice, auditoria in enumerate(abertas[:10]):
        ordinal = _ORDINAIS[indice] if indice < len(_ORDINAIS) else f'número {indice + 1}'
        frases.append(f'A {ordinal} é {auditoria.codigo}, {auditoria.titulo}.')
    if len(abertas) > 10:
        frases.append(f'E mais {len(abertas) - 10}.')
    if perguntar:
        frases.append('Qual delas você quer continuar?')
    return ' '.join(frases)


def _escolher_e_seguir(user, pergunta, anteriores, fonte, auditorias, ultimo):
    abertas = _abertas(auditorias)
    codigo = _CODIGO.search(pergunta or '')
    if codigo:
        achada = next((item for item in auditorias if item.codigo == codigo.group(1)), None)
        if achada is None:
            return _resultado(
                pergunta, anteriores, fonte,
                'Não encontrei essa auditoria no seu acesso. Qual delas você quer continuar?',
            )
        if achada.status == 'concluida':
            return _resultado(
                pergunta, anteriores, fonte,
                f'A auditoria {achada.codigo} já está concluída. ' + _lista(abertas, perguntar=True),
            )
        return _seguir_para_pergunta(pergunta, anteriores, fonte, achada, anteriores)
    if 'quer continuar nela' in _norm(ultimo) and re.search(r'\bnao\b', _norm(pergunta)):
        return _resultado(
            pergunta, anteriores, fonte,
            'Tudo bem. Quando quiser retomar, peça para dar andamento na auditoria.',
        )
    escolhida = _escolher(pergunta, abertas, unica='quer continuar nela' in _norm(ultimo))
    if not isinstance(escolhida, AuditoriaSGQ):
        aviso = 'Não entendi qual.'
        if len(abertas) == 1:
            return _resultado(pergunta, anteriores, fonte, f'{aviso} Quer continuar nela?')
        return _resultado(
            pergunta, anteriores, fonte,
            f'{aviso} Diga a primeira, a segunda ou o código. Qual delas você quer continuar?',
        )
    return _seguir_para_pergunta(pergunta, anteriores, fonte, escolhida, anteriores)


def _escolher(fala: str, abertas: list, unica: bool):
    texto = _norm(fala)
    bruto = fala or ''
    por_codigo = [item for item in abertas if item.codigo.lower() in bruto.lower()]
    if len(por_codigo) == 1:
        return por_codigo[0]
    por_titulo = []
    for item in abertas:
        titulo = _norm(item.titulo)
        if len(titulo) >= 4 and titulo in texto:
            por_titulo.append(item)
    if len(por_titulo) == 1:
        return por_titulo[0]
    for indice, nome in enumerate(_ORDINAIS):
        if indice < len(abertas) and re.search(rf'\b{nome}\b', texto):
            return abertas[indice]
    numero = re.fullmatch(r'(?:a\s+|o\s+|numero\s+)?(\d{1,2})', texto.strip())
    if numero:
        indice = int(numero.group(1)) - 1
        if 0 <= indice < len(abertas):
            return abertas[indice]
    if unica and re.search(r'\b(sim|pode|quero|vamos|continua|ela|essa)\b', texto):
        return abertas[0]
    return None


def _receber_resposta(user, pergunta, anteriores, fonte, auditoria, item):
    texto = _norm(pergunta)
    opcao, observacao, destaque = _interpretar_resposta(pergunta, item.tipo_resposta.opcoes or [])
    if opcao is None and re.search(r'\b(pular|pula|proxima|proximo)\b', texto):
        return _pular(pergunta, anteriores, fonte, auditoria, item)
    if opcao is None:
        return _resultado(
            pergunta, anteriores, fonte,
            _frase_pergunta(auditoria, item, _pendentes(auditoria, anteriores), _perguntas(auditoria), aviso='Não entendi.'),
        )
    if opcao.get('exigeJustificativa') and not observacao:
        return _resultado(
            pergunta, anteriores, fonte,
            (
                f'Auditoria {auditoria.codigo}, item {_rotulo_item(item)}, opção {opcao.get("texto")}. '
                'Essa resposta pede justificativa. Pode falar a observação.'
            ),
        )
    erro = _gravar(user, auditoria, item, str(opcao.get('codigo') or ''), observacao, destaque)
    if erro:
        return _resultado(
            pergunta, anteriores, fonte,
            _frase_pergunta(auditoria, item, _pendentes(auditoria, anteriores), _perguntas(auditoria), aviso=erro),
        )
    extra = f' e marquei como {_nome_destaque(destaque)}' if destaque else ''
    return _resultado(
        pergunta, anteriores, fonte,
        f'Auditoria {auditoria.codigo}, item {_rotulo_item(item)}. Anotei {opcao.get("texto")}{extra}. {_FECHO_DEPOIS}',
    )


def _receber_observacao(user, pergunta, anteriores, fonte, auditoria, item, ultimo):
    texto = _norm(pergunta)
    if texto in {'ponto forte', 'ponto fraco', 'proxima', 'anexo', 'anexar'}:
        return _resultado(
            pergunta, anteriores, fonte,
            f'Auditoria {auditoria.codigo}, item {_rotulo_item(item)}. Preciso da justificativa antes. Pode falar a observação.',
        )
    nota = _PREFIXO_OBS.sub('', (pergunta or '').strip()).strip()
    if not nota:
        return _resultado(
            pergunta, anteriores, fonte,
            f'Auditoria {auditoria.codigo}, item {_rotulo_item(item)}. Pode falar a observação.',
        )
    if 'pede justificativa' in _norm(ultimo):
        opcao = _opcao_pendente(item, ultimo)
        if opcao is None:
            return _resultado(pergunta, anteriores, fonte, _frase_pergunta(
                auditoria, item, _pendentes(auditoria, anteriores), _perguntas(auditoria), aviso='Não encontrei a opção.',
            ))
        erro = _gravar(user, auditoria, item, str(opcao.get('codigo') or ''), nota, '')
        if erro:
            return _resultado(
                pergunta, anteriores, fonte,
                f'Auditoria {auditoria.codigo}, item {_rotulo_item(item)}. {erro} Pode falar a observação.',
            )
        return _resultado(
            pergunta, anteriores, fonte,
            f'Auditoria {auditoria.codigo}, item {_rotulo_item(item)}. Anotei {opcao.get("texto")}, com a observação. {_FECHO_DEPOIS}',
        )
    atual = _resposta_atual(auditoria, item)
    if atual is None or not atual.opcao_codigo:
        return _resultado(pergunta, anteriores, fonte, _frase_pergunta(
            auditoria, item, _pendentes(auditoria, anteriores), _perguntas(auditoria),
        ))
    erro = _gravar(user, auditoria, item, atual.opcao_codigo, nota, atual.destaque)
    if erro:
        return _resultado(
            pergunta, anteriores, fonte,
            f'Auditoria {auditoria.codigo}, item {_rotulo_item(item)}. {erro} {_FECHO_DEPOIS}',
        )
    return _resultado(
        pergunta, anteriores, fonte,
        f'Auditoria {auditoria.codigo}, item {_rotulo_item(item)}. Guardei a observação. {_FECHO_DEPOIS}',
    )


def _receber_depois(user, pergunta, anteriores, fonte, auditoria, item):
    texto = _norm(pergunta)
    atual = _resposta_atual(auditoria, item)
    if atual is None or not atual.opcao_codigo:
        return _resultado(pergunta, anteriores, fonte, _frase_pergunta(
            auditoria, item, _pendentes(auditoria, anteriores), _perguntas(auditoria),
        ))
    nota = _nota_na_frase(pergunta)
    if nota is None and re.search(r'\b(observacao|comenta(?:rio)?)\b', texto):
        return _resultado(
            pergunta, anteriores, fonte,
            f'Auditoria {auditoria.codigo}, item {_rotulo_item(item)}. Pode falar a observação.',
        )
    if nota is None and re.search(r'\b(anexo|anexar|anexos)\b', texto):
        return _resultado(
            pergunta, anteriores, fonte,
            (
                f'Auditoria {auditoria.codigo}, item {_rotulo_item(item)}. '
                'Por voz eu não recebo arquivo. Abra o Questionário, nessa auditoria, e anexe nesta pergunta. '
                f'{_FECHO_ANEXO}'
            ),
        )
    destaque = '' if nota is not None else _destaque_pedido(texto)
    quer_proxima = False if nota is not None else _pediu_proxima(texto)
    observacoes = nota if nota is not None else atual.observacoes
    if nota is not None or destaque:
        erro = _gravar(user, auditoria, item, atual.opcao_codigo, observacoes, destaque or atual.destaque)
        if erro:
            return _resultado(
                pergunta, anteriores, fonte,
                f'Auditoria {auditoria.codigo}, item {_rotulo_item(item)}. {erro} {_FECHO_DEPOIS}',
            )
        atual.destaque = destaque or atual.destaque
    if quer_proxima:
        return _seguir_para_pergunta(pergunta, anteriores, fonte, auditoria, anteriores)
    if destaque:
        return _resultado(
            pergunta, anteriores, fonte,
            f'Auditoria {auditoria.codigo}, item {_rotulo_item(item)}. Marquei como {_nome_destaque(destaque)}. {_FECHO_DEPOIS}',
        )
    if nota is not None:
        return _resultado(
            pergunta, anteriores, fonte,
            f'Auditoria {auditoria.codigo}, item {_rotulo_item(item)}. Guardei a observação. {_FECHO_DEPOIS}',
        )
    return _resultado(
        pergunta, anteriores, fonte,
        f'Auditoria {auditoria.codigo}, item {_rotulo_item(item)}. Não entendi. {_FECHO_DEPOIS}',
    )


def _pular(pergunta, anteriores, fonte, auditoria, item):
    pendentes = _pendentes(auditoria, anteriores)
    rotulo = _rotulo_item(item)
    outros = [pergunta_item for pergunta_item in pendentes if _rotulo_item(pergunta_item) != rotulo]
    if not outros:
        return _resultado(
            pergunta, anteriores, fonte,
            _frase_pergunta(auditoria, item, pendentes, _perguntas(auditoria), aviso='Essa é a última sem resposta.'),
        )
    frase = _frase_pergunta(auditoria, outros[0], outros, _perguntas(auditoria))
    return _resultado(pergunta, anteriores, fonte, f'Pulei o item {rotulo}. {frase}')


def _seguir_para_pergunta(pergunta, anteriores, fonte, auditoria, historico):
    pendentes = _pendentes(auditoria, historico)
    if not pendentes:
        return _resultado(
            pergunta, anteriores, fonte,
            f'Pronto. O questionário da auditoria {auditoria.codigo} está completo.',
        )
    return _resultado(
        pergunta, anteriores, fonte,
        _frase_pergunta(auditoria, pendentes[0], pendentes, _perguntas(auditoria)),
    )


def _frase_pergunta(auditoria, item, pendentes, todas, aviso: str = '') -> str:
    total = len(todas) or 1
    feitas = max(0, len(todas) - len(pendentes))
    topico = ''
    if item.parent_id and getattr(item, 'parent', None) is not None:
        topico = f'No tópico {item.parent.titulo}. '
    titulo = (item.titulo or '').strip()
    descricao = (item.descricao or '').strip()
    if descricao and _norm(descricao) != _norm(titulo) and len(descricao) <= 180:
        titulo = f'{titulo} {descricao}'
    prefixo = f'{aviso} ' if aviso else ''
    return (
        f'Auditoria {auditoria.codigo}, item {_rotulo_item(item)}. '
        f'{prefixo}Pergunta {min(feitas + 1, total)} de {total}. {topico}{titulo} '
        f'As opções são {_opcoes_faladas(item.tipo_resposta.opcoes or [])}. Como você responde?'
    )


def _perguntas(auditoria) -> list:
    normas = list(auditoria.normas.order_by('nome', 'pk'))
    itens = list(
        ItemNormaSGQ.objects.filter(norma__in=normas)
        .select_related('tipo_resposta', 'parent')
        .order_by('ordem', 'pk')
    )
    por_pai: dict = {}
    for item in itens:
        chave = ('item', item.parent_id) if item.parent_id else ('norma', item.norma_id)
        por_pai.setdefault(chave, []).append(item)
    saida = []

    def visitar(chave):
        for item in por_pai.get(chave, []):
            opcoes = item.tipo_resposta.opcoes if item.tipo_resposta_id else None
            if item.tipo == 'pergunta' and opcoes:
                saida.append(item)
            visitar(('item', item.pk))

    for norma in normas:
        visitar(('norma', norma.pk))
    return saida


def _pendentes(auditoria, historico) -> list:
    feitas = set(auditoria.respostas.exclude(opcao_codigo='').values_list('item_id', flat=True))
    pulados = _pulados(historico)
    pendentes = [item for item in _perguntas(auditoria) if item.pk not in feitas]
    restantes = [item for item in pendentes if _rotulo_item(item) not in pulados]
    return restantes or pendentes


def _pulados(historico) -> set[str]:
    achados = set()
    for item in historico or []:
        if item.get('role') != 'model':
            continue
        for achado in _PULOU.finditer(item.get('text') or ''):
            achados.add(achado.group(1).strip())
    return achados


def _contexto(auditorias, historico):
    for item in reversed(historico or []):
        if item.get('role') != 'model':
            continue
        achado = _REF.search(item.get('text') or '')
        if not achado:
            continue
        auditoria = next((candidata for candidata in auditorias if candidata.codigo == achado.group(1)), None)
        if auditoria is None:
            return None, None
        rotulo = achado.group(2)
        pergunta = next((questao for questao in _perguntas(auditoria) if _rotulo_item(questao) == rotulo), None)
        return auditoria, pergunta
    return None, None


def _gravar(user, auditoria, item, opcao_codigo: str, observacoes: str, destaque: str) -> str:
    entrada = ResponderItemAuditoriaSerializer(data={
        'itemId': str(item.pk),
        'opcaoCodigo': opcao_codigo,
        'observacoes': (observacoes or '')[:4000],
        'destaque': destaque or '',
    }, context={'auditoria': auditoria})
    if not entrada.is_valid():
        return _texto_erros(entrada.errors)
    dados = entrada.validated_data
    opcao = dados['opcao']
    with transaction.atomic():
        RespostaAuditoriaSGQ.objects.update_or_create(
            auditoria=auditoria,
            item=dados['item'],
            defaults={
                'opcao_codigo': str(opcao.get('codigo', '')) if opcao else '',
                'opcao_texto': str(opcao.get('texto', ''))[:60] if opcao else '',
                'valor': opcao.get('valor') if opcao else None,
                'observacoes': dados['observacoes'],
                'destaque': dados['destaque'],
                'respondido_por': user,
            },
        )
        if auditoria.status == 'planejamento':
            auditoria.status = 'execucao'
            auditoria.save(update_fields=['status', 'atualizado_em'])
    record_audit(
        user,
        'sgq.auditoria.resposta',
        f'Auditoria {auditoria.codigo}: item {item.codigo or item.titulo[:60]} → {(opcao or {}).get("texto") or "sem resposta"} (Camilo).',
    )
    return ''


def _resposta_atual(auditoria, item):
    return RespostaAuditoriaSGQ.objects.filter(auditoria=auditoria, item=item).first()


def _interpretar_resposta(fala: str, opcoes: list):
    texto = _norm(fala)
    destaque = _destaque_pedido(texto)
    opcao = _casa_opcao(texto, opcoes)
    if opcao is None:
        return None, '', destaque
    observacao = _nota_na_frase(fala) or _resto_da_opcao(fala, opcao)
    return opcao, observacao, destaque


def _resto_da_opcao(fala: str, opcao) -> str:
    texto = str(opcao.get('texto') or '').strip()
    if not texto:
        return ''
    sem = re.sub(re.escape(texto), '', fala or '', count=1, flags=re.I)
    sem = re.sub(r'\bponto\s+forte\b', '', sem, flags=re.I)
    sem = re.sub(r'\bponto\s+fraco\b', '', sem, flags=re.I)
    sem = re.sub(r'^[\s,;:\-]+', '', sem)
    sem = re.sub(r'^(porque|pois|que|e|é|eh)\s+', '', sem, flags=re.I)
    sem = sem.strip(' ,.;')
    return sem if len(sem) >= 3 else ''


def _casa_opcao(fala: str, opcoes: list):
    candidatas = []
    for opcao in opcoes:
        texto = _norm(str(opcao.get('texto') or ''))
        codigo = _norm(str(opcao.get('codigo') or ''))
        if texto and fala.strip() == texto:
            return opcao
        if codigo and fala.strip() == codigo:
            return opcao
        if texto and texto in fala:
            candidatas.append((len(texto), fala.find(texto), opcao))
    if candidatas:
        candidatas.sort(key=lambda item: (-item[0], item[1]))
        return candidatas[0][2]
    if any(pista in fala for pista in ('nao se aplica', 'nao aplicavel', 'nao aplica')):
        for opcao in opcoes:
            if 'aplic' in _norm(str(opcao.get('texto') or '')):
                return opcao
    return None


def _opcao_pendente(item, ultimo: str):
    achado = _OPCAO_DITA.search(ultimo or '')
    if not achado:
        return None
    nome = _norm(achado.group(1))
    for opcao in item.tipo_resposta.opcoes or []:
        if _norm(str(opcao.get('texto') or '')) == nome:
            return opcao
    return None


def _destaque_pedido(texto: str) -> str:
    if re.search(r'\bnao\b.{0,16}\b(ponto forte|forte)\b', texto):
        forte = False
    else:
        forte = 'ponto forte' in texto or re.search(r'\bforte\b', texto) is not None
    if re.search(r'\bnao\b.{0,16}\b(ponto fraco|fraco)\b', texto):
        fraco = False
    else:
        fraco = 'ponto fraco' in texto or re.search(r'\bfraco\b', texto) is not None
    if fraco and not forte:
        return 'fraco'
    if forte and not fraco:
        return 'forte'
    return ''


def _nota_na_frase(fala: str) -> str | None:
    if not _PREFIXO_OBS.match(fala or ''):
        return None
    nota = _PREFIXO_OBS.sub('', (fala or '').strip()).strip()
    return nota or None


def _pediu_proxima(texto: str) -> bool:
    if texto.strip() in {'nao', 'nao quero', 'so a proxima', 'proxima', 'proximo'}:
        return True
    return re.search(r'\b(proxima|proximo|seguir|pular|pula)\b', texto) is not None


def _nome_destaque(destaque: str) -> str:
    return 'ponto forte' if destaque == 'forte' else 'ponto fraco'


def _opcoes_faladas(opcoes: list) -> str:
    textos = [str(opcao.get('texto') or opcao.get('codigo') or '').strip() for opcao in opcoes]
    textos = [texto for texto in textos if texto]
    if not textos:
        return 'sem opções cadastradas'
    if len(textos) == 1:
        return textos[0]
    return ', '.join(textos[:-1]) + ' ou ' + textos[-1]


def _rotulo_item(item) -> str:
    return item.codigo or f'id{item.pk}'


def _texto_erros(errors) -> str:
    partes = []
    for msgs in errors.values():
        if isinstance(msgs, (list, tuple)):
            partes.extend(str(msg) for msg in msgs)
        else:
            partes.append(str(msgs))
    return ' '.join(partes) or 'Não consegui gravar essa resposta.'


def _passo(texto: str) -> str:
    t = _norm(texto)
    if 'pode falar a observacao' in t:
        return 'observacao'
    if 'diga proxima quando quiser seguir' in t:
        return 'anexo'
    if 'diga ponto forte, ponto fraco' in t:
        return 'depois'
    if 'como voce responde' in t:
        return 'responder'
    if 'qual delas voce quer continuar' in t or 'quer continuar nela' in t:
        return 'escolher'
    return ''


def _pediu_andamento(texto: str) -> bool:
    """Qualquer pedido sobre a auditoria abre o questionário, no texto ou na voz.

    Pergunta de documento fica com a matriz.
    """
    if any(pista in texto for pista in ('questionario', 'checklist')):
        return True
    if 'auditoria' not in texto and 'auditorias' not in texto:
        return False
    if any(pista in texto for pista in ('matriz', 'documento', 'arquivo', 'procedimento')):
        return False
    return True


def _quer_parar(texto: str) -> bool:
    return any(pista in texto for pista in (
        'parar', 'cancela', 'cancelar', 'sair da auditoria', 'deixa pra la', 'deixa para la',
    ))


def _quer_outra(texto: str) -> bool:
    return any(pista in texto for pista in (
        'trocar de auditoria', 'trocar a auditoria', 'outra auditoria', 'outras auditorias',
        'quais auditorias',
    ))


def _ultimo_modelo(historico: list) -> str:
    for item in reversed(historico or []):
        if item.get('role') == 'model' and (item.get('text') or '').strip():
            return item['text']
    return ''


def _norm(texto: str) -> str:
    base = unicodedata.normalize('NFD', texto or '')
    return ''.join(caractere for caractere in base if unicodedata.category(caractere) != 'Mn').lower()


def _resultado(pergunta: str, anteriores: list, fonte: dict, texto: str) -> dict:
    from apps.camilo.conversa import medir_contexto
    saida = {
        'resposta': texto,
        'fontes': [fonte],
        'material': '',
        **medir_contexto('', [{'text': pergunta}, {'text': texto}]),
    }
    if not anteriores:
        saida['titulo'] = 'Questionário da auditoria'
    return saida
