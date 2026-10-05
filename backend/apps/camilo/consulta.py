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
    ('indicadores', 'Indicadores'),
    ('marketing', 'Marketing'),
    ('frota', 'Frota'),
    ('rh', 'RH'),
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


def _trecho(texto: str, termos: list[str], limite: int = 1100) -> str:
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
        if len(chave) < 4 or chave in pedidos:
            continue
        pedidos.append(chave)
        for extra in _APOIO_TERMO.get(chave, ()):
            if extra not in pedidos and extra not in apoio:
                apoio.append(extra)
    alvos = [(termo, 3) for termo in pedidos] + [(termo, 1) for termo in apoio]
    pede_valor = any(termo in _TERMOS_VALOR for termo in pedidos)

    melhor = None
    for termo, _peso in alvos:
        cursor = 0
        vistos = 0
        while vistos < 12:
            posicao = dobrado.find(termo, cursor)
            if posicao < 0:
                break
            vistos += 1
            inicio = max(0, posicao - 180)
            fim = min(len(dobrado), inicio + limite)
            janela = dobrado[inicio:fim]
            nota = sum(peso for candidato, peso in alvos if candidato in janela)
            if pede_valor and re.search(r'r\$\s*\d', janela):
                nota += 8
                if any(candidato in janela for candidato in pedidos if candidato not in _TERMOS_VALOR):
                    nota += 6
            if melhor is None or nota > melhor[0]:
                melhor = (nota, inicio, fim)
            cursor = posicao + max(len(termo), 1)

    if melhor is None:
        fatia = texto[:limite]
    else:
        inicio, fim = melhor[1], melhor[2]
        fatia = texto[mapa[inicio]:mapa[fim - 1] + 1]
    if len(texto) > len(fatia):
        fatia = fatia.rstrip() + '…'
    return fatia


def resumo_documentos(user, pergunta: str = '') -> str:
    from apps.rh.documento_texto import garantir_texto
    from apps.rh.models import DocumentoRH

    documentos = list(
        DocumentoRH.objects
        .only('id', 'titulo', 'texto', 'texto_extraido', 'nome_original', 'tamanho', 'arquivo')
        .order_by('-criado_em')[:40]
    )
    if not documentos:
        return 'Nenhum documento cadastrado na aba Documentos.'

    termos = _termos_pergunta(pergunta)
    if termos:
        def pontos(documento):
            base = f'{documento.titulo} {documento.texto}'.lower()
            return sum(base.count(termo) for termo in termos)
        ordenados = sorted(documentos, key=pontos, reverse=True)
        escolhidos = [documento for documento in ordenados if pontos(documento) > 0][:2]
        if not escolhidos:
            for documento in [item for item in documentos if not item.texto_extraido][:2]:
                garantir_texto(documento)
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
        if documento.texto:
            linhas.append(f'{documento.titulo}: {_trecho(documento.texto, termos)}')
        else:
            linhas.append(f'{documento.titulo}: o arquivo não tem texto legível para leitura.')
    return 'Trechos lidos dos documentos:\n' + '\n'.join(linhas)


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
    lote_lista = alvo
    if lote_lista is None and tipos and not (mes and ano):
        lote_lista = next(
            (lote for lote in lotes if por_lote[lote.id][1].get(tipos[0], 0)),
            None,
        )
    if lote_lista is not None:
        cpfs, totais = por_lote[lote_lista.id]
        pedidos = tipos or ['salario', 'cargo', 'outros']
        escolhidos = [tipo for tipo in pedidos if totais.get(tipo, 0)]
        if not escolhidos:
            linhas.append(f'Em {lote_lista.mes:02d}/{lote_lista.ano} não há alteração do tipo pedido.')
        else:
            itens = list(
                lote_lista.inconsistencias.filter(cpf__in=cpfs, tipo__in=escolhidos).order_by('tipo', 'nome')
            )
            linhas.append(f'Alterações em {lote_lista.mes:02d}/{lote_lista.ano}:')
            for item in itens[:20]:
                anterior = item.valor_anterior or '—'
                atual = item.valor_atual or '—'
                motivo = (item.justificativa or '').strip()
                extra = f' Motivo: {motivo[:120]}' if motivo else ''
                linhas.append(
                    f'- {item.nome}: {item.get_tipo_display()} de {anterior} para {atual}.{extra}'
                )
            if len(itens) > 20:
                linhas.append(f'E mais {len(itens) - 20} alteração(ões) nesse mês.')
    elif not (mes and ano):
        linhas.append('Nenhum mês foi citado na pergunta. Os números acima separam salário e cargo por período.')

    return '\n'.join(linhas)


