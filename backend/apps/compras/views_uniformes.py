import re
from datetime import date

from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.db.models import Count, F, Max, Prefetch, Q, Sum
from django.db.models.functions import Coalesce
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.audit.services import record_audit

from . import uniforme_email, uniformes_service as service
from .models import (
    MOV_TIPO_CHOICES,
    Colaborador,
    DevolucaoUniforme,
    EntregaUniforme,
    EntregaUniformeItem,
    MovimentacaoUniforme,
    Uniforme,
)
from .pagination import ComprasPagination
from .serializers import (
    EntregaUniformeItemSerializer,
    EntregaUniformeSerializer,
    MovimentacaoUniformeSerializer,
    UniformeSerializer,
)

_NUMERO_TERMO_RE = re.compile(r'^\s*(?:TR?U-?)?0*(\d+)\s*$', re.IGNORECASE)


def _erro(mensagem: str) -> Response:
    return Response({'error': mensagem}, status=status.HTTP_400_BAD_REQUEST)


def _exige_funcao(request, funcao: str, detail: str):
    if request.user.has_funcao('Compras', funcao):
        return None
    return Response({'detail': detail}, status=status.HTTP_403_FORBIDDEN)


def _primeiro_erro(errors) -> str:
    if isinstance(errors, dict):
        for value in errors.values():
            return _primeiro_erro(value)
    if isinstance(errors, list) and errors:
        return _primeiro_erro(errors[0])
    return str(errors)


def _filtrar_periodo(qs, request, campo: str):
    inicio = (request.query_params.get('dataInicio') or '').strip()
    fim = (request.query_params.get('dataFim') or '').strip()
    if inicio:
        qs = qs.filter(**{f'{campo}__gte': inicio})
    if fim:
        qs = qs.filter(**{f'{campo}__lte': fim})
    return qs


class UniformeViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Compras'
    serializer_class = UniformeSerializer
    queryset = Uniforme.objects.all()

    def get_queryset(self):
        qs = super().get_queryset()
        termo = (self.request.query_params.get('q') or '').strip()
        if termo:
            qs = qs.filter(Q(nome__icontains=termo) | Q(codigo__icontains=termo) | Q(tamanho__iexact=termo))
        return qs.order_by('nome', 'tamanho')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['totais'] = service.totais_por_uniforme()
        return context

    def _resposta(self, uniforme, status_code=status.HTTP_200_OK):
        uniforme.refresh_from_db()
        return Response(self.get_serializer(uniforme).data, status=status_code)

    def create(self, request, *args, **kwargs):
        negado = _exige_funcao(request, 'cadastrar-uniformes', 'Acesso negado. Solicite a função "Cadastrar itens" do Controle de Uniformes.')
        if negado:
            return negado
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return _erro(_primeiro_erro(serializer.errors))
        try:
            estoque_inicial = int(request.data.get('estoqueInicial') or 0)
        except (TypeError, ValueError):
            return _erro('Estoque inicial inválido.')
        if estoque_inicial < 0:
            return _erro('Estoque inicial não pode ser negativo.')
        try:
            uniforme = serializer.save()
        except IntegrityError:
            return _erro('Já existe um uniforme com este nome e tamanho.')
        record_audit(request.user, 'compras.uniforme.criado', f'Uniforme "{uniforme}" cadastrado.')
        if estoque_inicial:
            service.registrar_entrada(
                uniforme.pk, condicao='novo', quantidade=estoque_inicial,
                data=uniforme.criado_em.date(), observacao='Estoque inicial do cadastro', user=request.user,
            )
        return self._resposta(uniforme, status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def lote(self, request):
        """Cadastra um item em vários tamanhos de uma vez, com estoque inicial novo e usado."""
        negado = _exige_funcao(request, 'cadastrar-uniformes', 'Acesso negado. Solicite a função "Cadastrar itens" do Controle de Uniformes.')
        if negado:
            return negado
        nome = (request.data.get('nome') or '').strip()
        codigo = (request.data.get('codigo') or '').strip()
        tamanhos = request.data.get('tamanhos') or []
        if not nome:
            return _erro('Informe o nome do item.')
        if not isinstance(tamanhos, list) or not tamanhos:
            return _erro('Informe ao menos um tamanho.')

        linhas = []
        vistos = set()
        for linha in tamanhos:
            if not isinstance(linha, dict):
                return _erro('Tamanho inválido.')
            try:
                qtd_nova = int(linha.get('qtdNova') or 0)
                qtd_usada = int(linha.get('qtdUsada') or 0)
            except (TypeError, ValueError):
                return _erro('Quantidade inicial inválida.')
            if qtd_nova < 0 or qtd_usada < 0:
                return _erro('Estoque inicial não pode ser negativo.')
            serializer = self.get_serializer(data={
                'nome': nome, 'codigo': codigo,
                'tamanho': linha.get('tamanho'), 'estoqueMinimo': linha.get('estoqueMinimo') or 0,
            })
            if not serializer.is_valid():
                return _erro(_primeiro_erro(serializer.errors))
            chave = serializer.validated_data['tamanho'].upper()
            if chave in vistos:
                return _erro(f'O tamanho {chave} foi informado mais de uma vez.')
            vistos.add(chave)
            linhas.append((serializer, qtd_nova, qtd_usada))

        criados = []
        try:
            with transaction.atomic():
                for serializer, qtd_nova, qtd_usada in linhas:
                    uniforme = serializer.save()
                    for condicao, quantidade in (('novo', qtd_nova), ('usado', qtd_usada)):
                        if quantidade:
                            service.registrar_entrada(
                                uniforme.pk, condicao=condicao, quantidade=quantidade,
                                data=uniforme.criado_em.date(), observacao='Estoque inicial do cadastro',
                                user=request.user,
                            )
                    criados.append(uniforme)
        except IntegrityError:
            return _erro(f'"{nome}" já tem cadastro em algum desses tamanhos.')
        except service.UniformeError as exc:
            return _erro(str(exc))

        record_audit(
            request.user, 'compras.uniforme.criado',
            f'Uniforme "{nome}" cadastrado nos tamanhos {", ".join(u.tamanho for u in criados)}.',
        )
        context = self.get_serializer_context()
        return Response(UniformeSerializer(criados, many=True, context=context).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        negado = _exige_funcao(request, 'editar-uniformes', 'Acesso negado. Solicite a função "Editar itens" do Controle de Uniformes.')
        if negado:
            return negado
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=partial)
        if not serializer.is_valid():
            return _erro(_primeiro_erro(serializer.errors))
        try:
            uniforme = serializer.save()
        except IntegrityError:
            return _erro('Já existe um uniforme com este nome e tamanho.')
        record_audit(request.user, 'compras.uniforme.atualizado', f'Uniforme "{uniforme}" atualizado.')
        return self._resposta(uniforme)

    def destroy(self, request, *args, **kwargs):
        negado = _exige_funcao(request, 'editar-uniformes', 'Acesso negado. Solicite a função "Editar itens" do Controle de Uniformes.')
        if negado:
            return negado
        uniforme = self.get_object()
        if uniforme.movimentacoes.exists() or uniforme.itens_entregues.exists():
            return _erro('Este uniforme já possui movimentações e não pode ser excluído; o histórico é preservado.')
        record_audit(request.user, 'compras.uniforme.excluido', f'Uniforme "{uniforme}" excluído.')
        uniforme.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _executar(self, request, operacao, **extra):
        uniforme = self.get_object()
        try:
            operacao(uniforme.pk, user=request.user, **extra)
        except service.UniformeError as exc:
            return _erro(str(exc))
        return self._resposta(uniforme)

    @action(detail=True, methods=['post'])
    def entrada(self, request, pk=None):
        negado = _exige_funcao(request, 'movimentar-uniformes', 'Acesso negado. Solicite a função "Movimentar estoque" do Controle de Uniformes.')
        if negado:
            return negado
        return self._executar(
            request, service.registrar_entrada,
            condicao=request.data.get('condicao'), quantidade=request.data.get('quantidade'),
            data=request.data.get('data'), observacao=request.data.get('observacao'),
        )

    @action(detail=True, methods=['post'])
    def ajuste(self, request, pk=None):
        negado = _exige_funcao(request, 'movimentar-uniformes', 'Acesso negado. Solicite a função "Movimentar estoque" do Controle de Uniformes.')
        if negado:
            return negado
        return self._executar(
            request, service.registrar_ajuste,
            condicao=request.data.get('condicao'), quantidade=request.data.get('quantidade'),
            observacao=request.data.get('observacao'),
        )

    @action(detail=True, methods=['post'])
    def descarte(self, request, pk=None):
        negado = _exige_funcao(request, 'movimentar-uniformes', 'Acesso negado. Solicite a função "Movimentar estoque" do Controle de Uniformes.')
        if negado:
            return negado
        return self._executar(
            request, service.registrar_descarte,
            condicao=request.data.get('condicao'), quantidade=request.data.get('quantidade'),
            observacao=request.data.get('observacao'),
        )

    @action(detail=False, methods=['get'])
    def resumo(self, request):
        return Response(service.resumo())

    @action(detail=False, methods=['get'])
    def exportar(self, request):
        negado = _exige_funcao(request, 'exportar-uniformes', 'Acesso negado. Solicite a função "Exportar estoque" do Controle de Uniformes.')
        if negado:
            return negado
        conteudo = service.planilha_estoque()
        record_audit(request.user, 'compras.uniforme.exportado', 'Planilha de estoque e peças com colaboradores.')
        resposta = HttpResponse(
            conteudo,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        resposta['Content-Disposition'] = f'attachment; filename="estoque_uniformes_{date.today().isoformat()}.xlsx"'
        resposta['Content-Length'] = str(len(conteudo))
        return resposta


class EntregaUniformeViewSet(ModuleScopedViewMixin, viewsets.ReadOnlyModelViewSet):
    permission_module = 'Compras'
    serializer_class = EntregaUniformeSerializer
    pagination_class = ComprasPagination

    def get_queryset(self):
        params = self.request.query_params
        qs = EntregaUniforme.objects.prefetch_related(
            'itens',
            Prefetch('devolucoes', queryset=DevolucaoUniforme.objects.prefetch_related('itens__entrega_item')),
        ).annotate(
            pendente_total=Sum(
                F('itens__quantidade') - F('itens__qtd_devolvida') - F('itens__qtd_descartada') - F('itens__qtd_perdida')
            ),
        )
        colaborador_id = (params.get('colaboradorId') or '').strip()
        if colaborador_id:
            qs = qs.filter(colaborador_id=colaborador_id)
        situacao = (params.get('status') or '').strip()
        if situacao == 'abertas':
            qs = qs.filter(pendente_total__gt=0)
        elif situacao == 'encerradas':
            qs = qs.filter(pendente_total=0)
        termo = (params.get('q') or '').strip()
        if termo:
            filtro = Q(colaborador_nome__icontains=termo) | Q(colaborador_cpf__icontains=re.sub(r'\D', '', termo) or termo)
            numero = _NUMERO_TERMO_RE.match(termo)
            if numero:
                filtro |= Q(pk=int(numero.group(1)))
            qs = qs.filter(filtro)
        qs = _filtrar_periodo(qs, self.request, 'data_entrega')
        return qs.order_by('-data_entrega', '-criado_em')

    def create(self, request, *args, **kwargs):
        negado = _exige_funcao(request, 'entregar-uniformes', 'Acesso negado. Solicite a função "Entregar" do Controle de Uniformes.')
        if negado:
            return negado
        try:
            destino = uniforme_email.validar_email_aviso(request.data.get('emailDestino'))
            entrega = service.registrar_entrega(
                colaborador_id=request.data.get('colaboradorId'),
                data_entrega=request.data.get('dataEntrega'),
                observacoes=request.data.get('observacoes'),
                itens=request.data.get('itens') or [],
                user=request.user,
            )
        except service.UniformeError as exc:
            return _erro(str(exc))
        dados = dict(self.get_serializer(self.get_queryset().get(pk=entrega.pk)).data)
        dados.update(uniforme_email.enviar_aviso_entrega(entrega, destino))
        return Response(dados, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def devolver(self, request, pk=None):
        negado = _exige_funcao(request, 'devolver-uniformes', 'Acesso negado. Solicite a função "Receber devolução" do Controle de Uniformes.')
        if negado:
            return negado
        entrega = self.get_object()
        try:
            destino = uniforme_email.validar_email_aviso(request.data.get('emailDestino'))
            devolucao = service.registrar_devolucao(
                entrega.pk,
                data_devolucao=request.data.get('dataDevolucao'),
                observacoes=request.data.get('observacoes'),
                itens=request.data.get('itens') or [],
                user=request.user,
            )
        except service.UniformeError as exc:
            return _erro(str(exc))
        dados = dict(self.get_serializer(self.get_queryset().get(pk=entrega.pk)).data)
        dados.update(uniforme_email.enviar_aviso_devolucao([devolucao], destino))
        return Response(dados)

    @action(detail=False, methods=['post'], url_path='devolucao-total')
    def devolucao_total(self, request):
        """Devolve de uma vez as peças de todos os termos pendentes do colaborador."""
        negado = _exige_funcao(request, 'devolver-uniformes', 'Acesso negado. Solicite a função "Receber devolução" do Controle de Uniformes.')
        if negado:
            return negado
        try:
            destino = uniforme_email.validar_email_aviso(request.data.get('emailDestino'))
            devolucoes = service.registrar_devolucao_total(
                request.data.get('colaboradorId'),
                data_devolucao=request.data.get('dataDevolucao'),
                observacoes=request.data.get('observacoes'),
                itens=request.data.get('itens') or [],
                user=request.user,
            )
        except service.UniformeError as exc:
            return _erro(str(exc))
        dados = {
            'termos': [d.entrega.numero for d in devolucoes],
            'totalPecas': sum(
                i.qtd_boa + i.qtd_danificada + i.qtd_sem_condicoes + i.qtd_perdida
                for d in devolucoes for i in d.itens.all()
            ),
        }
        dados.update(uniforme_email.enviar_aviso_devolucao(devolucoes, destino))
        return Response(dados)

    @action(detail=False, methods=['get'], url_path='por-colaborador')
    def por_colaborador(self, request):
        """Colaboradores que já receberam uniformes, com as peças ainda em posse."""
        pendente = (
            F('entregas_uniforme__itens__quantidade') - F('entregas_uniforme__itens__qtd_devolvida')
            - F('entregas_uniforme__itens__qtd_descartada') - F('entregas_uniforme__itens__qtd_perdida')
        )
        qs = (
            Colaborador.objects.filter(entregas_uniforme__isnull=False)
            .select_related('setor')
            .annotate(
                pecas_em_posse=Coalesce(Sum(pendente), 0),
                total_entregas=Count('entregas_uniforme', distinct=True),
                ultima_entrega=Max('entregas_uniforme__data_entrega'),
            )
        )
        termo = (request.query_params.get('q') or '').strip()
        if termo:
            filtro = (
                Q(nome__icontains=termo) | Q(setor__nome__icontains=termo) | Q(cargo__icontains=termo)
                | Q(cpf__icontains=re.sub(r'\D', '', termo) or termo)
            )
            numero = _NUMERO_TERMO_RE.match(termo)
            if numero:
                filtro |= Q(pk__in=EntregaUniforme.objects.filter(pk=int(numero.group(1))).values('colaborador_id'))
            qs = qs.filter(filtro)
        if (request.query_params.get('somenteEmPosse') or '') in {'1', 'true'}:
            qs = qs.filter(pecas_em_posse__gt=0)
        qs = qs.order_by('-pecas_em_posse', 'nome')

        page = self.paginate_queryset(qs)
        rows = page if page is not None else list(qs)
        data = [
            {
                'colaboradorId': str(c.pk),
                'nome': c.nome,
                'cpf': c.cpf,
                'cargo': c.cargo,
                'setorNome': c.setor.nome if c.setor_id else '',
                'pecasEmPosse': c.pecas_em_posse,
                'totalEntregas': c.total_entregas,
                'ultimaEntrega': c.ultima_entrega.isoformat() if c.ultima_entrega else None,
            }
            for c in rows
        ]
        return self.get_paginated_response(data) if page is not None else Response(data)

    @action(detail=False, methods=['get'], url_path='em-posse')
    def em_posse(self, request):
        """Peças ainda sob responsabilidade do colaborador (pendentes de devolução)."""
        colaborador_id = (request.query_params.get('colaboradorId') or '').strip()
        if not colaborador_id:
            return Response([])
        itens = (
            EntregaUniformeItem.objects.select_related('entrega')
            .filter(entrega__colaborador_id=colaborador_id)
            .annotate(pend=F('quantidade') - F('qtd_devolvida') - F('qtd_descartada') - F('qtd_perdida'))
            .filter(pend__gt=0)
            .order_by('-entrega__data_entrega', 'uniforme_nome', 'uniforme_tamanho')
        )
        return Response([
            {
                **EntregaUniformeItemSerializer(item).data,
                'entregaId': str(item.entrega_id),
                'entregaNumero': item.entrega.numero,
                'dataEntrega': item.entrega.data_entrega.isoformat(),
            }
            for item in itens
        ])


class MovimentacaoUniformeViewSet(ModuleScopedViewMixin, viewsets.ReadOnlyModelViewSet):
    permission_module = 'Compras'
    serializer_class = MovimentacaoUniformeSerializer
    pagination_class = ComprasPagination

    def get_queryset(self):
        params = self.request.query_params
        qs = MovimentacaoUniforme.objects.select_related('entrega')
        tipo = (params.get('tipo') or '').strip()
        if tipo in {t for t, _ in MOV_TIPO_CHOICES}:
            qs = qs.filter(tipo=tipo)
        for param, campo in (('uniformeId', 'uniforme_id'), ('colaboradorId', 'colaborador_id'), ('entregaId', 'entrega_id')):
            valor = (params.get(param) or '').strip()
            if valor:
                qs = qs.filter(**{campo: valor})
        ocultar = service.oculta_observacoes_ajustes(self.request.user)
        if ocultar:
            qs = qs.exclude(tipo='ajuste')
        termo = (params.get('q') or '').strip()
        if termo:
            busca = (
                Q(uniforme_nome__icontains=termo) | Q(colaborador_nome__icontains=termo)
                | Q(usuario_nome__icontains=termo)
            )
            if not ocultar:
                busca |= Q(observacao__icontains=termo)
            qs = qs.filter(busca)
        qs = _filtrar_periodo(qs, self.request, 'data')
        return qs.order_by('-criado_em', '-id')
