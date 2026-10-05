from rest_framework import serializers

from apps.camilo.catalogo import escopos_publicos, normalizar_escopos, partes_do_usuario
from apps.camilo.models import INSTRUCAO_CHAT_PADRAO, NOME_CHAT_PADRAO, Agente, ChatPadrao


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
        permitidos = {
            (item['ambiente'], item['parte'])
            for item in partes_do_usuario(self.context['request'].user)
        }
        data['escopos'] = [
            item for item in escopos_publicos(instance.escopos)
            if (item['ambiente'], item['parte']) in permitidos
        ]
        return data

    def create(self, validated_data):
        return Agente.objects.create(usuario=self.context['request'].user, **validated_data)

    def update(self, instance, validated_data):
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance


class ChatPadraoSerializer(serializers.Serializer):
    nome = serializers.CharField(max_length=80)
    instrucao = serializers.CharField(allow_blank=True, max_length=4000, required=False, default='')

    def validate_nome(self, value: str) -> str:
        nome = (value or '').strip()
        if not nome:
            raise serializers.ValidationError('Informe o nome do chat padrão.')
        return nome[:80]

    def validate_instrucao(self, value: str) -> str:
        return (value or '').strip()

    def save(self, **kwargs):
        config = ChatPadrao.atual()
        config.nome = self.validated_data['nome']
        instrucao = self.validated_data.get('instrucao') or ''
        config.instrucao = '' if instrucao == INSTRUCAO_CHAT_PADRAO else instrucao
        config.save()
        return config

    @staticmethod
    def publico(config: ChatPadrao, *, completo: bool) -> dict:
        data = {'nome': config.nome_efetivo}
        if completo:
            data['instrucao'] = config.instrucao_efetiva
            data['instrucaoPadrao'] = INSTRUCAO_CHAT_PADRAO
            data['nomePadrao'] = NOME_CHAT_PADRAO
        return data
