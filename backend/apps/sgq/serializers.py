from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from .clientes_cadastro import cliente_pesquisa_permitido, indice_cadastros_pesquisa, nome_exibicao_pesquisa
from .escopo_analise import has_escopo_opcoes, normalize_escopo_analise, slugify_chave
from .models import (
    RESPOSTA_DESTAQUE_CHOICES,
    AnexoRespostaAuditoriaSGQ,
    AuditoriaSGQ,
    CategoriaAuditoriaSGQ,
    DocumentoSGQ,
    EscopoAnalise,
    EscopoAnaliseOpcao,
    ItemNormaSGQ,
    NormaSGQ,
    PastaMatrizSGQ,
    PesquisaSatisfacao,
    RespostaAuditoriaSGQ,
    TipoRespostaSGQ,
)

TIPO_RESPOSTA_MIN_OPCOES = 2
TIPO_RESPOSTA_MAX_OPCOES = 20

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
    clienteLabel = serializers.SerializerMethodField()
    criadoPor = serializers.CharField(source='criado_por', read_only=True)
    dataInclusao = serializers.DateField(source='data_inclusao', format='%Y-%m-%d', read_only=True)
    dataEntrega = serializers.DateField(source='data_entrega', format='%Y-%m-%d')
    filial = serializers.CharField(read_only=True)

    class Meta:
        model = PesquisaSatisfacao
        fields = [
            'id', 'filial', 'motorista', 'cte', 'dataInclusao', 'dataEntrega', 'notaFiscal', 'cliente',
            'clienteLabel', 'clienteRecusouAssinar',
            'prazoEntrega', 'condicoesMercadoria', 'condicoesVeiculo',
            'apresentacaoMotorista', 'atendimentoDispensado',
            'analise', 'escopoAnalise', 'criadoPor',
        ]

    def get_clienteLabel(self, obj):
        indice = self.context.setdefault('_indice_clientes_pesquisa', indice_cadastros_pesquisa())
        return nome_exibicao_pesquisa(obj.cliente, indice)

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


class DocumentoSGQSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    nomeArquivo = serializers.CharField(source='nome_original', read_only=True)
    linkExterno = serializers.CharField(source='link_externo', read_only=True)
    incluidoPor = serializers.SerializerMethodField()
    criadoEm = serializers.DateTimeField(source='criado_em', format='%d/%m/%Y %H:%M', read_only=True)
    pastaId = serializers.SerializerMethodField()

    class Meta:
        model = DocumentoSGQ
        fields = ['id', 'titulo', 'nomeArquivo', 'tamanho', 'linkExterno', 'incluidoPor', 'criadoEm', 'pastaId']

    def get_incluidoPor(self, obj):
        if not obj.incluido_por:
            return ''
        return obj.incluido_por.name or obj.incluido_por.username

    def get_pastaId(self, obj):
        return str(obj.pasta_id) if obj.pasta_id else None


class AuditoriaSGQSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    codigo = serializers.CharField(read_only=True)
    categoria = serializers.CharField(max_length=120, trim_whitespace=True)
    titulo = serializers.CharField(max_length=200, trim_whitespace=True)
    dataInicio = serializers.DateField(source='data_inicio')
    dataTermino = serializers.DateField(source='data_termino')
    normas = serializers.SerializerMethodField()
    auditorLider = serializers.CharField(source='auditor_lider', max_length=150, trim_whitespace=True)
    auditores = serializers.ListField(
        child=serializers.CharField(max_length=150, trim_whitespace=True, allow_blank=True),
        required=False,
        max_length=30,
    )
    escopo = serializers.CharField(required=False, allow_blank=True, default='')
    filial = serializers.CharField(read_only=True)
    atrasada = serializers.SerializerMethodField()
    totalPerguntas = serializers.SerializerMethodField()
    perguntasRespondidas = serializers.SerializerMethodField()
    criadoPor = serializers.SerializerMethodField()
    criadoEm = serializers.DateTimeField(source='criado_em', read_only=True)
    atualizadoEm = serializers.DateTimeField(source='atualizado_em', read_only=True)

    class Meta:
        model = AuditoriaSGQ
        fields = [
            'id', 'codigo', 'categoria', 'titulo', 'dataInicio', 'dataTermino',
            'normas', 'auditorLider', 'auditores', 'status', 'escopo', 'filial', 'atrasada',
            'totalPerguntas', 'perguntasRespondidas',
            'criadoPor', 'criadoEm', 'atualizadoEm',
        ]

    def get_normas(self, obj):
        return [{'id': str(norma.pk), 'nome': norma.nome, 'ativa': norma.ativa} for norma in obj.normas.all()]

    def get_atrasada(self, obj):
        return obj.status != 'concluida' and obj.data_termino < timezone.localdate()

    def get_totalPerguntas(self, obj):
        valor = getattr(obj, 'total_perguntas', None)
        if valor is not None:
            return valor
        return ItemNormaSGQ.objects.filter(norma__in=obj.normas.all(), tipo='pergunta').count()

    def get_perguntasRespondidas(self, obj):
        valor = getattr(obj, 'perguntas_respondidas', None)
        if valor is not None:
            return valor
        return (
            obj.respostas.filter(item__tipo='pergunta', item__norma__in=obj.normas.all())
            .exclude(opcao_codigo='')
            .count()
        )

    def get_criadoPor(self, obj):
        if not obj.criado_por:
            return ''
        return obj.criado_por.name or obj.criado_por.username

    def validate(self, attrs):
        inicio = attrs.get('data_inicio', getattr(self.instance, 'data_inicio', None))
        termino = attrs.get('data_termino', getattr(self.instance, 'data_termino', None))
        if inicio and termino and termino < inicio:
            raise serializers.ValidationError({'dataTermino': 'A data de término não pode ser antes do início.'})
        if 'auditores' in attrs or 'auditor_lider' in attrs:
            lider = (attrs.get('auditor_lider') or getattr(self.instance, 'auditor_lider', '') or '').strip()
            nomes = attrs.get('auditores')
            if nomes is None and self.instance is not None:
                nomes = list(self.instance.auditores or [])
            limpos = []
            vistos = set()
            for nome in nomes or []:
                nome = str(nome).strip()
                chave = nome.casefold()
                if not nome or chave in vistos or (lider and chave == lider.casefold()):
                    continue
                vistos.add(chave)
                limpos.append(nome)
            attrs['auditores'] = limpos
        filial = self.instance.filial if self.instance is not None else self.context.get('filial')
        categoria = attrs.get('categoria')
        if categoria is not None and (self.instance is None or categoria != self.instance.categoria):
            cadastrada = CategoriaAuditoriaSGQ.objects.filter(filial=filial, nome__iexact=categoria, ativa=True).first()
            if cadastrada is None:
                raise serializers.ValidationError({'categoria': 'Selecione uma categoria ativa cadastrada nesta unidade.'})
            attrs['categoria'] = cadastrada.nome
            # As normas da auditoria são sempre as normas ativas da categoria.
            attrs['normas'] = list(cadastrada.normas.filter(ativa=True))
        return attrs


def _validar_normas(normas, filial, vinculadas_atuais=None) -> None:
    """Normas precisam ser da filial e ativas — exceto as que já estavam vinculadas."""
    if any(norma.filial != filial for norma in normas):
        raise serializers.ValidationError({'normaIds': 'Selecione apenas normas da mesma unidade.'})
    ja_vinculadas = set(vinculadas_atuais.values_list('pk', flat=True)) if vinculadas_atuais is not None else set()
    if any(not norma.ativa and norma.pk not in ja_vinculadas for norma in normas):
        raise serializers.ValidationError({'normaIds': 'Normas inativas não podem ser vinculadas.'})


NORMA_MAX_CLASSIFICACOES = 20
NORMA_MAX_AREAS = 30


class ClassificacaoNormaSerializer(serializers.Serializer):
    sigla = serializers.CharField(max_length=10, trim_whitespace=True)
    nome = serializers.CharField(max_length=60, trim_whitespace=True)
    critica = serializers.BooleanField(default=False)
    metaPrimeira = serializers.IntegerField(min_value=0, max_value=100, default=0)
    metaReavaliacao = serializers.IntegerField(min_value=0, max_value=100, default=0)

    def validate_sigla(self, value):
        return value.upper()


