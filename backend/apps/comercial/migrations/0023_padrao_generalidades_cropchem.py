from django.db import migrations


TRANSFERENCIA = [
    {'rotulo': 'Capacidade dos veículos - Carreta', 'valor': 'Carreta Graneleira (Até 33ton) 26 Pallets'},
    {'rotulo': 'Limite por Embarque', 'valor': 'R$ 2.000.000,00'},
    {'rotulo': 'Custo da Escolta', 'valor': 'Não incluso. Se necessário, mediante negociação.'},
    {'rotulo': 'Cubagem', 'valor': '1.000 kg por palete ou 300 kg por m³'},
    {'rotulo': 'ICMS / ISS', 'valor': 'Não incluso nos valores acima, cobrado conforme legislação vigente'},
    {'rotulo': 'Ad valorem / Griss', 'valor': 'Cobrado sobre o valor das notas fiscais de acordo com percentual descrito na tabela'},
    {'rotulo': 'Pedágios', 'valor': 'Conforme Legislação'},
    {'rotulo': 'Serviços de Ajudantes', 'valor': 'Não incluso. Se necessário, mediante negociação'},
    {'rotulo': 'Devolução', 'valor': 'Mediante a Negociação'},
    {'rotulo': 'Reentrega', 'valor': 'Mediante a Negociação'},
    {'rotulo': 'Carga e Descarga', 'valor': 'Não incluso (em caso de cobrança será repassado comprovante e cobrado o reembolso)'},
    {'rotulo': 'Prazo de entrega', 'valor': 'Em dias úteis, contados à partir do dia seguinte ao carregamento'},
    {'rotulo': 'Diária', 'valor': 'Conforme legislação ANTT'},
    {'rotulo': 'Franquia de Carga e Descarga', 'valor': '5 horas, acima deste período segue conforme legislação ANTT'},
    {'rotulo': 'Faturamento', 'valor': 'Semanal'},
    {'rotulo': 'Prazo de Pagamento', 'valor': '30 DDL'},
    {'rotulo': 'Validade da Proposta', 'valor': '30 dias'},
    {'rotulo': 'Vigência', 'valor': '12 meses'},
    {'rotulo': 'Reajuste', 'valor': 'Anual com base no índice INCT'},
]

DISTRIBUICAO = [
    {'rotulo': 'Limite de embarque', 'valor': 'R$ 2.000.000,00'},
    {'rotulo': 'Capacidades dos veículos', 'valor': 'Truck (14 ton) 14 pallets — Carreta graneleira / sider (até 32 ton) 24, 26, 28 pallets'},
    {'rotulo': 'Carga e descarga', 'valor': 'Tarifas livres de cargas e descargas'},
    {'rotulo': 'Franquia de carga e descarga', 'valor': '5 horas, acima deste período segue conforme legislação ANTT'},
    {'rotulo': 'Pedágios', 'valor': 'Conforme tabela acima'},
    {'rotulo': 'Diárias', 'valor': 'Conforme legislação ANTT'},
    {'rotulo': 'Balsa', 'valor': 'Não incluído nas tarifas'},
    {'rotulo': 'Escolta', 'valor': 'Não incluído nas tarifas'},
    {'rotulo': 'Prazo de coleta', 'valor': '48 horas após a data do recebimento da NF-e (D+2)'},
    {'rotulo': 'Prazo de entrega', 'valor': 'Em dias úteis, contados a partir do dia seguinte ao carregamento conforme tabela'},
    {'rotulo': 'Devolução e/ou reentrega', 'valor': 'Conforme negociação no ato da ocorrência'},
    {'rotulo': 'ICMS/ISS', 'valor': 'Não incluso nos valores acima, cobrado conforme legislação vigente'},
    {'rotulo': '+ de 1 NF mesmo CNPJ', 'valor': 'Emitimos no mesmo dia 1 único CT-e; datas diferentes, mais de 1 CT-e'},
    {'rotulo': 'Faturamento', 'valor': 'Semanal'},
    {'rotulo': 'Prazo de pagamento', 'valor': '30 DDL'},
    {'rotulo': 'Vigência', 'valor': '12 meses'},
]


def substituir_padroes(apps, schema_editor):
    Generalidade = apps.get_model('comercial', 'GeneralidadeComercial')
    catalogos = {
        'frete': TRANSFERENCIA,
        'distribuicao': DISTRIBUICAO,
    }
    for tipo, itens in catalogos.items():
        Generalidade.objects.filter(cliente__isnull=True, tipo_servico=tipo).delete()
        Generalidade.objects.bulk_create([
            Generalidade(
                cliente=None,
                tipo_servico=tipo,
                ordem=index,
                rotulo=item['rotulo'],
                valor=item['valor'],
            )
            for index, item in enumerate(itens)
        ])


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0022_cliente_responsavel'),
    ]

    operations = [
        migrations.RunPython(substituir_padroes, migrations.RunPython.noop),
    ]
