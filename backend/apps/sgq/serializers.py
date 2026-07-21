from rest_framework import serializers

from .models import PesquisaSatisfacao


class PesquisaSatisfacaoSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    notaFiscal = serializers.CharField(source='nota_fiscal', max_length=50)
    prazoEntrega = serializers.ChoiceField(source='prazo_entrega', choices=PesquisaSatisfacao._meta.get_field('prazo_entrega').choices)
    condicoesMercadoria = serializers.ChoiceField(source='condicoes_mercadoria', choices=PesquisaSatisfacao._meta.get_field('condicoes_mercadoria').choices)
    condicoesVeiculo = serializers.ChoiceField(source='condicoes_veiculo', choices=PesquisaSatisfacao._meta.get_field('condicoes_veiculo').choices)
    apresentacaoMotorista = serializers.ChoiceField(source='apresentacao_motorista', choices=PesquisaSatisfacao._meta.get_field('apresentacao_motorista').choices)
    atendimentoDispensado = serializers.ChoiceField(source='atendimento_dispensado', choices=PesquisaSatisfacao._meta.get_field('atendimento_dispensado').choices)
    tratativaJustificativa = serializers.CharField(source='tratativa_justificativa', required=False, allow_blank=True)
    analise = serializers.CharField(required=False, allow_blank=True)
    criadoPor = serializers.CharField(source='criado_por', read_only=True)
    data = serializers.DateField(format='%Y-%m-%d')

    class Meta:
        model = PesquisaSatisfacao
        fields = [
            'id', 'motorista', 'cte', 'data', 'notaFiscal', 'cliente',
            'prazoEntrega', 'condicoesMercadoria', 'condicoesVeiculo',
            'apresentacaoMotorista', 'atendimentoDispensado',
            'analise', 'tratativaJustificativa', 'criadoPor',
        ]
