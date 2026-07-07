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
