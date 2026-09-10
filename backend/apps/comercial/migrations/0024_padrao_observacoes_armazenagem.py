from django.db import migrations


ARMAZENAGEM = [
    {
        'rotulo': 'Faturamento mínimo (1)',
        'valor': 'R$ 17.650,00 — considerando 50% da capacidade máxima acordada.',
    },
    {
        'rotulo': 'Valor por posição pallet (2)',
        'valor': 'R$ 35,30 — cobrado pela quantidade de posições palete no pico da ocupação mensal até o limite de 1.000 posições.',
    },
    {
        'rotulo': 'Movimentação R$/ton (3)',
        'valor': 'R$ 13,87 por tonelada movimentada na entrada e/ou saída. Capacidade diária: 100 t na entrada e 150 t na saída.',
    },
    {
        'rotulo': 'Seguro (4)',
        'valor': '0,02% sobre o valor da mercadoria armazenada no pico da ocupação mensal (propriedade do cliente).',
    },
    {
        'rotulo': 'Seguro AG (5)',
        'valor': '0,10% sobre o valor da mercadoria armazenada no pico da ocupação mensal (em regime de AG).',
    },
    {
        'rotulo': 'Colaborador dedicado (6)',
        'valor': 'R$ 1.500,00 — cobrado apenas quando a quantidade de clientes AG for superior a 20.',
    },
    {
        'rotulo': 'Capacidade máxima acordada',
        'valor': '1.000 posições palete.',
    },
    {
        'rotulo': 'Hora-extra — segunda a sábado (7)',
        'valor': 'R$ 20,81/ton movimentada em horários extraordinários.',
    },
    {
        'rotulo': 'Hora-extra — domingos e feriados (7)',
        'valor': 'R$ 27,74/ton movimentada em horários extraordinários.',
    },
    {
        'rotulo': 'Expediente do CD',
        'valor': 'Segunda a sexta, das 08:00 às 17:00h.',
    },
    {
        'rotulo': 'Utilização acima da capacidade',
        'valor': 'Sob disponibilidade.',
    },
    {
        'rotulo': 'Carga e descarga',
        'valor': 'Cobrados dos transportadores contratados pelo cliente: R$ 25,00/ton + ISS.',
    },
    {
        'rotulo': 'Reetiquetagem e kits',
        'valor': 'Não contempla custos para reetiquetagem e montagem de kits.',
    },
    {
        'rotulo': 'Notas fiscais para separação',
        'valor': 'Consideradas as emitidas até as 15 horas do dia da separação.',
    },
    {
        'rotulo': 'Taxa de inventário',
        'valor': 'Tratada conforme necessidade.',
    },
    {
        'rotulo': 'Faturamento',
        'valor': 'Mensal, com prazo de pagamento de 120 DDL.',
    },
    {
        'rotulo': 'ISS',
        'valor': 'Por conta da contratante.',
    },
    {
        'rotulo': 'Reajuste',
        'valor': 'Anual, mediante nova negociação entre as partes.',
    },
]


def substituir_padrao_armazenagem(apps, schema_editor):
    Generalidade = apps.get_model('comercial', 'GeneralidadeComercial')
    Generalidade.objects.filter(cliente__isnull=True, tipo_servico='armazenagem').delete()
    Generalidade.objects.bulk_create([
        Generalidade(
            cliente=None,
            tipo_servico='armazenagem',
            ordem=index,
            rotulo=item['rotulo'],
            valor=item['valor'],
        )
        for index, item in enumerate(ARMAZENAGEM)
    ])


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0023_padrao_generalidades_cropchem'),
    ]

    operations = [
        migrations.RunPython(substituir_padrao_armazenagem, migrations.RunPython.noop),
    ]
