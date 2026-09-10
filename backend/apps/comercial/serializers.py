from decimal import Decimal

from django.db.models import Max
from rest_framework import serializers

from apps.faturamento.cnpj_service import format_cep, format_documento, only_digits
from apps.faturamento.models import TIPO_PESSOA_JURIDICA, format_municipio_cadastro, format_nome_cadastro

from .models import (
    CLASSE_RISCO_NAO_CLASSIFICADO,
    COMPATIBILIDADE_CHOICES,
    COMPATIBILIDADE_NAO_ANALISADO,
    GRUPO_EMBALAGEM_NAO_APLICAVEL,
    ONU_PARA_CLASSE,
    SERVICOS_TRANSPORTE,
    SITUACAO_CHOICES,
    SITUACAO_POTENCIAL,
    STATUS_PROPOSTA_CHOICES,
    TIPO_PROPOSTA_CHOICES,
    TIPO_PROPOSTA_TRANSPORTE_RODOVIARIO,
    TIPO_TABELA_DISTRIBUICAO,
    TIPO_TABELA_FRETE_CHOICES,
    STATUS_TABELA_ARQUIVADA,
    STATUS_TABELA_FRETE_CHOICES,
    STATUS_TABELA_RASCUNHO,
    ClienteComercial,
    ClienteComercialProduto,
    HomologacaoProdutoEvento,
    ProdutoComercial,
    GeneralidadeComercial,
    PropostaComercial,
    PropostaFreteLinha,
    TabelaFrete,
    TabelaFreteLinha,
    default_condicoes,
    nome_base_tabela_frete,
    normalizar_homologacao,
    tipos_servico_generalidade,
)
from .tabela_distribuicao import merge_config


def _usuario_nome(user) -> str:
    if not user:
        return ''
    nome = (getattr(user, 'name', '') or '').strip()
    return nome or getattr(user, 'username', '') or ''


def _validar_clientes_tabela_unica(clientes, instance=None):
    ids = [item.pk if hasattr(item, 'pk') else item for item in (clientes or [])]
    ids = [pk for pk in ids if pk]
    if not ids:
        return
    qs = TabelaFrete.objects.filter(
        tipo=TIPO_TABELA_DISTRIBUICAO,
        clientes__in=ids,
    ).exclude(status=STATUS_TABELA_ARQUIVADA)
    if instance is not None:
        qs = qs.exclude(pk=instance.pk)
        codigo = (instance.codigo or '').strip()
        if codigo:
            qs = qs.exclude(codigo=codigo)
    conflito_ids = list(
        qs.filter(clientes__in=ids).values_list('clientes__pk', flat=True).distinct()
    )
    if not conflito_ids:
        return
    nomes = list(
        ClienteComercial.objects.filter(pk__in=conflito_ids)
        .order_by('razao_social')
        .values_list('nome_fantasia', 'razao_social')
    )
    rotulos = [(fantasia or razao or '').strip() for fantasia, razao in nomes]
    rotulos = [item for item in rotulos if item]
    texto = ', '.join(rotulos) if rotulos else 'cliente selecionado'
    raise serializers.ValidationError({
        'clienteIds': f'{texto} já está vinculado a outra tabela de distribuição.',
    })


class ClienteComercialProdutoSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    produtoId = serializers.CharField(source='produto_id', read_only=True)
    nome = serializers.SerializerMethodField()
    fispq = serializers.SerializerMethodField()
    numeroOnu = serializers.SerializerMethodField()
    classeRisco = serializers.SerializerMethodField()
    grupoEmbalagem = serializers.SerializerMethodField()
    conformidade = serializers.SerializerMethodField()

    class Meta:
        model = ClienteComercialProduto
        fields = ['id', 'produtoId', 'nome', 'fispq', 'numeroOnu', 'classeRisco', 'grupoEmbalagem', 'conformidade']

    def _catalogo(self, instance):
        return instance.produto

    def get_nome(self, instance):
        catalogo = self._catalogo(instance)
        return (catalogo.nome if catalogo else instance.nome) or ''

    def get_fispq(self, instance):
        catalogo = self._catalogo(instance)
        return (catalogo.fispq_consulta if catalogo else instance.fispq_consulta) or ''

    def get_numeroOnu(self, instance):
        catalogo = self._catalogo(instance)
        return (catalogo.numero_onu if catalogo else instance.numero_onu) or ''

    def get_classeRisco(self, instance):
        catalogo = self._catalogo(instance)
        return (catalogo.classe_risco if catalogo else instance.classe_risco) or ''

    def get_grupoEmbalagem(self, instance):
        catalogo = self._catalogo(instance)
        return (catalogo.grupo_embalagem if catalogo else instance.grupo_embalagem) or ''

    def get_conformidade(self, instance):
        from .homologacao import conformidade_vinculo
        data = conformidade_vinculo(instance)
        data.pop('nome', None)
        return data


class HomologacaoProdutoEventoSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    usuarioNome = serializers.SerializerMethodField()
    dataCriacao = serializers.DateTimeField(source='data_criacao', read_only=True)

    class Meta:
        model = HomologacaoProdutoEvento
        fields = ['id', 'status', 'justificativa', 'produtos_snapshot', 'usuarioNome', 'dataCriacao']

    def get_usuarioNome(self, instance):
        return _usuario_nome(instance.usuario)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['produtosSnapshot'] = data.pop('produtos_snapshot', [])
        return data


class ProdutoComercialSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    fispq = serializers.CharField(source='fispq_consulta', required=False, allow_blank=True, max_length=500)
    numeroOnu = serializers.CharField(source='numero_onu', required=False, allow_blank=True, max_length=16)
    classeRisco = serializers.CharField(source='classe_risco', required=False, allow_blank=True, max_length=20)
    grupoEmbalagem = serializers.CharField(source='grupo_embalagem', required=False, allow_blank=True, max_length=20)
    clienteIds = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        write_only=True,
    )
    clientes = serializers.SerializerMethodField()
    clientesCount = serializers.SerializerMethodField()
    dataCriacao = serializers.DateTimeField(source='data_criacao', read_only=True)
    dataAtualizacao = serializers.DateTimeField(source='data_atualizacao', read_only=True)

    class Meta:
        model = ProdutoComercial
        fields = [
            'id',
            'nome',
            'fispq',
            'numeroOnu',
            'classeRisco',
            'grupoEmbalagem',
            'ativo',
            'clienteIds',
            'clientes',
            'clientesCount',
            'dataCriacao',
            'dataAtualizacao',
        ]

    def get_clientes(self, instance):
        vinculos = instance.vinculos.select_related('cliente').order_by('cliente__razao_social')
        itens = []
        for vinculo in vinculos:
            cliente = vinculo.cliente
            itens.append({
                'id': str(cliente.pk),
                'razaoSocial': cliente.razao_social,
                'nomeFantasia': cliente.nome_fantasia,
                'cnpj': cliente.cnpj,
                'compatibilidade': normalizar_homologacao(cliente.compatibilidade),
            })
        return itens

    def get_clientesCount(self, instance):
        count = getattr(instance, 'clientes_count', None)
        if count is not None:
            return count
        return instance.vinculos.count()

    def validate(self, attrs):
        from .models import normalizar_classe_risco, normalizar_fispq, normalizar_grupo_embalagem, normalizar_numero_onu
        from apps.faturamento.models import format_nome_cadastro as format_nome

        if 'nome' in attrs:
            nome = format_nome(attrs.get('nome') or '')
            if not nome:
                raise serializers.ValidationError({'nome': ['Informe o nome do produto.']})
            qs = ProdutoComercial.objects.filter(nome__iexact=nome)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({'nome': ['Já existe produto cadastrado com este nome.']})
            attrs['nome'] = nome
        if 'numero_onu' in attrs:
            attrs['numero_onu'] = normalizar_numero_onu(attrs.get('numero_onu') or '')
        if 'classe_risco' in attrs:
            attrs['classe_risco'] = normalizar_classe_risco(attrs.get('classe_risco') or '')
        if 'fispq_consulta' in attrs:
            attrs['fispq_consulta'] = normalizar_fispq(attrs.get('fispq_consulta') or '')
        if 'grupo_embalagem' in attrs:
            attrs['grupo_embalagem'] = normalizar_grupo_embalagem(attrs.get('grupo_embalagem') or '')
        onu = attrs.get('numero_onu', getattr(self.instance, 'numero_onu', '') if self.instance else '')
        classe = attrs.get('classe_risco', getattr(self.instance, 'classe_risco', CLASSE_RISCO_NAO_CLASSIFICADO) if self.instance else CLASSE_RISCO_NAO_CLASSIFICADO)
        if onu in ONU_PARA_CLASSE and classe == CLASSE_RISCO_NAO_CLASSIFICADO:
            attrs['classe_risco'] = ONU_PARA_CLASSE[onu]
            classe = attrs['classe_risco']
        if classe != CLASSE_RISCO_NAO_CLASSIFICADO and onu and len(onu) != 4:
            raise serializers.ValidationError({'numeroOnu': ['Informe o nº ONU com 4 dígitos para produto classificado.']})
        if classe == CLASSE_RISCO_NAO_CLASSIFICADO:
            attrs['grupo_embalagem'] = GRUPO_EMBALAGEM_NAO_APLICAVEL
        raw_ids = self.initial_data.get('clienteIds', None)
        if raw_ids is not None:
            if not isinstance(raw_ids, list):
                raise serializers.ValidationError({'clienteIds': ['Informe o cliente do produto.']})
            if len(raw_ids) > 1:
                raise serializers.ValidationError({
                    'clienteIds': ['O produto deve ser vinculado a um único cliente.'],
                })
        return attrs

    def _sync_clientes(self, produto, cliente_ids, usuario):
        from .homologacao import sincronizar_homologacao_por_produtos

        ids = []
        for raw in cliente_ids or []:
            try:
                ids.append(int(raw))
            except (TypeError, ValueError):
                continue
        ids = list(dict.fromkeys(ids))
        if len(ids) > 1:
            raise serializers.ValidationError({
                'clienteIds': ['O produto deve ser vinculado a um único cliente.'],
            })
        atuais = set(produto.vinculos.values_list('cliente_id', flat=True))
        novos = set(ids)
        afetados = atuais | novos
        produto.vinculos.exclude(cliente_id__in=novos).delete()
        ordem = produto.vinculos.aggregate(max_ordem=Max('ordem')).get('max_ordem') or 0
        for cliente_id in sorted(novos - atuais):
            ordem += 1
            ClienteComercialProduto.objects.create(cliente_id=cliente_id, produto=produto, ordem=ordem)
        for cliente in ClienteComercial.objects.filter(pk__in=afetados):
            sincronizar_homologacao_por_produtos(cliente, usuario)

    def create(self, validated_data):
        cliente_ids = validated_data.pop('clienteIds', None)
        usuario = self.context.get('request').user if self.context.get('request') else None
        produto = super().create(validated_data)
        if cliente_ids is not None:
            self._sync_clientes(produto, cliente_ids, usuario)
        return produto

    def update(self, instance, validated_data):
        cliente_ids = validated_data.pop('clienteIds', None)
        usuario = self.context.get('request').user if self.context.get('request') else None
        classificacao_antes = (
            instance.classe_risco,
            instance.numero_onu,
            instance.grupo_embalagem,
            instance.fispq_consulta,
        )
        produto = super().update(instance, validated_data)
        classificacao_depois = (
            produto.classe_risco,
            produto.numero_onu,
            produto.grupo_embalagem,
            produto.fispq_consulta,
        )
        if cliente_ids is not None:
            self._sync_clientes(produto, cliente_ids, usuario)
        elif classificacao_antes != classificacao_depois:
            from .homologacao import sincronizar_homologacao_por_produtos
            for vinculo in produto.vinculos.select_related('cliente'):
                vinculo.save()
                sincronizar_homologacao_por_produtos(
                    vinculo.cliente,
                    usuario,
                    'Classificação do produto alterada. Nova validação obrigatória.',
                )
        return produto


class ClienteComercialSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    tipoPessoa = serializers.CharField(source='tipo_pessoa', required=False)
    cnpj = serializers.CharField(required=False, allow_blank=True, max_length=20)
    razaoSocial = serializers.CharField(source='razao_social', max_length=200)
    nomeFantasia = serializers.CharField(source='nome_fantasia', required=False, allow_blank=True, max_length=200)
    municipio = serializers.CharField(required=False, allow_blank=True, max_length=150)
    uf = serializers.CharField(required=False, allow_blank=True, max_length=2)
    logradouro = serializers.CharField(required=False, allow_blank=True, max_length=200)
    numero = serializers.CharField(required=False, allow_blank=True, max_length=20)
    complemento = serializers.CharField(required=False, allow_blank=True, max_length=80)
    bairro = serializers.CharField(required=False, allow_blank=True, max_length=120)
    cep = serializers.CharField(required=False, allow_blank=True, max_length=10)
    telefone = serializers.CharField(required=False, allow_blank=True, max_length=30)
    email = serializers.CharField(required=False, allow_blank=True, max_length=254)
    inscricaoEstadual = serializers.CharField(
        source='inscricao_estadual',
        required=False,
        allow_blank=True,
        max_length=20,
    )
    responsavel = serializers.CharField(required=False, allow_blank=True, max_length=150)
    observacoes = serializers.CharField(required=False, allow_blank=True)
    situacao = serializers.ChoiceField(choices=[c[0] for c in SITUACAO_CHOICES], required=False)
    compatibilidade = serializers.SerializerMethodField()
    homologadoPor = serializers.SerializerMethodField()
    homologadoEm = serializers.DateTimeField(source='homologado_em', read_only=True)
    homologacaoJustificativa = serializers.CharField(source='homologacao_justificativa', read_only=True)
    homologacaoRevisao = serializers.IntegerField(source='homologacao_revisao', read_only=True)
    produtosCount = serializers.SerializerMethodField()
    previsaoVolumes = serializers.CharField(source='previsao_volumes', required=False, allow_blank=True, max_length=200)
    tiposEmbalagens = serializers.CharField(source='tipos_embalagens', required=False, allow_blank=True, max_length=200)
    quantidadeVolumes = serializers.CharField(source='quantidade_volumes', required=False, allow_blank=True, max_length=80)
    posicoesPallets = serializers.CharField(source='posicoes_pallets', required=False, allow_blank=True, max_length=80)
    produtos = ClienteComercialProdutoSerializer(many=True, read_only=True)
    homologacaoResumo = serializers.SerializerMethodField()
    clienteDesde = serializers.DateTimeField(source='cliente_desde', read_only=True)
    dataCriacao = serializers.DateTimeField(source='data_criacao', read_only=True)
    dataAtualizacao = serializers.DateTimeField(source='data_atualizacao', read_only=True)

    class Meta:
        model = ClienteComercial
        fields = [
            'id',
            'tipoPessoa',
            'cnpj',
            'razaoSocial',
            'nomeFantasia',
            'municipio',
            'uf',
            'logradouro',
            'numero',
            'complemento',
            'bairro',
            'cep',
            'telefone',
            'email',
            'inscricaoEstadual',
            'responsavel',
            'observacoes',
            'situacao',
            'compatibilidade',
            'homologadoPor',
            'homologadoEm',
            'homologacaoJustificativa',
            'homologacaoRevisao',
            'produtosCount',
            'previsaoVolumes',
            'tiposEmbalagens',
            'quantidadeVolumes',
            'posicoesPallets',
            'produtos',
            'homologacaoResumo',
            'clienteDesde',
            'dataCriacao',
            'dataAtualizacao',
        ]

    def validate(self, attrs):
        if 'tipo_pessoa' in attrs and (attrs.get('tipo_pessoa') or '').upper() not in {'', TIPO_PESSOA_JURIDICA}:
            raise serializers.ValidationError({'tipoPessoa': ['O cadastro comercial aceita apenas pessoa jurídica.']})
        attrs['tipo_pessoa'] = TIPO_PESSOA_JURIDICA

        if 'razao_social' in attrs:
            attrs['razao_social'] = format_nome_cadastro(attrs.get('razao_social'))
        if 'nome_fantasia' in attrs:
            attrs['nome_fantasia'] = format_nome_cadastro(attrs.get('nome_fantasia'))
        if 'municipio' in attrs:
            attrs['municipio'] = format_municipio_cadastro(attrs.get('municipio'))
        if 'uf' in attrs:
            attrs['uf'] = (attrs.get('uf') or '').strip().upper()[:2]
        if 'cep' in attrs:
            attrs['cep'] = format_cep(attrs.get('cep') or '')
        if 'email' in attrs:
            attrs['email'] = (attrs.get('email') or '').strip().lower()
        if 'responsavel' in attrs:
            attrs['responsavel'] = (attrs.get('responsavel') or '').strip()
        if 'situacao' not in attrs and not self.instance:
            attrs['situacao'] = SITUACAO_POTENCIAL
        attrs.pop('compatibilidade', None)
        if not self.instance:
            attrs['compatibilidade'] = COMPATIBILIDADE_NAO_ANALISADO

        razao = attrs.get('razao_social', getattr(self.instance, 'razao_social', '') if self.instance else '')
        if not (razao or '').strip():
            raise serializers.ValidationError({'razaoSocial': ['Informe a razão social.']})

        if 'cnpj' in attrs or not self.instance:
            raw = attrs.get('cnpj', getattr(self.instance, 'cnpj', '') if self.instance and 'cnpj' not in attrs else attrs.get('cnpj'))
            digits = only_digits(raw or '', 14)
            if not digits:
                raise serializers.ValidationError({'cnpj': ['Informe um CNPJ válido.']})
            if len(digits) != 14:
                raise serializers.ValidationError({'cnpj': ['Informe um CNPJ com 14 dígitos.']})
            qs = ClienteComercial.objects.filter(cnpj_digits=digits)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({'cnpj': ['Já existe cliente cadastrado com este CNPJ.']})
            attrs['cnpj'] = format_documento(digits, TIPO_PESSOA_JURIDICA)
        return attrs

    def get_compatibilidade(self, instance):
        return normalizar_homologacao(instance.compatibilidade)

    def get_homologadoPor(self, instance):
        return _usuario_nome(instance.homologado_por)

    def get_produtosCount(self, instance):
        count = getattr(instance, 'produtos_count', None)
        if count is not None:
            return count
        return instance.produtos.filter(produto__isnull=False).count()

    def get_homologacaoResumo(self, instance):
        from .homologacao import analisar_homologacao_produtos

        cached = getattr(instance, '_homologacao_analise', None)
        if cached is None:
            cached = analisar_homologacao_produtos(instance)
            instance._homologacao_analise = cached
        return {key: value for key, value in cached.items() if key != 'itens'}

    def create(self, validated_data):
        validated_data.pop('produtos', None)
        validated_data['compatibilidade'] = COMPATIBILIDADE_NAO_ANALISADO
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('produtos', None)
        validated_data.pop('compatibilidade', None)
        return super().update(instance, validated_data)


