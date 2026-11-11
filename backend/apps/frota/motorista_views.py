import jwt
from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.accounts.permissions import allowed_filiais_for_module, get_request_context, resolve_filial_name
from apps.audit.services import record_audit
from apps.rh.models import FuncionarioQuadro

from .models import UsuarioMotorista
from .motoristas import (
    DEPARTAMENTO_MOTORISTAS,
    aplicar_senha,
    emitir_token_motorista,
    motorista_elegivel,
    partes_do_nome,
    senha_confere,
    username_disponivel,
    usuario_pelo_token,
    usernames_ocupados,
)


class MotoristaPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


def _funcao_required_response(request, funcao: str, detail: str):
    if request.user.has_funcao('Frota', funcao, _filial_da_sessao(request)):
        return None
    return Response({'detail': detail}, status=status.HTTP_403_FORBIDDEN)


_EXCLUIR_USUARIO_DETAIL = (
    'Acesso negado. Solicite ao administrador a função "Excluir usuários" de TccConex motoristas.'
)


def _filial_da_sessao(request) -> str:
    _, filial = get_request_context(request)
    permitidas = allowed_filiais_for_module(request.user, 'Frota')
    return resolve_filial_name(filial, permitidas) or ''


def _usuario_payload(usuario: UsuarioMotorista) -> dict:
    funcionario = usuario.funcionario
    return {
        'id': str(usuario.pk),
        'funcionarioId': str(funcionario.pk),
        'nomeCompleto': funcionario.nome,
        'cpf': funcionario.cpf,
        'cargo': funcionario.cargo,
        'filial': funcionario.filial,
        'dataAdmissao': funcionario.data_admissao.isoformat() if funcionario.data_admissao else '',
        'username': usuario.username,
        'ativo': funcionario.ativo,
    }


def _elegivel_payload(funcionario: FuncionarioQuadro, ocupados: set[str]) -> dict:
    username = username_disponivel(funcionario.nome, ocupados)
    ocupados.add(username)
    return {
        'id': str(funcionario.pk),
        'nomeCompleto': funcionario.nome,
        'cpf': funcionario.cpf,
        'cargo': funcionario.cargo,
        'username': username,
    }


def _senha_invalida(senha: str) -> str | None:
    if len(senha or '') < 6:
        return 'A senha precisa ter pelo menos 6 caracteres.'
    return None