def resumo_pesquisas(user) -> str:
    from apps.sgq.models import PesquisaSatisfacao
    total = _filtra_filial(PesquisaSatisfacao.objects.all(), user, 'SGQ', 'filial').count()
    return _texto(total, 'pesquisa de satisfação', 'pesquisas de satisfação')


def resumo_campanhas(user) -> str:
    from apps.marketing.models import CampanhaMarketing
    return _texto(CampanhaMarketing.objects.count(), 'campanha', 'campanhas')


def resumo_metas(user) -> str:
    from apps.indicadores.models import MetaFaturamentoMensal
    return _texto(MetaFaturamentoMensal.objects.count(), 'meta de faturamento cadastrada', 'metas de faturamento cadastradas')


def resumo_veiculos(user) -> str:
    from apps.frota.models import VeiculoFrota
    total = _filtra_filial(VeiculoFrota.objects.all(), user, 'Frota', 'filial').count()
    return _texto(total, 'veículo da frota', 'veículos da frota')


def resumo_condutores(user) -> str:
    from apps.frota.models import CondutorFrota
    total = _filtra_filial(CondutorFrota.objects.all(), user, 'Frota', 'filial').count()
    return _texto(total, 'condutor', 'condutores')


def resumo_custos_frota(user) -> str:
    from apps.frota.models import CustoFrotaLote
    return _texto(CustoFrotaLote.objects.count(), 'lote de custos da frota', 'lotes de custos da frota')


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


def resumo_frota_indicador(user) -> str:
    return resumo_custos_frota(user)


LEITORES = {
    ('Financeiro', 'calendario'): resumo_calendario,
    ('Financeiro', 'inclusao-relatorios'): resumo_relatorios,
    ('Financeiro', 'saldos-bancarios'): resumo_saldos,
    ('Financeiro', 'ajustes-caixa'): resumo_ajustes,
    ('Financeiro', 'faturamento'): resumo_faturamento_fin,
    ('Faturamento', 'envio-nf-cliente'): resumo_protocolos,
    ('Faturamento', 'cadastro-clientes'): resumo_clientes_protocolo,
    ('Compras', 'controle-estoque'): resumo_estoque,
    ('RH', 'movimentacoes'): resumo_movimentacoes,
    ('RH', 'documentos'): resumo_documentos,
    ('SGQ', 'pesquisa-satisfacao'): resumo_pesquisas,
    ('Marketing', 'campanhas'): resumo_campanhas,
    ('Logística', 'configuracoes'): resumo_metas,
    ('Frota', 'custos-frota'): resumo_custos_frota,
    ('Frota', 'cadastro-condutores'): resumo_condutores,
    ('Frota', 'cadastro-veiculos'): resumo_veiculos,
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
    ('Indicadores', 'custos-frota'): resumo_frota_indicador,
}


_SINAIS = {
    ('Financeiro', 'calendario'): ('calendario', 'agenda', 'evento', 'compromisso'),
    ('Financeiro', 'inclusao-relatorios'): ('pagar', 'receber', 'titulo', 'fornecedor', 'inadimplencia'),
    ('Financeiro', 'saldos-bancarios'): ('saldo', 'banco', 'conta bancaria'),
    ('Financeiro', 'ajustes-caixa'): ('ajuste', 'caixa'),
    ('Financeiro', 'faturamento'): ('faturamento',),
    ('Faturamento', 'envio-nf-cliente'): ('protocolo', 'canhoto', 'nota fiscal'),
    ('Faturamento', 'cadastro-clientes'): ('protocolo',),
    ('Compras', 'controle-estoque'): ('estoque', 'quantidade minima'),
    ('RH', 'movimentacoes'): ('salario', 'cargo', 'colaborador', 'funcionario', 'movimentacao', 'admissao'),
    ('RH', 'documentos'): ('documento', 'convencao', 'piso', 'diaria', 'sindical', 'acordo'),
    ('SGQ', 'pesquisa-satisfacao'): ('pesquisa', 'satisfacao'),
    ('Marketing', 'campanhas'): ('campanha', 'marketing'),
    ('Logística', 'configuracoes'): ('logistica',),
    ('Frota', 'custos-frota'): ('abastecimento', 'manutencao', 'custo da frota'),
    ('Frota', 'cadastro-condutores'): ('condutor', 'motorista'),
    ('Frota', 'cadastro-veiculos'): ('placa', 'veiculo da frota'),
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
    ('Indicadores', 'custos-frota'): ('custo de frota',),
}

