from django.contrib.auth import get_user_model
from django.db.models import Count, Prefetch, Q

from rest_framework import status, viewsets

from rest_framework.decorators import action

from rest_framework.permissions import IsAuthenticated

from rest_framework.response import Response



from apps.accounts.mixins import ModuleScopedViewMixin

from apps.accounts.permissions import ModuleAccessPermission



from .models import KANBAN_STATUSES, CampanhaComentario, CampanhaMarketing, CampanhaMembro

from .serializers import (

    CampanhaComentarioCreateSerializer,

    CampanhaComentarioSerializer,

    CampanhaMarketingDetailSerializer,

    CampanhaMarketingSerializer,

    CampanhaMembroCreateSerializer,

    CampanhaMembroRemoveSerializer,

    CampanhaMembroSerializer,

    CampanhaStatusMoveSerializer,

)

from .services import usuario_display
from .realtime import notify_marketing_changed

User = get_user_model()





def _funcao_required_response(request, funcao: str, detail: str):

    if request.user.has_funcao('Marketing', funcao):

        return None

    return Response({'detail': detail}, status=status.HTTP_403_FORBIDDEN)





_CRIAR_CAMPANHAS_DETAIL = 'Acesso negado. Solicite ao administrador a função "Criar campanhas" do Marketing.'

_EDITAR_CAMPANHAS_DETAIL = 'Acesso negado. Solicite ao administrador a função "Editar campanhas" do Marketing.'

_EXCLUIR_CAMPANHAS_DETAIL = 'Acesso negado. Solicite ao administrador a função "Excluir campanhas" do Marketing.'





def _adicionar_membro(campanha, user, adicionado_por):

    return CampanhaMembro.objects.get_or_create(

        campanha=campanha,

        user=user,

        defaults={'adicionado_por': adicionado_por},

    )





class CampanhaMarketingViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):

    permission_module = 'Marketing'

    permission_requires_filial = False

    serializer_class = CampanhaMarketingSerializer

    queryset = CampanhaMarketing.objects.all()

    http_method_names = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']



    def get_queryset(self):

        qs = CampanhaMarketing.objects.select_related(

            'responsavel_user', 'criado_por_user',

        ).annotate(

            comentarios_count=Count('comentarios'),

            membros_count=Count('membros'),

        )



        start = (self.request.query_params.get('start') or '').strip()

        end = (self.request.query_params.get('end') or '').strip()

        status_filter = (self.request.query_params.get('status') or '').strip()

        search = (self.request.query_params.get('search') or '').strip()



        if start and end:

            qs = qs.filter(data_inicio__lte=end, data_fim__gte=start)

        elif start:

            qs = qs.filter(data_fim__gte=start)

        elif end:

            qs = qs.filter(data_inicio__lte=end)



        if status_filter:

            qs = qs.filter(status=status_filter)



        if search:

            qs = qs.filter(

                Q(titulo__icontains=search)

                | Q(descricao__icontains=search)

                | Q(responsavel__icontains=search)

            )



        return qs.order_by('ordem_kanban', '-data_inicio', '-data_criacao')

    def get_object(self):
        obj = super().get_object()
        if self.action != 'retrieve':
            return obj
        return CampanhaMarketing.objects.select_related(
            'responsavel_user', 'criado_por_user',
        ).prefetch_related(
            Prefetch('comentarios', queryset=CampanhaComentario.objects.select_related('autor_user').prefetch_related('mencoes')),
            Prefetch('membros', queryset=CampanhaMembro.objects.select_related('user', 'adicionado_por')),
        ).annotate(
            comentarios_count=Count('comentarios'),
            membros_count=Count('membros'),
        ).get(pk=obj.pk)

    def get_serializer_class(self):

        if self.action == 'retrieve':

            return CampanhaMarketingDetailSerializer

        return CampanhaMarketingSerializer



    def create(self, request, *args, **kwargs):

        denied = _funcao_required_response(request, 'criar-campanhas', _CRIAR_CAMPANHAS_DETAIL)

        if denied:

            return denied

        return super().create(request, *args, **kwargs)



    def update(self, request, *args, **kwargs):

        denied = _funcao_required_response(request, 'editar-campanhas', _EDITAR_CAMPANHAS_DETAIL)

        if denied:

            return denied

        return super().update(request, *args, **kwargs)



    def partial_update(self, request, *args, **kwargs):

        denied = _funcao_required_response(request, 'editar-campanhas', _EDITAR_CAMPANHAS_DETAIL)

        if denied:

            return denied

        return super().partial_update(request, *args, **kwargs)



    def destroy(self, request, *args, **kwargs):

        denied = _funcao_required_response(request, 'excluir-campanhas', _EXCLUIR_CAMPANHAS_DETAIL)

        if denied:

            return denied

        instance = self.get_object()

        campanha_id = instance.pk

        actor_id = request.user.pk

        response = super().destroy(request, *args, **kwargs)

        notify_marketing_changed(event='deleted', campanha_id=campanha_id, actor_user_id=actor_id)

        return response



    def perform_create(self, serializer):

        user = self.request.user

        extra = {

            'criado_por': usuario_display(user),

            'criado_por_user': user,

        }

        if serializer.validated_data.get('responsavel_user') is None:

            extra['responsavel_user'] = user

            extra['responsavel'] = usuario_display(user)

        campanha = serializer.save(**extra)

        _adicionar_membro(campanha, user, user)

        if campanha.responsavel_user_id and campanha.responsavel_user_id != user.pk:

            _adicionar_membro(campanha, campanha.responsavel_user, user)

        notify_marketing_changed(event='created', campanha_id=campanha.pk, actor_user_id=user.pk)



    def perform_update(self, serializer):

        instance = self.get_object()

        old_responsavel_id = instance.responsavel_user_id

        campanha = serializer.save()

        if campanha.responsavel_user_id != old_responsavel_id and campanha.responsavel_user:

            _adicionar_membro(campanha, campanha.responsavel_user, self.request.user)

        notify_marketing_changed(

            event='updated',

            campanha_id=campanha.pk,

            actor_user_id=self.request.user.pk,

        )



    @action(detail=False, methods=['get'], url_path='quadro')

    def quadro(self, request):

        columns = {}

        base_qs = CampanhaMarketing.objects.select_related(

            'responsavel_user', 'criado_por_user',

        ).annotate(

            comentarios_count=Count('comentarios'),

            membros_count=Count('membros'),

        )

        for status_key in KANBAN_STATUSES:

            items = base_qs.filter(status=status_key).order_by('ordem_kanban', '-data_inicio')

            columns[status_key] = CampanhaMarketingSerializer(items, many=True).data

        return Response(columns)



    @action(detail=True, methods=['post'], url_path='mover-status')

    def mover_status(self, request, pk=None):

        denied = _funcao_required_response(request, 'editar-campanhas', _EDITAR_CAMPANHAS_DETAIL)

        if denied:

            return denied

        campanha = self.get_object()

        ser = CampanhaStatusMoveSerializer(data=request.data)

        ser.is_valid(raise_exception=True)

        campanha.status = ser.validated_data['status']

        campanha.ordem_kanban = ser.validated_data.get('ordemKanban', 0)

        campanha.save(update_fields=['status', 'ordem_kanban', 'data_atualizacao'])

        notify_marketing_changed(event='moved', campanha_id=campanha.pk, actor_user_id=request.user.pk)

        return Response(CampanhaMarketingSerializer(campanha).data)



    @action(detail=True, methods=['get', 'post'], url_path='membros')

    def membros(self, request, pk=None):

        campanha = self.get_object()

        if request.method == 'GET':

            items = campanha.membros.select_related('user', 'adicionado_por').order_by('data_criacao')

            return Response(CampanhaMembroSerializer(items, many=True).data)



        ser = CampanhaMembroCreateSerializer(data=request.data)

        ser.is_valid(raise_exception=True)

        target_user = ser.validated_data['user']

        membro, created = _adicionar_membro(campanha, target_user, request.user)

        if not created:

            return Response(

                {'detail': 'Usuário já faz parte da equipe desta campanha.'},

                status=status.HTTP_400_BAD_REQUEST,

            )

        notify_marketing_changed(event='membro', campanha_id=campanha.pk, actor_user_id=request.user.pk)

        return Response(CampanhaMembroSerializer(membro).data, status=status.HTTP_201_CREATED)



    @action(detail=True, methods=['post'], url_path='membros/remover')

    def remover_membro(self, request, pk=None):

        campanha = self.get_object()

        ser = CampanhaMembroRemoveSerializer(data=request.data)

        ser.is_valid(raise_exception=True)

        target_user = ser.validated_data['user']

        deleted, _ = CampanhaMembro.objects.filter(campanha=campanha, user=target_user).delete()

        if not deleted:

            return Response({'detail': 'Membro não encontrado nesta campanha.'}, status=status.HTTP_404_NOT_FOUND)

        notify_marketing_changed(event='membro', campanha_id=campanha.pk, actor_user_id=request.user.pk)

        return Response(status=status.HTTP_204_NO_CONTENT)



    @action(detail=True, methods=['post'], url_path='atribuir-me')

    def atribuir_me(self, request, pk=None):

        campanha = self.get_object()

        user = request.user

        campanha.responsavel_user = user

        campanha.responsavel = usuario_display(user)

        campanha.save(update_fields=['responsavel_user', 'responsavel', 'data_atualizacao'])

        _adicionar_membro(campanha, user, user)

        notify_marketing_changed(event='updated', campanha_id=campanha.pk, actor_user_id=user.pk)

        return Response(CampanhaMarketingSerializer(campanha).data)



    @action(detail=True, methods=['post'], url_path='participar')

    def participar(self, request, pk=None):

        campanha = self.get_object()

        membro, created = _adicionar_membro(campanha, request.user, request.user)

        if not created:

            return Response(

                {'detail': 'Você já participa desta campanha.'},

                status=status.HTTP_400_BAD_REQUEST,

            )

        notify_marketing_changed(event='membro', campanha_id=campanha.pk, actor_user_id=request.user.pk)

        return Response(CampanhaMembroSerializer(membro).data, status=status.HTTP_201_CREATED)



    @action(detail=True, methods=['get', 'post'], url_path='comentarios')

    def comentarios(self, request, pk=None):

        campanha = self.get_object()

        if request.method == 'GET':

            items = campanha.comentarios.select_related('autor_user').prefetch_related('mencoes').order_by('data_criacao')

            return Response(CampanhaComentarioSerializer(items, many=True).data)



        ser = CampanhaComentarioCreateSerializer(data=request.data)

        ser.is_valid(raise_exception=True)

        texto = ser.validated_data['texto']

        mencao_ids = ser.validated_data.get('mencoes') or []



        comentario = CampanhaComentario.objects.create(

            campanha=campanha,

            autor_user=request.user,

            autor_nome=usuario_display(request.user),

            texto=texto,

        )

        if mencao_ids:

            mencionados = list(User.objects.filter(pk__in=mencao_ids))

            comentario.mencoes.set(mencionados)

            for mencionado in mencionados:

                _adicionar_membro(campanha, mencionado, request.user)



        comentario = CampanhaComentario.objects.select_related('autor_user').prefetch_related('mencoes').get(pk=comentario.pk)

        notify_marketing_changed(event='comment', campanha_id=campanha.pk, actor_user_id=request.user.pk)

        return Response(

            CampanhaComentarioSerializer(comentario).data,

            status=status.HTTP_201_CREATED,

        )

