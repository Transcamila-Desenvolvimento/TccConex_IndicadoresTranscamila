"""Leitura das partes liberadas. Não altera dados.

A pergunta abre o detalhe de no máximo duas funções. As outras ficam só listadas,
para a resposta ser específica sem encher o contexto.
"""

from apps.accounts.permissions import allowed_filiais_for_module, db_values_for_filiais
from apps.camilo.catalogo import PARTE_POR_CHAVE, escopos_publicos, partes_do_usuario

MENCOES_AMBIENTE = (
    ('financeiro', 'Financeiro'),
    ('faturamento', 'Faturamento'),
    ('compras', 'Compras'),
    ('logística', 'Logística'),
    ('logistica', 'Logística'),
    ('comercial', 'Comercial'),
    ('suprimentos', 'Suprimentos'),
    ('indicadores', 'Indicadores'),
    ('marketing', 'Marketing'),
    ('frota', 'Frota'),
    ('rh', 'RH'),
    ('sgq', 'SGQ'),
)


def _filtra_filial(qs, user, ambiente: str, campo: str):
    if user.is_admin:
        return qs
    nomes = allowed_filiais_for_module(user, ambiente)
    if not nomes:
        return qs.none()
    return qs.filter(**{f'{campo}__in': db_values_for_filiais(nomes)})


def _texto(quantidade: int, um: str, varios: str) -> str:
    return f'{quantidade} {um if quantidade == 1 else varios}.'


def resumo_calendario(user) -> str:
    from apps.financeiro.models import CalendarioEvento
    total = CalendarioEvento.objects.filter(usuario=user).count()
    return _texto(total, 'evento no seu calendário', 'eventos no seu calendário')


def resumo_relatorios(user) -> str:
    from apps.financeiro.models import PagarTitulo, ReceberTitulo
    pagar = _filtra_filial(PagarTitulo.objects.all(), user, 'Financeiro', 'filial').count()
    receber = _filtra_filial(ReceberTitulo.objects.all(), user, 'Financeiro', 'filial').count()
    return f'{pagar} títulos a pagar e {receber} a receber nas filiais do seu acesso.'


def resumo_saldos(user) -> str:
    from apps.financeiro.models import BankAccount
    return _texto(BankAccount.objects.count(), 'conta bancária cadastrada', 'contas bancárias cadastradas')


def resumo_ajustes(user) -> str:
    from apps.financeiro.models import CashAdjustment
    return _texto(CashAdjustment.objects.count(), 'ajuste de caixa', 'ajustes de caixa')


def resumo_faturamento_fin(user) -> str:
    from apps.financeiro.models import BillingRecord
    return _texto(BillingRecord.objects.count(), 'registro de faturamento', 'registros de faturamento')


def resumo_protocolos(user) -> str:
    from apps.faturamento.models import ProtocoloEnvio
    return _texto(ProtocoloEnvio.objects.count(), 'protocolo de envio de NF', 'protocolos de envio de NF')


def resumo_clientes_protocolo(user) -> str:
    from apps.faturamento.models import ClienteProtocolo
    return _texto(ClienteProtocolo.objects.count(), 'cliente de protocolo', 'clientes de protocolo')


def resumo_estoque(user) -> str:
    from apps.compras.models import ItemEstoque
    return _texto(ItemEstoque.objects.count(), 'item de estoque', 'itens de estoque')


_PARADAS = frozenset(
    'a o os as um uma uns umas de da do das dos e ou em no na nos nas por para com sem que '
    'qual quais como quando onde este esta esse essa isto isso aquele me meu minha sobre '
    'documento documentos arquivo arquivos liberado liberados'.split()
)


def _termos_pergunta(pergunta: str) -> list[str]:
    import re
    bruto = re.findall(r'[a-z0-9áéíóúâêôãõç]{3,}', (pergunta or '').lower())
    return [termo for termo in bruto if termo not in _PARADAS]


_APOIO_TERMO = {
    'diaria': ('piso', 'salario', 'remuneracao'),
    'diarias': ('piso', 'salario', 'remuneracao'),
    'salario': ('piso', 'remuneracao'),
    'salarial': ('piso', 'salario'),
    'piso': ('salario',),
}
_TERMOS_VALOR = frozenset(
    'quanto valor piso salario salarial diaria diarias remuneracao preco'.split()
)


def _indice_sem_acento(texto: str) -> tuple[str, list[int]]:
    import unicodedata
    caracteres = []
    mapa = []
    for indice, caractere in enumerate(texto):
        for pedaco in unicodedata.normalize('NFD', caractere):
            if unicodedata.category(pedaco) == 'Mn':
                continue
            caracteres.append(pedaco.lower())
            mapa.append(indice)
    return ''.join(caracteres), mapa


def _trecho(texto: str, termos: list[str], limite: int = 1100, janelas: int = 3) -> str:
    import re
    if not texto:
        return ''
    if len(texto) <= limite:
        return texto

    dobrado, mapa = _indice_sem_acento(texto)
    pedidos = []
    apoio = []
    for termo in termos:
        chave = _sem_acento(termo)
        if len(chave) > 4 and chave.endswith('s'):
            chave = chave[:-1]
        if len(chave) < 4 or chave in pedidos:
            continue
        pedidos.append(chave)
        for extra in _APOIO_TERMO.get(chave, ()):
            if extra not in pedidos and extra not in apoio:
                apoio.append(extra)
    alvos = [(termo, 3) for termo in pedidos] + [(termo, 1) for termo in apoio]
    pede_valor = any(termo in _TERMOS_VALOR for termo in pedidos)

    candidatas = []
    for termo, _peso in alvos:
        cursor = 0
        vistos = 0
        while vistos < 40:
            posicao = dobrado.find(termo, cursor)
            if posicao < 0:
                break
            vistos += 1
            inicio = max(0, posicao - 180)
            fim = min(len(dobrado), inicio + limite)
            janela = dobrado[inicio:fim]
            nota = sum(peso for candidato, peso in alvos if candidato in janela)
            # Desempate: com valor pedido, a janela com o R$ mais perto do começo mostra a cifra com contexto.
            desvio = limite
            valor = re.search(r'r\$\s*\d', janela[:int(limite * 0.7)]) if pede_valor else None
            if valor:
                nota += 8
                desvio = abs(valor.start() - 180)
                if any(candidato in janela for candidato in pedidos if candidato not in _TERMOS_VALOR):
                    nota += 6
            candidatas.append((nota, desvio, inicio, fim))
            cursor = posicao + max(len(termo), 1)

    if not candidatas:
        return texto[:limite].rstrip() + '…'

    escolhidas = []
    melhor_nota = max(item[0] for item in candidatas)
    for nota, _desvio, inicio, fim in sorted(candidatas, key=lambda item: (-item[0], item[1], item[2])):
        if escolhidas and nota < melhor_nota * 0.6:
            break
        if any(inicio < outro_fim and fim > outro_inicio for _n, outro_inicio, outro_fim in escolhidas):
            continue
        escolhidas.append((nota, inicio, fim))
        if len(escolhidas) >= janelas:
            break
    fatias = [
        texto[mapa[inicio]:mapa[fim - 1] + 1].strip()
        for _nota, inicio, fim in sorted(escolhidas, key=lambda item: item[1])
    ]
    return '…\n' + '\n…\n'.join(fatias) + '\n…'


TRECHOS_LIDOS = 'Trechos lidos da Matriz de conhecimento:'