class AreaNormaSerializer(serializers.Serializer):
    sigla = serializers.CharField(max_length=10, trim_whitespace=True)
    nome = serializers.CharField(max_length=60, trim_whitespace=True)

    def validate_sigla(self, value):
        return value.upper()


def _siglas_repetidas(itens) -> str | None:
    vistas = set()
    for item in itens:
        if item['sigla'] in vistas:
            return item['sigla']
        vistas.add(item['sigla'])
    return None


class NormaSGQSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    nome = serializers.CharField(max_length=150, trim_whitespace=True)
    descricao = serializers.CharField(max_length=500, required=False, allow_blank=True, default='')
    dataAtualizacao = serializers.DateField(source='data_atualizacao', read_only=True)
    emissor = serializers.CharField(read_only=True)
    publica = serializers.BooleanField(required=False, default=False)
    ativa = serializers.BooleanField(required=False, default=True)
    classificacoes = serializers.ListField(
        child=ClassificacaoNormaSerializer(), max_length=NORMA_MAX_CLASSIFICACOES, required=False,
    )
    areas = serializers.ListField(child=AreaNormaSerializer(), max_length=NORMA_MAX_AREAS, required=False)
    filial = serializers.CharField(read_only=True)
    criadoPor = serializers.SerializerMethodField()
    criadoEm = serializers.DateTimeField(source='criado_em', read_only=True)
    atualizadoEm = serializers.DateTimeField(source='atualizado_em', read_only=True)

    class Meta:
        model = NormaSGQ
        fields = [
            'id', 'nome', 'descricao', 'dataAtualizacao', 'emissor', 'publica', 'ativa', 'classificacoes', 'areas',
            'filial', 'criadoPor', 'criadoEm', 'atualizadoEm',
        ]

    def validate_areas(self, value):
        repetida = _siglas_repetidas(value)
        if repetida:
            raise serializers.ValidationError(f'A sigla "{repetida}" está repetida.')
        if self.instance is not None:
            siglas = {area['sigla'] for area in value}
            em_uso = set()
            for areas in ItemNormaSGQ.objects.filter(norma=self.instance).values_list('areas', flat=True):
                em_uso.update(set(areas) - siglas)
            if em_uso:
                raise serializers.ValidationError(
                    f'Não é possível remover {", ".join(sorted(em_uso))}: há perguntas da norma nessa área.'
                )
        return value

    def validate_classificacoes(self, value):
        repetida = _siglas_repetidas(value)
        if repetida:
            raise serializers.ValidationError(f'A sigla "{repetida}" está repetida.')
        vistas = {classificacao['sigla'] for classificacao in value}
        if self.instance is not None:
            em_uso = sorted(
                set(
                    ItemNormaSGQ.objects.filter(norma=self.instance)
                    .exclude(classificacao='')
                    .values_list('classificacao', flat=True)
                ) - vistas
            )
            if em_uso:
                raise serializers.ValidationError(
                    f'Não é possível remover {", ".join(em_uso)}: há perguntas da norma com essa classificação.'
                )
        return value

    def get_criadoPor(self, obj):
        if not obj.criado_por:
            return ''
        return obj.criado_por.name or obj.criado_por.username

    def validate_nome(self, value):
        filial = self.instance.filial if self.instance else self.context.get('filial')
        duplicada = NormaSGQ.objects.filter(filial=filial, nome__iexact=value)
        if self.instance:
            duplicada = duplicada.exclude(pk=self.instance.pk)
        if duplicada.exists():
            raise serializers.ValidationError('Já existe uma norma com esse nome nesta unidade.')
        return value


class CategoriaAuditoriaSGQSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    nome = serializers.CharField(max_length=120, trim_whitespace=True)
    normas = serializers.SerializerMethodField()
    normaIds = serializers.PrimaryKeyRelatedField(
        source='normas', many=True, queryset=NormaSGQ.objects.none(), required=False, write_only=True,
    )
    ativa = serializers.BooleanField(required=False, default=True)
    emissor = serializers.CharField(read_only=True)
    atualizadoPor = serializers.CharField(source='atualizado_por', read_only=True)
    filial = serializers.CharField(read_only=True)
    criadoEm = serializers.DateTimeField(source='criado_em', read_only=True)
    atualizadoEm = serializers.DateTimeField(source='atualizado_em', read_only=True)
    totalAuditorias = serializers.SerializerMethodField()

    class Meta:
        model = CategoriaAuditoriaSGQ
        fields = [
            'id', 'nome', 'normas', 'normaIds', 'ativa', 'emissor', 'atualizadoPor',
            'filial', 'criadoEm', 'atualizadoEm', 'totalAuditorias',
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        normas = self.context.get('normas')
        if normas is not None:
            self.fields['normaIds'].child_relation.queryset = normas

    def get_normas(self, obj):
        return [{'id': str(norma.pk), 'nome': norma.nome, 'ativa': norma.ativa} for norma in obj.normas.all()]

    def validate(self, attrs):
        normas = attrs.get('normas')
        if normas is not None:
            filial = self.instance.filial if self.instance is not None else self.context.get('filial')
            _validar_normas(normas, filial, self.instance.normas if self.instance is not None else None)
        return attrs

    def get_totalAuditorias(self, obj):
        anotado = getattr(obj, 'total_auditorias', None)
        if anotado is not None:
            return anotado
        return AuditoriaSGQ.objects.filter(filial=obj.filial, categoria=obj.nome).count()

    def validate_nome(self, value):
        filial = self.instance.filial if self.instance else self.context.get('filial')
        duplicada = CategoriaAuditoriaSGQ.objects.filter(filial=filial, nome__iexact=value)
        if self.instance:
            duplicada = duplicada.exclude(pk=self.instance.pk)
        if duplicada.exists():
            raise serializers.ValidationError('Já existe uma categoria com esse título nesta unidade.')
        return value


class OpcaoRespostaSerializer(serializers.Serializer):
    # O que se digita/importa como resposta (ex.: SASSMAQ 1, 0, X).
    codigo = serializers.CharField(max_length=10, allow_blank=True, trim_whitespace=True, required=False, default='')
    texto = serializers.CharField(max_length=100, allow_blank=True, trim_whitespace=True)
    # % de conformidade da opção; null = "não se aplica" (tira a pergunta do cálculo).
    valor = serializers.IntegerField(min_value=0, max_value=100, allow_null=True)
    exigeJustificativa = serializers.BooleanField(default=False)


class TipoRespostaSGQSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    codigo = serializers.CharField(read_only=True)
    nome = serializers.CharField(max_length=120, trim_whitespace=True)
    opcoes = serializers.ListField(child=OpcaoRespostaSerializer(), max_length=TIPO_RESPOSTA_MAX_OPCOES)
    publica = serializers.BooleanField(required=False, default=False)
    emissor = serializers.CharField(read_only=True)
    filial = serializers.CharField(read_only=True)
    criadoEm = serializers.DateTimeField(source='criado_em', read_only=True)
    atualizadoEm = serializers.DateTimeField(source='atualizado_em', read_only=True)

    class Meta:
        model = TipoRespostaSGQ
        fields = ['id', 'codigo', 'nome', 'opcoes', 'publica', 'emissor', 'filial', 'criadoEm', 'atualizadoEm']

    def validate_nome(self, value):
        filial = self.instance.filial if self.instance else self.context.get('filial')
        duplicado = TipoRespostaSGQ.objects.filter(filial=filial, nome__iexact=value)
        if self.instance:
            duplicado = duplicado.exclude(pk=self.instance.pk)
        if duplicado.exists():
            raise serializers.ValidationError('Já existe um tipo de resposta com esse nome nesta unidade.')
        return value

    def validate_opcoes(self, value):
        opcoes = [
            {
                'codigo': opcao['codigo'] or opcao['texto'][:10].strip(),
                'texto': opcao['texto'],
                'valor': opcao['valor'],
                'exigeJustificativa': opcao['exigeJustificativa'],
            }
            for opcao in value if opcao['texto']
        ]
        textos, codigos = set(), set()
        for opcao in opcoes:
            if opcao['texto'].casefold() in textos:
                raise serializers.ValidationError(f'A opção "{opcao["texto"]}" está repetida.')
            if opcao['codigo'].casefold() in codigos:
                raise serializers.ValidationError(f'O código "{opcao["codigo"]}" está repetido.')
            textos.add(opcao['texto'].casefold())
            codigos.add(opcao['codigo'].casefold())
        if len(opcoes) < TIPO_RESPOSTA_MIN_OPCOES:
            raise serializers.ValidationError(f'Informe ao menos {TIPO_RESPOSTA_MIN_OPCOES} opções de resposta.')
        if all(opcao['valor'] is None for opcao in opcoes):
            raise serializers.ValidationError('Ao menos uma opção precisa contar no cálculo (não pode ser tudo "não se aplica").')
        return opcoes


class ItemNormaSGQSerializer(serializers.ModelSerializer):
    """`context['normas']` restringe a quais normas (escopo da filial) o item pode pertencer."""

    id = serializers.CharField(source='pk', read_only=True)
    normaId = serializers.PrimaryKeyRelatedField(source='norma', queryset=NormaSGQ.objects.none())
    parentId = serializers.PrimaryKeyRelatedField(
        source='parent', queryset=ItemNormaSGQ.objects.all(), allow_null=True, required=False, default=None,
    )
    codigo = serializers.CharField(max_length=30, required=False, allow_blank=True, default='', trim_whitespace=True)
    titulo = serializers.CharField(max_length=500, trim_whitespace=True)
    descricao = serializers.CharField(max_length=4000, required=False, allow_blank=True, default='')
    tipoRespostaId = serializers.PrimaryKeyRelatedField(
        source='tipo_resposta', queryset=TipoRespostaSGQ.objects.all(), allow_null=True, required=False, default=None,
    )
    classificacao = serializers.CharField(max_length=10, required=False, allow_blank=True, default='', trim_whitespace=True)
    areas = serializers.ListField(
        child=serializers.CharField(max_length=10, trim_whitespace=True), max_length=NORMA_MAX_AREAS, required=False, default=list,
    )
    peso = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=Decimal('0.01'), coerce_to_string=False, required=False, default=1)

    class Meta:
        model = ItemNormaSGQ
        fields = [
            'id', 'normaId', 'parentId', 'ordem', 'codigo', 'titulo', 'descricao', 'tipo',
            'tipoRespostaId', 'classificacao', 'areas', 'peso', 'obrigatorio',
        ]
        read_only_fields = ['ordem']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        normas = self.context.get('normas')
        if normas is not None:
            self.fields['normaId'].queryset = normas
            self.fields['parentId'].queryset = ItemNormaSGQ.objects.filter(norma__in=normas)
        if self.instance is not None and not isinstance(self.instance, (list, tuple)):
            self.fields['normaId'].read_only = True

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['normaId'] = str(instance.norma_id)
        data['parentId'] = str(instance.parent_id) if instance.parent_id else None
        data['tipoRespostaId'] = str(instance.tipo_resposta_id) if instance.tipo_resposta_id else None
        return data

    def validate_classificacao(self, value):
        return value.upper()

    def validate_areas(self, value):
        return list(dict.fromkeys(sigla.upper() for sigla in value if sigla))

    def validate(self, attrs):
        norma = attrs.get('norma', getattr(self.instance, 'norma', None))
        parent = attrs.get('parent', getattr(self.instance, 'parent', None))
        if parent is not None:
            if parent.norma_id != norma.pk:
                raise serializers.ValidationError({'parentId': 'O item superior precisa ser da mesma norma.'})
            if self.instance is not None:
                ancestral = parent
                while ancestral is not None:
                    if ancestral.pk == self.instance.pk:
                        raise serializers.ValidationError({'parentId': 'Um item não pode pertencer a ele mesmo ou a um subitem seu.'})
                    ancestral = ancestral.parent
        tipo = attrs.get('tipo', getattr(self.instance, 'tipo', 'orientativo'))
        if tipo != 'pergunta':
            attrs.update(tipo_resposta=None, classificacao='', areas=[])
            return attrs

        areas = attrs.get('areas', getattr(self.instance, 'areas', []))
        desconhecidas = [sigla for sigla in areas if sigla not in norma.siglas_areas()]
        if desconhecidas:
            raise serializers.ValidationError({'areas': f'Áreas não cadastradas na norma: {", ".join(desconhecidas)}.'})

        tipo_resposta = attrs.get('tipo_resposta', getattr(self.instance, 'tipo_resposta', None))
        if tipo_resposta is None:
            raise serializers.ValidationError({'tipoRespostaId': 'Informe o tipo de resposta da pergunta.'})
        if tipo_resposta.filial != norma.filial:
            raise serializers.ValidationError({'tipoRespostaId': 'O tipo de resposta precisa ser da mesma unidade da norma.'})

        sigla = attrs.get('classificacao', getattr(self.instance, 'classificacao', ''))
        if sigla:
            classificacao = norma.classificacao_por_sigla(sigla)
            if classificacao is None:
                raise serializers.ValidationError({'classificacao': f'A classificação "{sigla}" não está cadastrada na norma.'})
            if classificacao.get('critica'):
                attrs['obrigatorio'] = True
        return attrs


