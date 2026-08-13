import re
import unicodedata

_AFASTADO_TEMP_TOKEN = 'AFASTADO TEMP'


def _normalizar_situacao_texto(situacao: str | None) -> str:
    if not situacao:
        return ''
    texto = unicodedata.normalize('NFKD', str(situacao))
    texto = ''.join(c for c in texto if not unicodedata.combining(c))
    return re.sub(r'\s+', ' ', texto.upper()).strip()


def classificar_grupo_situacao(situacao: str | None) -> str:
    """Retorna 'ativos', 'afastados' (AFASTADO TEMP.) ou 'ferias'."""
    normalizado = _normalizar_situacao_texto(situacao)
    if _AFASTADO_TEMP_TOKEN in normalizado:
        return 'afastados'
    if normalizado and re.search(r'\bFERIAS?\b', normalizado):
        return 'ferias'
    return 'ativos'


def contar_grupos_situacao(situacoes) -> dict[str, int]:
    contagens = {'ativos': 0, 'afastados': 0, 'ferias': 0}
    for situacao in situacoes:
        contagens[classificar_grupo_situacao(situacao)] += 1
    return contagens


_CATEGORIAS_PESSOAL = (
    ('ADMINISTRATIVO', 'Administrativo'),
    ('OPERACIONAL', 'Operacional'),
    ('MOTORISTA', 'Motorista'),
)


def _bucket_categoria_pessoal() -> dict[str, int]:
    return {'total': 0, 'ativos': 0, 'afastados': 0, 'ferias': 0}


def contar_categorias_com_situacao(registros) -> dict[str, dict[str, int]]:
    """Agrupa colaboradores por categoria com breakdown ativos/afastados/férias."""
    buckets = {chave: _bucket_categoria_pessoal() for chave, _ in _CATEGORIAS_PESSOAL}
    buckets['OUTROS'] = _bucket_categoria_pessoal()
    for categoria, situacao in registros:
        chave = categoria if categoria in buckets else 'OUTROS'
        grupo = classificar_grupo_situacao(situacao)
        buckets[chave]['total'] += 1
        buckets[chave][grupo] += 1
    return buckets


def montar_quadro_categorias_pessoal(registros) -> list[dict]:
    buckets = contar_categorias_com_situacao(registros)
    quadro = [
        {'label': label, **buckets[chave]}
        for chave, label in _CATEGORIAS_PESSOAL
    ]
    if buckets['OUTROS']['total']:
        quadro.append({'label': 'Não mapeado', **buckets['OUTROS']})
    return quadro


def definir_categoria_colaborador(cargo_str):
    """
    Define a categoria (MOTORISTA, ADMINISTRATIVO, OPERACIONAL) com base no cargo/função.
    Utiliza persistência no modelo CargoMapping para permitir ajustes manuais permanentes.
    """
    if not cargo_str:
        return None
    
    from .models import CargoMapping
    
    cargo_clean = str(cargo_str).strip().upper()
    
    # 1. Tentar buscar no mapeamento persistente
    mapping, created = CargoMapping.objects.get_or_create(cargo=cargo_clean)
    
    # Se já existir uma categoria definida no mapeamento, retornamos ela imediatamente
    if mapping.categoria:
        return mapping.categoria
    
    # 2. Se for novo ou não tiver categoria, rodar a lógica automática de "chute"
    guess = None
    
    # MOTORISTA
    if any(k in cargo_clean for k in ['MOTORISTA', 'CONDUTOR', 'CARRETEIRO']):
        guess = 'MOTORISTA'
    
    # ADMINISTRATIVO
    elif any(k in cargo_clean for k in [
        'ADMINISTRATIVO', 'AUXILIAR', 'ASSISTENTE', 'ANALISTA', 'GERENTE', 
        'COORDENADOR', 'SUPERVISOR', 'DIRETOR', 'RECEPCIONISTA', 'FATURAMENTO',
        'RH', 'RECURSOS HUMANOS', 'COMPRAS', 'TI', 'TECNICO', 'SUPORTE',
        'FINANCEIRO', 'CONTABIL', 'FISCAL', 'ESCRITORIO', 'SECRETARIA',
        'PLANEJAMENTO', 'LOGISTICA'
    ]):
        # Exceção: Auxiliar de Operações ou Auxiliar de Carga pode ser Operacional
        if any(k in cargo_clean for k in ['OPERACAO', 'OPERACIONAL', 'CARGA', 'DESCARGA', 'CONFERENTE']):
            guess = 'OPERACIONAL'
        else:
            guess = 'ADMINISTRATIVO'
    
    # OPERACIONAL
    elif any(k in cargo_clean for k in [
        'OPERADOR', 'AJUDANTE', 'CONFERENTE', 'CARGA', 'DESCARGA', 'ALMOXARIFE',
        'MECANICO', 'LIMPEZA', 'PATRIMONIO', 'VIGILANTE', 'ZELADOR', 'MANUTENCAO',
        'ELETRICISTA', 'BORRACHEIRO', 'LAVADOR', 'SERVICOS GERAIS'
    ]):
        guess = 'OPERACIONAL'
        
    # Se conseguimos um "palpite", salvamos no mapeamento para revisão do usuário
    if guess:
        mapping.categoria = guess
        mapping.save()
        
    return guess