def resumo_documentos(user, pergunta: str = '', modelo=None) -> str:
    from apps.rh.documento_texto import garantir_texto
    from apps.rh.models import DocumentoRH

    modelo = modelo or DocumentoRH
    documentos = list(
        modelo.objects
        .select_related('pasta')
        .order_by('-criado_em')[:40]
    )
    if not documentos:
        return 'Nenhum arquivo cadastrado na Matriz de conhecimento.'

    termos = _termos_pergunta(pergunta)
    if termos:
        chaves = {
            chave[:-1] if len(chave) > 4 and chave.endswith('s') else chave
            for chave in (_sem_acento(termo) for termo in termos)
        }
        bases = {}

        def pontos(documento):
            if documento.pk not in bases:
                pasta = documento.pasta.nome if documento.pasta_id else ''
                bases[documento.pk] = _sem_acento(f'{pasta} {documento.titulo} {documento.texto}'.lower())
            base = bases[documento.pk]
            return sum(base.count(chave) for chave in chaves)
        ordenados = sorted(documentos, key=pontos, reverse=True)
        escolhidos = [documento for documento in ordenados if pontos(documento) > 0][:2]
        if not escolhidos:
            for documento in [item for item in documentos if not item.texto_extraido][:2]:
                garantir_texto(documento)
                bases.pop(documento.pk, None)
            ordenados = sorted(documentos, key=pontos, reverse=True)
            escolhidos = [documento for documento in ordenados if pontos(documento) > 0][:2]
        if not escolhidos:
            nomes = '; '.join(documento.titulo for documento in documentos[:8])
            return (
                f'Li {len(documentos)} documento(s) ({nomes}) e nenhum trecho fala sobre isso.'
            )
    else:
        escolhidos = documentos[:2]

    linhas = []
    for documento in escolhidos:
        if not documento.texto_extraido:
            garantir_texto(documento)
        pasta = (documento.pasta.nome if documento.pasta_id else '').strip()
        rotulo = f'{pasta} / {documento.titulo}' if pasta else documento.titulo
        if documento.texto:
            linhas.append(f'{rotulo}: {_trecho(documento.texto, termos)}')
        else:
            linhas.append(f'{rotulo}: o arquivo não tem texto legível para leitura.')
    return f'{TRECHOS_LIDOS}\n' + '\n'.join(linhas)


def resumo_matriz_sgq(user, pergunta: str = '') -> str:
    from apps.sgq.models import DocumentoSGQ
    return resumo_documentos(user, pergunta, modelo=DocumentoSGQ)


_NOMES_MES = (
    ('janeiro', 1),
    ('fevereiro', 2),
    ('marco', 3),
    ('abril', 4),
    ('maio', 5),
    ('junho', 6),
    ('julho', 7),
    ('agosto', 8),
    ('setembro', 9),
    ('outubro', 10),
    ('novembro', 11),
    ('dezembro', 12),
)


def _sem_acento(texto: str) -> str:
    import unicodedata
    return ''.join(
        caractere for caractere in unicodedata.normalize('NFD', texto)
        if unicodedata.category(caractere) != 'Mn'
    )


def _periodo_da_pergunta(pergunta: str) -> tuple[int | None, int | None]:
    import re
    texto = _sem_acento((pergunta or '').lower())
    mes = None
    for nome, numero in _NOMES_MES:
        if re.search(rf'\b{nome}\b', texto):
            mes = numero
            break
    anos = re.findall(r'\b(20\d{2})\b', texto)
    ano = int(anos[-1]) if anos else None
    casado = re.search(r'\b(0?[1-9]|1[0-2])\s*/\s*(20\d{2})\b', texto)
    if casado:
        mes = int(casado.group(1))
        ano = int(casado.group(2))
    return mes, ano


def _tipos_pedidos(pergunta: str) -> list[str]:
    texto = _sem_acento((pergunta or '').lower())
    tipos = []
    if any(termo in texto for termo in ('salario', 'salarial', 'aumento', 'remuneracao')):
        tipos.append('salario')
    if any(termo in texto for termo in ('cargo', 'funcao', 'promocao')):
        tipos.append('cargo')
    return tipos


def _rotulo_contagem(quantidade: int, um: str, varios: str) -> str:
    return f'{quantidade} {um if quantidade == 1 else varios}'


_GENERICOS_PESSOA = frozenset(
    'quem base teve tiveram houve existe existem movimentacao movimentacoes '
    'colaborador colaboradores funcionario funcionarios salario salarial salarios '
    'aumento cargo funcao promocao alteracao alteracoes periodo periodos mes ano '
    'pessoa pessoas nome sobre empresa quadro rh janeiro fevereiro marco abril maio '
    'junho julho agosto setembro outubro novembro dezembro'.split()
)


def _termos_pessoa(pergunta: str) -> list[str]:
    termos = []
    for termo in _termos_pergunta(pergunta):
        chave = _sem_acento(termo)
        if chave.isdigit() or chave in _GENERICOS_PESSOA:
            continue
        termos.append(termo)
    return termos[:4]


def _data_curta(valor) -> str:
    if not valor:
        return '—'
    return valor.strftime('%d/%m/%Y')


def _ficha_pessoas(movimentos, pergunta: str) -> str:
    termos = _termos_pessoa(pergunta)
    if not termos:
        return ''

    consulta = movimentos.select_related('lote')
    achados = consulta
    for termo in termos:
        achados = achados.filter(nome__icontains=termo)
    pessoas = list(achados.order_by('-lote__ano', '-lote__mes', 'nome')[:40])
    if not pessoas:
        from django.db.models import Q
        filtro = Q()
        for termo in termos:
            filtro |= Q(nome__icontains=termo)
        pessoas = list(consulta.filter(filtro).order_by('-lote__ano', '-lote__mes', 'nome')[:40])
    if not pessoas:
        return f'Nenhum colaborador nas movimentações com o nome "{" ".join(termos)}".'

    por_cpf = {}
    for item in pessoas:
        por_cpf.setdefault(item.cpf, []).append(item)

    linhas = ['Colaboradores encontrados pelo nome:']
    for registros in list(por_cpf.values())[:5]:
        atual = registros[0]
        salario = f'{atual.salario:.2f}' if atual.salario is not None else '—'
        linhas.append(
            f'- {atual.nome}, em {atual.lote.mes:02d}/{atual.lote.ano}: '
            f'função {atual.funcao or "—"}, filial {atual.filial or "—"}, '
            f'categoria {atual.categoria or "—"}, situação {atual.situacao or "—"}, '
            f'admissão {_data_curta(atual.data_admissao)}, salário {salario}.'
        )
        outros = [
            f'{item.lote.mes:02d}/{item.lote.ano}'
            for item in registros[1:6]
        ]
        if outros:
            linhas.append(f'  Também consta em {", ".join(outros)}.')
        from apps.rh.models import InconsistenciaColaborador
        alteracoes = (
            InconsistenciaColaborador.objects
            .filter(cpf=atual.cpf, lote__in=movimentos.filter(cpf=atual.cpf).values('lote_id'))
            .select_related('lote')
            .order_by('-lote__ano', '-lote__mes', 'tipo')[:5]
        )
        for item in alteracoes:
            linhas.append(
                f'  {item.get_tipo_display()} em {item.lote.mes:02d}/{item.lote.ano}: '
                f'{item.valor_anterior or "—"} para {item.valor_atual or "—"}.'
            )
    if len(por_cpf) > 5:
        linhas.append(f'E mais {len(por_cpf) - 5} colaborador(es) com nome parecido.')
    return '\n'.join(linhas)


def _linha_alteracao(item) -> str:
    anterior = item.valor_anterior or '—'
    atual = item.valor_atual or '—'
    motivo = (item.justificativa or '').strip()
    extra = f' Motivo: {motivo[:120]}' if motivo else ''
    return f'{item.nome}: {item.get_tipo_display()} de {anterior} para {atual}.{extra}'


