"""Envio formal da proposta comercial pelo Gmail da conta Google do usuário."""

from __future__ import annotations

import base64
import os
import re
from email.mime.image import MIMEImage

from django.core.mail import EmailMessage
from django.template.loader import render_to_string
from django.utils import timezone

from apps.accounts.google_gmail_service import send_gmail_as_user

from .models import (
    STATUS_PROPOSTA_ENVIADA,
    STATUS_PROPOSTA_RASCUNHO,
    TIPO_PROPOSTA_CHOICES,
)

PDF_MAX_BYTES = 8 * 1024 * 1024


def _safe_filename_part(value: str, max_len: int = 80) -> str:
    text = (value or '').strip()
    if not text or text == '—':
        return ''
    text = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', text)
    text = re.sub(r'\s+', '_', text)
    text = re.sub(r'_+', '_', text).strip('._')
    return text[:max_len].rstrip('._')


def proposta_pdf_filename(numero: str, cliente_nome: str) -> str:
    numero_part = _safe_filename_part(numero, 40) or 'proposta'
    cliente_part = _safe_filename_part(cliente_nome)
    if cliente_part:
        return f'Proposta_comercial_{numero_part}_{cliente_part}.pdf'
    return f'Proposta_comercial_{numero_part}.pdf'


def parse_emails(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        parts = value
    else:
        parts = re.split(r'[,;]+', str(value))
    seen: set[str] = set()
    result: list[str] = []
    for part in parts:
        email = str(part).strip().lower()
        if email and '@' in email and email not in seen:
            seen.add(email)
            result.append(email)
    return result


def request_email_list(data, *keys) -> list[str]:
    parts: list = []
    for key in keys:
        if hasattr(data, 'getlist'):
            listed = data.getlist(key)
            if listed:
                for item in listed:
                    if isinstance(item, list):
                        parts.extend(item)
                    else:
                        parts.append(item)
                continue
        value = data.get(key)
        if isinstance(value, list):
            parts.extend(value)
        elif value:
            parts.append(value)
    return parse_emails(parts)


def read_proposta_pdf(request) -> bytes | None:
    uploaded = request.FILES.get('pdf') if hasattr(request, 'FILES') else None
    if uploaded:
        data = uploaded.read()
    else:
        raw = request.data.get('pdfBase64') or ''
        if isinstance(raw, str) and raw.startswith('data:'):
            raw = raw.split(',', 1)[-1]
        try:
            data = base64.b64decode(raw) if raw else b''
        except (ValueError, TypeError):
            data = b''
    if len(data) > PDF_MAX_BYTES:
        raise ValueError('O PDF da proposta excede o tamanho permitido.')
    if len(data) < 5 or not data.startswith(b'%PDF'):
        return None
    return data


def _usuario_display(user) -> str:
    if not user or not getattr(user, 'is_authenticated', False):
        return 'Área Comercial'
    return (user.name or user.get_full_name() or user.username or '').strip() or 'Área Comercial'


def _google_email(user) -> str:
    return (getattr(user, 'google_email', None) or '').strip().lower()


def _fmt_date(value) -> str:
    if not value:
        return '—'
    if hasattr(value, 'strftime'):
        return value.strftime('%d/%m/%Y')
    text = str(value)[:10]
    parts = text.split('-')
    if len(parts) == 3:
        return f'{parts[2]}/{parts[1]}/{parts[0]}'
    return str(value)


def _tipo_label(tipo: str) -> str:
    return dict(TIPO_PROPOSTA_CHOICES).get(tipo, 'Proposta comercial')


def _saudacao(proposta) -> str:
    att = (proposta.att or '').strip()
    if att:
        return f'Prezado(a) {att},'
    return 'Prezados,'


LOGO_CID = 'logo_transcamila'
LOGO_PATH = os.path.abspath(os.path.join(
    os.path.dirname(__file__),
    '..', '..', '..',
    'frontend', 'src', 'assets', 'logo-transcamila-30-anos.png',
))


def _logo_png_bytes() -> bytes | None:
    try:
        with open(LOGO_PATH, 'rb') as handle:
            data = handle.read()
    except OSError:
        return None
    return data or None


def _build_context(proposta, user) -> dict:
    cliente = proposta.cliente
    cliente_nome = (getattr(cliente, 'razao_social', None) or proposta.cliente_nome or '').strip() or '—'
    return {
        'proposta': proposta,
        'numero': proposta.numero_identificacao or '—',
        'cliente_nome': cliente_nome,
        'cliente_cnpj': getattr(cliente, 'cnpj', '') or '—',
        'servico': _tipo_label(proposta.tipo),
        'emissao': _fmt_date(proposta.data_proposta or (proposta.data_criacao.date() if proposta.data_criacao else None)),
        'validade': proposta.validade or '—',
        'vigencia': proposta.vigencia or '—',
        'vencimento': _fmt_date(proposta.data_vencimento()),
        'saudacao': _saudacao(proposta),
        'enviado_por': _usuario_display(user),
        'ref_date': timezone.localtime(),
        'logo_cid': LOGO_CID if _logo_png_bytes() else '',
    }


def send_proposta_comercial_email(
    user,
    proposta,
    *,
    to_emails: list[str] | None = None,
    cc_emails: list[str] | None = None,
    pdf_bytes: bytes | None = None,
) -> dict:
    google_from = _google_email(user)
    if not google_from:
        raise ValueError('Vincule sua conta Google no perfil para enviar a proposta pelo seu e-mail.')

    cliente_email = (getattr(proposta.cliente, 'email', None) or '').strip().lower()
    destinarios = parse_emails(to_emails)
    if not destinarios and cliente_email:
        destinarios = [cliente_email]
    if cliente_email and cliente_email not in destinarios:
        destinarios.insert(0, cliente_email)
    if not destinarios:
        raise ValueError('Cadastre o e-mail do cliente ou informe um destinatário para enviar a proposta.')
    if not pdf_bytes:
        raise ValueError('Não foi possível receber o PDF da proposta gerado na tela. Tente novamente.')

    cc = [email for email in parse_emails(cc_emails) if email != google_from]

    context = _build_context(proposta, user)
    html_body = render_to_string('comercial/emails/proposta.html', context)
    numero = context['numero']
    cliente_nome = context['cliente_nome']
    remetente = f'{_usuario_display(user)} <{google_from}>'

    email_obj = EmailMessage(
        subject=f'Proposta comercial nº {numero} — Transcamila Cargas e Armazéns Gerais Ltda.',
        body=html_body,
        from_email=remetente,
        to=destinarios,
        cc=cc,
    )
    email_obj.content_subtype = 'html'
    logo_bytes = _logo_png_bytes()
    if logo_bytes:
        logo = MIMEImage(logo_bytes, _subtype='png')
        logo.add_header('Content-ID', f'<{LOGO_CID}>')
        logo.add_header('Content-Disposition', 'inline', filename='logo-transcamila-30-anos.png')
        email_obj.attach(logo)
    email_obj.attach(proposta_pdf_filename(numero, cliente_nome), pdf_bytes, 'application/pdf')
    send_gmail_as_user(user, email_obj)

    if proposta.status == STATUS_PROPOSTA_RASCUNHO:
        proposta.status = STATUS_PROPOSTA_ENVIADA
        proposta.save(update_fields=['status', 'data_atualizacao'])

    return {
        'to': destinarios,
        'cc': cc,
        'numero': numero,
        'cliente': cliente_nome,
    }
