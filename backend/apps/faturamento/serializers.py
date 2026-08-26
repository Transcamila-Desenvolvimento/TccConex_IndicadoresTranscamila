from rest_framework import serializers

from .constants import EXPEDICAO_CHOICES
from .models import ClienteProtocolo, FilialClienteProtocolo, ProtocoloEnvio
from .services import gerar_numero_sequencial, separar_expedicoes, validate_protocolo_payload


class FilialClienteProtocoloSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)

    class Meta:
        model = FilialClienteProtocolo
        fields = ['id', 'nome']


class ClienteProtocoloSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    codigo = serializers.CharField(read_only=True)
    razaoSocial = serializers.CharField(source='razao_social', required=False, allow_blank=True)
    nomeFantasia = serializers.CharField(source='nome_fantasia', required=False, allow_blank=True)
    nomeInterno = serializers.CharField(source='nome_interno', required=False, allow_blank=True)
    emitirProtocoloCanhotos = serializers.BooleanField(source='emitir_protocolo_canhotos', required=False)
    considerarPesquisaSatisfacao = serializers.BooleanField(source='considerar_pesquisa_satisfacao', required=False)
    requerExpedicao = serializers.BooleanField(source='requer_expedicao', required=False)
    exigeFilial = serializers.BooleanField(source='exige_filial', required=False)
    filiais = FilialClienteProtocoloSerializer(many=True, read_only=True)
    # Usado apenas na criação: permite cadastrar as filiais junto com o cliente,
    # já que FilialClienteProtocolo exige um cliente_id que só existe após o save.
    filiaisIniciais = serializers.ListField(
        child=serializers.CharField(max_length=150, allow_blank=False),
        write_only=True,
        required=False,
        default=list,
    )
    emailsEnvio = serializers.CharField(source='emails_envio', allow_blank=True, required=False)
    emailsCopia = serializers.CharField(source='emails_copia', allow_blank=True, required=False)
    dataCriacao = serializers.DateTimeField(source='data_criacao', read_only=True)
    dataAtualizacao = serializers.DateTimeField(source='data_atualizacao', read_only=True)

    class Meta:
        model = ClienteProtocolo
        fields = [
            'id',
            'codigo',
            'nome',
            'razaoSocial',
            'nomeFantasia',
            'nomeInterno',
            'cnpj',
            'emitirProtocoloCanhotos',
            'considerarPesquisaSatisfacao',
            'requerExpedicao',
            'exigeFilial',
            'filiais',
            'filiaisIniciais',
            'emailsEnvio',
            'emailsCopia',
            'dataCriacao',
            'dataAtualizacao',
        ]
        extra_kwargs = {'nome': {'required': False, 'allow_blank': True}}

    def validate(self, attrs):
        razao = (attrs.get('razao_social') or getattr(self.instance, 'razao_social', '') or '').strip()
        interno = (attrs.get('nome_interno') or getattr(self.instance, 'nome_interno', '') or '').strip()
        nome = (attrs.get('nome') or getattr(self.instance, 'nome', '') or '').strip()
        if not (interno or razao or nome):
            raise serializers.ValidationError({
                'razaoSocial': ['Informe a razão social ou o nome interno.'],
            })
        attrs['razao_social'] = razao or interno or nome
        attrs['nome_interno'] = interno or razao or nome
        attrs['nome'] = attrs['nome_interno']
        return attrs

    def create(self, validated_data):
        nomes = validated_data.pop('filiaisIniciais', [])
        cliente = super().create(validated_data)
        vistos = set()
        for nome in nomes:
            nome = (nome or '').strip()
            if nome and nome.lower() not in vistos:
                vistos.add(nome.lower())
                FilialClienteProtocolo.objects.create(cliente=cliente, nome=nome)
        return cliente

    def update(self, instance, validated_data):
        # filiaisIniciais é usado apenas na criação; edições de filiais passam
        # pelo endpoint dedicado (FilialClienteProtocoloViewSet).
        validated_data.pop('filiaisIniciais', None)
        return super().update(instance, validated_data)


class ProtocoloEnvioSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    clienteId = serializers.PrimaryKeyRelatedField(
        source='cliente',
        queryset=ClienteProtocolo.objects.all(),
        write_only=True,
    )
    clienteIdReadOnly = serializers.CharField(source='cliente.pk', read_only=True)
    clienteNome = serializers.CharField(source='cliente.nome', read_only=True)
    clienteCnpj = serializers.CharField(source='cliente.cnpj', read_only=True)
    notaFiscal = serializers.CharField(source='nota_fiscal')
    usuarioNome = serializers.CharField(source='usuario_nome', read_only=True)
    dataCriacao = serializers.DateTimeField(source='data_criacao', read_only=True)
    dataAtualizacao = serializers.DateTimeField(source='data_atualizacao', read_only=True)
    protocoloNumero = serializers.SerializerMethodField()
    notasFiscais = serializers.SerializerMethodField()
    notasFiliais = serializers.JSONField(source='notas_filiais', required=False, default=dict)
    # Lista das expedições selecionadas (derivada do valor combinado em `expedicao`),
    # usada pelo frontend para pré-carregar a seleção ao editar um protocolo.
    expedicoes = serializers.SerializerMethodField()

    class Meta:
        model = ProtocoloEnvio
        fields = [
            'id',
            'protocoloNumero',
            'data',
            'clienteId',
            'clienteIdReadOnly',
            'clienteNome',
            'clienteCnpj',
            'notaFiscal',
            'notasFiscais',
            'notasFiliais',
            'expedicao',
            'expedicoes',
            'usuarioNome',
            'dataCriacao',
            'dataAtualizacao',
        ]
        read_only_fields = ['expedicao']

    def get_protocoloNumero(self, obj: ProtocoloEnvio) -> str:
        return f'{obj.data.year}-{obj.numero_sequencial:04d}'

    def get_notasFiscais(self, obj: ProtocoloEnvio) -> list[str]:
        return [nf.strip() for nf in obj.nota_fiscal.split(',') if nf.strip()]

    def get_expedicoes(self, obj: ProtocoloEnvio) -> list[str]:
        return separar_expedicoes(obj.expedicao)

    def validate(self, attrs):
        cliente = attrs.get('cliente') or getattr(self.instance, 'cliente', None)
        nota_fiscal = attrs.get('nota_fiscal')
        expedicoes = attrs.pop('expedicoes', None)
        notas_filiais = attrs.get('notas_filiais', {})

        if cliente and nota_fiscal is not None:
            try:
                nota_fiscal_normalizada, expedicao_combinada = validate_protocolo_payload(
                    cliente=cliente,
                    expedicoes=expedicoes,
                    nota_fiscal=nota_fiscal,
                    protocolo_atual_id=getattr(self.instance, 'pk', None),
                )
            except ValueError as exc:
                raise serializers.ValidationError(str(exc))
            attrs['nota_fiscal'] = nota_fiscal_normalizada
            attrs['expedicao'] = expedicao_combinada or None

            if cliente.exige_filial:
                nfs = [nf.strip() for nf in attrs['nota_fiscal'].split(',') if nf.strip()]
                sem_filial = [nf for nf in nfs if not notas_filiais.get(nf)]
                if sem_filial:
                    raise serializers.ValidationError(
                        f'As seguintes NFs não têm filial associada: {", ".join(sem_filial)}'
                    )

        return attrs


class ProtocoloEnvioCreateSerializer(ProtocoloEnvioSerializer):
    expedicoes = serializers.ListField(
        child=serializers.ChoiceField(choices=EXPEDICAO_CHOICES),
        required=False,
        default=list,
        write_only=True,
    )

    class Meta(ProtocoloEnvioSerializer.Meta):
        read_only_fields = ['expedicao']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        cliente = attrs.get('cliente')
        if cliente and not cliente.emitir_protocolo_canhotos:
            raise serializers.ValidationError({
                'clienteId': ['Este cliente não está habilitado para emitir protocolo de canhotos.'],
            })
        return attrs

    def create(self, validated_data):
        # Cada cliente tem sua própria sequência numérica de protocolos.
        validated_data['numero_sequencial'] = gerar_numero_sequencial(validated_data['cliente'])
        return super().create(validated_data)


class ProtocoloEnvioUpdateSerializer(ProtocoloEnvioSerializer):
    expedicoes = serializers.ListField(
        child=serializers.ChoiceField(choices=EXPEDICAO_CHOICES),
        required=False,
        default=list,
        write_only=True,
    )
    clienteId = serializers.PrimaryKeyRelatedField(
        source='cliente',
        queryset=ClienteProtocolo.objects.all(),
        required=False,
    )
    notaFiscal = serializers.CharField(source='nota_fiscal', required=False)

    class Meta(ProtocoloEnvioSerializer.Meta):
        read_only_fields = ['expedicao']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        cliente = attrs.get('cliente') or getattr(self.instance, 'cliente', None)
        atual_id = getattr(getattr(self.instance, 'cliente', None), 'pk', None)
        if cliente and not cliente.emitir_protocolo_canhotos and cliente.pk != atual_id:
            raise serializers.ValidationError({
                'clienteId': ['Este cliente não está habilitado para emitir protocolo de canhotos.'],
            })
        return attrs


class ProtocoloBulkDeleteSerializer(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )
