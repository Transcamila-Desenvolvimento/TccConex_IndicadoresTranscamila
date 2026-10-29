import re

from django.core.cache import cache
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .caepi import CaepiIndisponivel, consultar_ca

_CACHE_TTL = 60 * 30


class ConsultaCaepiView(APIView):
    """Consulta pública de CA. Exige apenas usuário autenticado."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        numero = re.sub(r'\D', '', request.query_params.get('numero') or '')
        if not numero or len(numero) > 6:
            return Response(
                {'detail': 'Informe o número do CA com até 6 dígitos.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        chave = f'caepi:{numero}'
        salvo = cache.get(chave)
        if isinstance(salvo, dict):
            return Response(salvo)
        try:
            certificado = consultar_ca(numero)
        except CaepiIndisponivel as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        payload = {
            'encontrado': certificado is not None,
            'numero': numero,
            'certificado': certificado,
        }
        cache.set(chave, payload, _CACHE_TTL)
        return Response(payload)