class UsuariosMotoristaView(ModuleScopedViewMixin, APIView):
    permission_module = 'Frota'
    permission_aba = 'tccconex-motoristas-usuarios'
    pagination_class = MotoristaPagination

    def get(self, request):
        filial = _filial_da_sessao(request)
        busca = (request.query_params.get('search') or '').strip()
        status = (request.query_params.get('status') or '').strip()
        qs = (
            UsuarioMotorista.objects
            .select_related('funcionario')
            .filter(funcionario__filial=filial)
        )
        if status == 'ativo':
            qs = qs.filter(funcionario__ativo=True)
        elif status == 'inativo':
            qs = qs.filter(funcionario__ativo=False)
        if busca:
            qs = qs.filter(
                Q(funcionario__nome__icontains=busca)
                | Q(username__icontains=busca)
                | Q(funcionario__cpf__icontains=busca)
                | Q(funcionario__cargo__icontains=busca)
            )
        pagina = self.pagination_class()
        page = pagina.paginate_queryset(qs.order_by('funcionario__nome'), request, view=self)
        return pagina.get_paginated_response([_usuario_payload(item) for item in page])

    def post(self, request):
        negado = _funcao_required_response(
            request,
            'criar-usuarios-motorista',
            'Acesso negado. Solicite ao administrador a função "Criar e redefinir senha" de TccConex motoristas.',
        )
        if negado:
            return negado
        filial = _filial_da_sessao(request)
        funcionario_id = request.data.get('funcionarioId')
        senha = request.data.get('password') or ''
        erro_senha = _senha_invalida(senha)
        if erro_senha:
            return Response({'password': erro_senha}, status=status.HTTP_400_BAD_REQUEST)
        try:
            funcionario = FuncionarioQuadro.objects.get(pk=funcionario_id)
        except (FuncionarioQuadro.DoesNotExist, ValueError, TypeError):
            return Response({'funcionarioId': 'Selecione um motorista.'}, status=status.HTTP_400_BAD_REQUEST)
        motivo = motorista_elegivel(funcionario, filial)
        if motivo:
            return Response({'funcionarioId': motivo}, status=status.HTTP_400_BAD_REQUEST)
        if UsuarioMotorista.objects.filter(funcionario=funcionario).exists():
            return Response({'funcionarioId': 'Este motorista já possui usuário.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            partes_do_nome(funcionario.nome)
        except ValueError as exc:
            return Response({'funcionarioId': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                username = username_disponivel(funcionario.nome)
                usuario = UsuarioMotorista(
                    funcionario=funcionario,
                    username=username,
                    criado_por=request.user if request.user.is_authenticated else None,
                )
                aplicar_senha(usuario, senha)
                usuario.save()
        except IntegrityError:
            return Response({'username': 'Não foi possível montar um usuário disponível.'}, status=status.HTTP_400_BAD_REQUEST)

        record_audit(
            request.user,
            'frota.motorista.usuario_criado',
            f'Usuário {usuario.username} criado para {funcionario.nome} ({filial}).',
        )
        return Response(_usuario_payload(usuario), status=status.HTTP_201_CREATED)


class UsuarioMotoristaSenhaView(ModuleScopedViewMixin, APIView):
    permission_module = 'Frota'
    permission_aba = 'tccconex-motoristas-usuarios'

    def patch(self, request, pk):
        negado = _funcao_required_response(
            request,
            'criar-usuarios-motorista',
            'Acesso negado. Solicite ao administrador a função "Criar e redefinir senha" de TccConex motoristas.',
        )
        if negado:
            return negado
        filial = _filial_da_sessao(request)
        try:
            usuario = UsuarioMotorista.objects.select_related('funcionario').get(pk=pk, funcionario__filial=filial)
        except (UsuarioMotorista.DoesNotExist, ValueError, TypeError):
            return Response({'detail': 'Usuário não encontrado nesta filial.'}, status=status.HTTP_404_NOT_FOUND)
        senha = request.data.get('password') or ''
        erro_senha = _senha_invalida(senha)
        if erro_senha:
            return Response({'password': erro_senha}, status=status.HTTP_400_BAD_REQUEST)
        aplicar_senha(usuario, senha)
        usuario.save(update_fields=['password'])
        record_audit(
            request.user,
            'frota.motorista.senha_definida',
            f'Senha do usuário {usuario.username} redefinida.',
        )
        return Response(_usuario_payload(usuario))


class UsuarioMotoristaExcluirView(ModuleScopedViewMixin, APIView):
    permission_module = 'Frota'
    permission_aba = 'tccconex-motoristas-usuarios'

    def delete(self, request, pk):
        negado = _funcao_required_response(request, 'excluir-usuarios-motorista', _EXCLUIR_USUARIO_DETAIL)
        if negado:
            return negado
        filial = _filial_da_sessao(request)
        try:
            usuario = UsuarioMotorista.objects.select_related('funcionario').get(pk=pk, funcionario__filial=filial)
        except (UsuarioMotorista.DoesNotExist, ValueError, TypeError):
            return Response({'detail': 'Usuário não encontrado nesta filial.'}, status=status.HTTP_404_NOT_FOUND)
        username = usuario.username
        nome = usuario.funcionario.nome
        usuario.delete()
        record_audit(
            request.user,
            'frota.motorista.usuario_excluido',
            f'Usuário {username} de {nome} ({filial}) excluído do aplicativo.',
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class MotoristasElegiveisView(ModuleScopedViewMixin, APIView):
    permission_module = 'Frota'
    permission_aba = 'tccconex-motoristas-usuarios'

    def get(self, request):
        filial = _filial_da_sessao(request)
        funcionarios = (
            FuncionarioQuadro.objects
            .filter(
                filial=filial,
                ativo=True,
                departamento=DEPARTAMENTO_MOTORISTAS,
                usuario_motorista__isnull=True,
            )
            .order_by('nome')
        )
        ocupados = usernames_ocupados()
        return Response([_elegivel_payload(funcionario, ocupados) for funcionario in funcionarios])


def _token_do_pedido(request) -> str:
    cabecalho = request.headers.get('Authorization') or ''
    partes = cabecalho.split()
    if len(partes) == 2 and partes[0].lower() == 'bearer':
        return partes[1]
    return ''


class MotoristaLoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        username = str(request.data.get('username') or '').strip()
        senha = str(request.data.get('password') or '')
        if not username or not senha:
            return Response({'detail': 'Informe o usuário e a senha.'}, status=status.HTTP_400_BAD_REQUEST)
        usuario = (
            UsuarioMotorista.objects
            .select_related('funcionario')
            .filter(username__iexact=username)
            .first()
        )
        if usuario is None or not senha_confere(usuario, senha):
            return Response(
                {'detail': 'Usuário ou senha incorretos.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if not usuario.funcionario.ativo:
            return Response(
                {'detail': 'Este usuário foi desativado.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        record_audit(
            None,
            'frota.motorista.login',
            f'Login do motorista {usuario.username} no aplicativo.',
        )
        return Response({
            'token': emitir_token_motorista(usuario),
            'motorista': _usuario_payload(usuario),
        })


class MotoristaEuView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        token = _token_do_pedido(request)
        if not token:
            return Response({'detail': 'Faça login novamente.'}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            usuario = usuario_pelo_token(token)
        except (jwt.PyJWTError, UsuarioMotorista.DoesNotExist):
            return Response({'detail': 'Faça login novamente.'}, status=status.HTTP_401_UNAUTHORIZED)
        if not usuario.funcionario.ativo:
            return Response({'detail': 'Este usuário foi desativado.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(_usuario_payload(usuario))
