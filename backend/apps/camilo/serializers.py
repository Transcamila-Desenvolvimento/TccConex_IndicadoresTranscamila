from rest_framework import serializers

from apps.camilo.catalogo import escopos_publicos, normalizar_escopos
from apps.camilo.models import Agente


class AgenteSerializer(serializers.ModelSerializer):
    criadoEm = serializers.DateTimeField(source='criado_em', read_only=True)
    escopos = serializers.ListField(child=serializers.DictField(), required=True)

    class Meta:
        model = Agente
        fields = ['id', 'nome', 'instrucao', 'escopos', 'criadoEm']

    def validate_nome(self, value: str) -> str:
        nome = (value or '').strip()
        if not nome:
            raise serializers.ValidationError('Informe o nome do agente.')
        return nome

    def validate_instrucao(self, value: str) -> str:
        return (value or '').strip()

    def validate_escopos(self, value):
        user = self.context['request'].user
        recebidos = len(value or [])
        validos = normalizar_escopos(user, value)
        if recebidos and len(validos) != recebidos:
            raise serializers.ValidationError('Há partes fora do seu acesso ou desconhecidas.')
        if not validos:
            raise serializers.ValidationError('Escolha ao menos uma parte que você pode consultar.')
        return validos

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['id'] = str(instance.id)
        data['escopos'] = escopos_publicos(instance.escopos)
        return data

    def create(self, validated_data):
        return Agente.objects.create(usuario=self.context['request'].user, **validated_data)

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
