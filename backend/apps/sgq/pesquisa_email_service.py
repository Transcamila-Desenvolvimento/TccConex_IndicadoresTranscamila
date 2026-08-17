"""Envio do resumo de pesquisas de satisfação por e-mail (SGQ operacional)."""

from __future__ import annotations

import re

from django.conf import settings
from django.core.mail import EmailMessage
from django.db.models import Count
from django.template.loader import render_to_string
from django.utils import timezone

from apps.accounts.permissions import allowed_filiais_for_module, get_request_context, resolve_filial_name

from .models import CLIENTE_CHOICES, PesquisaSatisfacao
from .stats_service import build_pesquisa_stats, count_pesquisas_em_branco

_CLIENTE_LABELS = dict(CLIENTE_CHOICES)


def parse_emails(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        parts = value
    else:
        parts = re.split(r'[,;]+', str(value))
    return [p.strip() for p in parts if p and '@' in p]


def _usuario_display(user) -> str:
    if not user or not user.is_authenticated:
        return 'Sistema'
    return user.name or user.get_full_name() or user.username


def _resolve_session_filial(user, request) -> str:
    _, filial_header = get_request_context(request)
    allowed = allowed_filiais_for_module(user, 'SGQ')
    return resolve_filial_name(filial_header, allowed) or (filial_header or '').strip()


def send_pesquisa_resumo_email(
    user,
    request,
    *,
    to_emails: list[str],
    cc_emails: list[str] | None = None,
) -> None:
    if not to_emails:
        raise ValueError('Informe ao menos um destinatário.')

    filial = _resolve_session_filial(user, request)
    if not filial:
        raise ValueError('Filial da sessão é obrigatória para enviar o resumo.')

    qs = PesquisaSatisfacao.objects.filter(filial=filial)
    stats = build_pesquisa_stats(qs)
    total_em_branco = count_pesquisas_em_branco(qs)

    por_cliente = [
        {
            'cliente': row['cliente'],
            'label': _CLIENTE_LABELS.get(row['cliente'], row['cliente']),
            'total': row['total'],
        }
        for row in qs.values('cliente').annotate(total=Count('id')).order_by('-total', 'cliente')
    ]

    criterios = []
    for item in stats['criterios']:
        total = item['otimo'] + item['bom'] + item['regular'] + item['ruim']
        criterios.append({**item, 'total': total})

    score_medio = (
        round(sum(item['score'] for item in stats['criterios']) / len(stats['criterios']), 2)
        if stats['criterios'] else 0
    )

    dashboard_base = getattr(settings, 'FRONTEND_BASE_URL', 'http://localhost:5173').rstrip('/')

    context = {
        'filial': filial,
        'periodo': 'Todos os registros',
        'enviado_por': _usuario_display(user),
        'ref_date': timezone.localtime(),
        'stats': stats,
        'total_em_branco': total_em_branco,
        'pct_otimo': stats['percentual']['otimo'],
        'score_medio': score_medio,
        'criterios': criterios,
        'por_cliente': por_cliente,
        'dashboard_url': f'{dashboard_base}/indicadores/gestao-qualidade/satisfacao-clientes',
    }

    html_body = render_to_string('sgq/emails/resumo_pesquisa.html', context)

    subject = f'Pesquisa de Satisfação — {filial}'

    email_obj = EmailMessage(
        subject=subject,
        body=html_body,
        from_email=None,
        to=to_emails,
        cc=cc_emails or [],
    )
    email_obj.content_subtype = 'html'
    email_obj.send(fail_silently=False)