def _nome_usuario(user) -> str:
    return (user.name or user.username) if user else ''


class AnexoRespostaAuditoriaSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    nome = serializers.CharField(source='nome_original', read_only=True)
    incluidoPor = serializers.SerializerMethodField()
    criadoEm = serializers.DateTimeField(source='criado_em', read_only=True)

    class Meta:
        model = AnexoRespostaAuditoriaSGQ
        fields = ['id', 'nome', 'tamanho', 'incluidoPor', 'criadoEm']

    def get_incluidoPor(self, obj):
        return _nome_usuario(obj.incluido_por)


class RespostaAuditoriaSGQSerializer(serializers.ModelSerializer):
    itemId = serializers.CharField(source='item_id', read_only=True)
    opcaoCodigo = serializers.CharField(source='opcao_codigo', read_only=True)
    opcaoTexto = serializers.CharField(source='opcao_texto', read_only=True)
    respondidoPor = serializers.SerializerMethodField()
    atualizadoEm = serializers.DateTimeField(source='atualizado_em', read_only=True)
    anexos = AnexoRespostaAuditoriaSerializer(many=True, read_only=True)

    class Meta:
        model = RespostaAuditoriaSGQ
        fields = [
            'itemId', 'opcaoCodigo', 'opcaoTexto', 'valor', 'observacoes', 'destaque',
            'respondidoPor', 'atualizadoEm', 'anexos',
        ]

    def get_respondidoPor(self, obj):
        return _nome_usuario(obj.respondido_por)


