from rest_framework import serializers

from .models import (
    UnidadeMedida,
    Setor,
    Colaborador,
    Fornecedor,
    ItemEstoque,
    EntradaEstoque,
    SaidaEstoque,
    Uniforme,
    EntregaUniforme,
    EntregaUniformeItem,
    DevolucaoUniforme,
    DevolucaoUniformeItem,
    MovimentacaoUniforme,
)
from .uniformes_service import oculta_observacoes_ajustes


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


# ─── Controle de Uniformes ───────────────────────────────────────────────────

class UniformeSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    qtdNova = serializers.IntegerField(source='qtd_nova', read_only=True)
    qtdUsada = serializers.IntegerField(source='qtd_usada', read_only=True)
    estoqueMinimo = serializers.IntegerField(source='estoque_minimo', min_value=0, required=False)
    destinados = serializers.SerializerMethodField()
    perdidos = serializers.SerializerMethodField()
    descartados = serializers.SerializerMethodField()

    class Meta:
        model = Uniforme
        fields = [
            'id', 'nome', 'codigo', 'tamanho', 'qtdNova', 'qtdUsada', 'estoqueMinimo',
            'destinados', 'perdidos', 'descartados',
        ]

    def _total(self, obj, chave):
        return (self.context.get('totais') or {}).get(obj.pk, {}).get(chave, 0)

    def get_destinados(self, obj):
        return self._total(obj, 'destinados')

    def get_perdidos(self, obj):
        return self._total(obj, 'perdidos')

    def get_descartados(self, obj):
        return self._total(obj, 'descartados')

    def validate_nome(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Informe o nome do uniforme.')
        return value

    def validate_tamanho(self, value):
        value = (value or '').strip().upper()
        if not value:
            raise serializers.ValidationError('Informe o tamanho.')
        return value

    def validate_codigo(self, value):
        return (value or '').strip()


class EntregaUniformeItemSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    uniformeId = serializers.CharField(source='uniforme_id', read_only=True)
    uniformeNome = serializers.CharField(source='uniforme_nome', read_only=True)
    uniformeCodigo = serializers.CharField(source='uniforme_codigo', read_only=True)
    uniformeTamanho = serializers.CharField(source='uniforme_tamanho', read_only=True)
    qtdDevolvida = serializers.IntegerField(source='qtd_devolvida', read_only=True)
    qtdDescartada = serializers.IntegerField(source='qtd_descartada', read_only=True)
    qtdPerdida = serializers.IntegerField(source='qtd_perdida', read_only=True)
    pendente = serializers.IntegerField(read_only=True)

    class Meta:
        model = EntregaUniformeItem
        fields = [
            'id', 'uniformeId', 'uniformeNome', 'uniformeCodigo', 'uniformeTamanho', 'condicao', 'quantidade',
            'qtdDevolvida', 'qtdDescartada', 'qtdPerdida', 'pendente',
        ]


class DevolucaoUniformeItemSerializer(serializers.ModelSerializer):
    entregaItemId = serializers.CharField(source='entrega_item_id', read_only=True)
    uniformeNome = serializers.CharField(source='entrega_item.uniforme_nome', read_only=True)
    uniformeTamanho = serializers.CharField(source='entrega_item.uniforme_tamanho', read_only=True)
    qtdBoa = serializers.IntegerField(source='qtd_boa', read_only=True)
    qtdDanificada = serializers.IntegerField(source='qtd_danificada', read_only=True)
    qtdSemCondicoes = serializers.IntegerField(source='qtd_sem_condicoes', read_only=True)
    qtdPerdida = serializers.IntegerField(source='qtd_perdida', read_only=True)

    class Meta:
        model = DevolucaoUniformeItem
        fields = [
            'entregaItemId', 'uniformeNome', 'uniformeTamanho', 'qtdBoa', 'qtdDanificada', 'qtdSemCondicoes', 'qtdPerdida',
        ]


class DevolucaoUniformeSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    dataDevolucao = serializers.DateField(source='data_devolucao', format='%Y-%m-%d', read_only=True)
    usuarioNome = serializers.CharField(source='usuario_nome', read_only=True)
    criadoEm = serializers.DateTimeField(source='criado_em', read_only=True)
    itens = DevolucaoUniformeItemSerializer(many=True, read_only=True)

    class Meta:
        model = DevolucaoUniforme
        fields = ['id', 'dataDevolucao', 'observacoes', 'usuarioNome', 'criadoEm', 'itens']


class EntregaUniformeSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    numero = serializers.CharField(read_only=True)
    colaboradorId = serializers.CharField(source='colaborador_id', read_only=True)
    colaboradorNome = serializers.CharField(source='colaborador_nome', read_only=True)
    colaboradorCpf = serializers.CharField(source='colaborador_cpf', read_only=True)
    colaboradorCargo = serializers.CharField(source='colaborador_cargo', read_only=True)
    colaboradorSetor = serializers.CharField(source='colaborador_setor', read_only=True)
    dataEntrega = serializers.DateField(source='data_entrega', format='%Y-%m-%d', read_only=True)
    usuarioNome = serializers.CharField(source='usuario_nome', read_only=True)
    criadoEm = serializers.DateTimeField(source='criado_em', read_only=True)
    itens = EntregaUniformeItemSerializer(many=True, read_only=True)
    devolucoes = DevolucaoUniformeSerializer(many=True, read_only=True)
    status = serializers.SerializerMethodField()
    totalEntregue = serializers.SerializerMethodField()
    totalPendente = serializers.SerializerMethodField()

    class Meta:
        model = EntregaUniforme
        fields = [
            'id', 'numero', 'colaboradorId', 'colaboradorNome', 'colaboradorCpf', 'colaboradorCargo',
            'colaboradorSetor', 'dataEntrega', 'observacoes', 'usuarioNome', 'criadoEm', 'itens', 'devolucoes',
            'status', 'totalEntregue', 'totalPendente',
        ]

    def get_totalEntregue(self, obj):
        return sum(i.quantidade for i in obj.itens.all())

    def get_totalPendente(self, obj):
        return sum(i.pendente for i in obj.itens.all())

    def get_status(self, obj):
        pendente = self.get_totalPendente(obj)
        if pendente == 0:
            return 'encerrada'
        if pendente < self.get_totalEntregue(obj):
            return 'parcial'
        return 'em_posse'


class MovimentacaoUniformeSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    tipoLabel = serializers.CharField(source='get_tipo_display', read_only=True)
    uniformeId = serializers.CharField(source='uniforme_id', read_only=True)
    uniformeNome = serializers.CharField(source='uniforme_nome', read_only=True)
    uniformeTamanho = serializers.CharField(source='uniforme_tamanho', read_only=True)
    variacaoEstoque = serializers.IntegerField(source='variacao_estoque', read_only=True)
    saldoNovo = serializers.IntegerField(source='saldo_novo', read_only=True)
    saldoUsado = serializers.IntegerField(source='saldo_usado', read_only=True)
    data = serializers.DateField(format='%Y-%m-%d', read_only=True)
    colaboradorNome = serializers.CharField(source='colaborador_nome', read_only=True)
    entregaId = serializers.CharField(source='entrega_id', read_only=True)
    entregaNumero = serializers.SerializerMethodField()
    usuarioNome = serializers.CharField(source='usuario_nome', read_only=True)
    criadoEm = serializers.DateTimeField(source='criado_em', read_only=True)

    class Meta:
        model = MovimentacaoUniforme
        fields = [
            'id', 'tipo', 'tipoLabel', 'uniformeId', 'uniformeNome', 'uniformeTamanho', 'condicao', 'quantidade',
            'variacaoEstoque', 'saldoNovo', 'saldoUsado', 'data', 'colaboradorNome', 'entregaId', 'entregaNumero',
            'observacao', 'usuarioNome', 'criadoEm',
        ]

    def get_entregaNumero(self, obj):
        return obj.entrega.numero if obj.entrega_id else ''

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request is not None else None
        if oculta_observacoes_ajustes(user):
            data['observacao'] = ''
        return data
