import re
import unicodedata
from datetime import timedelta

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone

from apps.accounts.constants import DEPARTAMENTOS_QUADRO

from .models import UsuarioMotorista

DEPARTAMENTO_MOTORISTAS = 'Motoristas'
_PARTICULAS = {'de', 'da', 'do', 'dos', 'das', 'e'}


def _token(parte: str) -> str:
    texto = unicodedata.normalize('NFD', parte)
    texto = ''.join(caractere for caractere in texto if unicodedata.category(caractere) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', texto.lower())


def partes_do_nome(nome: str) -> tuple[str, str]:
    partes = []
    for bruta in (nome or '').split():
        token = _token(bruta)
        if token and token not in _PARTICULAS:
            partes.append(token)
    if len(partes) < 2:
        raise ValueError('O nome do colaborador precisa ter nome e sobrenome para montar o usuário.')
    return partes[0], partes[-1]


def usernames_ocupados() -> set[str]:
    do_app = UsuarioMotorista.objects.values_list('username', flat=True)
    do_erp = get_user_model().objects.values_list('username', flat=True)
    return {item.lower() for item in [*do_app, *do_erp] if item}


def username_disponivel(nome: str, ocupados: set[str] | None = None) -> str:
    primeiro, ultimo = partes_do_nome(nome)
    base = f'{primeiro}.{ultimo}'
    usados = ocupados if ocupados is not None else usernames_ocupados()
    if base not in usados:
        return base
    numero = 2
    while f'{base}{numero}' in usados:
        numero += 1
    return f'{base}{numero}'


def motorista_elegivel(funcionario, filial: str) -> str | None:
    if not funcionario.ativo:
        return 'Somente colaboradores ativos podem receber usuário.'
    if (funcionario.departamento or '') != DEPARTAMENTO_MOTORISTAS:
        return 'Somente colaboradores do departamento Motoristas podem receber usuário.'
    if funcionario.filial != filial:
        return 'O colaborador não pertence à filial selecionada.'
    if DEPARTAMENTO_MOTORISTAS not in DEPARTAMENTOS_QUADRO:
        return 'Departamento de motoristas indisponível.'
    return None


def aplicar_senha(usuario: UsuarioMotorista, senha: str) -> None:
    usuario.password = make_password(senha)


TOKEN_MOTORISTA_DIAS = 7


def emitir_token_motorista(usuario: UsuarioMotorista) -> str:
    payload = {
        'tipo': 'motorista',
        'motorista_id': usuario.pk,
        'username': usuario.username,
        'exp': timezone.now() + timedelta(days=TOKEN_MOTORISTA_DIAS),
    }
    token = jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.JWT_SETTINGS.get('ALGORITHM', 'HS256'),
    )
    return token if isinstance(token, str) else token.decode()


def usuario_pelo_token(token: str) -> UsuarioMotorista:
    payload = jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.JWT_SETTINGS.get('ALGORITHM', 'HS256')],
    )
    if payload.get('tipo') != 'motorista' or not payload.get('motorista_id'):
        raise jwt.InvalidTokenError('Token de motorista inválido.')
    return (
        UsuarioMotorista.objects
        .select_related('funcionario')
        .get(pk=payload['motorista_id'])
    )


def senha_confere(usuario: UsuarioMotorista, senha: str) -> bool:
    return bool(senha) and check_password(senha, usuario.password)
