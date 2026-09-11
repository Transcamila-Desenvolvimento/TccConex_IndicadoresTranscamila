"""Aviso interno quando o cliente entra em pendente de homologação de produtos."""

from __future__ import annotations

import logging
import os
from email.mime.image import MIMEImage

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMessage
from django.template.loader import render_to_string

from .models import CLASSE_RISCO_CHOICES, GRUPO_EMBALAGEM_CHOICES, ClienteComercial
from .proposta_email_service import _usuario_display

logger = logging.getLogger(__name__)

FUNCAO_EMAIL_HOMOLOGACAO = 'receber-email-homologacao'
MAX_PRODUTOS_EMAIL = 40
LOGO_CID = 'logo_tccconex'
LOGO_FILENAME = 'Logo_TccConex_Branca.png'
LOGO_PATH = os.path.abspath(os.path.join(
    os.path.dirname(__file__),
    'static', 'comercial', 'email', LOGO_FILENAME,
))


def _google_email(user) -> str:
    return (getattr(user, 'google_email', None) or '').strip().lower()


def _usuario_optou_email(user) -> bool:
    if (getattr(user, 'status', '') or '') != 'ativo':
        return False
    if 'Comercial' not in (user.environments or []):
        return False
    return FUNCAO_EMAIL_HOMOLOGACAO in ((user.funcoes or {}).get('Comercial') or [])


def destinatarios_homologacao_pendente():
    User = get_user_model()
    candidatos = User.objects.filter(status='ativo').exclude(google_email__isnull=True).exclude(google_email='')
    return [user for user in candidatos if _usuario_optou_email(user) and _google_email(user)]


def _from_email_sistema() -> str:
    endereco = (getattr(settings, 'DEFAULT_FROM_EMAIL', '') or 'digitalmidia@transcamila.com.br').strip()
    if '<' in endereco:
        return endereco
    return f'TccConex <{endereco}>'


def _logo_tccconex_bytes() -> bytes | None:
    try:
        with open(LOGO_PATH, 'rb') as handle:
            data = handle.read()
    except OSError:
        return None
    return data or None


def _detalhe_produtos(cliente) -> tuple[list[dict], int]:
    from .homologacao import conformidade_vinculo

    classe_map = dict(CLASSE_RISCO_CHOICES)
    grupo_map = dict(GRUPO_EMBALAGEM_CHOICES)
    rows = []
    total = 0
    for vinculo in cliente.produtos.select_related('produto').order_by('ordem', 'id'):
        catalogo = vinculo.produto
        if vinculo.produto_id is None and not catalogo:
            continue
        total += 1
        if len(rows) >= MAX_PRODUTOS_EMAIL:
            continue
        conf = conformidade_vinculo(vinculo)
        classe = (catalogo.classe_risco if catalogo else vinculo.classe_risco) or ''
        grupo = (catalogo.grupo_embalagem if catalogo else vinculo.grupo_embalagem) or ''
        onu = (catalogo.numero_onu if catalogo else vinculo.numero_onu) or ''
        if conf['alertas']:
            situacao = ' · '.join(conf['alertas'])
        elif conf['cargaPerigosa']:
            situacao = 'Carga perigosa'
        else:
            situacao = 'Não perigoso'
        rows.append({
            'nome': conf['nome'] or '—',
            'classe': classe_map.get(classe, classe) or '—',
            'onu': onu or '—',
            'grupo': grupo_map.get(grupo, grupo) or '—',
            'situacao': situacao,
        })
    return rows, max(0, total - len(rows))


def notificar_homologacao_pendente(cliente_id, usuario_id=None) -> None:
    try:
        _enviar_homologacao_pendente(cliente_id, usuario_id)
    except Exception:
        logger.exception(
            'Falha ao enviar e-mail de homologação pendente do cliente %s.',
            cliente_id,
        )


def _enviar_homologacao_pendente(cliente_id, usuario_id=None) -> None:
    cliente = ClienteComercial.objects.filter(pk=cliente_id).first()
    if not cliente:
        return

    User = get_user_model()
    ator = User.objects.filter(pk=usuario_id).first() if usuario_id else None
    destinatarios = destinatarios_homologacao_pendente()
    to_emails = list(dict.fromkeys(_google_email(user) for user in destinatarios if _google_email(user)))
    if not to_emails:
        return

    from .homologacao import analisar_homologacao_produtos

    analise = analisar_homologacao_produtos(cliente)
    cliente_nome = (cliente.razao_social or cliente.nome_fantasia or '').strip() or f'Cliente {cliente.pk}'
    produtos, restante = _detalhe_produtos(cliente)
    frontend_base = getattr(settings, 'FRONTEND_BASE_URL', 'http://localhost:5173').rstrip('/')
    html_body = render_to_string('comercial/emails/homologacao_pendente.html', {
        'cliente_nome': cliente_nome,
        'cnpj': cliente.cnpj or '—',
        'solicitado_por': _usuario_display(ator) if ator else 'Área Comercial',
        'resumo': analise.get('resumoPendencia') or 'Pendente de validação',
        'produtosVinculados': analise.get('produtosVinculados') or len(produtos),
        'produtosPerigosos': analise.get('produtosPerigosos') or 0,
        'produtos': produtos,
        'produtos_restantes': restante,
        'logo_cid': LOGO_CID if _logo_tccconex_bytes() else '',
        'validacao_url': f'{frontend_base}/comercial/validacao-clientes?cliente={cliente.pk}',
    })

    email_obj = EmailMessage(
        subject=f'TccConex — Homologação pendente: {cliente_nome}',
        body=html_body,
        from_email=_from_email_sistema(),
        to=to_emails,
    )
    email_obj.content_subtype = 'html'
    logo_bytes = _logo_tccconex_bytes()
    if logo_bytes:
        logo = MIMEImage(logo_bytes, _subtype='png')
        logo.add_header('Content-ID', f'<{LOGO_CID}>')
        logo.add_header('Content-Disposition', 'inline', filename=LOGO_FILENAME)
        email_obj.attach(logo)
    email_obj.send(fail_silently=False)