_LIMITE_RESUMO = 2800


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


def _contagem_documentos(user) -> str:
    from apps.rh.models import DocumentoRH
    return _texto(DocumentoRH.objects.count(), 'documento na aba Documentos', 'documentos na aba Documentos')


def _contagem_movimentacoes(user) -> str:
    from apps.rh.models import MovimentacaoColaborador
    total = _filtra_filial(MovimentacaoColaborador.objects.all(), user, 'RH', 'filial').count()
    return _texto(total, 'registro de movimentação', 'registros de movimentação')


def _linhas_casadas(qs, campos: tuple[str, ...], pergunta: str, formatar, limite: int = 4) -> str:
    from django.db.models import Q
    termos = [termo for termo in _termos_pergunta(pergunta) if len(termo) >= 4][:3]
    if termos and campos:
        filtro = Q()
        for termo in termos:
            for campo in campos:
                filtro |= Q(**{f'{campo}__icontains': termo})
        achados = list(qs.filter(filtro)[:limite])
        if not achados:
            return 'Nenhum registro dessa função com os termos da pergunta.'
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


def _detalhe_veiculos(user, pergunta: str) -> str:
    from apps.frota.models import VeiculoFrota
    qs = _filtra_filial(VeiculoFrota.objects.all(), user, 'Frota', 'filial').order_by('placa')

    def linha(item):
        return f'{item.placa} {item.marca} {item.modelo}, filial {item.filial}'

    return _linhas_casadas(qs, ('placa', 'modelo', 'marca'), pergunta, linha)


def _detalhe_condutores(user, pergunta: str) -> str:
    from apps.frota.models import CondutorFrota
    qs = _filtra_filial(CondutorFrota.objects.all(), user, 'Frota', 'filial').order_by('nome')
    return _linhas_casadas(qs, ('nome',), pergunta, lambda item: item.nome)


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
    ('Compras', 'controle-estoque'): _detalhe_estoque,
    ('SGQ', 'pesquisa-satisfacao'): _detalhe_pesquisas,
    ('Marketing', 'campanhas'): _detalhe_campanhas,
    ('Logística', 'configuracoes'): _detalhe_metas,
    ('Frota', 'cadastro-veiculos'): _detalhe_veiculos,
    ('Frota', 'cadastro-condutores'): _detalhe_condutores,
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
        if chave in {('RH', 'movimentacoes'), ('Indicadores', 'movimentacao-rh')}:
            return _contagem_movimentacoes(user)
        leitor = LEITORES.get(chave)
        return leitor(user) if leitor else 'Parte liberada, sem resumo cadastrado.'

    if chave == ('RH', 'documentos'):
        texto = resumo_documentos(user, pergunta)
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
    if len(texto) > _LIMITE_RESUMO:
        texto = texto[:_LIMITE_RESUMO].rstrip() + '…'
    return texto


def consultar(user, agente, pergunta: str) -> dict:
    liberadas = {(item['ambiente'], item['parte']) for item in partes_do_usuario(user)}
    efetivos = []
    ignorados = []
    for item in escopos_publicos(agente.escopos):
        chave = (item['ambiente'], item['parte'])
        if chave in liberadas:
            efetivos.append(item)
        else:
            ignorados.append(item)

    foco = {(item['ambiente'], item['parte']) for item in _partes_em_foco(pergunta, efetivos)}
    fontes = []
    for item in efetivos:
        resumo = _ler_parte(user, item, pergunta, (item['ambiente'], item['parte']) in foco)
        fontes.append({**item, 'resumo': resumo, 'detalhada': (item['ambiente'], item['parte']) in foco})

    if not fontes:
        resposta = f'{agente.nome} não tem partes liberadas no seu acesso atual.'
        material = ''
    else:
        linhas = [f'{agente.nome} consultou {len(fontes)} parte(s) do seu acesso:']
        linhas.extend(f"{fonte['ambiente']} / {fonte['rotulo']}: {fonte['resumo']}" for fonte in fontes)
        resposta = '\n'.join(linhas)
        abertas = [fonte for fonte in fontes if fonte['detalhada']]
        fechadas = [fonte for fonte in fontes if not fonte['detalhada']]
        blocos = [
            f"{fonte['ambiente']} / {fonte['rotulo']}: {fonte['resumo']}"
            for fonte in abertas
        ]
        if fechadas:
            nomes = ', '.join(f"{fonte['ambiente']} / {fonte['rotulo']}" for fonte in fechadas)
            blocos.append(f'Também liberado, sem detalhe nesta pergunta: {nomes}.')
        material = '\n'.join(blocos)

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
