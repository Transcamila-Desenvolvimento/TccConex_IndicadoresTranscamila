from django.contrib.auth import get_user_model
from rest_framework import serializers

from .constants import ADMIN_ENVIRONMENT, sanitize_environments, sanitize_filiais, sanitize_permissions
from .models import Role

User = get_user_model()


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'permissions']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['permissions'] = sanitize_permissions(data.get('permissions'))
        return data


def _apply_environment_rules(user):
    """Sanitiza ambientes/filiais e garante que administradores sempre
    mantenham acesso ao ambiente de Administração/Manutenção, mesmo que
    tenham escolhido um conjunto customizado de módulos operacionais."""
    user.environments = sanitize_environments(user.environments)
    user.filiais = sanitize_filiais(user.filiais)
    if user.role_id == '1' and ADMIN_ENVIRONMENT not in user.environments:
        user.environments = [*user.environments, ADMIN_ENVIRONMENT]


class UserSerializer(serializers.ModelSerializer):
    roleId = serializers.CharField(source='role_id')
    lastLogin = serializers.DateTimeField(source='last_login', read_only=True)
    googleEmail = serializers.EmailField(source='google_email', read_only=True)
    googleLinkedAt = serializers.DateTimeField(source='google_linked_at', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'name', 'roleId', 'status',
            'environments', 'filiais', 'lastLogin',
            'googleEmail', 'googleLinkedAt',
        ]
        read_only_fields = ['id', 'lastLogin', 'googleEmail', 'googleLinkedAt']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['environments'] = sanitize_environments(data.get('environments'))
        data['filiais'] = sanitize_filiais(data.get('filiais'))
        return data


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class CreateUserSerializer(serializers.ModelSerializer):
    roleId = serializers.CharField(source='role_id', required=False, default='2')
    password = serializers.CharField(required=True, write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'roleId', 'status', 'environments', 'filiais', 'password']
        read_only_fields = ['id']

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Nome de usuário já existe.")
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')

        user = User.objects.create(**validated_data)
        user.set_password(password)

        _apply_environment_rules(user)

        user.save()
        return user


class UpdateUserSerializer(serializers.ModelSerializer):
    roleId = serializers.CharField(source='role_id', required=False)
    password = serializers.CharField(required=False, write_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'roleId', 'status', 'environments', 'filiais', 'password']
        read_only_fields = ['id', 'username']

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        _apply_environment_rules(instance)

        instance.save()
        return instance
