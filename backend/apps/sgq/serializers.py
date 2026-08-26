from django.utils import timezone
from rest_framework import serializers

from .clientes_cadastro import cliente_pesquisa_permitido
from .escopo_analise import has_escopo_opcoes, normalize_escopo_analise, slugify_chave
from .models import EscopoAnalise, EscopoAnaliseOpcao, PesquisaSatisfacao

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
    notaFiscal = serializers.CharField(source='nota_fiscal', max_length=500)
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
    escopoAnalise = serializers.JSONField(source='escopo_analise', required=False)
    cliente = serializers.CharField(max_length=200)
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
            'analise', 'escopoAnalise', 'criadoPor',
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

        cliente = attrs.get('cliente')
        if cliente is None and self.instance is not None:
            cliente = self.instance.cliente
        cliente = (cliente or '').strip()
        atual = getattr(self.instance, 'cliente', '') if self.instance is not None else ''
        if not cliente_pesquisa_permitido(
            cliente,
            valor_atual=atual,
            permitir_outros=bool(self.context.get('permitir_outros')),
        ):
            raise serializers.ValidationError({
                'cliente': ['Selecione um cliente cadastrado. OUTROS só é permitido na importação da planilha.'],
            })
        attrs['cliente'] = cliente

        analise = attrs.get('analise')
        if analise is None and self.instance is not None:
            analise = self.instance.analise
        analise = (analise or '').strip()
        attrs['analise'] = analise

        escopo = attrs.get('escopo_analise')
        if escopo is None and self.instance is not None:
            escopo = self.instance.escopo_analise
        escopo = normalize_escopo_analise(escopo)

        if analise and not has_escopo_opcoes(escopo) and self.context.get('exigir_escopo', True):
            raise serializers.ValidationError({
                'escopoAnalise': ['Selecione ao menos uma opção de escopo quando há texto em Análise, Tratativa e Justificativa.'],
            })
        if not analise:
            escopo = {}
        attrs['escopo_analise'] = escopo

        return attrs


class EscopoAnaliseOpcaoSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    escopoId = serializers.IntegerField(source='escopo_id', read_only=True)
    chave = serializers.SlugField(read_only=True)
    label = serializers.CharField(max_length=255)
    ordem = serializers.IntegerField(required=False)
    ativo = serializers.BooleanField(required=False)

    class Meta:
        model = EscopoAnaliseOpcao
        fields = ['id', 'escopoId', 'chave', 'label', 'ordem', 'ativo']

    def create(self, validated_data):
        escopo = self.context['escopo']
        existentes = set(escopo.opcoes.values_list('chave', flat=True))
        validated_data['escopo'] = escopo
        validated_data['chave'] = slugify_chave(validated_data['label'], existentes)
        if 'ordem' not in validated_data:
            max_ordem = escopo.opcoes.order_by('-ordem').values_list('ordem', flat=True).first()
            validated_data['ordem'] = (max_ordem or 0) + 1
        return super().create(validated_data)


class EscopoAnaliseSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    chave = serializers.SlugField(read_only=True)
    label = serializers.CharField(max_length=120)
    ordem = serializers.IntegerField(required=False)
    ativo = serializers.BooleanField(required=False)
    opcoes = serializers.SerializerMethodField()

    class Meta:
        model = EscopoAnalise
        fields = ['id', 'chave', 'label', 'ordem', 'ativo', 'opcoes']

    def get_opcoes(self, obj):
        incluir_inativos = self.context.get('incluir_inativos', False)
        opcoes = list(obj.opcoes.all())
        if not incluir_inativos:
            opcoes = [item for item in opcoes if item.ativo]
        opcoes.sort(key=lambda item: (item.ordem, item.id))
        return EscopoAnaliseOpcaoSerializer(opcoes, many=True).data

    def create(self, validated_data):
        existentes = set(EscopoAnalise.objects.values_list('chave', flat=True))
        validated_data['chave'] = slugify_chave(validated_data['label'], existentes)
        if 'ordem' not in validated_data:
            max_ordem = EscopoAnalise.objects.order_by('-ordem').values_list('ordem', flat=True).first()
            validated_data['ordem'] = (max_ordem or 0) + 1
        return super().create(validated_data)
