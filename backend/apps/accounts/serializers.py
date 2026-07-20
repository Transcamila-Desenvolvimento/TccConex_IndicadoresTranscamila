from django.contrib.auth import get_user_model
from rest_framework import serializers

from .constants import (
    ADMIN_ENVIRONMENT,
    sanitize_environments,
    sanitize_filiais,
    sanitize_funcoes,
    sanitize_indicadores,
    sanitize_permissions,
)
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
    user.indicadores = sanitize_indicadores(user.indicadores)
    user.funcoes = sanitize_funcoes(user.funcoes)
    if user.role_id == '1' and ADMIN_ENVIRONMENT not in user.environments:
        user.environments = [*user.environments, ADMIN_ENVIRONMENT]


class UserSerializer(serializers.ModelSerializer):
    roleId = serializers.CharField(source='role_id')
    lastLogin = serializers.DateTimeField(source='last_login', read_only=True)
    googleEmail = serializers.EmailField(source='google_email', read_only=True)
    googleLinkedAt = serializers.DateTimeField(source='google_linked_at', read_only=True)
    mustChangePassword = serializers.BooleanField(source='must_change_password', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'name', 'roleId', 'status',
            'environments', 'filiais', 'indicadores', 'funcoes', 'lastLogin',
            'googleEmail', 'googleLinkedAt', 'mustChangePassword',
        ]
        read_only_fields = [
            'id', 'lastLogin', 'googleEmail', 'googleLinkedAt', 'mustChangePassword',
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['environments'] = sanitize_environments(data.get('environments'))
        data['filiais'] = sanitize_filiais(data.get('filiais'))
        data['indicadores'] = sanitize_indicadores(data.get('indicadores'))
        data['funcoes'] = sanitize_funcoes(data.get('funcoes'))
        return data


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class CreateUserSerializer(serializers.ModelSerializer):
    roleId = serializers.CharField(source='role_id', required=False, default='2')
    password = serializers.CharField(required=True, write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'roleId', 'status', 'environments', 'filiais', 'indicadores', 'funcoes', 'password']
        read_only_fields = ['id']

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Nome de usuário já existe.")
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')

        user = User.objects.create(**validated_data)
        user.set_password(password)
        # Senha definida pelo admin: exige troca no próximo acesso.
        user.must_change_password = True

        _apply_environment_rules(user)

        user.save()
        return user


class UpdateUserSerializer(serializers.ModelSerializer):
    roleId = serializers.CharField(source='role_id', required=False)
    password = serializers.CharField(required=False, write_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'roleId', 'status', 'environments', 'filiais', 'indicadores', 'funcoes', 'password']
        read_only_fields = ['id', 'username']

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)
            instance.must_change_password = True

        _apply_environment_rules(instance)

        instance.save()
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    currentPassword = serializers.CharField(required=True, write_only=True)
    newPassword = serializers.CharField(required=True, write_only=True, min_length=6)
    confirmPassword = serializers.CharField(required=True, write_only=True, min_length=6)

    def validate(self, attrs):
        if attrs['newPassword'] != attrs['confirmPassword']:
            raise serializers.ValidationError({'confirmPassword': 'As senhas não coincidem.'})
        if attrs['currentPassword'] == attrs['newPassword']:
            raise serializers.ValidationError({'newPassword': 'A nova senha deve ser diferente da atual.'})
        return attrs
