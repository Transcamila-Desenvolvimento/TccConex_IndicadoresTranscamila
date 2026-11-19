"""Resultado da auditoria a partir das metas cadastradas em cada norma.

A conformidade de uma classificação é a média do valor das respostas aplicáveis
(Não aplicável fica de fora). A norma é aprovada num ciclo quando toda
classificação com pergunta atinge a meta daquele ciclo.
"""


def _percentual(soma: int, aplicaveis: int) -> int | None:
    if not aplicaveis:
        return None
    return int((soma / aplicaveis) + 0.5)


def _situacao(classes: list[dict], ciclo: str) -> str:
    if any(classe['incompleta'] for classe in classes):
        return 'incompleta'
    campo = 'atingePrimeira' if ciclo == 'primeira' else 'atingeReavaliacao'
    if any(not classe[campo] for classe in classes):
        return 'reprovada'
    return 'aprovada'


def calcular_resultado(normas, itens, respostas) -> dict:
    por_item = {resposta.item_id: resposta for resposta in respostas}
    por_norma: dict[int, list] = {}
    for item in itens:
        if item.tipo != 'pergunta':
            continue
        por_norma.setdefault(item.norma_id, []).append(item)

    normas_saida = []
    for norma in normas:
        classes = []
        for definicao in norma.classificacoes or []:
            sigla = str(definicao.get('sigla') or '').strip()
            if not sigla:
                continue
            grupo = [
                item for item in por_norma.get(norma.pk, [])
                if (item.classificacao or '').strip() == sigla
            ]
            if not grupo:
                continue
            respondidas = 0
            aplicaveis = 0
            soma = 0
            for item in grupo:
                resposta = por_item.get(item.pk)
                if resposta is None or not (resposta.opcao_codigo or '').strip():
                    continue
                respondidas += 1
                if resposta.valor is None:
                    continue
                aplicaveis += 1
                soma += resposta.valor
            conformidade = _percentual(soma, aplicaveis)
            meta_primeira = int(definicao.get('metaPrimeira') or 0)
            meta_reavaliacao = int(definicao.get('metaReavaliacao') or 0)
            incompleta = respondidas < len(grupo)
            classes.append({
                'sigla': sigla,
                'nome': str(definicao.get('nome') or sigla),
                'conformidade': conformidade,
                'perguntas': len(grupo),
                'respondidas': respondidas,
                'metaPrimeira': meta_primeira,
                'metaReavaliacao': meta_reavaliacao,
                'incompleta': incompleta,
                'atingePrimeira': (not incompleta) and (conformidade is None or conformidade >= meta_primeira),
                'atingeReavaliacao': (not incompleta) and (conformidade is None or conformidade >= meta_reavaliacao),
            })
        normas_saida.append({
            'id': str(norma.pk),
            'nome': norma.nome,
            'primeira': _situacao(classes, 'primeira') if classes else 'incompleta',
            'reavaliacao': _situacao(classes, 'reavaliacao') if classes else 'incompleta',
            'classes': [
                {chave: valor for chave, valor in classe.items() if chave != 'incompleta'}
                for classe in classes
            ],
        })

    def geral(ciclo: str) -> str:
        if not normas_saida:
            return 'incompleta'
        valores = [norma[ciclo] for norma in normas_saida]
        if 'incompleta' in valores:
            return 'incompleta'
        if 'reprovada' in valores:
            return 'reprovada'
        return 'aprovada'

    return {
        'primeira': geral('primeira'),
        'reavaliacao': geral('reavaliacao'),
        'normas': normas_saida,
    }