def _alteracoes_do_periodo(lotes, por_lote, tipos, limite: int = 48) -> list[str]:
    """Reparte a lista entre os meses, para um mês grande não esconder os outros."""
    grupos = []
    total = 0
    for lote in lotes:
        cpfs, totais = por_lote[lote.id]
        if not any(totais.get(tipo, 0) for tipo in tipos):
            continue
        itens = list(
            lote.inconsistencias.filter(cpf__in=cpfs, tipo__in=tipos)
            .select_related('lote')
            .order_by('nome')
        )
        if itens:
            grupos.append(itens)
            total += len(itens)
    if not grupos:
        return ['Não há alteração do tipo pedido no período importado.']

    cota = max(1, limite // len(grupos))
    escolhidos = []
    for itens in grupos:
        escolhidos.extend(itens[:cota])
    if len(escolhidos) < limite:
        faltam = limite - len(escolhidos)
        for itens in grupos:
            extra = itens[cota:cota + faltam]
            escolhidos.extend(extra)
            faltam -= len(extra)
            if faltam <= 0:
                break
    escolhidos = escolhidos[:limite]
    linhas = [
        f'Alterações no período: {total}. '
        f'A lista traz {len(escolhidos)}, com nome, valor anterior e valor atual.',
    ]
    for item in escolhidos:
        linhas.append(f'- {item.lote.mes:02d}/{item.lote.ano} {_linha_alteracao(item)}')
    if total > len(escolhidos):
        linhas.append(f'E mais {total - len(escolhidos)} alteração(ões) no período, fora desta lista.')
    return linhas


def resumo_movimentacoes(user, pergunta: str = '') -> str:
    from datetime import date

    from django.db.models import Count

    from apps.rh.models import LoteMovimentacaoRH, MovimentacaoColaborador

    movimentos = _filtra_filial(MovimentacaoColaborador.objects.all(), user, 'RH', 'filial')
    lote_ids = movimentos.values_list('lote_id', flat=True).distinct()
    lotes = list(LoteMovimentacaoRH.objects.filter(id__in=lote_ids).order_by('-ano', '-mes'))
    if not lotes:
        return 'Nenhuma movimentação de colaborador importada.'

    def visiveis(lote):
        return movimentos.filter(lote=lote)

    def contagem(lote, cpfs):
        bruto = (
            lote.inconsistencias.filter(cpf__in=cpfs)
            .values('tipo')
            .annotate(n=Count('id'))
        )
        return {item['tipo']: item['n'] for item in bruto}

    linhas = ['Cada linha é o quadro daquele mês, não a soma dos meses.']
    ficha = _ficha_pessoas(movimentos, pergunta)
    if ficha:
        linhas.insert(0, ficha)
    por_lote = {}
    for lote in lotes:
        cpfs = set(visiveis(lote).values_list('cpf', flat=True))
        totais = contagem(lote, cpfs)
        por_lote[lote.id] = (cpfs, totais)
        linhas.append(
            f"{lote.mes:02d}/{lote.ano}: "
            f"{_rotulo_contagem(visiveis(lote).count(), 'colaborador no mês', 'colaboradores no mês')}, "
            f"{_rotulo_contagem(totais.get('salario', 0), 'alteração de salário', 'alterações de salário')}, "
            f"{_rotulo_contagem(totais.get('cargo', 0), 'alteração de cargo', 'alterações de cargo')}."
        )

    mes, ano = _periodo_da_pergunta(pergunta)
    if mes and ano is None:
        ano = date.today().year
    alvo = None
    if mes and ano:
        alvo = next((lote for lote in lotes if lote.mes == mes and lote.ano == ano), None)
        if alvo is None:
            linhas.insert(0, f'Não há movimentação importada em {mes:02d}/{ano}.')

    tipos = _tipos_pedidos(pergunta)
    if alvo is not None:
        cpfs, totais = por_lote[alvo.id]
        pedidos = tipos or ['salario', 'cargo', 'outros']
        escolhidos = [tipo for tipo in pedidos if totais.get(tipo, 0)]
        if not escolhidos:
            linhas.append(f'Em {alvo.mes:02d}/{alvo.ano} não há alteração do tipo pedido.')
        else:
            itens = list(
                alvo.inconsistencias.filter(cpf__in=cpfs, tipo__in=escolhidos).order_by('tipo', 'nome')
            )
            linhas.append(f'Alterações em {alvo.mes:02d}/{alvo.ano}:')
            for item in itens[:20]:
                linhas.append(f'- {_linha_alteracao(item)}')
            if len(itens) > 20:
                linhas.append(f'E mais {len(itens) - 20} alteração(ões) nesse mês.')
    elif tipos and not (mes and ano):
        linhas.extend(_alteracoes_do_periodo(lotes, por_lote, tipos))
    elif not (mes and ano):
        linhas.append('Nenhum mês foi citado na pergunta. Os números acima separam salário e cargo por período.')

    return '\n'.join(linhas)


def resumo_pesquisas(user) -> str:
    from apps.sgq.models import PesquisaSatisfacao
    total = _filtra_filial(PesquisaSatisfacao.objects.all(), user, 'SGQ', 'filial').count()
    return _texto(total, 'pesquisa de satisfação', 'pesquisas de satisfação')


def _texto_limpo(valor: str) -> str:
    import re
    texto = str(valor or '')
    texto = re.sub(r'<br\s*/?>', '\n', texto, flags=re.I)
    texto = re.sub(r'</(?:p|div|li|ul|ol|h[1-6])>', '\n', texto, flags=re.I)
    texto = re.sub(r'<[^>]+>', '', texto)
    texto = (
        texto.replace('&nbsp;', ' ')
        .replace('&amp;', '&')
        .replace('&lt;', '<')
        .replace('&gt;', '>')
    )
    texto = re.sub(r'[ \t]+\n', '\n', texto)
    return re.sub(r'\n{3,}', '\n\n', texto).strip()


def _pontos_blob(blob: str, termos: list[str]) -> int:
    base = _sem_acento(blob.lower())
    nota = 0
    for termo in termos:
        chave = _sem_acento(termo)
        if len(chave) > 4 and chave.endswith('s'):
            chave = chave[:-1]
        if len(chave) >= 4:
            nota += base.count(chave)
    return nota


def _normas_do_acesso(user):
    from django.db.models import Q

    from apps.accounts.permissions import allowed_filiais_for_module, db_values_for_filiais
    from apps.sgq.models import NormaSGQ
    from apps.sgq.serializers import filial_que_compartilha_normas

    if user.is_admin:
        return NormaSGQ.objects.all()
    filiais = db_values_for_filiais(allowed_filiais_for_module(user, 'SGQ'))
    if not filiais:
        return NormaSGQ.objects.none()
    origem = filial_que_compartilha_normas()
    return NormaSGQ.objects.filter(Q(filial__in=filiais) | Q(filial=origem, publica=True)).distinct()


def _normalizar_referencia(texto: str) -> str:
    import re

    base = _sem_acento((texto or '').lower()).replace('ª', '').replace('º', '').replace('°', '')
    base = re.sub(r'(\d)\s*[ao]\b', r'\1', base)
    base = re.sub(r'[^a-z0-9]+', ' ', base)
    return ' '.join(base.split())


def _tokens_nome(nome: str) -> list[str]:
    paradas = {'a', 'o', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nbr', 'abnt'}
    return [token for token in _normalizar_referencia(nome).split() if token not in paradas]


def _normas_citadas(normas, pergunta: str) -> list:
    import re

    base = _normalizar_referencia(pergunta)
    tokens_base = set(base.split())
    edicoes = set(re.findall(r'\b(\d{1,2})\s+edicao\b', base))
    genericos = {'edicao', 'edicoes', 'versao'}
    pontuadas = []
    for norma in normas:
        casados = []
        for token in _tokens_nome(norma.nome):
            if token in genericos:
                continue
            if token.isdigit() and len(token) <= 2:
                if token in edicoes:
                    casados.append(token)
                continue
            if token in tokens_base:
                casados.append(token)
        if casados:
            pontuadas.append((len(casados), norma))
    if not pontuadas:
        return []
    melhor = max(nota for nota, _norma in pontuadas)
    return [norma for nota, norma in pontuadas if nota == melhor]


def _escolhe_a_unica_ativa(normas, pergunta: str):
    base = _sem_acento((pergunta or '').lower())
    frases = (
        'a ativa',
        'norma ativa',
        'que esta ativa',
        'somente a ativa',
        'so a ativa',
        'apenas a ativa',
        'a que esta ativa',
    )
    if not any(frase in base for frase in frases):
        return None
    ativas = [norma for norma in normas if norma.ativa]
    if len(ativas) == 1:
        return ativas[0]
    return None


def _pediu_todas_as_normas(pergunta: str) -> bool:
    base = _sem_acento((pergunta or '').lower())
    return any(frase in base for frase in (
        'todas as normas',
        'em todas as normas',
        'de todas as normas',
        'nas normas cadastradas',
    ))


def _pedido_de_norma(normas) -> str:
    ativas = sum(1 for norma in normas if norma.ativa)
    if ativas == 1:
        situacao = ' Só uma está ativa.'
    elif ativas == 0:
        situacao = ' Nenhuma está ativa.'
    else:
        situacao = f' {ativas} estão ativas.'
    linhas = [
        (
            f'Há {len(normas)} normas cadastradas e a pergunta não diz qual consultar. '
            'Pergunte qual delas usar antes de responder o conteúdo.'
            f'{situacao}'
        )
    ]
    for norma in normas:
        estado = 'ativa' if norma.ativa else 'inativa'
        linhas.append(f'- {norma.nome} ({estado})')
    return '\n'.join(linhas)


def _mapa_areas(norma) -> dict[str, str]:
    mapa = {}
    for area in norma.areas or []:
        if isinstance(area, dict) and str(area.get('sigla') or '').strip():
            sigla = str(area['sigla']).strip()
            mapa[sigla] = str(area.get('nome') or sigla).strip()
    return mapa


def _pediu_lista_completa(pergunta: str) -> bool:
    base = _normalizar_referencia(pergunta)
    if any(termo in base.split() for termo in ('tabela', 'listagem', 'liste', 'lista', 'listar')):
        return True
    return any(frase in base for frase in (
        'todas as perguntas',
        'todos os itens',
        'com todas',
        'lista completa',
    ))


def _bloco_area(norma, pergunta: str) -> list[str] | None:
    import re

    mapa = _mapa_areas(norma)
    if not mapa:
        return None
    base = _normalizar_referencia(pergunta)
    pedidas = []
    for sigla, nome in mapa.items():
        nome_normal = _normalizar_referencia(nome)
        sigla_normal = _normalizar_referencia(sigla)
        if nome_normal and nome_normal in base:
            pedidas.append(sigla)
        elif len(sigla_normal) >= 2 and re.search(
            rf'(?<![a-z0-9]){re.escape(sigla_normal)}(?![a-z0-9])', base,
        ):
            pedidas.append(sigla)
    if not pedidas:
        return None
    so_perguntas = 'pergunta' in base
    itens = [
        item for item in norma.itens.all()
        if (not so_perguntas or item.tipo == 'pergunta') and set(item.areas or []) & set(pedidas)
    ]
    nomes = ', '.join(f'{mapa[sigla]} ({sigla})' for sigla in pedidas)
    if so_perguntas:
        rotulo = 'pergunta' if len(itens) == 1 else 'perguntas'
    else:
        rotulo = 'item' if len(itens) == 1 else 'itens'
    if _pediu_lista_completa(pergunta):
        linhas = [
            f'LISTA COMPLETA. {norma.nome}: {len(itens)} {rotulo} da área {nomes}.',
            'Monte a tabela com todas as linhas abaixo, sem omitir nenhuma.',
            '| Código | Pergunta |',
            '| --- | --- |',
        ]
        for item in itens:
            titulo = ' '.join(str(item.titulo or '').split()).replace('|', '/')
            linhas.append(f'| {item.codigo} | {titulo} |')
        return linhas
    linhas = [f'{norma.nome}: {len(itens)} {rotulo} da área {nomes}.']
    for item in itens[:30]:
        linhas.append(f'- {f"{item.codigo} {item.titulo}".strip()}')
    if len(itens) > 30:
        linhas.append(f'Outras {len(itens) - 30} não listadas. O total é {len(itens)}.')
    return linhas


def resumo_normas(user, pergunta: str = '') -> str:
    normas = list(_normas_do_acesso(user).prefetch_related('itens').order_by('nome', 'pk'))
    if not normas:
        return 'Nenhuma norma no seu acesso.'
    if not (pergunta or '').strip():
        return _texto(len(normas), 'norma no seu acesso', 'normas no seu acesso')

    citadas = _normas_citadas(normas, pergunta)
    if len(citadas) == 1:
        normas = citadas
    elif len(citadas) > 1:
        return _pedido_de_norma(citadas)
    elif not _pediu_todas_as_normas(pergunta):
        unica_ativa = _escolhe_a_unica_ativa(normas, pergunta)
        if unica_ativa is not None:
            normas = [unica_ativa]
        elif len(normas) > 1:
            return _pedido_de_norma(normas)

    termos = _termos_pergunta(pergunta)
    linhas_area = []
    normas_texto = []
    for norma in normas:
        bloco = _bloco_area(norma, pergunta)
        if bloco is not None:
            linhas_area.extend(bloco)
        else:
            normas_texto.append(norma)
    if linhas_area and not normas_texto:
        return '\n'.join(linhas_area)

    blocos = []
    for norma in normas_texto:
        itens = list(norma.itens.all())
        pedacos = [f'{norma.nome} {norma.descricao}']
        pedacos.extend(f'{item.codigo} {item.titulo} {item.descricao}' for item in itens)
        blob = ' '.join(pedacos)
        blocos.append(( _pontos_blob(blob, termos), norma, itens))
    escolhidas = [bloco for bloco in sorted(blocos, key=lambda item: item[0], reverse=True) if bloco[0] > 0][:2]
    if not escolhidas:
        if linhas_area:
            return '\n'.join(linhas_area)
        nomes = '; '.join(norma.nome for norma in normas[:8])
        return f'Li {len(normas)} norma(s) ({nomes}) e nenhuma fala sobre isso.'

    linhas = []
    for _nota, norma, itens in escolhidas:
        cabeca = norma.nome
        if norma.descricao:
            cabeca += f': {_trecho(_texto_limpo(norma.descricao), termos, limite=500, janelas=1)}'
        linhas.append(cabeca)
        casados = []
        for item in itens:
            texto_item = f'{item.codigo} {item.titulo} {item.descricao}'
            if termos and _pontos_blob(texto_item, termos) <= 0 and _pontos_blob(norma.nome, termos) <= 0:
                continue
            if termos and _pontos_blob(norma.nome, termos) > 0 and _pontos_blob(texto_item, termos) <= 0:
                continue
            linha = f'{item.codigo} {item.titulo}'.strip()
            descricao = _texto_limpo(item.descricao)
            if descricao:
                linha += f': {_trecho(descricao, termos, limite=400, janelas=1)}'
            casados.append(linha)
        if not casados and _pontos_blob(f'{norma.nome} {norma.descricao}', termos) > 0:
            casados = [f'{item.codigo} {item.titulo}'.strip() for item in itens[:20]]
        linhas.extend(f'- {linha}' for linha in casados[:20])
    return '\n'.join([*linhas_area, *linhas])


def _bloco_auditoria(auditoria, termos: list[str]) -> str:
    linhas = [
        (
            f'{auditoria.codigo} {auditoria.titulo} ({auditoria.get_status_display()}), '
            f'{auditoria.data_inicio:%d/%m/%Y} a {auditoria.data_termino:%d/%m/%Y}, '
            f'líder {auditoria.auditor_lider or "—"}, filial {auditoria.filial}'
        )
    ]
    for rotulo, valor in (
        ('Escopo / objetivo', auditoria.escopo),
        ('Critérios', auditoria.criterios),
        ('Processos e áreas', auditoria.processos_areas),
        ('Responsáveis pelo processo', auditoria.responsaveis_processos),
        ('Metodologia', auditoria.metodologia),
    ):
        limpo = _texto_limpo(valor)
        if limpo:
            linhas.append(f'{rotulo}: {_trecho(limpo, termos, limite=700, janelas=2)}')
    plano = []
    for item in auditoria.planejamento or []:
        if not isinstance(item, dict):
            continue
        atividade = ' '.join(str(item.get('atividade') or '').split())
        quando = ' '.join(
            pedaco for pedaco in (str(item.get('data') or ''), f"{item.get('horaInicio') or ''}–{item.get('horaFim') or ''}")
            if pedaco and pedaco != '–'
        )
        if atividade or quando:
            plano.append(f'{quando} {atividade}'.strip())
    if plano:
        linhas.append('Planejamento: ' + '; '.join(plano[:12]))
    respostas = []
    for resposta in auditoria.respostas.all():
        item = resposta.item
        rotulo = f'{item.codigo} {item.titulo}'.strip()
        pedacos = []
        if resposta.opcao_texto:
            pedacos.append(resposta.opcao_texto)
        observacao = _texto_limpo(resposta.observacoes)
        if observacao:
            pedacos.append(f'observação: {observacao}')
        if resposta.destaque == 'forte':
            pedacos.append('ponto forte')
        elif resposta.destaque == 'fraco':
            pedacos.append('ponto fraco')
        if pedacos:
            respostas.append(f'{rotulo}: {"; ".join(pedacos)}')
    if respostas:
        linhas.append('Questionário:')
        linhas.extend(f'- {linha}' for linha in respostas[:24])
    return '\n'.join(linhas)


def resumo_auditorias(user, pergunta: str = '') -> str:
    import re

    from apps.sgq.models import AuditoriaSGQ

    auditorias = list(
        _filtra_filial(
            AuditoriaSGQ.objects.prefetch_related('respostas__item'),
            user, 'SGQ', 'filial',
        ).order_by('-data_inicio', '-sequencia')
    )
    if not auditorias:
        return 'Nenhuma auditoria no seu acesso.'
    if not (pergunta or '').strip():
        return _texto(len(auditorias), 'auditoria no seu acesso', 'auditorias no seu acesso')

    termos = _termos_pergunta(pergunta)
    codigos = re.findall(r'\b\d{2}-\d{5}\b', pergunta or '')
    if codigos:
        escolhidas = [auditoria for auditoria in auditorias if auditoria.codigo in codigos][:2]
    else:
        pontuadas = []
        for auditoria in auditorias:
            respostas = ' '.join(
                f'{resposta.item.codigo} {resposta.item.titulo} {resposta.opcao_texto} {resposta.observacoes}'
                for resposta in auditoria.respostas.all()
            )
            plano = ' '.join(
                str(item.get('atividade') or '')
                for item in (auditoria.planejamento or [])
                if isinstance(item, dict)
            )
            blob = ' '.join((
                auditoria.codigo, auditoria.titulo, auditoria.categoria, auditoria.escopo,
                auditoria.criterios, auditoria.processos_areas, auditoria.responsaveis_processos,
                auditoria.metodologia, plano, respostas,
            ))
            pontuadas.append((_pontos_blob(blob, termos), auditoria))
        escolhidas = [auditoria for nota, auditoria in sorted(pontuadas, key=lambda item: item[0], reverse=True) if nota > 0][:2]
    if not escolhidas:
        amostra = '; '.join(f'{auditoria.codigo} {auditoria.titulo}' for auditoria in auditorias[:8])
        return f'Li {len(auditorias)} auditoria(s) ({amostra}) e nenhuma traz esse assunto.'
    return '\n\n'.join(_bloco_auditoria(auditoria, termos) for auditoria in escolhidas)


def resumo_campanhas(user) -> str:
    from apps.marketing.models import CampanhaMarketing
    return _texto(CampanhaMarketing.objects.count(), 'campanha', 'campanhas')


def resumo_metas(user) -> str:
    from apps.indicadores.models import MetaFaturamentoMensal
    return _texto(MetaFaturamentoMensal.objects.count(), 'meta de faturamento cadastrada', 'metas de faturamento cadastradas')


def resumo_clientes_comercial(user) -> str:
    from apps.comercial.models import ClienteComercial
    return _texto(ClienteComercial.objects.count(), 'cliente comercial', 'clientes comerciais')


def resumo_tabela_frete(user) -> str:
    from apps.comercial.models import TabelaFrete
    return _texto(TabelaFrete.objects.count(), 'tabela de frete', 'tabelas de frete')


def resumo_generalidades(user) -> str:
    from apps.comercial.models import GeneralidadeComercial
    return _texto(GeneralidadeComercial.objects.count(), 'generalidade', 'generalidades')


def resumo_icms(user) -> str:
    from apps.comercial.models import MatrizIcmsUf
    return _texto(MatrizIcmsUf.objects.count(), 'alíquota de ICMS por UF', 'alíquotas de ICMS por UF')


def resumo_parametros(user) -> str:
    from apps.comercial.models import ParametrosComercial
    total = ParametrosComercial.objects.count()
    if total:
        return 'Parâmetros comerciais configurados.'
    return 'Parâmetros comerciais ainda não configurados.'


def resumo_produtos(user) -> str:
    from apps.comercial.models import ProdutoComercial
    return _texto(ProdutoComercial.objects.count(), 'produto na composição', 'produtos na composição')


def resumo_propostas(user) -> str:
    from apps.comercial.models import PropostaComercial
    return _texto(PropostaComercial.objects.count(), 'proposta comercial', 'propostas comerciais')


def resumo_validacao(user) -> str:
    from apps.comercial.models import COMPATIBILIDADE_HOMOLOGADO, ClienteComercial
    pendentes = ClienteComercial.objects.exclude(compatibilidade=COMPATIBILIDADE_HOMOLOGADO).count()
    return _texto(pendentes, 'cliente ainda sem homologação', 'clientes ainda sem homologação')


def resumo_fluxo(user) -> str:
    return resumo_relatorios(user)


def resumo_meta_indicador(user) -> str:
    return resumo_metas(user)


def resumo_rh_indicador(user, pergunta: str = '') -> str:
    return resumo_movimentacoes(user, pergunta)


def resumo_satisfacao_indicador(user) -> str:
    return resumo_pesquisas(user)


LEITORES = {
    ('Financeiro', 'calendario'): resumo_calendario,
    ('Financeiro', 'inclusao-relatorios'): resumo_relatorios,
    ('Financeiro', 'saldos-bancarios'): resumo_saldos,
    ('Financeiro', 'ajustes-caixa'): resumo_ajustes,
    ('Financeiro', 'faturamento'): resumo_faturamento_fin,
    ('Faturamento', 'envio-nf-cliente'): resumo_protocolos,
    ('Faturamento', 'cadastro-clientes'): resumo_clientes_protocolo,
    ('Suprimentos', 'controle-estoque'): resumo_estoque,
    ('RH', 'movimentacoes'): resumo_movimentacoes,
    ('RH', 'documentos'): resumo_documentos,
    ('SGQ', 'matriz'): resumo_matriz_sgq,
    ('SGQ', 'pesquisa-satisfacao'): resumo_pesquisas,
    ('SGQ', 'auditorias'): resumo_auditorias,
    ('SGQ', 'normas'): resumo_normas,
    ('Marketing', 'campanhas'): resumo_campanhas,
    ('Logística', 'configuracoes'): resumo_metas,
    ('Comercial', 'cadastro-clientes'): resumo_clientes_comercial,
    ('Comercial', 'cadastro-tabela-frete'): resumo_tabela_frete,
    ('Comercial', 'cadastro-generalidades'): resumo_generalidades,
    ('Comercial', 'cadastro-icms-ufs'): resumo_icms,
    ('Comercial', 'cadastro-parametros'): resumo_parametros,
    ('Comercial', 'cadastro-produtos'): resumo_produtos,
    ('Comercial', 'propostas-comerciais'): resumo_propostas,
    ('Comercial', 'validacao-clientes'): resumo_validacao,
    ('Indicadores', 'fluxo-caixa'): resumo_fluxo,
    ('Indicadores', 'meta-faturamento'): resumo_meta_indicador,
    ('Indicadores', 'movimentacao-rh'): resumo_rh_indicador,
    ('Indicadores', 'satisfacao-clientes'): resumo_satisfacao_indicador,
}


_SINAIS = {
    ('Financeiro', 'calendario'): ('calendario', 'agenda', 'evento', 'compromisso'),
    ('Financeiro', 'inclusao-relatorios'): ('pagar', 'receber', 'titulo', 'fornecedor', 'inadimplencia'),
    ('Financeiro', 'saldos-bancarios'): ('saldo', 'banco', 'conta bancaria'),
    ('Financeiro', 'ajustes-caixa'): ('ajuste', 'caixa'),
    ('Financeiro', 'faturamento'): ('faturamento',),
    ('Faturamento', 'envio-nf-cliente'): ('protocolo', 'canhoto', 'nota fiscal'),
    ('Faturamento', 'cadastro-clientes'): ('protocolo',),
    ('Suprimentos', 'controle-estoque'): ('estoque', 'quantidade minima'),
    ('RH', 'movimentacoes'): ('salario', 'cargo', 'colaborador', 'funcionario', 'movimentacao', 'admissao'),
    ('RH', 'documentos'): ('documento', 'matriz', 'conhecimento', 'convencao', 'piso', 'diaria', 'sindical', 'acordo'),
    ('SGQ', 'matriz'): ('matriz', 'conhecimento', 'documento', 'procedimento', 'qualidade'),
    ('SGQ', 'pesquisa-satisfacao'): ('pesquisa', 'satisfacao'),
    ('SGQ', 'auditorias'): (
        'auditoria', 'questionario', 'observacao', 'resposta', 'planejamento',
        'escopo', 'criterio', 'metodologia', 'andamento',
    ),
    ('SGQ', 'normas'): ('norma', 'normas', 'requisito', 'checklist', 'item da norma'),
    ('Marketing', 'campanhas'): ('campanha', 'marketing'),
    ('Logística', 'configuracoes'): ('logistica',),
    ('Comercial', 'cadastro-clientes'): ('cliente comercial', 'razao'),
    ('Comercial', 'cadastro-tabela-frete'): ('tabela de frete', 'tarifa'),
    ('Comercial', 'cadastro-generalidades'): ('generalidade',),
    ('Comercial', 'cadastro-icms-ufs'): ('icms', 'aliquota'),
    ('Comercial', 'cadastro-parametros'): ('parametro comercial', 'vigencia padrao'),
    ('Comercial', 'cadastro-produtos'): ('produto', 'onu', 'pastagem', 'composicao'),
    ('Comercial', 'propostas-comerciais'): ('proposta', 'cotacao', 'spot'),
    ('Comercial', 'validacao-clientes'): ('homologacao', 'validacao'),
    ('Indicadores', 'fluxo-caixa'): ('fluxo de caixa',),
    ('Indicadores', 'meta-faturamento'): ('meta de faturamento',),
    ('Indicadores', 'movimentacao-rh'): ('movimentacao de rh',),
    ('Indicadores', 'satisfacao-clientes'): ('satisfacao dos clientes',),
}

_LIMITE_RESUMO = 2800
# Sem palavra-sinal na pergunta, agentes com até estas partes leem todas pelo termo da pergunta.
_MAXIMO_SEM_SINAL = 3
_PARTES_DOCUMENTO = frozenset({
    ('RH', 'documentos'),
    ('SGQ', 'matriz'),
    ('SGQ', 'auditorias'),
    ('SGQ', 'normas'),
})


def _tem_sinal(texto: str, sinal: str) -> bool:
    import re
    chave = _sem_acento(sinal)
    if ' ' in chave or len(chave) >= 6:
        return chave in texto
    return re.search(rf'\b{re.escape(chave)}\b', texto) is not None


def _pontos_parte(pergunta: str, item: dict) -> int:
    texto = _sem_acento((pergunta or '').lower())
    nota = 0
    rotulo = _sem_acento(item.get('rotulo') or '')
    for palavra in rotulo.split():
        if len(palavra) > 3 and _tem_sinal(texto, palavra):
            nota += 3
    for sinal in _SINAIS.get((item.get('ambiente'), item.get('parte')), ()):
        if _tem_sinal(texto, sinal):
            nota += 2
    return nota


def _partes_em_foco(pergunta: str, efetivos: list[dict]) -> list[dict]:
    ranqueadas = sorted(efetivos, key=lambda item: _pontos_parte(pergunta, item), reverse=True)
    fortes = [item for item in ranqueadas if _pontos_parte(pergunta, item) >= 2]
    if fortes:
        return fortes[:2]
    if len(efetivos) == 1:
        return list(efetivos)
    return []


def _contagem_documentos(user, modelo=None) -> str:
    from apps.rh.models import DocumentoRH
    modelo = modelo or DocumentoRH
    return _texto(modelo.objects.count(), 'arquivo na Matriz de conhecimento', 'arquivos na Matriz de conhecimento')


def _contagem_matriz_sgq(user) -> str:
    from apps.sgq.models import DocumentoSGQ
    return _contagem_documentos(user, DocumentoSGQ)


def _contagem_movimentacoes(user) -> str:
    from apps.rh.models import MovimentacaoColaborador
    total = _filtra_filial(MovimentacaoColaborador.objects.all(), user, 'RH', 'filial').count()
    return _texto(total, 'registro de movimentação', 'registros de movimentação')


_GENERICOS_BUSCA = frozenset(
    'proposta propostas comercial comerciais cliente clientes produto produtos '
    'alguma algum tenho existe existem quantas quantos status registrada registrado '
    'funcao rotina cadastro tabela documento documentos'.split()
)


def _linhas_casadas(qs, campos: tuple[str, ...], pergunta: str, formatar, limite: int = 4) -> str:
    from django.db.models import Q
    termos = [
        termo for termo in _termos_pergunta(pergunta)
        if len(termo) >= 4 and _sem_acento(termo) not in _GENERICOS_BUSCA
    ][:3]
    if termos and campos:
        filtro = Q()
        for termo in termos:
            for campo in campos:
                filtro |= Q(**{f'{campo}__icontains': termo})
        achados = list(qs.filter(filtro)[:limite])
        if not achados:
            recentes = list(qs[:limite])
            if not recentes:
                return 'Nenhum registro nessa função.'
            linhas = ['Nenhum registro com esse nome. Amostra recente:']
            linhas.extend(f'- {formatar(item)}' for item in recentes)
            return '\n'.join(linhas)
        titulo = 'Registros que batem com a pergunta:'
    else:
        achados = list(qs[:limite])
        if not achados:
            return ''
        titulo = 'Amostra recente:'
    linhas = [titulo]
    linhas.extend(f'- {formatar(item)}' for item in achados)
    return '\n'.join(linhas)


def _detalhe_propostas(user, pergunta: str) -> str:
    from apps.comercial.models import PropostaComercial
    qs = PropostaComercial.objects.select_related('cliente').order_by('-data_criacao')

    def linha(proposta):
        cliente = proposta.cliente_nome or (proposta.cliente.razao_social if proposta.cliente_id else '—')
        numero = proposta.numero_identificacao or 'sem número'
        return f'{numero} {proposta.titulo or "sem título"}: {proposta.get_status_display()}, cliente {cliente}'

    return _linhas_casadas(qs, ('titulo', 'cliente_nome', 'proposta_referente'), pergunta, linha)


def _detalhe_produtos(user, pergunta: str) -> str:
    from apps.comercial.models import ProdutoComercial
    qs = ProdutoComercial.objects.order_by('nome')

    def linha(produto):
        onu = produto.numero_onu or '—'
        return f'{produto.nome}: {produto.get_tipo_produto_display()}, ONU {onu}'

    return _linhas_casadas(qs, ('nome', 'numero_onu'), pergunta, linha)


def _detalhe_clientes(user, pergunta: str) -> str:
    from apps.comercial.models import ClienteComercial
    qs = ClienteComercial.objects.order_by('razao_social')

    def linha(cliente):
        return f'{cliente.razao_social} ({cliente.uf or "—"})'

    return _linhas_casadas(qs, ('razao_social', 'nome_fantasia'), pergunta, linha)


def _detalhe_tabela_frete(user, pergunta: str) -> str:
    from apps.comercial.models import TabelaFrete
    qs = TabelaFrete.objects.order_by('-data_criacao')

    def linha(tabela):
        return f'{tabela.nome}: {tabela.get_status_display()}, revisão {tabela.revisao}'

    return _linhas_casadas(qs, ('nome', 'codigo'), pergunta, linha)


def _detalhe_generalidades(user, pergunta: str) -> str:
    from apps.comercial.models import GeneralidadeComercial
    qs = GeneralidadeComercial.objects.select_related('cliente').order_by('ordem', 'pk')

    def linha(item):
        escopo = item.cliente.razao_social if item.cliente_id else 'Padrão'
        return f'{escopo} / {item.rotulo}: {(item.valor or "—")[:160]}'

    return _linhas_casadas(qs, ('rotulo', 'valor'), pergunta, linha)


def _detalhe_icms(user, pergunta: str) -> str:
    import re
    from apps.comercial.models import MatrizIcmsUf
    matriz = MatrizIcmsUf.objects.order_by('-atualizado_em').first()
    dados = matriz.matriz if matriz and isinstance(matriz.matriz, dict) else {}
    if not dados:
        return 'Nenhuma alíquota cadastrada na matriz.'
    ufs = re.findall(r'\b[A-Za-z]{2}\b', pergunta or '')
    ufs = [uf.upper() for uf in ufs][:2]
    linhas = []
    if len(ufs) == 2 and isinstance(dados.get(ufs[0]), dict) and ufs[1] in dados[ufs[0]]:
        linhas.append(f'{ufs[0]} para {ufs[1]}: {dados[ufs[0]][ufs[1]]}')
    elif len(ufs) == 1 and isinstance(dados.get(ufs[0]), dict):
        pares = list(dados[ufs[0]].items())[:6]
        linhas.extend(f'{ufs[0]} para {destino}: {valor}' for destino, valor in pares)
    else:
        origens = list(dados.items())[:4]
        for origem, destinos in origens:
            if not isinstance(destinos, dict):
                continue
            amostra = ', '.join(f'{destino} {valor}' for destino, valor in list(destinos.items())[:3])
            linhas.append(f'{origem}: {amostra}')
    if not linhas:
        return 'A matriz existe, mas não há par de UF na pergunta.'
    return 'Alíquotas:\n' + '\n'.join(f'- {linha}' for linha in linhas[:6])


def _detalhe_parametros(user, pergunta: str) -> str:
    from apps.comercial.models import ParametrosComercial
    item = ParametrosComercial.objects.order_by('-atualizado_em').first()
    if not item:
        return ''
    return (
        f'Validade padrão: {item.validade_padrao or "—"}. '
        f'Faturamento padrão: {item.faturamento_padrao or "—"}. '
        f'Vigência padrão: {item.vigencia_padrao or "—"}.'
    )


def _detalhe_validacao(user, pergunta: str) -> str:
    from apps.comercial.models import COMPATIBILIDADE_HOMOLOGADO, ClienteComercial
    qs = ClienteComercial.objects.exclude(compatibilidade=COMPATIBILIDADE_HOMOLOGADO).order_by('razao_social')

    def linha(cliente):
        return f'{cliente.razao_social}: {cliente.compatibilidade or "pendente"}'

    return _linhas_casadas(qs, ('razao_social',), pergunta, linha)


def _detalhe_estoque(user, pergunta: str) -> str:
    from apps.compras.models import ItemEstoque
    qs = ItemEstoque.objects.order_by('nome')

    def linha(item):
        return f'{item.nome}: {item.qtd_atual} {item.unidade}, mínimo {item.qtd_minima}'

    return _linhas_casadas(qs, ('nome',), pergunta, linha)


def _detalhe_saldos(user, pergunta: str) -> str:
    from apps.financeiro.models import BankAccount
    qs = BankAccount.objects.order_by('bank', 'number')

    def linha(conta):
        return f'{conta.bank} ag {conta.agency} cc {conta.number}: saldo {conta.balance}'

    return _linhas_casadas(qs, ('bank', 'number'), pergunta, linha)


def _detalhe_relatorios(user, pergunta: str) -> str:
    from apps.financeiro.models import PagarTitulo, ReceberTitulo
    texto = _sem_acento((pergunta or '').lower())
    blocos = []
    if 'receber' not in texto or 'pagar' in texto:
        pagar = _filtra_filial(PagarTitulo.objects.all(), user, 'Financeiro', 'filial').order_by('vencimento')
        blocos.append('A pagar:\n' + _linhas_casadas(
            pagar, ('fornecedor', 'titulo'), pergunta,
            lambda item: f'{item.fornecedor} título {item.titulo}: saldo {item.saldo}, vencimento {item.vencimento or "—"}',
        ))
    if 'pagar' not in texto or 'receber' in texto:
        receber = _filtra_filial(ReceberTitulo.objects.all(), user, 'Financeiro', 'filial').order_by('vencimento')
        blocos.append('A receber:\n' + _linhas_casadas(
            receber, ('cliente', 'titulo'), pergunta,
            lambda item: f'{item.cliente} título {item.titulo}: saldo {item.saldo}, vencimento {item.vencimento or "—"}',
        ))
    return '\n'.join(bloco for bloco in blocos if bloco.strip())


def _detalhe_calendario(user, pergunta: str) -> str:
    from apps.financeiro.models import CalendarioEvento
    qs = CalendarioEvento.objects.filter(usuario=user).order_by('data')

    def linha(evento):
        return f'{evento.data.strftime("%d/%m/%Y")} {evento.titulo}'

    return _linhas_casadas(qs, ('titulo',), pergunta, linha)


def _detalhe_faturamento(user, pergunta: str) -> str:
    from apps.financeiro.models import BillingRecord
    qs = BillingRecord.objects.order_by('-reference_date')

    def linha(item):
        return f'{item.reference_date.strftime("%d/%m/%Y")} {item.branch}: {item.value}'

    return _linhas_casadas(qs, ('branch',), pergunta, linha)


def _detalhe_protocolos(user, pergunta: str) -> str:
    from apps.faturamento.models import ProtocoloEnvio
    qs = ProtocoloEnvio.objects.select_related('cliente').order_by('-data')

    def linha(item):
        nome = item.cliente.nome if item.cliente_id else '—'
        return f'{item.data.strftime("%d/%m/%Y")} {nome}: NF {(item.nota_fiscal or "—")[:80]}'

    return _linhas_casadas(qs, ('nota_fiscal', 'cliente__nome'), pergunta, linha)


def _detalhe_campanhas(user, pergunta: str) -> str:
    from apps.marketing.models import CampanhaMarketing
    qs = CampanhaMarketing.objects.order_by('-data_inicio')

    def linha(item):
        return f'{item.titulo}: {item.get_status_display()}, {item.data_inicio.strftime("%d/%m/%Y")}'

    return _linhas_casadas(qs, ('titulo',), pergunta, linha)


def _detalhe_pesquisas(user, pergunta: str) -> str:
    from apps.sgq.models import PesquisaSatisfacao
    qs = _filtra_filial(PesquisaSatisfacao.objects.all(), user, 'SGQ', 'filial').order_by('-data_entrega')

    def linha(item):
        return f'{item.data_entrega.strftime("%d/%m/%Y")} {item.cliente}: CT-e {item.cte}'

    return _linhas_casadas(qs, ('cliente', 'cte', 'motorista'), pergunta, linha)


def _detalhe_metas(user, pergunta: str) -> str:
    from apps.indicadores.models import MetaFaturamentoMensal
    qs = MetaFaturamentoMensal.objects.order_by('-ano', '-mes')

    def linha(item):
        return f'{item.mes:02d}/{item.ano}: {item.valor}'

    return _linhas_casadas(qs, (), pergunta, linha)


_DETALHE = {
    ('Financeiro', 'calendario'): _detalhe_calendario,
    ('Financeiro', 'inclusao-relatorios'): _detalhe_relatorios,
    ('Financeiro', 'saldos-bancarios'): _detalhe_saldos,
    ('Financeiro', 'faturamento'): _detalhe_faturamento,
    ('Faturamento', 'envio-nf-cliente'): _detalhe_protocolos,
    ('Suprimentos', 'controle-estoque'): _detalhe_estoque,
    ('SGQ', 'pesquisa-satisfacao'): _detalhe_pesquisas,
    ('Marketing', 'campanhas'): _detalhe_campanhas,
    ('Logística', 'configuracoes'): _detalhe_metas,
    ('Comercial', 'cadastro-clientes'): _detalhe_clientes,
    ('Comercial', 'cadastro-tabela-frete'): _detalhe_tabela_frete,
    ('Comercial', 'cadastro-generalidades'): _detalhe_generalidades,
    ('Comercial', 'cadastro-icms-ufs'): _detalhe_icms,
    ('Comercial', 'cadastro-parametros'): _detalhe_parametros,
    ('Comercial', 'cadastro-produtos'): _detalhe_produtos,
    ('Comercial', 'propostas-comerciais'): _detalhe_propostas,
    ('Comercial', 'validacao-clientes'): _detalhe_validacao,
    ('Indicadores', 'fluxo-caixa'): _detalhe_relatorios,
    ('Indicadores', 'meta-faturamento'): _detalhe_metas,
    ('Indicadores', 'satisfacao-clientes'): _detalhe_pesquisas,
}


def _ler_parte(user, item: dict, pergunta: str, detalhar: bool) -> str:
    chave = (item['ambiente'], item['parte'])
    if not detalhar:
        if chave == ('RH', 'documentos'):
            return _contagem_documentos(user)
        if chave == ('SGQ', 'matriz'):
            return _contagem_matriz_sgq(user)
        if chave == ('SGQ', 'auditorias'):
            return resumo_auditorias(user)
        if chave == ('SGQ', 'normas'):
            return resumo_normas(user)
        if chave in {('RH', 'movimentacoes'), ('Indicadores', 'movimentacao-rh')}:
            return _contagem_movimentacoes(user)
        leitor = LEITORES.get(chave)
        return leitor(user) if leitor else 'Parte liberada, sem resumo cadastrado.'

    if chave == ('RH', 'documentos'):
        texto = resumo_documentos(user, pergunta)
    elif chave == ('SGQ', 'matriz'):
        texto = resumo_matriz_sgq(user, pergunta)
    elif chave == ('SGQ', 'auditorias'):
        texto = resumo_auditorias(user, pergunta)
    elif chave == ('SGQ', 'normas'):
        texto = resumo_normas(user, pergunta)
    elif chave in {('RH', 'movimentacoes'), ('Indicadores', 'movimentacao-rh')}:
        texto = resumo_movimentacoes(user, pergunta)
    else:
        leitor = LEITORES.get(chave)
        texto = leitor(user) if leitor else 'Parte liberada, sem resumo cadastrado.'
        extra = _DETALHE.get(chave)
        if extra:
            detalhe = extra(user, pergunta)
            if detalhe:
                texto = f'{texto}\n{detalhe}'
    limite = _LIMITE_RESUMO
    if detalhar and chave in {('RH', 'movimentacoes'), ('Indicadores', 'movimentacao-rh')}:
        limite = 9000
    elif detalhar and chave in _PARTES_DOCUMENTO:
        limite = 20000 if texto.startswith('LISTA COMPLETA') else 7000
    if len(texto) > limite:
        texto = texto[:limite].rstrip() + '…'
    return texto


def consultar(user, agente, pergunta: str, contexto: str = '') -> dict:
    """`contexto` traz as perguntas anteriores da conversa, para continuações sem palavra-chave."""
    liberadas = {(item['ambiente'], item['parte']) for item in partes_do_usuario(user)}
    efetivos = []
    ignorados = []
    for item in escopos_publicos(agente.escopos):
        chave = (item['ambiente'], item['parte'])
        if chave in liberadas:
            efetivos.append(item)
        else:
            ignorados.append(item)

    leitura = pergunta
    em_foco = _partes_em_foco(pergunta, efetivos)
    if not em_foco and (contexto or '').strip():
        leitura = f'{contexto.strip()} {pergunta}'
        em_foco = _partes_em_foco(leitura, efetivos)
    if not em_foco and len(efetivos) <= _MAXIMO_SEM_SINAL:
        em_foco = list(efetivos)
    foco = {(item['ambiente'], item['parte']) for item in em_foco}
    fontes = []
    for item in efetivos:
        chave = (item['ambiente'], item['parte'])
        if chave in _PARTES_DOCUMENTO and (contexto or '').strip():
            resumo = _ler_parte(user, item, f'{contexto.strip()} {pergunta}', chave in foco)
        else:
            resumo = _ler_parte(user, item, leitura, chave in foco)
        fontes.append({**item, 'resumo': resumo, 'detalhada': (item['ambiente'], item['parte']) in foco})

    if not fontes:
        resposta = f'{agente.nome} não tem partes liberadas no seu acesso atual.'
        material = ''
    else:
        linhas = [f'{agente.nome} consultou {len(fontes)} parte(s) do seu acesso:']
        linhas.extend(f"{fonte['ambiente']} / {fonte['rotulo']}: {fonte['resumo']}" for fonte in fontes)
        resposta = '\n'.join(linhas)
        abertas = [fonte for fonte in fontes if fonte['detalhada']]
        material = '\n'.join(
            f"{fonte['ambiente']} / {fonte['rotulo']}: {fonte['resumo']}"
            for fonte in abertas
        )

    if ignorados:
        nomes = ', '.join(f"{item['ambiente']} / {item['rotulo']}" for item in ignorados)
        resposta += f'\nEstas partes saíram do seu acesso e não foram consultadas: {nomes}.'

    texto = (pergunta or '').lower()
    citados = []
    ambientes_lidos = {fonte['ambiente'] for fonte in fontes}
    for termo, ambiente in MENCOES_AMBIENTE:
        if termo in texto and ambiente not in ambientes_lidos and ambiente not in citados:
            citados.append(ambiente)
    if citados:
        resposta += '\nA pergunta cita ' + ', '.join(citados) + ', e isso não está liberado neste agente.'

    return {'resposta': resposta, 'fontes': fontes, 'material': material}
