from django.db import migrations


ARMAZENAGEM = [
    {'rotulo': '(1)', 'valor': 'Faturamento mínimo considerando 50% da capacidade máxima acordada.'},
    {'rotulo': '(2)', 'valor': 'Cobrado pela quantidade das posições palete no pico da ocupação mensal até o limite de 1.000 posições pallets.'},
    {'rotulo': '(3)', 'valor': 'Cobrada por tonelada movimentada. Cobrado na entrada e/ou saída dos produtos no armazém. (Capacidade diária de 100 toneladas na entrada e 150 toneladas na saída).'},
    {'rotulo': '(4)', 'valor': 'Cobrado sobre o valor da mercadoria armazenada no pico da ocupação mensal. (Propriedade Albaugh)'},
    {'rotulo': '(5)', 'valor': 'Cobrado sobre o valor da mercadoria armazenada no pico da ocupação mensal. (Em regime de AG)'},
    {'rotulo': '(6)', 'valor': 'Custo para um colaborador dedicado a ser cobrado apenas quando a quantidade de clientes AG for superior a 20.'},
    {'rotulo': '(7)', 'valor': 'Custo por tonelada movimentada em horários extraordinários.'},
    {'rotulo': 'a)', 'valor': 'A utilização acima da capacidade máxima acordada será sob disponibilidade.'},
    {'rotulo': 'b)', 'valor': 'Os custos de carga e descarga serão cobrados dos transportadores contratados pelo cliente: R$ 25,00/ton + ISS.'},
    {'rotulo': 'c)', 'valor': 'Essa proposta não contempla custos para reetiquetagem e montagem de kits.'},
    {'rotulo': 'd)', 'valor': 'As notas fiscais consideradas para separação num determinado dia serão as emitidas até as 15 horas deste dia.'},
    {'rotulo': 'e)', 'valor': 'Taxa de inventário será tratada conforme necessidade.'},
    {'rotulo': 'f)', 'valor': 'Faturamento mensal, com prazo de pagamento de 120 DDL.'},
    {'rotulo': 'g)', 'valor': 'ISS por conta da contratante.'},
    {'rotulo': 'h)', 'valor': 'O reajuste nas tarifas é aplicado anualmente através de nova negociação entre as partes.'},
]


def substituir_observacoes(apps, schema_editor):
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
        ('comercial', '0024_padrao_observacoes_armazenagem'),
    ]

    operations = [
        migrations.RunPython(substituir_observacoes, migrations.RunPython.noop),
    ]
