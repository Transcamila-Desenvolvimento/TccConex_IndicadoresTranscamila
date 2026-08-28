from rest_framework import serializers

from .cnpj_service import format_documento, only_digits
from .constants import EXPEDICAO_CHOICES
from .models import (
    ClienteProtocolo,
    FilialClienteProtocolo,
    ProtocoloEnvio,
    TIPO_PESSOA_FISICA,
    TIPO_PESSOA_JURIDICA,
    chave_texto_sem_acento,
)
from .services import gerar_numero_sequencial, separar_expedicoes, validate_protocolo_payload


class FilialClienteProtocoloSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)

    class Meta:
        model = FilialClienteProtocolo
        fields = ['id', 'nome']


class ClienteProtocoloSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='pk', read_only=True)
    codigo = serializers.CharField(required=True, allow_blank=False, max_length=20)
    loja = serializers.CharField(required=True, allow_blank=False, max_length=10)
    tipoPessoa = serializers.ChoiceField(
        source='tipo_pessoa',
        choices=[TIPO_PESSOA_JURIDICA, TIPO_PESSOA_FISICA],
        required=False,
        default=TIPO_PESSOA_JURIDICA,
    )
    municipio = serializers.CharField(required=False, allow_blank=True, max_length=150)
    padraoProtocolo = serializers.BooleanField(source='padrao_protocolo', read_only=True)
    razaoSocial = serializers.CharField(source='razao_social', required=False, allow_blank=True)
    nomeFantasia = serializers.CharField(source='nome_fantasia', required=False, allow_blank=True)
    nomeInterno = serializers.CharField(source='nome_interno', required=False, allow_blank=True)
    emitirProtocoloCanhotos = serializers.BooleanField(source='emitir_protocolo_canhotos', required=False)
    considerarPesquisaSatisfacao = serializers.BooleanField(source='considerar_pesquisa_satisfacao', required=False)
    requerExpedicao = serializers.BooleanField(source='requer_expedicao', required=False)
    exigeFilial = serializers.BooleanField(source='exige_filial', required=False)
    filiais = serializers.SerializerMethodField()
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
            'loja',
            'tipoPessoa',
            'nome',
            'razaoSocial',
            'nomeFantasia',
            'nomeInterno',
            'municipio',
            'cnpj',
            'padraoProtocolo',
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

    def get_filiais(self, obj: ClienteProtocolo):
        cache = self.context.setdefault('_filiais_grupo', {})
        codigo = obj.codigo or ''
        if codigo not in cache:
            cache[codigo] = [
                {'id': f'mun-{idx}', 'nome': nome}
                for idx, nome in enumerate(obj.municipios_do_grupo(), start=1)
            ]
        return cache[codigo]

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

        codigo = (attrs.get('codigo') if 'codigo' in attrs else getattr(self.instance, 'codigo', '') or '').strip()
        loja = (attrs.get('loja') if 'loja' in attrs else getattr(self.instance, 'loja', '01') or '01').strip()
        attrs['codigo'] = codigo
        attrs['loja'] = loja or '01'
        if not attrs['codigo']:
            raise serializers.ValidationError({'codigo': ['Informe o código do cliente.']})
        if not attrs['loja']:
            raise serializers.ValidationError({'loja': ['Informe a loja.']})

        qs = ClienteProtocolo.objects.filter(codigo=attrs['codigo'], loja=attrs['loja'])
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError({
                'loja': ['Já existe um cadastro com este código e loja.'],
            })

        tipo = attrs.get('tipo_pessoa') or getattr(self.instance, 'tipo_pessoa', TIPO_PESSOA_JURIDICA)
        attrs['tipo_pessoa'] = tipo
        if not self.instance:
            attrs.setdefault('emitir_protocolo_canhotos', False)
            attrs.setdefault('considerar_pesquisa_satisfacao', False)
        cnpj = attrs.get('cnpj', getattr(self.instance, 'cnpj', None) if self.instance and 'cnpj' not in attrs else attrs.get('cnpj'))
        if 'cnpj' in attrs:
            raw = attrs.get('cnpj') or ''
            digits = only_digits(raw, 14)
            if digits:
                expected = 11 if tipo == TIPO_PESSOA_FISICA else 14
                if len(digits) != expected:
                    campo = 'CPF' if tipo == TIPO_PESSOA_FISICA else 'CNPJ'
                    raise serializers.ValidationError({
                        'cnpj': [f'Informe um {campo} com {expected} dígitos.'],
                    })
                attrs['cnpj'] = format_documento(digits, tipo)
            else:
                attrs['cnpj'] = None

        self._validar_flag_exclusiva_no_grupo(
            attrs,
            campo='emitir_protocolo_canhotos',
            erro_key='emitirProtocoloCanhotos',
            rotulo='Emitir protocolo de canhotos',
        )
        self._validar_flag_exclusiva_no_grupo(
            attrs,
            campo='considerar_pesquisa_satisfacao',
            erro_key='considerarPesquisaSatisfacao',
            rotulo='Considerar pesquisa de satisfação',
        )
        return attrs

    def _validar_flag_exclusiva_no_grupo(self, attrs, *, campo: str, erro_key: str, rotulo: str):
        codigo = attrs.get('codigo') or ''
        if not codigo:
            return
        ativo = attrs.get(campo, getattr(self.instance, campo, False) if self.instance else False)
        if not ativo:
            return
        qs = ClienteProtocolo.objects.filter(codigo=codigo, **{campo: True})
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        outra = qs.order_by('loja', 'pk').first()
        if outra:
            raise serializers.ValidationError({
                erro_key: [
                    f'{rotulo} já está ativo na loja {outra.loja}. '
                    f'Desative nessa loja para ativar nesta.'
                ],
            })

    def create(self, validated_data):
        nomes = validated_data.pop('filiaisIniciais', [])
        codigo = validated_data.get('codigo')
        if codigo:
            irmao = ClienteProtocolo.objects.filter(codigo=codigo).order_by('pk').first()
            if irmao:
                validated_data['requer_expedicao'] = irmao.requer_expedicao
                validated_data['exige_filial'] = irmao.exige_filial
        cliente = super().create(validated_data)
        vistos = set()
        for nome in nomes:
            nome = (nome or '').strip()
            if nome and nome.lower() not in vistos:
                vistos.add(nome.lower())
                FilialClienteProtocolo.objects.create(cliente=cliente, nome=nome)
        return cliente

    def update(self, instance, validated_data):
        from apps.sgq.clientes_cadastro import _nomes_cadastro, sincronizar_cliente_pesquisas

        aliases_anteriores = _nomes_cadastro(instance)
        validated_data.pop('filiaisIniciais', None)
        cliente = super().update(instance, validated_data)
        sincronizar_cliente_pesquisas(cliente, aliases_anteriores)
        grupo_flags = {}
        for campo in ('requer_expedicao', 'exige_filial'):
            if campo in validated_data:
                grupo_flags[campo] = getattr(cliente, campo)
        if grupo_flags and cliente.codigo:
            ClienteProtocolo.objects.filter(codigo=cliente.codigo).exclude(pk=cliente.pk).update(**grupo_flags)
        return cliente


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
                permitidas = {}
                for nome in cliente.municipios_do_grupo():
                    permitidas[nome.casefold()] = nome
                    permitidas[chave_texto_sem_acento(nome)] = nome
                if not permitidas:
                    raise serializers.ValidationError(
                        'Cadastre o município nas lojas deste código para exigir filial no protocolo.'
                    )
                sem_filial = []
                normalizadas = {}
                for nf in nfs:
                    raw = (notas_filiais.get(nf) or '').strip()
                    if not raw:
                        sem_filial.append(nf)
                        continue
                    oficial = permitidas.get(raw.casefold()) or permitidas.get(chave_texto_sem_acento(raw))
                    if not oficial:
                        raise serializers.ValidationError(
                            f'O município "{raw}" não pertence aos cadastros do cliente {cliente.codigo}.'
                        )
                    normalizadas[nf] = oficial
                if sem_filial:
                    raise serializers.ValidationError(
                        f'As seguintes NFs não têm município associado: {", ".join(sem_filial)}'
                    )
                attrs['notas_filiais'] = normalizadas

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