class ResponderItemAuditoriaSerializer(serializers.Serializer):
    """Resolução de uma pergunta. `context['auditoria']` limita as perguntas às normas da auditoria."""

    itemId = serializers.CharField()
    opcaoCodigo = serializers.CharField(max_length=10, required=False, allow_blank=True, default='')
    observacoes = serializers.CharField(max_length=4000, required=False, allow_blank=True, default='')
    destaque = serializers.ChoiceField(choices=RESPOSTA_DESTAQUE_CHOICES, required=False, default='')

    def validate(self, attrs):
        auditoria = self.context['auditoria']
        item_id = attrs['itemId'].strip()
        item = None
        if item_id.isdigit():
            item = (
                ItemNormaSGQ.objects.select_related('tipo_resposta')
                .filter(pk=int(item_id), norma__in=auditoria.normas.all(), tipo='pergunta')
                .first()
            )
        if item is None:
            raise serializers.ValidationError({'itemId': 'Pergunta não encontrada nas normas desta auditoria.'})
        attrs['item'] = item
        attrs['opcao'] = None
        codigo = attrs['opcaoCodigo'].strip()
        if codigo:
            opcoes = item.tipo_resposta.opcoes if item.tipo_resposta else []
            opcao = next((o for o in opcoes if str(o.get('codigo', '')).casefold() == codigo.casefold()), None)
            if opcao is None:
                raise serializers.ValidationError({'opcaoCodigo': 'Opção de resposta inválida para esta pergunta.'})
            if opcao.get('exigeJustificativa') and not attrs['observacoes'].strip():
                raise serializers.ValidationError({'observacoes': f'Justifique a resposta "{opcao.get("texto")}" nas observações.'})
            attrs['opcao'] = opcao
        return attrs


class PastaMatrizSGQSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    parentId = serializers.SerializerMethodField()

    class Meta:
        model = PastaMatrizSGQ
        fields = ['id', 'nome', 'parentId']

    def get_parentId(self, obj):
        return str(obj.parent_id) if obj.parent_id else None
