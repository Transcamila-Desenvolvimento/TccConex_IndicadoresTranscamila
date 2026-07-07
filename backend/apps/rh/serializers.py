from rest_framework import serializers
from .models import (
    Colaborador,
    LoteMovimentacaoRH,
    MovimentacaoColaborador,
    InconsistenciaColaborador,
    CargoMapping,
    ColaboradorPJ,
)


class ColaboradorSerializer(serializers.ModelSerializer):
    nomeCompleto = serializers.CharField(source='nome_completo')
    dataAdmissao = serializers.DateField(source='data_admissao', format='%Y-%m-%d', required=False, allow_null=True)
    dataDemissao = serializers.DateField(source='data_demissao', format='%Y-%m-%d', required=False, allow_null=True)
    nomeLider = serializers.CharField(source='nome_lider', required=False, allow_null=True, allow_blank=True)
    dataNascimento = serializers.DateField(source='data_nascimento', format='%Y-%m-%d', required=False, allow_null=True)
    dataAtualizacao = serializers.DateTimeField(source='data_atualizacao', format='%Y-%m-%d %H:%M:%S', read_only=True)

    class Meta:
        model = Colaborador
        fields = [
            'id', 'cpf', 'matricula', 'nomeCompleto', 'empresa', 'filial', 
            'departamento', 'cargo', 'situacao', 'dataAdmissao', 'dataDemissao', 
            'telefone', 'nomeLider', 'dataNascimento', 'escolaridade', 'sexo', 
            'regime', 'categoria', 'dataAtualizacao', 'desconsiderado'
        ]


class LoteMovimentacaoRHSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    dataImportacao = serializers.DateTimeField(source='data_importacao', format='%d/%m/%Y %H:%M:%S', read_only=True)
    updatedBy = serializers.SerializerMethodField()
    arquivoUrl = serializers.SerializerMethodField()

    class Meta:
        model = LoteMovimentacaoRH
        fields = ['id', 'mes', 'ano', 'dataImportacao', 'updatedBy', 'arquivoUrl']

    def get_updatedBy(self, obj):
        return obj.usuario.name if obj.usuario else 'Sistema'

    def get_arquivoUrl(self, obj):
        return obj.arquivo.url if obj.arquivo else None


class MovimentacaoColaboradorSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    loteId = serializers.PrimaryKeyRelatedField(source='lote', read_only=True)
    ufEstado = serializers.CharField(source='uf_estado', required=False, allow_null=True, allow_blank=True)
    dataAdmissao = serializers.DateField(source='data_admissao', format='%d/%m/%Y', read_only=True)
    dataNascimento = serializers.DateField(source='data_nascimento', format='%d/%m/%Y', read_only=True)
    idadeStr = serializers.CharField(source='idade', read_only=True)
    tempoEmpresaStr = serializers.CharField(source='tempo_empresa', read_only=True)
    pisPasep = serializers.CharField(source='pis_pasep', required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = MovimentacaoColaborador
        fields = [
            'id', 'loteId', 'filial', 'nome', 'situacao', 'ufEstado', 'funcao', 
            'dataAdmissao', 'dataNascimento', 'cpf', 'pisPasep', 'rg', 'salario', 
            'categoria', 'idadeStr', 'tempoEmpresaStr'
        ]


class InconsistenciaColaboradorSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    loteId = serializers.PrimaryKeyRelatedField(source='lote', read_only=True)
    valorAnterior = serializers.CharField(source='valor_anterior', required=False, allow_null=True, allow_blank=True)
    valorAtual = serializers.CharField(source='valor_atual', required=False, allow_null=True, allow_blank=True)
    tipoDisplay = serializers.CharField(source='get_tipo_display', read_only=True)
    dataCriacao = serializers.DateTimeField(source='data_criacao', format='%d/%m/%Y %H:%M:%S', read_only=True)

    class Meta:
        model = InconsistenciaColaborador
        fields = ['id', 'loteId', 'cpf', 'nome', 'tipo', 'tipoDisplay', 'valorAnterior', 'valorAtual', 'justificativa', 'dataCriacao']


class CargoMappingSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    categoriaDisplay = serializers.CharField(source='get_categoria_display', read_only=True)
    dataCriacao = serializers.DateTimeField(source='data_criacao', format='%d/%m/%Y %H:%M:%S', read_only=True)
    ultimaAtualizacao = serializers.DateTimeField(source='ultima_atualizacao', format='%d/%m/%Y %H:%M:%S', read_only=True)

    class Meta:
        model = CargoMapping
        fields = ['id', 'cargo', 'categoria', 'categoriaDisplay', 'dataCriacao', 'ultimaAtualizacao']


class ColaboradorPJSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    dataAdmissao = serializers.DateField(source='data_admissao', format='%Y-%m-%d', required=False, allow_null=True)
    dataNascimento = serializers.DateField(source='data_nascimento', format='%Y-%m-%d', required=False, allow_null=True)
    dataCriacao = serializers.DateTimeField(source='data_criacao', format='%d/%m/%Y %H:%M:%S', read_only=True)

    class Meta:
        model = ColaboradorPJ
        fields = ['id', 'nome', 'cpf', 'salario', 'filial', 'cargo', 'dataAdmissao', 'dataNascimento', 'ativo', 'dataCriacao']
