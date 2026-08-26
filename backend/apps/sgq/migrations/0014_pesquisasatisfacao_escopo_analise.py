from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0013_pesquisasatisfacaoformdraft'),
    ]

    operations = [
        migrations.AddField(
            model_name='pesquisasatisfacao',
            name='escopo_analise',
            field=models.CharField(
                blank=True,
                choices=[
                    ('prazo_entrega', 'Prazo de Entrega'),
                    ('condicoes_mercadoria', 'Condições da Mercadoria'),
                    ('condicoes_veiculo', 'Condições do Veículo'),
                    ('apresentacao_motorista', 'Apresentação do Motorista'),
                    ('atendimento_dispensado', 'Atendimento Dispensado'),
                ],
                default='',
                max_length=40,
                verbose_name='Escopo da análise',
            ),
        ),
    ]
