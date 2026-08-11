from collections import Counter

from django.db import transaction
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.accounts.permissions import (
    allowed_filiais_for_module,
    get_request_context,
    resolve_filial_name,
)
from apps.audit.services import record_audit
from apps.financeiro.pagination import ReportPagination

from .lote_draft import draft_payload, has_meaningful_draft, sanitize_draft_rows
from .models import PesquisaSatisfacao, PesquisaSatisfacaoLoteDraft
from .pesquisa_import_service import (
    PesquisaImportError,
    build_pesquisa_import_template,
    import_pesquisas_from_spreadsheet,
    preview_pesquisas_from_spreadsheet,
)
from .pesquisa_query import filter_pesquisas_queryset
from .serializers import PesquisaSatisfacaoSerializer
from .stats_service import build_pesquisa_stats


def _usuario_display(user) -> str:
    if not user or not user.is_authenticated:
        return ''
    return user.name or user.get_full_name() or user.username


def _funcao_required_response(request, funcao: str, detail: str):
    """Nega o acesso a operadores sem a função liberada (admin sempre pode)."""
    if request.user.has_funcao('SGQ', funcao):
        return None
    return Response({'detail': detail}, status=status.HTTP_403_FORBIDDEN)


_CRIAR_PESQUISAS_DETAIL = (
    'Acesso negado. Solicite ao administrador a função "Criar pesquisas" do SGQ.'
)
_EDITAR_PESQUISAS_DETAIL = (
    'Acesso negado. Solicite ao administrador a função "Editar pesquisas" do SGQ.'
)
_EXCLUIR_PESQUISAS_DETAIL = (
    'Acesso negado. Solicite ao administrador a função "Excluir pesquisas" do SGQ.'
)
_IMPORTAR_PESQUISAS_DETAIL = (
    'Acesso negado. Solicite ao administrador a função "Importar pesquisas" do SGQ.'
)


class PesquisaSatisfacaoViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'SGQ'
    serializer_class = PesquisaSatisfacaoSerializer
    queryset = PesquisaSatisfacao.objects.all()
    pagination_class = ReportPagination
    http_method_names = ['get', 'post', 'patch', 'put', 'delete', 'head', 'options']

    def get_queryset(self):
        # admin_bypass=False: pesquisas do SGQ ficam sempre segregadas por filial,
        # sem visão consolidada — nem mesmo para admin.
        qs = self.scope_queryset(self.queryset, filial_field='filial', admin_bypass=False)
        return filter_pesquisas_queryset(qs, self.request.query_params)

    def _session_filial(self) -> str:
        _, filial = get_request_context(self.request)
        allowed = allowed_filiais_for_module(self.request.user, 'SGQ')
        return resolve_filial_name(filial, allowed) or filial

    def create(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'criar-pesquisas', _CRIAR_PESQUISAS_DETAIL)
        if denied:
            return denied
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'editar-pesquisas', _EDITAR_PESQUISAS_DETAIL)
        if denied:
            return denied
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'editar-pesquisas', _EDITAR_PESQUISAS_DETAIL)
        if denied:
            return denied
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = _funcao_required_response(request, 'excluir-pesquisas', _EXCLUIR_PESQUISAS_DETAIL)
        if denied:
            return denied
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        pesquisa = serializer.save(
            criado_por=_usuario_display(self.request.user),
            filial=self._session_filial(),
        )
        record_audit(
            self.request.user,
            'sgq.pesquisa.criada',
            f'Pesquisa de satisfação #{pesquisa.pk} ({pesquisa.cliente}, CT-e {pesquisa.cte}) registrada.',
        )

    def perform_update(self, serializer):
        pesquisa = serializer.save()
        record_audit(
            self.request.user,
            'sgq.pesquisa.atualizada',
            f'Pesquisa de satisfação #{pesquisa.pk} ({pesquisa.cliente}, CT-e {pesquisa.cte}) atualizada.',
        )

    def perform_destroy(self, instance):
        record_audit(
            self.request.user,
            'sgq.pesquisa.excluida',
            f'Pesquisa de satisfação #{instance.pk} ({instance.cliente}, CT-e {instance.cte}) excluída.',
        )
        instance.delete()

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Cria várias pesquisas de uma vez (Inclusão em Tabela). Tudo ou nada:
        se qualquer linha for inválida, nada é salvo e os erros voltam indexados
        por linha para o frontend destacar os campos problemáticos."""
        denied = _funcao_required_response(request, 'criar-pesquisas', _CRIAR_PESQUISAS_DETAIL)
        if denied:
            return denied

        items = request.data if isinstance(request.data, list) else request.data.get('items', [])
        if not items:
            return Response({'errors': {'0': {'non_field_errors': ['Nenhuma pesquisa informada.']}}}, status=400)

        valid_serializers = []
        errors = {}
        for idx, item in enumerate(items):
            serializer = PesquisaSatisfacaoSerializer(data=item)
            if serializer.is_valid():
                valid_serializers.append(serializer)
            else:
                errors[idx] = serializer.errors
        if errors:
            return Response({'errors': errors}, status=400)

        criado_por = _usuario_display(request.user)
        filial = self._session_filial()
        with transaction.atomic():
            pesquisas = [
                serializer.save(criado_por=criado_por, filial=filial)
                for serializer in valid_serializers
            ]

        record_audit(
            request.user,
            'sgq.pesquisa.lote_criado',
            f'{len(pesquisas)} pesquisa(s) de satisfação registradas em lote.',
        )
        return Response(PesquisaSatisfacaoSerializer(pesquisas, many=True).data, status=201)

    @action(detail=False, methods=['get'])
    def motoristas(self, request):
        """Nomes de motoristas já usados nesta filial — alimenta a sugestão
        (autocomplete) do formulário para reduzir o mesmo motorista sendo
        digitado de formas diferentes, sem exigir um cadastro formal deles."""
        qs = self.scope_queryset(PesquisaSatisfacao.objects.all(), filial_field='filial', admin_bypass=False)
        nomes = qs.exclude(motorista='').values_list('motorista', flat=True)

        # Agrupa variações de escrita (case/espaços) e usa a grafia mais
        # frequente de cada uma como sugestão canônica.
        variacoes_por_chave: dict[str, Counter] = {}
        for nome in nomes:
            nome = nome.strip()
            if not nome:
                continue
            chave = nome.upper()
            variacoes_por_chave.setdefault(chave, Counter())[nome] += 1

        sugestoes = sorted(
            (contador.most_common(1)[0][0] for contador in variacoes_por_chave.values()),
            key=str.upper,
        )
        return Response(sugestoes)

    @action(detail=False, methods=['get'])
    def lancadores(self, request):
        """Usuários que já lançaram pesquisa nesta filial — filtro 'Lançado por'."""
        qs = self.scope_queryset(PesquisaSatisfacao.objects.all(), filial_field='filial', admin_bypass=False)
        nomes = (
            qs.exclude(criado_por='')
            .values_list('criado_por', flat=True)
            .distinct()
        )
        sugestoes = sorted({(nome or '').strip() for nome in nomes if (nome or '').strip()}, key=str.upper)
        return Response(sugestoes)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """KPIs e distribuição por critério, respeitando os mesmos filtros da lista."""
        qs = self.scope_queryset(PesquisaSatisfacao.objects.all(), filial_field='filial', admin_bypass=False)
        qs = filter_pesquisas_queryset(qs, request.query_params)
        return Response(build_pesquisa_stats(qs))

    @action(detail=False, methods=['get', 'put', 'delete'], url_path='lote-draft')
    def lote_draft(self, request):
        """Rascunho de inclusão em tabela — singleton por usuário + filial da sessão."""
        filial = self._session_filial()
        if not filial:
            return Response(
                {'detail': 'Filial da sessão é obrigatória para o rascunho.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        draft = PesquisaSatisfacaoLoteDraft.objects.filter(
            usuario=request.user,
            filial=filial,
        ).first()

        if request.method == 'GET':
            return Response(draft_payload(draft, filial))

        if request.method == 'DELETE':
            # Descartar rascunho exige criar: o rascunho só existe no fluxo de inclusão.
            denied = _funcao_required_response(request, 'criar-pesquisas', _CRIAR_PESQUISAS_DETAIL)
            if denied:
                return denied
            if draft:
                draft.delete()
                record_audit(
                    request.user,
                    'sgq.pesquisa.lote_draft_descartado',
                    f'Rascunho de inclusão em tabela descartado ({filial}).',
                )
            return Response(status=status.HTTP_204_NO_CONTENT)

        # PUT — upsert; rows vazias/sem conteúdo útil apagam o rascunho
        denied = _funcao_required_response(request, 'criar-pesquisas', _CRIAR_PESQUISAS_DETAIL)
        if denied:
            return denied
        rows = sanitize_draft_rows(request.data.get('rows', []))
        if not has_meaningful_draft(rows):
            if draft:
                draft.delete()
                record_audit(
                    request.user,
                    'sgq.pesquisa.lote_draft_descartado',
                    f'Rascunho de inclusão em tabela limpo ({filial}).',
                )
            return Response(draft_payload(None, filial))

        draft, _created = PesquisaSatisfacaoLoteDraft.objects.update_or_create(
            usuario=request.user,
            filial=filial,
            defaults={'version': 1, 'rows': rows},
        )
        record_audit(
            request.user,
            'sgq.pesquisa.lote_draft_salvo',
            f'Rascunho de inclusão em tabela salvo ({filial}, {len(rows)} linha(s)).',
        )
        return Response(draft_payload(draft, filial))

    @action(detail=False, methods=['get'], url_path='exportar-modelo')
    def exportar_modelo(self, request):
        denied = _funcao_required_response(request, 'importar-pesquisas', _IMPORTAR_PESQUISAS_DETAIL)
        if denied:
            return denied
        try:
            content = build_pesquisa_import_template()
        except Exception as exc:
            return Response(
                {'detail': f'Não foi possível gerar o modelo: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        response = HttpResponse(
            content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename="modelo_importacao_pesquisas_sgq.xlsx"'
        response['Content-Length'] = str(len(content))
        return response

    @action(
        detail=False,
        methods=['post'],
        url_path='import-preview',
        parser_classes=[MultiPartParser, FormParser],
    )
    def import_preview(self, request):
        denied = _funcao_required_response(request, 'importar-pesquisas', _IMPORTAR_PESQUISAS_DETAIL)
        if denied:
            return denied

        arquivo = request.FILES.get('file') or request.FILES.get('arquivo')
        if not arquivo:
            return Response(
                {'detail': 'Arquivo Excel (.xlsx) não fornecido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = preview_pesquisas_from_spreadsheet(arquivo.read())
        except PesquisaImportError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result)

    @action(
        detail=False,
        methods=['post'],
        url_path='import-spreadsheet',
        parser_classes=[MultiPartParser, FormParser],
    )
    def import_spreadsheet(self, request):
        denied = _funcao_required_response(request, 'importar-pesquisas', _IMPORTAR_PESQUISAS_DETAIL)
        if denied:
            return denied

        arquivo = request.FILES.get('file') or request.FILES.get('arquivo')
        if not arquivo:
            return Response(
                {'detail': 'Arquivo Excel (.xlsx) não fornecido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_dry = request.data.get('dryRun') or request.data.get('dry_run')
        dry_run = str(raw_dry).strip().lower() in ('1', 'true', 'yes', 'on', 'sim') if raw_dry is not None else False

        filial = self._session_filial()
        if not filial:
            return Response(
                {'detail': 'Filial da sessão é obrigatória para importação.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            file_bytes = arquivo.read()
            result = import_pesquisas_from_spreadsheet(
                file_bytes,
                filial=filial,
                dry_run=dry_run,
            )
        except PesquisaImportError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if result.get('success') and not dry_run:
            record_audit(
                request.user,
                'sgq.pesquisa.importada',
                f'{result["created"]} pesquisa(s) importadas ({filial}).',
            )

        status_code = status.HTTP_200_OK if result.get('success') else status.HTTP_400_BAD_REQUEST
        return Response(result, status=status_code)
