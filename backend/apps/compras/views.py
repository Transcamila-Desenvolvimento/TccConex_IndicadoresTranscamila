from decimal import Decimal, InvalidOperation

from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.audit.services import record_audit

from .models import (
    UnidadeMedida,
    Setor,
    Colaborador,
    Fornecedor,
    ItemEstoque,
    EntradaEstoque,
    SaidaEstoque,
)
from .serializers import (
    UnidadeMedidaSerializer,
    SetorSerializer,
    ColaboradorSerializer,
    FornecedorSerializer,
    ItemEstoqueSerializer,
    EntradaEstoqueSerializer,
    SaidaEstoqueSerializer,
)


def _parse_positive_int(value, field_name: str) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValueError(f'{field_name} inválida.')
    if parsed <= 0:
        raise ValueError(f'{field_name} deve ser maior que zero.')
    return parsed


class UnidadeMedidaViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Compras'
    serializer_class = UnidadeMedidaSerializer
    queryset = UnidadeMedida.objects.all()


class SetorViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Compras'
    serializer_class = SetorSerializer
    queryset = Setor.objects.all()


class ColaboradorViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Compras'
    serializer_class = ColaboradorSerializer
    queryset = Colaborador.objects.all()


class FornecedorViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Compras'
    serializer_class = FornecedorSerializer
    queryset = Fornecedor.objects.all()


class ItemEstoqueViewSet(ModuleScopedViewMixin, viewsets.ModelViewSet):
    permission_module = 'Compras'
    serializer_class = ItemEstoqueSerializer
    queryset = ItemEstoque.objects.all()

    def perform_create(self, serializer):
        item = serializer.save()
        record_audit(self.request.user, 'compras.item.criado', f'Item "{item.nome}" cadastrado no estoque.')

    def perform_update(self, serializer):
        item = serializer.save()
        record_audit(self.request.user, 'compras.item.atualizado', f'Item "{item.nome}" atualizado.')

    def perform_destroy(self, instance):
        record_audit(self.request.user, 'compras.item.excluido', f'Item "{instance.nome}" removido do estoque.')
        instance.delete()


class EntradaEstoqueViewSet(ModuleScopedViewMixin, viewsets.ReadOnlyModelViewSet):
    permission_module = 'Compras'
    serializer_class = EntradaEstoqueSerializer
    queryset = EntradaEstoque.objects.select_related('item', 'fornecedor').all()

    @action(detail=False, methods=['post'])
    def registrar_compra(self, request):
        """Registra uma compra: cria as entradas e incrementa o saldo de cada
        item numa única transação atômica (regra de negócio antes implementada
        no frontend)."""
        data_str = request.data.get('data')
        fornecedor_id = request.data.get('fornecedorId')
        linhas = request.data.get('linhas') or []

        if not data_str:
            return Response({'error': 'Informe a data da compra.'}, status=status.HTTP_400_BAD_REQUEST)
        if not fornecedor_id:
            return Response({'error': 'Selecione um fornecedor.'}, status=status.HTTP_400_BAD_REQUEST)
        if not linhas:
            return Response({'error': 'Adicione ao menos um item à compra.'}, status=status.HTTP_400_BAD_REQUEST)

        fornecedor = Fornecedor.objects.filter(pk=fornecedor_id).first()
        if not fornecedor:
            return Response({'error': 'Fornecedor não encontrado.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                criadas = []
                for linha in linhas:
                    item = ItemEstoque.objects.select_for_update().filter(pk=linha.get('itemId')).first()
                    if not item:
                        raise ValueError('Item inválido na compra.')

                    quantidade = _parse_positive_int(linha.get('quantidade'), 'Quantidade')
                    try:
                        valor_unitario = Decimal(str(linha.get('valorUnitario', 0)))
                    except InvalidOperation:
                        raise ValueError('Valor unitário inválido.')
                    if valor_unitario < 0:
                        raise ValueError('Valor unitário não pode ser negativo.')

                    item.qtd_atual += quantidade
                    item.save(update_fields=['qtd_atual'])

                    criadas.append(EntradaEstoque.objects.create(
                        item=item,
                        item_nome=item.nome,
                        data=data_str,
                        quantidade=quantidade,
                        valor_unitario=valor_unitario,
                        fornecedor=fornecedor,
                        fornecedor_nome=fornecedor.nome,
                    ))
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        record_audit(
            request.user,
            'compras.entrada.registrada',
            f'Compra registrada com {len(criadas)} item(ns) junto a "{fornecedor.nome}".'
        )

        return Response(EntradaEstoqueSerializer(criadas, many=True).data, status=status.HTTP_201_CREATED)


class SaidaEstoqueViewSet(ModuleScopedViewMixin, viewsets.ReadOnlyModelViewSet):
    permission_module = 'Compras'
    serializer_class = SaidaEstoqueSerializer
    queryset = SaidaEstoque.objects.select_related('item', 'setor', 'colaborador').all()

    @action(detail=False, methods=['post'])
    def registrar_saida(self, request):
        """Registra um protocolo de saída: valida saldo suficiente por item e
        decrementa o estoque numa transação atômica."""
        data_str = request.data.get('data')
        setor_id = request.data.get('setorId')
        colaborador_id = request.data.get('colaboradorId')
        linhas = request.data.get('linhas') or []

        if not data_str:
            return Response({'error': 'Informe a data da saída.'}, status=status.HTTP_400_BAD_REQUEST)
        if not setor_id or not colaborador_id:
            return Response({'error': 'Informe o setor e o colaborador responsável pela retirada.'}, status=status.HTTP_400_BAD_REQUEST)
        if not linhas:
            return Response({'error': 'Adicione ao menos um item ao protocolo.'}, status=status.HTTP_400_BAD_REQUEST)

        setor = Setor.objects.filter(pk=setor_id).first()
        colaborador = Colaborador.objects.filter(pk=colaborador_id).first()
        if not setor:
            return Response({'error': 'Setor não encontrado.'}, status=status.HTTP_400_BAD_REQUEST)
        if not colaborador:
            return Response({'error': 'Colaborador não encontrado.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                criadas = []
                for linha in linhas:
                    item = ItemEstoque.objects.select_for_update().filter(pk=linha.get('itemId')).first()
                    if not item:
                        raise ValueError('Item inválido no protocolo de saída.')

                    quantidade = _parse_positive_int(linha.get('quantidade'), 'Quantidade')
                    if item.qtd_atual < quantidade:
                        raise ValueError(
                            f'Quantidade indisponível para "{item.nome}"! Saldo atual: {item.qtd_atual} {item.unidade}.'
                        )

                    item.qtd_atual -= quantidade
                    item.save(update_fields=['qtd_atual'])

                    criadas.append(SaidaEstoque.objects.create(
                        item=item,
                        item_nome=item.nome,
                        data=data_str,
                        quantidade=quantidade,
                        setor=setor,
                        setor_nome=setor.nome,
                        colaborador=colaborador,
                        colaborador_nome=colaborador.nome,
                    ))
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        record_audit(
            request.user,
            'compras.saida.registrada',
            f'Protocolo de saída registrado com {len(criadas)} item(ns) para "{setor.nome}" (colaborador: {colaborador.nome}).'
        )

        return Response(SaidaEstoqueSerializer(criadas, many=True).data, status=status.HTTP_201_CREATED)
