MAX_NOTAS_FISCAIS = 78

EXPEDICAO_CHOICES = [
    ('Transcamila Ibiporã', 'Transcamila Ibiporã'),
    ('Transcamila Barueri', 'Transcamila Barueri'),
    ('Transcamila Paranaguá', 'Transcamila Paranaguá'),
    ('Transcamila Rondonópolis', 'Transcamila Rondonópolis'),
]

EXPEDICAO_VALUES = frozenset(value for value, _ in EXPEDICAO_CHOICES)

# Um protocolo pode combinar até 2 expedições (ex.: "Transcamila Barueri/Ibiporã").
MAX_EXPEDICOES_POR_PROTOCOLO = 2
EXPEDICAO_PREFIXO_COMUM = 'Transcamila '
