from rest_framework import serializers

from .models import Notificacao


class NotificacaoSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    lida = serializers.SerializerMethodField()
    lidaEm = serializers.DateTimeField(source='lida_em', read_only=True)
    criadaEm = serializers.DateTimeField(source='criada_em', read_only=True)

    class Meta:
        model = Notificacao
        fields = ['id', 'ambiente', 'tipo', 'titulo', 'mensagem', 'link', 'lida', 'lidaEm', 'criadaEm']
        read_only_fields = fields

    def get_lida(self, instance):
        return instance.lida_em is not None


class PushInscricaoKeysSerializer(serializers.Serializer):
    p256dh = serializers.CharField(max_length=200)
    auth = serializers.CharField(max_length=100)


class PushInscricaoSerializer(serializers.Serializer):
    """Formato do `PushSubscription.toJSON()` do navegador."""

    endpoint = serializers.URLField(max_length=1000)
    keys = PushInscricaoKeysSerializer()

    def validate_endpoint(self, value):
        if not value.startswith('https://'):
            raise serializers.ValidationError('Endpoint de push inválido.')
        return value
