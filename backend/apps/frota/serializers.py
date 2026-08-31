import re

from rest_framework import serializers

from apps.accounts.constants import ALL_BRANCHES
from apps.accounts.permissions import allowed_filiais_for_module

from .models import (
    CARROCERIA_CHOICES,
    CATEGORIA_CHOICES,
    COMBUSTIVEL_CHOICES,
    STATUS_CHOICES,
    CustoAbastecimentoLinha,
    CustoFrotaLote,
    CustoManutencaoLinha,
    VeiculoFrota,
    ano_valido,
    format_placa,
    normalize_placa,
    placa_valida,
)


class VeiculoFrotaSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    placa = serializers.CharField(max_length=10)
    renavam = serializers.CharField(required=False, allow_blank=True, max_length=20)
    chassi = serializers.CharField(required=False, allow_blank=True, max_length=30)
    marca = serializers.CharField(max_length=80)
    modelo = serializers.CharField(max_length=120)
    anoFabricacao = serializers.IntegerField(source='ano_fabricacao', required=False, allow_null=True)
    anoModelo = serializers.IntegerField(source='ano_modelo', required=False, allow_null=True)
    cor = serializers.CharField(required=False, allow_blank=True, max_length=40)
    combustivel = serializers.ChoiceField(choices=[c[0] for c in COMBUSTIVEL_CHOICES])
    categoria = serializers.ChoiceField(choices=[c[0] for c in CATEGORIA_CHOICES])
    tipoCarroceria = serializers.ChoiceField(choices=[c[0] for c in CARROCERIA_CHOICES], source='tipo_carroceria')
    hodometro = serializers.IntegerField(min_value=0, required=False, default=0)
    status = serializers.ChoiceField(choices=[c[0] for c in STATUS_CHOICES])
    filial = serializers.ChoiceField(choices=list(ALL_BRANCHES))
    observacoes = serializers.CharField(required=False, allow_blank=True)
    dataCriacao = serializers.DateTimeField(source='data_criacao', read_only=True)
    dataAtualizacao = serializers.DateTimeField(source='data_atualizacao', read_only=True)

    class Meta:
        model = VeiculoFrota
        fields = [
            'id',
            'placa',
            'renavam',
            'chassi',
            'marca',
            'modelo',
            'anoFabricacao',
            'anoModelo',
            'cor',
            'combustivel',
            'categoria',
            'tipoCarroceria',
            'hodometro',
            'status',
            'filial',
            'observacoes',
            'dataCriacao',
            'dataAtualizacao',
        ]

    def validate_placa(self, value):
        placa = normalize_placa(value)
        if not placa_valida(placa):
            raise serializers.ValidationError('Informe uma placa válida (ABC-1234 ou ABC1D23).')
        qs = VeiculoFrota.objects.filter(placa=placa)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f'Já existe veículo cadastrado com a placa {format_placa(placa)}.')
        return placa

    def validate_renavam(self, value):
        return re.sub(r'\D', '', value or '')

    def validate_chassi(self, value):
        return (value or '').strip().upper()

    def validate_marca(self, value):
        return (value or '').strip().upper()

    def validate_modelo(self, value):
        return (value or '').strip().upper()

    def validate_cor(self, value):
        return (value or '').strip().title()

    def validate_filial(self, value):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user and user.is_authenticated and not user.is_admin:
            allowed = allowed_filiais_for_module(user, 'Frota')
            if value not in allowed:
                raise serializers.ValidationError('Você não tem acesso a esta filial.')
        return value

    def validate_anoFabricacao(self, value):
        if not ano_valido(value):
            raise serializers.ValidationError('Ano de fabricação inválido.')
        return value

    def validate_anoModelo(self, value):
        if not ano_valido(value):
            raise serializers.ValidationError('Ano modelo inválido.')
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['placa'] = format_placa(instance.placa)
        return data


