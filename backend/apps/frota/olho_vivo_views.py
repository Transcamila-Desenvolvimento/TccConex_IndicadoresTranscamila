from django.db import transaction
from django.db.models import Sum
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.accounts.permissions import allowed_filiais_for_module, get_request_context, resolve_filial_name
from apps.audit.services import record_audit

from .models import ItemRespostaOlhoVivo, RespostaOlhoVivo
from .olho_vivo import COMPORTAMENTOS, period_key_de, validar_ano, validar_itens, validar_periodo


def _funcao_required_response(request, funcao: str, detail: str):
    if request.user.has_funcao('Frota', funcao):
        return None
    return Response({'detail': detail}, status=status.HTTP_403_FORBIDDEN)

_RESPONDER_DETAIL = (
    'Acesso negado. Solicite ao administrador a função "Responder" de Olho vivo na estrada.'
)


def _session_filial(request) -> str:
    _, filial = get_request_context(request)
    allowed = allowed_filiais_for_module(request.user, 'Frota')
    return resolve_filial_name(filial, allowed) or ''


def _payload(resposta: RespostaOlhoVivo | None, ano: int, mes: int, filial: str) -> dict:
    salvos = {}
    if resposta is not None:
        salvos = {item.comportamento: item.recorrencia for item in resposta.itens.all()}
    return {
        'ano': ano,
        'mes': mes,
        'filial': filial,
        'respondido': resposta is not None,
        'atualizadoEm': resposta.updated_at.isoformat() if resposta else None,
        'atualizadoPor': resposta.updated_by.name if resposta and resposta.updated_by else '',
        'itens': [
            {
                'comportamento': chave,
                'descricao': descricao,
                'recorrencia': salvos.get(chave, 0),
            }
            for chave, descricao in COMPORTAMENTOS
        ],
    }


def _resumo_ano(filial: str, ano: int) -> dict:
    respostas = {
        item.mes: item
        for item in (
            RespostaOlhoVivo.objects.filter(
                filial=filial,
                ano=ano,
                periodicidade=RespostaOlhoVivo.PERIODICIDADE_MENSAL,
            )
            .select_related('updated_by')
            .annotate(total=Sum('itens__recorrencia'))
        )
    }
    meses = []
    for mes in range(1, 13):
        resposta = respostas.get(mes)
        meses.append({
            'mes': mes,
            'respondido': resposta is not None,
            'total': int(resposta.total or 0) if resposta is not None else 0,
            'atualizadoEm': resposta.updated_at.isoformat() if resposta else None,
            'atualizadoPor': resposta.updated_by.name if resposta and resposta.updated_by else '',
        })
    return {'ano': ano, 'filial': filial, 'meses': meses}


class OlhoVivoView(ModuleScopedViewMixin, APIView):
    permission_module = 'Frota'

    def get(self, request):
        filial = _session_filial(request)
        if not (request.query_params.get('mes') or '').strip():
            try:
                ano = validar_ano(request.query_params.get('ano'))
            except ValueError as exc:
                return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            return Response(_resumo_ano(filial, ano))
        try:
            ano, mes = validar_periodo(
                request.query_params.get('ano'),
                request.query_params.get('mes'),
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        chave = period_key_de(ano, mes)
        resposta = (
            RespostaOlhoVivo.objects.filter(filial=filial, period_key=chave)
            .select_related('updated_by')
            .prefetch_related('itens')
            .first()
        )
        return Response(_payload(resposta, ano, mes, filial))

    def put(self, request):
        denied = _funcao_required_response(request, 'responder-olho-vivo', _RESPONDER_DETAIL)
        if denied:
            return denied
        filial = _session_filial(request)
        try:
            ano, mes = validar_periodo(
                request.data.get('ano'),
                request.data.get('mes'),
            )
            recorrencias = validar_itens(request.data.get('itens'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        chave = period_key_de(ano, mes)
        with transaction.atomic():
            resposta, _created = RespostaOlhoVivo.objects.update_or_create(
                filial=filial,
                period_key=chave,
                defaults={
                    'periodicidade': RespostaOlhoVivo.PERIODICIDADE_MENSAL,
                    'ano': ano,
                    'mes': mes,
                    'updated_by': request.user,
                },
            )
            for comportamento, recorrencia in recorrencias.items():
                ItemRespostaOlhoVivo.objects.update_or_create(
                    resposta=resposta,
                    comportamento=comportamento,
                    defaults={'recorrencia': recorrencia},
                )
            resposta.itens.exclude(comportamento__in=recorrencias.keys()).delete()
        resposta = (
            RespostaOlhoVivo.objects.filter(pk=resposta.pk)
            .select_related('updated_by')
            .prefetch_related('itens')
            .get()
        )
        record_audit(
            request.user,
            'frota.olho_vivo.respondido',
            f'Olho vivo na estrada respondido ({filial}, {chave}).',
        )
        return Response(_payload(resposta, ano, mes, filial))
