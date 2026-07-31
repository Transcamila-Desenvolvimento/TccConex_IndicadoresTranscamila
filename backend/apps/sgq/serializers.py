from django.utils import timezone
from rest_framework import serializers

from .models import PesquisaSatisfacao

# Nome do campo no model (source) → nome do campo camelCase no serializer.
# Usado em validate() para reportar erros com a chave que o frontend espera
# (SgqPesquisaBulkFieldErrors é indexado pelas chaves camelCase do payload).
_CRITERIO_SOURCE_TO_FIELD = {
    'prazo_entrega': 'prazoEntrega',
    'condicoes_mercadoria': 'condicoesMercadoria',
    'condicoes_veiculo': 'condicoesVeiculo',
    'apresentacao_motorista': 'apresentacaoMotorista',
    'atendimento_dispensado': 'atendimentoDispensado',
}


class PesquisaSatisfacaoSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    notaFiscal = serializers.CharField(source='nota_fiscal', max_length=50)
    clienteRecusouAssinar = serializers.BooleanField(source='cliente_recusou_assinar', required=False, default=False)
    prazoEntrega = serializers.ChoiceField(
        source='prazo_entrega', choices=PesquisaSatisfacao._meta.get_field('prazo_entrega').choices,
        required=False, allow_blank=True,
    )
    condicoesMercadoria = serializers.ChoiceField(
        source='condicoes_mercadoria', choices=PesquisaSatisfacao._meta.get_field('condicoes_mercadoria').choices,
        required=False, allow_blank=True,
    )
    condicoesVeiculo = serializers.ChoiceField(
        source='condicoes_veiculo', choices=PesquisaSatisfacao._meta.get_field('condicoes_veiculo').choices,
        required=False, allow_blank=True,
    )
    apresentacaoMotorista = serializers.ChoiceField(
        source='apresentacao_motorista', choices=PesquisaSatisfacao._meta.get_field('apresentacao_motorista').choices,
        required=False, allow_blank=True,
    )
    atendimentoDispensado = serializers.ChoiceField(
        source='atendimento_dispensado', choices=PesquisaSatisfacao._meta.get_field('atendimento_dispensado').choices,
        required=False, allow_blank=True,
    )
    analise = serializers.CharField(required=False, allow_blank=True)
    criadoPor = serializers.CharField(source='criado_por', read_only=True)
    dataInclusao = serializers.DateField(source='data_inclusao', format='%Y-%m-%d', read_only=True)
    dataEntrega = serializers.DateField(source='data_entrega', format='%Y-%m-%d')
    filial = serializers.CharField(read_only=True)

    class Meta:
        model = PesquisaSatisfacao
        fields = [
            'id', 'filial', 'motorista', 'cte', 'dataInclusao', 'dataEntrega', 'notaFiscal', 'cliente',
            'clienteRecusouAssinar',
            'prazoEntrega', 'condicoesMercadoria', 'condicoesVeiculo',
            'apresentacaoMotorista', 'atendimentoDispensado',
            'analise', 'criadoPor',
        ]

    def create(self, validated_data):
        validated_data.setdefault('data_inclusao', timezone.localdate())
        return super().create(validated_data)

    def validate(self, attrs):
        recusou = attrs.get('cliente_recusou_assinar')
        if recusou is None:
            recusou = getattr(self.instance, 'cliente_recusou_assinar', False)

        if not recusou:
            errors = {}
            for source, field_name in _CRITERIO_SOURCE_TO_FIELD.items():
                value = attrs.get(source)
                if value is None and self.instance is not None:
                    value = getattr(self.instance, source)
                if not value:
                    errors[field_name] = ['Obrigatório quando o cliente não recusou a assinatura.']
            if errors:
                raise serializers.ValidationError(errors)

        return attrs
