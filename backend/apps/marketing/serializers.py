from django.contrib.auth import get_user_model

from rest_framework import serializers



from .models import (

    CAMPANHA_CANAL_VALUES,

    CAMPANHA_STATUS_CHOICES,

    CampanhaComentario,

    CampanhaMarketing,

    CampanhaMembro,

    CampanhaMidia,

)



User = get_user_model()





class UserBriefSerializer(serializers.ModelSerializer):

    googlePicture = serializers.URLField(source='google_picture_url', read_only=True)



    class Meta:

        model = User

        fields = ['id', 'name', 'googlePicture']





class CampanhaMembroSerializer(serializers.ModelSerializer):

    user = UserBriefSerializer(read_only=True)

    userId = serializers.PrimaryKeyRelatedField(

        source='user',

        queryset=User.objects.all(),

        write_only=True,

    )

    adicionadoPor = UserBriefSerializer(source='adicionado_por', read_only=True)

    dataCriacao = serializers.DateTimeField(source='data_criacao', read_only=True)



    class Meta:

        model = CampanhaMembro

        fields = ['id', 'user', 'userId', 'adicionadoPor', 'dataCriacao']

        read_only_fields = ['id', 'user', 'adicionadoPor', 'dataCriacao']





class CampanhaComentarioSerializer(serializers.ModelSerializer):

    autor = UserBriefSerializer(source='autor_user', read_only=True)

    mencoes = UserBriefSerializer(many=True, read_only=True)

    dataCriacao = serializers.DateTimeField(source='data_criacao', read_only=True)



    class Meta:

        model = CampanhaComentario

        fields = ['id', 'texto', 'autor', 'autorNome', 'mencoes', 'dataCriacao']

        read_only_fields = ['id', 'autor', 'autorNome', 'mencoes', 'dataCriacao']



    autorNome = serializers.CharField(source='autor_nome', read_only=True)





class CampanhaComentarioCreateSerializer(serializers.Serializer):

    texto = serializers.CharField(max_length=5000)

    mencoes = serializers.ListField(

        child=serializers.IntegerField(min_value=1),

        required=False,

        default=list,

    )





class CampanhaMarketingSerializer(serializers.ModelSerializer):

    dataInicio = serializers.DateField(source='data_inicio')

    dataFim = serializers.DateField(source='data_fim')

    ordemKanban = serializers.IntegerField(source='ordem_kanban', required=False)

    responsavelUserId = serializers.PrimaryKeyRelatedField(

        source='responsavel_user',

        queryset=User.objects.all(),

        allow_null=True,

        required=False,

    )

    responsavelUser = UserBriefSerializer(source='responsavel_user', read_only=True)

    criadoPorUser = UserBriefSerializer(source='criado_por_user', read_only=True)

    criadoPor = serializers.CharField(source='criado_por', read_only=True)

    dataCriacao = serializers.DateTimeField(source='data_criacao', read_only=True)

    dataAtualizacao = serializers.DateTimeField(source='data_atualizacao', read_only=True)

    comentariosCount = serializers.SerializerMethodField()

    membrosCount = serializers.SerializerMethodField()

    midiasCount = serializers.SerializerMethodField()

    canais = serializers.ListField(
        child=serializers.ChoiceField(choices=CAMPANHA_CANAL_VALUES),
        allow_empty=False,
        required=False,
    )



    class Meta:

        model = CampanhaMarketing

        fields = [

            'id',

            'titulo',

            'descricao',

            'dataInicio',

            'dataFim',

            'status',

            'canais',

            'responsavel',

            'responsavelUserId',

            'responsavelUser',

            'cor',

            'ordemKanban',

            'criadoPor',

            'criadoPorUser',

            'dataCriacao',

            'dataAtualizacao',

            'comentariosCount',

            'membrosCount',

            'midiasCount',

        ]



    def get_comentariosCount(self, obj) -> int:

        if hasattr(obj, 'comentarios_count'):

            return obj.comentarios_count

        return obj.comentarios.count()



    def get_membrosCount(self, obj) -> int:

        if hasattr(obj, 'membros_count'):

            return obj.membros_count

        return obj.membros.count()



    def get_midiasCount(self, obj) -> int:

        if hasattr(obj, 'midias_count'):

            return obj.midias_count

        return obj.midias.count()



    def validate_canais(self, value):
        if not value:
            raise serializers.ValidationError('Selecione ao menos um canal de comunicação.')
        seen = set()
        unique = []
        for canal in value:
            if canal not in seen:
                seen.add(canal)
                unique.append(canal)
        return unique



    def validate(self, attrs):

        data_inicio = attrs.get('data_inicio') or getattr(self.instance, 'data_inicio', None)

        data_fim = attrs.get('data_fim') or getattr(self.instance, 'data_fim', None)

        if data_inicio and data_fim and data_fim < data_inicio:

            raise serializers.ValidationError({'dataFim': 'A data fim não pode ser anterior à data início.'})

        if self.instance is None and 'canais' not in attrs:
            attrs['canais'] = ['evento']

        return attrs



    def _sync_responsavel_nome(self, validated_data):

        user = validated_data.get('responsavel_user')

        if user is not None:

            validated_data['responsavel'] = user.name or user.username

        return validated_data



    def create(self, validated_data):

        validated_data = self._sync_responsavel_nome(validated_data)

        return super().create(validated_data)



    def update(self, instance, validated_data):

        validated_data = self._sync_responsavel_nome(validated_data)

        return super().update(instance, validated_data)





class CampanhaMarketingDetailSerializer(CampanhaMarketingSerializer):

    comentarios = CampanhaComentarioSerializer(many=True, read_only=True)

    membros = CampanhaMembroSerializer(many=True, read_only=True)

    midias = serializers.SerializerMethodField()



    class Meta(CampanhaMarketingSerializer.Meta):

        fields = [*CampanhaMarketingSerializer.Meta.fields, 'comentarios', 'membros', 'midias']



    def get_midias(self, obj) -> list[dict]:

        request = self.context.get('request')

        if not request or not getattr(request.user, 'is_authenticated', False):

            return []

        from .campanha_midias import build_campanha_midia_payloads

        return build_campanha_midia_payloads(obj, request.user)





class CampanhaStatusMoveSerializer(serializers.Serializer):

    status = serializers.ChoiceField(choices=[c[0] for c in CAMPANHA_STATUS_CHOICES])

    ordemKanban = serializers.IntegerField(min_value=0, required=False, default=0)





class CampanhaMembroCreateSerializer(serializers.Serializer):

    userId = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source='user')





class CampanhaMembroRemoveSerializer(serializers.Serializer):

    userId = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source='user')





class CampanhaMidiaCreateSerializer(serializers.Serializer):

    driveFileId = serializers.CharField(max_length=128)



    def validate_driveFileId(self, value):

        cleaned = (value or '').strip()

        if not cleaned:

            raise serializers.ValidationError('Informe o arquivo do Drive.')

        return cleaned





class CampanhaMidiaRemoveSerializer(serializers.Serializer):

    driveFileId = serializers.CharField(max_length=128)



    def validate_driveFileId(self, value):

        cleaned = (value or '').strip()

        if not cleaned:

            raise serializers.ValidationError('Informe o arquivo do Drive.')

        return cleaned