def _validate_filial_acesso(serializer, value):
    request = serializer.context.get('request')
    user = getattr(request, 'user', None)
    if user and user.is_authenticated and not user.is_admin:
        allowed = allowed_filiais_for_module(user, 'Frota')
        if value not in allowed:
            raise serializers.ValidationError('Você não tem acesso a esta filial.')
    return value


class CondutorFrotaSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    cpf = serializers.CharField(max_length=14, required=False, allow_blank=True)
    nome = serializers.CharField(max_length=150)
    filial = serializers.ChoiceField(choices=list(ALL_BRANCHES))
    status = serializers.ChoiceField(choices=[c[0] for c in STATUS_CHOICES], required=False)
    dataCriacao = serializers.DateTimeField(source='data_criacao', read_only=True)

    class Meta:
        from .models import CondutorFrota

        model = CondutorFrota
        fields = [
            'id',
            'nome',
            'cpf',
            'filial',
            'status',
            'dataCriacao',
        ]

    def validate_cpf(self, value):
        from .models import CondutorFrota, normalize_cpf

        cpf = normalize_cpf(value)
        if not cpf:
            return None
        if len(cpf) != 11:
            raise serializers.ValidationError('Informe um CPF com 11 dígitos.')
        qs = CondutorFrota.objects.filter(cpf=cpf)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Já existe condutor cadastrado com este CPF.')
        return cpf

    def validate_nome(self, value):
        return ' '.join((value or '').split()).upper()

    def validate_filial(self, value):
        return _validate_filial_acesso(self, value)

    def to_representation(self, instance):
        from .models import format_cpf

        data = super().to_representation(instance)
        data['cpf'] = format_cpf(instance.cpf) if instance.cpf else ''
        return data


class CustoFrotaLoteSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    date = serializers.SerializerMethodField()
    periodoInicio = serializers.DateField(source='periodo_inicio', format='%d/%m/%Y', read_only=True)
    periodoFim = serializers.DateField(source='periodo_fim', format='%d/%m/%Y', read_only=True)
    updatedBy = serializers.SerializerMethodField()
    importedReports = serializers.SerializerMethodField()
    isActive = serializers.BooleanField(source='is_active')

    class Meta:
        model = CustoFrotaLote
        fields = ['id', 'label', 'date', 'periodoInicio', 'periodoFim', 'updatedBy', 'importedReports', 'isActive']

    def get_date(self, obj):
        return obj.periodo_inicio.strftime('%d/%m/%Y')

    def get_updatedBy(self, obj):
        return obj.updated_by.name if obj.updated_by else 'Sistema'

    def get_importedReports(self, obj):
        return {
            'manutencao': obj.imported_manutencao,
            'abastecimento': obj.imported_abastecimento,
        }


class CustoManutencaoLinhaSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)
    placa = serializers.SerializerMethodField()
    valorMaterial = serializers.DecimalField(source='valor_material', max_digits=14, decimal_places=2)
    valorServicos = serializers.DecimalField(source='valor_servicos', max_digits=14, decimal_places=2)
    valorTotal = serializers.DecimalField(source='valor_total', max_digits=14, decimal_places=2)

    class Meta:
        model = CustoManutencaoLinha
        fields = ['id', 'placa', 'grupo', 'item', 'valorMaterial', 'valorServicos', 'valorTotal']

    def get_placa(self, obj):
        return format_placa(obj.placa)


class CustoAbastecimentoLinhaSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)
    placa = serializers.SerializerMethodField()
    valorTotal = serializers.DecimalField(source='valor_total', max_digits=14, decimal_places=2)
    numeroNfe = serializers.CharField(source='numero_nfe')
    kmTrecho = serializers.IntegerField(source='km_trecho', allow_null=True)
    data = serializers.DateField(format='%d/%m/%Y', allow_null=True)

    class Meta:
        model = CustoAbastecimentoLinha
        fields = [
            'id', 'placa', 'transacao', 'data', 'hora', 'estabelecimento', 'cidade',
            'motorista', 'hodometro', 'kmTrecho', 'litragem', 'combustivel', 'valorTotal', 'numeroNfe',
        ]

    def get_placa(self, obj):
        return format_placa(obj.placa)
