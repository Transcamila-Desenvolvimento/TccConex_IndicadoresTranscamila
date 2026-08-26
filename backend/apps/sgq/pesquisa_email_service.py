"""Envio do resumo de pesquisas de satisfação por e-mail (SGQ operacional)."""

from __future__ import annotations

import re

from django.conf import settings
from django.core.mail import EmailMessage
from django.db.models import Count, Max
from django.template.loader import render_to_string
from django.utils import timezone

from apps.accounts.constants import branches_for_module

from .models import PesquisaSatisfacao
from .stats_service import build_pesquisa_stats, count_pesquisas_em_branco


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


def resolve_resumo_filiais(_user=None) -> list[str]:
    """Filiais do resumo: sempre as unidades do SGQ (Ibiporã e Rondonópolis).

    Independente das filiais liberadas no cadastro do usuário e da sessão.
    Quem consegue abrir o SGQ envia o consolidado operacional completo.
    """
    return list(branches_for_module('SGQ'))


def _filial_curta(nome: str) -> str:
    if 'Ibiporã' in nome:
        return 'Ibiporã'
    if nome == 'Rondonópolis':
        return 'Rondonópolis'
    return nome


def _fmt_data_br(value) -> str:
    if not value:
        return '—'
    return value.strftime('%d/%m/%Y')


def filiais_label(filiais: list[str]) -> str:
    if len(filiais) == 1:
        return filiais[0]
    if len(filiais) == 2:
        return f'{_filial_curta(filiais[0])} e {_filial_curta(filiais[1])}'
    nomes = [_filial_curta(nome) for nome in filiais]
    return ', '.join(nomes[:-1]) + f' e {nomes[-1]}'


def _score_medio_criterios(criterios: list[dict]) -> float:
    if not criterios:
        return 0.0
    return round(sum(item['score'] for item in criterios) / len(criterios), 2)


def _build_por_filial(filiais: list[str]) -> list[dict]:
    por_filial = []
    for nome in filiais:
        f_qs = PesquisaSatisfacao.objects.filter(filial=nome)
        f_stats = build_pesquisa_stats(f_qs)
        ultima_inclusao = f_qs.aggregate(ultima=Max('data_inclusao'))['ultima']
        por_filial.append({
            'filial': nome,
            'filial_curta': _filial_curta(nome),
            'totalPesquisas': f_stats['totalPesquisas'],
            'percentualOtimo': f_stats['percentual']['otimo'],
            'scoreMedio': _score_medio_criterios(f_stats['criterios']),
            'pontosAtencao': f_stats['pontosAtencao'],
            'totalEmBranco': count_pesquisas_em_branco(f_qs),
            'ultimaInclusao': _fmt_data_br(ultima_inclusao),
        })
    return por_filial


def send_pesquisa_resumo_email(
    user,
    request,
    *,
    to_emails: list[str],
    cc_emails: list[str] | None = None,
) -> None:
    del request  # resumo consolidado — não depende da filial da sessão

    if not to_emails:
        raise ValueError('Informe ao menos um destinatário.')

    filiais = resolve_resumo_filiais(user)
    if not filiais:
        raise ValueError('Usuário sem acesso a filiais do SGQ para enviar o resumo.')

    qs = PesquisaSatisfacao.objects.filter(filial__in=filiais)
    stats = build_pesquisa_stats(qs)
    total_em_branco = count_pesquisas_em_branco(qs)
    por_filial = _build_por_filial(filiais)

    por_cliente = [
        {
            'cliente': row['cliente'],
            'label': row['cliente'],
            'total': row['total'],
        }
        for row in qs.values('cliente').annotate(total=Count('id')).order_by('-total', 'cliente')
    ]

    criterios = []
    for item in stats['criterios']:
        total = item['otimo'] + item['bom'] + item['regular'] + item['ruim']
        criterios.append({**item, 'total': total})

    score_medio = _score_medio_criterios(stats['criterios'])
    filiais_label_text = filiais_label(filiais)
    dashboard_base = getattr(settings, 'FRONTEND_BASE_URL', 'http://localhost:5173').rstrip('/')

    context = {
        'filiais_label': filiais_label_text,
        'periodo': 'Todos os registros',
        'enviado_por': _usuario_display(user),
        'ref_date': timezone.localtime(),
        'stats': stats,
        'total_em_branco': total_em_branco,
        'pct_otimo': stats['percentual']['otimo'],
        'score_medio': score_medio,
        'criterios': criterios,
        'por_filial': por_filial,
        'por_cliente': por_cliente,
        'dashboard_url': f'{dashboard_base}/indicadores/gestao-qualidade/satisfacao-clientes',
    }

    html_body = render_to_string('sgq/emails/resumo_pesquisa.html', context)

    subject = f'Pesquisa de Satisfação — {filiais_label_text}'

    email_obj = EmailMessage(
        subject=subject,
        body=html_body,
        from_email=None,
        to=to_emails,
        cc=cc_emails or [],
    )
    email_obj.content_subtype = 'html'
    email_obj.send(fail_silently=False)