def _money_str(value):
    if value is None:
        return None
    return str(value)


class ClienteHistoricoPropostaSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    numeroIdentificacao = serializers.CharField(source='numero_identificacao', read_only=True)
    tipo = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    dataProposta = serializers.DateField(source='data_proposta', read_only=True)
    dataAtualizacao = serializers.DateTimeField(source='data_atualizacao', read_only=True)
    vigencia = serializers.CharField(read_only=True)
    valorEstimado = serializers.SerializerMethodField()

    class Meta:
        model = PropostaComercial
        fields = [
            'id',
            'numeroIdentificacao',
            'tipo',
            'status',
            'dataProposta',
            'dataAtualizacao',
            'vigencia',
            'valorEstimado',
        ]

    def get_valorEstimado(self, instance):
        return _money_str(instance.valor_estimado)


class PropostaFreteLinhaSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    origem = serializers.CharField(required=False, allow_blank=True, max_length=120)
    entrega = serializers.CharField(required=False, allow_blank=True, max_length=120)
    veiculo = serializers.CharField(required=False, allow_blank=True, max_length=80)
    devolucaoContainer = serializers.CharField(
        source='devolucao_container',
        required=False,
        allow_blank=True,
        max_length=120,
    )
    observacoes = serializers.CharField(required=False, allow_blank=True, max_length=200)
    peso = serializers.CharField(required=False, allow_blank=True, max_length=40)
    tarifaFrete = serializers.DecimalField(
        source='tarifa_frete',
        max_digits=14,
        decimal_places=2,
        required=False,
        allow_null=True,
    )
    pedagio = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)
    adValorem = serializers.CharField(source='ad_valorem', required=False, allow_blank=True, max_length=20)
    gris = serializers.CharField(required=False, allow_blank=True, max_length=20)
    icms = serializers.CharField(required=False, allow_blank=True, max_length=40)
    prazoDias = serializers.CharField(source='prazo_dias', required=False, allow_blank=True, max_length=20)
    totalEstimado = serializers.DecimalField(
        source='total_estimado',
        max_digits=14,
        decimal_places=2,
        required=False,
        allow_null=True,
        read_only=True,
    )
    ordem = serializers.IntegerField(required=False)

    class Meta:
        model = PropostaFreteLinha
        fields = [
            'id',
            'ordem',
            'origem',
            'entrega',
            'veiculo',
            'devolucaoContainer',
            'observacoes',
            'peso',
            'tarifaFrete',
            'pedagio',
            'adValorem',
            'gris',
            'icms',
            'prazoDias',
            'totalEstimado',
        ]

    def to_internal_value(self, data):
        payload = dict(data)
        for key in ('tarifaFrete', 'pedagio'):
            if payload.get(key) == '':
                payload[key] = None
        return super().to_internal_value(payload)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['tarifaFrete'] = _money_str(instance.tarifa_frete)
        data['pedagio'] = _money_str(instance.pedagio)
        data['totalEstimado'] = _money_str(instance.total_estimado)
        return data


class TabelaFreteLinhaSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    tabelaId = serializers.PrimaryKeyRelatedField(
        source='tabela',
        queryset=TabelaFrete.objects.all(),
        required=True,
    )
    origem = serializers.CharField(required=False, allow_blank=True, max_length=120)
    entrega = serializers.CharField(required=False, allow_blank=True, max_length=120)
    veiculo = serializers.CharField(required=False, allow_blank=True, max_length=80)
    tarifaFrete = serializers.DecimalField(
        source='tarifa_frete',
        max_digits=14,
        decimal_places=2,
        required=False,
        allow_null=True,
    )
    pedagio = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)
    adValorem = serializers.CharField(source='ad_valorem', required=False, allow_blank=True, max_length=20)
    gris = serializers.CharField(required=False, allow_blank=True, max_length=20)
    icms = serializers.CharField(required=False, allow_blank=True, max_length=40)
    prazoDias = serializers.CharField(source='prazo_dias', required=False, allow_blank=True, max_length=20)
    totalEstimado = serializers.DecimalField(
        source='total_estimado',
        max_digits=14,
        decimal_places=2,
        required=False,
        allow_null=True,
        read_only=True,
    )
    ordem = serializers.IntegerField(required=False)

    class Meta:
        model = TabelaFreteLinha
        fields = [
            'id',
            'tabelaId',
            'ordem',
            'origem',
            'entrega',
            'veiculo',
            'tarifaFrete',
            'pedagio',
            'adValorem',
            'gris',
            'icms',
            'prazoDias',
            'totalEstimado',
        ]

    def to_internal_value(self, data):
        payload = dict(data)
        for key in ('tarifaFrete', 'pedagio'):
            if payload.get(key) == '':
                payload[key] = None
        return super().to_internal_value(payload)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['tarifaFrete'] = _money_str(instance.tarifa_frete)
        data['pedagio'] = _money_str(instance.pedagio)
        data['totalEstimado'] = _money_str(instance.total_estimado)
        data['tabelaId'] = str(instance.tabela_id)
        return data


class TabelaFreteSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    nome = serializers.CharField(max_length=160)
    codigo = serializers.CharField(max_length=40, required=False, allow_blank=True)
    revisao = serializers.IntegerField(min_value=1, required=False)
    vigenciaInicio = serializers.DateField(source='vigencia_inicio', required=False, allow_null=True)
    vigenciaFim = serializers.DateField(source='vigencia_fim', required=False, allow_null=True)
    status = serializers.ChoiceField(
        choices=[c[0] for c in STATUS_TABELA_FRETE_CHOICES],
        required=False,
        read_only=True,
    )
    observacoes = serializers.CharField(required=False, allow_blank=True)
    tipo = serializers.ChoiceField(choices=[c[0] for c in TIPO_TABELA_FRETE_CHOICES])
    clienteIds = serializers.PrimaryKeyRelatedField(
        many=True,
        source='clientes',
        queryset=ClienteComercial.objects.all(),
        required=False,
    )
    clientesNomes = serializers.SerializerMethodField()
    criadoPorNome = serializers.SerializerMethodField()
    atualizadoPorNome = serializers.SerializerMethodField()
    config = serializers.JSONField(required=False)
    faixas = serializers.JSONField(required=False)
    linhasCount = serializers.SerializerMethodField()
    linhas = TabelaFreteLinhaSerializer(many=True, read_only=True)
    dataCriacao = serializers.DateTimeField(source='data_criacao', read_only=True)
    dataAtualizacao = serializers.DateTimeField(source='data_atualizacao', read_only=True)

    class Meta:
        model = TabelaFrete
        fields = [
            'id',
            'nome',
            'codigo',
            'revisao',
            'vigenciaInicio',
            'vigenciaFim',
            'status',
            'observacoes',
            'tipo',
            'clienteIds',
            'clientesNomes',
            'criadoPorNome',
            'atualizadoPorNome',
            'config',
            'faixas',
            'linhasCount',
            'linhas',
            'dataCriacao',
            'dataAtualizacao',
        ]

    def get_linhasCount(self, instance):
        return getattr(instance, 'linhas_count', instance.linhas.count())

    def get_clientesNomes(self, instance):
        clientes = instance.clientes.all()
        return [
            (cliente.nome_fantasia or cliente.razao_social).strip()
            for cliente in clientes
            if (cliente.nome_fantasia or cliente.razao_social or '').strip()
        ]

    def get_criadoPorNome(self, instance):
        return _usuario_nome(instance.criado_por)

    def get_atualizadoPorNome(self, instance):
        return _usuario_nome(instance.atualizado_por)

    def validate_nome(self, value):
        return nome_base_tabela_frete(value)

    def to_internal_value(self, data):
        payload = dict(data)
        if 'clienteIds' not in payload and payload.get('clienteId') not in (None, '', 'null'):
            payload['clienteIds'] = [payload['clienteId']]
        if payload.get('clienteIds') in ('', 'null', None):
            payload['clienteIds'] = []
        return super().to_internal_value(payload)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['clienteIds'] = [str(pk) for pk in instance.clientes.order_by('pk').values_list('pk', flat=True)]
        data['linhasCount'] = getattr(instance, 'linhas_count', instance.linhas.count())
        compact = self.context.get('compact')
        if compact:
            data.pop('faixas', None)
            data.pop('linhas', None)
            data.pop('config', None)
        return data

    def validate(self, attrs):
        tipo = attrs.get('tipo') or getattr(self.instance, 'tipo', None)
        config = attrs.get('config')
        vigencia_inicio = attrs.get('vigencia_inicio')
        vigencia_fim = attrs.get('vigencia_fim')
        if vigencia_inicio and vigencia_fim and vigencia_fim < vigencia_inicio:
            raise serializers.ValidationError({'vigenciaFim': 'A vigência final deve ser igual ou posterior à inicial.'})
        if self.instance and self.instance.status != STATUS_TABELA_RASCUNHO:
            bloqueados = {'config', 'faixas', 'tipo', 'codigo', 'revisao', 'vigencia_inicio', 'vigencia_fim', 'nome', 'clientes'}
            for campo in bloqueados:
                if campo in attrs:
                    raise serializers.ValidationError(
                        'Tabela publicada, expirada ou arquivada não pode ser alterada. Crie uma nova revisão.'
                    )
        if tipo == TIPO_TABELA_DISTRIBUICAO:
            attrs['config'] = merge_config(config or getattr(self.instance, 'config', None) or {})
        elif config is None and not self.instance:
            attrs['config'] = {}
        if 'clientes' in attrs:
            _validar_clientes_tabela_unica(attrs.get('clientes') or [], self.instance)
        return attrs

    def create(self, validated_data):
        clientes = validated_data.pop('clientes', [])
        tabela = TabelaFrete(**validated_data)
        tabela.regenerar_faixas()
        tabela.save()
        if clientes:
            tabela.clientes.set(clientes)
        tabela.sync_clientes_vinculo_key()
        return tabela

    def update(self, instance, validated_data):
        clientes = validated_data.pop('clientes', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if instance.tipo == TIPO_TABELA_DISTRIBUICAO:
            instance.regenerar_faixas()
        else:
            instance.faixas = []
        instance.save()
        if clientes is not None:
            instance.clientes.set(clientes)
        instance.sync_clientes_vinculo_key()
        return instance


class GeneralidadeComercialSerializer(serializers.ModelSerializer):
    rotulo = serializers.CharField(max_length=120)
    valor = serializers.CharField(required=False, allow_blank=True, max_length=800)

    class Meta:
        model = GeneralidadeComercial
        fields = ['rotulo', 'valor']


class MatrizIcmsUfSerializer(serializers.Serializer):
    ufs = serializers.ListField(child=serializers.CharField(), read_only=True)
    aliquotas = serializers.DictField(child=serializers.IntegerField(min_value=0, max_value=100))
    atualizadoEm = serializers.DateTimeField(source='atualizado_em', read_only=True)


class PropostaComercialSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    tipo = serializers.ChoiceField(choices=[c[0] for c in TIPO_PROPOSTA_CHOICES] + ['frete', 'transporte_container'])
    status = serializers.ChoiceField(choices=[c[0] for c in STATUS_PROPOSTA_CHOICES], required=False)
    clienteId = serializers.PrimaryKeyRelatedField(
        source='cliente',
        queryset=ClienteComercial.objects.all(),
        allow_null=True,
        required=False,
    )
    clienteNome = serializers.CharField(source='cliente_nome', required=False, allow_blank=True, max_length=200)
    titulo = serializers.CharField(max_length=200, required=False, allow_blank=True)
    subtitulo = serializers.CharField(required=False, allow_blank=True, max_length=240)
    revisao = serializers.CharField(required=False, allow_blank=True, max_length=10)
    dataProposta = serializers.DateField(source='data_proposta', required=False, allow_null=True)
    propostaReferente = serializers.CharField(
        source='proposta_referente',
        required=False,
        allow_blank=True,
        max_length=200,
    )
    responsavel = serializers.CharField(required=False, allow_blank=True, max_length=150)
    reajuste = serializers.CharField(required=False, allow_blank=True, max_length=200)
    att = serializers.CharField(required=False, allow_blank=True, max_length=150)
    validade = serializers.CharField(required=False, allow_blank=True, max_length=80)
    vigencia = serializers.CharField(required=False, allow_blank=True, max_length=80, label='Vigência do contrato')
    faturamento = serializers.CharField(required=False, allow_blank=True, max_length=120)
    localEmissao = serializers.CharField(source='local_emissao', required=False, allow_blank=True, max_length=120)
    valorEstimado = serializers.DecimalField(
        source='valor_estimado',
        max_digits=14,
        decimal_places=2,
        required=False,
        allow_null=True,
    )
    observacoes = serializers.CharField(required=False, allow_blank=True)
    incluiTransferencia = serializers.BooleanField(source='inclui_transferencia', required=False)
    incluiDistribuicao = serializers.BooleanField(source='inclui_distribuicao', required=False)
    condicoes = serializers.JSONField(required=False)
    linhas = PropostaFreteLinhaSerializer(many=True, required=False)
    dataCriacao = serializers.DateTimeField(source='data_criacao', read_only=True)
    dataAtualizacao = serializers.DateTimeField(source='data_atualizacao', read_only=True)
    dataVencimento = serializers.SerializerMethodField()
    numeroIdentificacao = serializers.CharField(source='numero_identificacao', read_only=True)
    numero = serializers.IntegerField(read_only=True)
    ano = serializers.IntegerField(read_only=True)
    clienteEmail = serializers.SerializerMethodField()

    class Meta:
        model = PropostaComercial
        fields = [
            'id',
            'tipo',
            'status',
            'clienteId',
            'clienteNome',
            'titulo',
            'subtitulo',
            'revisao',
            'dataProposta',
            'propostaReferente',
            'responsavel',
            'reajuste',
            'att',
            'validade',
            'vigencia',
            'faturamento',
            'localEmissao',
            'valorEstimado',
            'observacoes',
            'incluiTransferencia',
            'incluiDistribuicao',
            'condicoes',
            'linhas',
            'dataCriacao',
            'dataAtualizacao',
            'dataVencimento',
            'numeroIdentificacao',
            'numero',
            'ano',
            'clienteEmail',
        ]

    def validate_condicoes(self, value):
        if value in (None, ''):
            return None
        if not isinstance(value, list):
            raise serializers.ValidationError('Informe a lista de condições comerciais.')
        cleaned = []
        for item in value:
            if not isinstance(item, dict):
                raise serializers.ValidationError('Cada condição deve ter rótulo e valor.')
            rotulo = str(item.get('rotulo') or '').strip()
            valor = str(item.get('valor') or '').strip()
            if not rotulo and not valor:
                continue
            cleaned.append({'rotulo': rotulo, 'valor': valor})
        return cleaned

    def validate_tipo(self, value):
        if value in {'frete', 'transporte_container'}:
            return TIPO_PROPOSTA_TRANSPORTE_RODOVIARIO
        return value

    def validate(self, attrs):
        tipo = attrs.get('tipo') or (self.instance.tipo if self.instance else TIPO_PROPOSTA_TRANSPORTE_RODOVIARIO)
        if tipo in {'frete', 'transporte_container'}:
            tipo = TIPO_PROPOSTA_TRANSPORTE_RODOVIARIO
            attrs['tipo'] = tipo
        cliente_nome = (attrs.get('cliente_nome') or (self.instance.cliente_nome if self.instance else '') or '').strip()
        if not (attrs.get('titulo') or '').strip():
            servico = dict(TIPO_PROPOSTA_CHOICES).get(tipo, 'Proposta')
            attrs['titulo'] = f'{servico} — {cliente_nome}' if cliente_nome else servico

        if 'cliente' in attrs:
            cliente = attrs.get('cliente')
            attrs['att'] = (cliente.responsavel or '').strip() if cliente else ''
        elif self.instance and getattr(self.instance, 'cliente', None):
            attrs['att'] = (self.instance.cliente.responsavel or '').strip()
        return attrs

    def _save_linhas(self, proposta, linhas_data):
        proposta.linhas.all().delete()
        for index, item in enumerate(linhas_data or []):
            tarifa = item.get('tarifa_frete')
            pedagio = item.get('pedagio')
            total = None
            if tarifa is not None or pedagio is not None:
                total = (tarifa or Decimal('0')) + (pedagio or Decimal('0'))
            PropostaFreteLinha.objects.create(
                proposta=proposta,
                ordem=item.get('ordem', index),
                origem=item.get('origem') or '',
                entrega=item.get('entrega') or '',
                veiculo=item.get('veiculo') or '',
                devolucao_container=item.get('devolucao_container') or '',
                observacoes=item.get('observacoes') or '',
                peso=item.get('peso') or '',
                tarifa_frete=tarifa,
                pedagio=pedagio,
                ad_valorem=item.get('ad_valorem') or '',
                gris=item.get('gris') or '',
                icms=item.get('icms') if item.get('icms') is not None else 'Conforme legislação',
                prazo_dias=item.get('prazo_dias') or '',
                total_estimado=total,
            )

    def _sync_valor_estimado(self, proposta, valor_informado=None, linhas_aplicadas=False):
        if proposta.tipo in SERVICOS_TRANSPORTE and (linhas_aplicadas or proposta.linhas.exists()):
            total = Decimal('0')
            tem_valor = False
            for linha in proposta.linhas.all():
                if linha.total_estimado is not None:
                    total += linha.total_estimado
                    tem_valor = True
            proposta.valor_estimado = total if tem_valor else valor_informado
            proposta.save(update_fields=['valor_estimado', 'data_atualizacao'])
            return proposta
        if valor_informado is not None:
            proposta.valor_estimado = valor_informado
            proposta.save(update_fields=['valor_estimado', 'data_atualizacao'])
        return proposta

    def _aplicar_modalidades(self, validated_data, instance=None):
        tipo = validated_data.get('tipo') or (instance.tipo if instance else None)
        if tipo not in SERVICOS_TRANSPORTE:
            validated_data['inclui_transferencia'] = False
            validated_data['inclui_distribuicao'] = False
        return validated_data

    def create(self, validated_data):
        linhas_data = validated_data.pop('linhas', None)
        validated_data = self._aplicar_modalidades(validated_data)
        if not validated_data.get('condicoes'):
            validated_data['condicoes'] = default_condicoes(
                cliente=validated_data.get('cliente'),
                tipos_servico=tipos_servico_generalidade(
                    validated_data.get('tipo'),
                    validated_data.get('inclui_transferencia', False),
                    validated_data.get('inclui_distribuicao', False),
                ),
            )
        valor = validated_data.get('valor_estimado')
        proposta = PropostaComercial.objects.create(**validated_data)
        if linhas_data is not None:
            self._save_linhas(proposta, linhas_data)
        self._sync_valor_estimado(proposta, valor_informado=valor, linhas_aplicadas=linhas_data is not None)
        return proposta

    def update(self, instance, validated_data):
        linhas_data = validated_data.pop('linhas', None)
        validated_data = self._aplicar_modalidades(validated_data, instance)
        valor = validated_data.get('valor_estimado', instance.valor_estimado)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if linhas_data is not None:
            self._save_linhas(instance, linhas_data)
        self._sync_valor_estimado(instance, valor_informado=valor, linhas_aplicadas=linhas_data is not None)
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.cliente_id:
            data['clienteId'] = str(instance.cliente_id)
        else:
            data['clienteId'] = None
        data['clienteNome'] = (
            instance.cliente.razao_social
            if instance.cliente_id
            else (instance.cliente_nome or '')
        )
        data['valorEstimado'] = _money_str(instance.valor_estimado)
        if instance.cliente_id:
            data['att'] = (instance.cliente.responsavel or '').strip()
        return data

    def get_dataVencimento(self, instance):
        value = instance.data_vencimento()
        return value.isoformat() if value else None

    def get_clienteEmail(self, instance):
        return (getattr(instance.cliente, 'email', None) or '').strip().lower()

