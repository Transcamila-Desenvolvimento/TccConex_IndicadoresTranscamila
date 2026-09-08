from rest_framework import serializers
from decimal import Decimal
from .models import (
    Colaborador,
    LoteMovimentacaoRH,
    MovimentacaoColaborador,
    InconsistenciaColaborador,
    CargoMapping,
    ColaboradorPJ,
    ColaboradorPJHistorico,
)
from .pj_sync_service import (
    pj_ativo_na_competencia,
    salario_e_overrides_para_competencia,
    competencia_anterior,
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


class ColaboradorPJHistoricoSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    pjId = serializers.PrimaryKeyRelatedField(source='pj', read_only=True)
    dataCriacao = serializers.DateTimeField(source='data_criacao', format='%d/%m/%Y %H:%M:%S', read_only=True)
    motivo = serializers.CharField(required=False, allow_blank=True, default='')

    class Meta:
        model = ColaboradorPJHistorico
        fields = ['id', 'pjId', 'ano', 'mes', 'salario', 'cargo', 'filial', 'motivo', 'dataCriacao']

    def validate_mes(self, value):
        if value < 1 or value > 12:
            raise serializers.ValidationError('Mês deve estar entre 1 e 12.')
        return value

    def validate(self, attrs):
        pj = self.context.get('pj') or getattr(self.instance, 'pj', None)
        if not pj:
            return attrs

        ano = attrs.get('ano', getattr(self.instance, 'ano', None))
        mes = attrs.get('mes', getattr(self.instance, 'mes', None))
        salario = attrs.get('salario', getattr(self.instance, 'salario', None))
        motivo = (attrs.get('motivo') if 'motivo' in attrs else getattr(self.instance, 'motivo', '') or '').strip()
        attrs['motivo'] = motivo

        if ano is None or mes is None or salario is None:
            return attrs

        prev_ano, prev_mes = competencia_anterior(ano, mes)
        if not pj_ativo_na_competencia(pj, prev_ano, prev_mes):
            return attrs

        salario_ant, _, _ = salario_e_overrides_para_competencia(pj, prev_ano, prev_mes)
        salario_mudou_vs_anterior = Decimal(salario) != Decimal(salario_ant or 0)
        if not salario_mudou_vs_anterior or motivo:
            return attrs

        # Históricos já gravados sem motivo continuam válidos; exigimos motivo
        # só em inclusão nova ou quando o salário do lançamento é alterado.
        is_create = self.instance is None
        salario_do_lancamento_mudou = (
            is_create
            or (
                'salario' in attrs
                and Decimal(attrs['salario']) != Decimal(self.instance.salario)
            )
        )
        if salario_do_lancamento_mudou:
            raise serializers.ValidationError({
                'motivo': (
                    'Informe o motivo da alteração salarial. '
                    'Na redução, use o motivo de governança.'
                ),
            })
        return attrs


class ColaboradorPJSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    dataAdmissao = serializers.DateField(source='data_admissao', format='%Y-%m-%d', required=False, allow_null=True)
    dataDemissao = serializers.DateField(source='data_demissao', format='%Y-%m-%d', required=False, allow_null=True)
    dataNascimento = serializers.DateField(source='data_nascimento', format='%Y-%m-%d', required=False, allow_null=True)
    dataCriacao = serializers.DateTimeField(source='data_criacao', format='%d/%m/%Y %H:%M:%S', read_only=True)

    class Meta:
        model = ColaboradorPJ
        fields = [
            'id', 'nome', 'cpf', 'salario', 'filial', 'cargo',
            'dataAdmissao', 'dataDemissao', 'dataNascimento', 'ativo', 'dataCriacao',
        ]
