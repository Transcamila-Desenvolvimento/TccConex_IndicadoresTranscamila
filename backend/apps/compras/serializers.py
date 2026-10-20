from rest_framework import serializers

from .models import (
    UnidadeMedida,
    Setor,
    Colaborador,
    Fornecedor,
    ItemEstoque,
    EntradaEstoque,
    SaidaEstoque,
)


class UnidadeMedidaSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)

    class Meta:
        model = UnidadeMedida
        fields = ['id', 'nome']


class SetorSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    colaboradoresCount = serializers.IntegerField(source='colaboradores_count', read_only=True)

    class Meta:
        model = Setor
        fields = ['id', 'nome', 'colaboradoresCount']


class ColaboradorSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    setorId = serializers.PrimaryKeyRelatedField(source='setor', queryset=Setor.objects.all())
    setorNome = serializers.CharField(source='setor.nome', read_only=True)
    cpf = serializers.CharField(required=False, allow_blank=True, max_length=14)

    class Meta:
        model = Colaborador
        fields = ['id', 'nome', 'cargo', 'cpf', 'setorId', 'setorNome']

    def validate_cargo(self, value):
        return (value or '').strip()

    def validate_cpf(self, value):
        digits = ''.join(ch for ch in (value or '') if ch.isdigit())
        if digits and len(digits) != 11:
            raise serializers.ValidationError('CPF deve conter 11 dígitos.')
        return digits


class FornecedorSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)

    class Meta:
        model = Fornecedor
        fields = ['id', 'nome']


class ItemEstoqueSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    qtdAtual = serializers.IntegerField(source='qtd_atual')
    qtdMinima = serializers.IntegerField(source='qtd_minima')

    class Meta:
        model = ItemEstoque
        fields = ['id', 'nome', 'unidade', 'qtdAtual', 'qtdMinima']


class EntradaEstoqueSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    itemId = serializers.CharField(source='item_id', read_only=True)
    itemNome = serializers.CharField(source='item_nome', read_only=True)
    valorUnitario = serializers.DecimalField(source='valor_unitario', max_digits=12, decimal_places=2, read_only=True)
    fornecedorId = serializers.CharField(source='fornecedor_id', read_only=True)
    fornecedorNome = serializers.CharField(source='fornecedor_nome', read_only=True)
    data = serializers.DateField(format='%Y-%m-%d', read_only=True)

    class Meta:
        model = EntradaEstoque
        fields = ['id', 'itemId', 'itemNome', 'data', 'quantidade', 'valorUnitario', 'fornecedorId', 'fornecedorNome']


class SaidaEstoqueSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    itemId = serializers.CharField(source='item_id', read_only=True)
    itemNome = serializers.CharField(source='item_nome', read_only=True)
    setorId = serializers.CharField(source='setor_id', read_only=True)
    setorNome = serializers.CharField(source='setor_nome', read_only=True)
    colaboradorId = serializers.CharField(source='colaborador_id', read_only=True)
    colaboradorNome = serializers.CharField(source='colaborador_nome', read_only=True)
    data = serializers.DateField(format='%Y-%m-%d', read_only=True)

    class Meta:
        model = SaidaEstoque
        fields = ['id', 'itemId', 'itemNome', 'data', 'quantidade', 'setorId', 'setorNome', 'colaboradorId', 'colaboradorNome']
