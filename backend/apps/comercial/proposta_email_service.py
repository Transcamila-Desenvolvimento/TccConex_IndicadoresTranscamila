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
    TIPO_GENERALIDADE_CHOICES,
    TIPO_PROPOSTA_CHOICES,
    tipos_servico_generalidade,
)

PDF_MAX_BYTES = 8 * 1024 * 1024
MAX_PROPOSTAS_EMAIL = 4


def _juntar_lista(itens: list[str]) -> str:
    partes = [str(item).strip() for item in itens if str(item or '').strip()]
    if not partes:
        return '—'
    if len(partes) == 1:
        return partes[0]
    if len(partes) == 2:
        return f'{partes[0]} e {partes[1]}'
    return f'{", ".join(partes[:-1])} e {partes[-1]}'


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
    pdfs = read_proposta_pdfs(request)
    return pdfs[0] if pdfs else None


def read_proposta_pdfs(request) -> list[bytes]:
    arquivos = []
    if hasattr(request, 'FILES'):
        arquivos = list(request.FILES.getlist('pdf'))
    if arquivos:
        resultados = []
        for uploaded in arquivos:
            data = uploaded.read()
            if len(data) > PDF_MAX_BYTES:
                raise ValueError('O PDF da proposta excede o tamanho permitido.')
            if len(data) < 5 or not data.startswith(b'%PDF'):
                raise ValueError('Um dos PDFs da proposta é inválido.')
            resultados.append(data)
        return resultados
    single = _read_pdf_base64(request)
    return [single] if single else []


def _read_pdf_base64(request) -> bytes | None:
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


def request_proposta_ids(data) -> list[str]:
    parts: list[str] = []
    if hasattr(data, 'getlist'):
        listed = data.getlist('ids') or data.getlist('id')
        for item in listed:
            parts.extend(str(item).split(','))
    else:
        value = data.get('ids') if hasattr(data, 'get') else None
        if value is None and hasattr(data, 'get'):
            value = data.get('id')
        if isinstance(value, list):
            for item in value:
                parts.extend(str(item).split(','))
        elif value:
            parts.extend(str(value).split(','))
    seen: set[str] = set()
    result: list[str] = []
    for part in parts:
        item_id = str(part).strip()
        if item_id and item_id not in seen:
            seen.add(item_id)
            result.append(item_id)
    return result


def validar_envio_conjunto(propostas) -> None:
    if not propostas:
        raise ValueError('Selecione ao menos uma proposta para enviar.')
    if len(propostas) > MAX_PROPOSTAS_EMAIL:
        raise ValueError(
            f'Selecione no máximo {MAX_PROPOSTAS_EMAIL} propostas do mesmo cliente para o mesmo e-mail.'
        )
    if len(propostas) == 1:
        return
    cliente_ids = {getattr(item, 'cliente_id', None) for item in propostas}
    if None in cliente_ids or len(cliente_ids) != 1:
        raise ValueError('Só é possível enviar várias propostas juntas quando forem do mesmo cliente.')


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


def _servico_label(proposta) -> str:
    tipos = tipos_servico_generalidade(
        proposta.tipo,
        inclui_transferencia=bool(getattr(proposta, 'inclui_transferencia', False)),
        inclui_distribuicao=bool(getattr(proposta, 'inclui_distribuicao', False)),
        inclui_armazenagem=bool(getattr(proposta, 'inclui_armazenagem', False)),
        inclui_op_portuaria=bool(getattr(proposta, 'inclui_op_portuaria', False)),
    )
    labels = dict(TIPO_GENERALIDADE_CHOICES)
    if tipos:
        return ' + '.join(labels.get(tipo, tipo) for tipo in tipos)
    return _tipo_label(proposta.tipo)


def _saudacao(proposta) -> str:
    att = (proposta.att or '').strip()
    if att:
        return f'Prezado(a) {att},'
    return 'Prezados,'


LOGO_CID = 'logo_tccconex'
LOGO_PATH = os.path.abspath(os.path.join(
    os.path.dirname(__file__),
    '..', '..', '..',
    'frontend', 'src', 'assets', 'Logo_Indicadores.png',
))


def _logo_png_bytes() -> bytes | None:
    from .models import ensure_parametros_comercial

    registro = ensure_parametros_comercial()
    if registro.logo_email:
        return bytes(registro.logo_email)
    if registro.logo_pdf:
        return bytes(registro.logo_pdf)
    try:
        with open(LOGO_PATH, 'rb') as handle:
            data = handle.read()
    except OSError:
        return None
    return data or None


def _logo_mime_subtype() -> str:
    from .models import ensure_parametros_comercial

    registro = ensure_parametros_comercial()
    tipo = ''
    if registro.logo_email:
        tipo = registro.logo_email_tipo or ''
    elif registro.logo_pdf:
        tipo = registro.logo_pdf_tipo or ''
    if tipo.startswith('image/'):
        tipo = tipo.split('/', 1)[1]
    tipo = (tipo or 'png').lower().strip()
    if tipo in ('jpg', 'jpeg'):
        return 'jpeg'
    if tipo in ('png', 'gif', 'webp'):
        return tipo
    return 'png'


def _build_context(proposta, user) -> dict:
    from .proposta_tarifas import rotulo_revisao
    cliente = proposta.cliente
    cliente_nome = (getattr(cliente, 'razao_social', None) or proposta.cliente_nome or '').strip() or '—'
    return {
        'proposta': proposta,
        'numero': rotulo_revisao(proposta),
        'cliente_nome': cliente_nome,
        'cliente_cnpj': getattr(cliente, 'cnpj', '') or '—',
        'servico': _servico_label(proposta),
        'emissao': _fmt_date(proposta.data_proposta or (proposta.data_criacao.date() if proposta.data_criacao else None)),
        'validade': proposta.validade or '—',
        'vigencia': proposta.vigencia or '—',
        'vencimento': _fmt_date(proposta.data_vencimento()),
        'saudacao': _saudacao(proposta),
        'enviado_por': _usuario_display(user),
        'enviado_por_cargo': (getattr(user, 'cargo', None) or '').strip(),
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
    return send_propostas_comerciais_email(
        user,
        [(proposta, pdf_bytes)],
        to_emails=to_emails,
        cc_emails=cc_emails,
    )


def send_propostas_comerciais_email(
    user,
    anexos: list[tuple],
    *,
    to_emails: list[str] | None = None,
    cc_emails: list[str] | None = None,
) -> dict:
    google_from = _google_email(user)
    if not google_from:
        raise ValueError('Vincule sua conta Google no perfil para enviar a proposta pelo seu e-mail.')
    if not anexos:
        raise ValueError('Selecione ao menos uma proposta para enviar.')

    propostas = [item[0] for item in anexos]
    pdfs = [item[1] for item in anexos]
    validar_envio_conjunto(propostas)
    if any(not pdf for pdf in pdfs) or len(pdfs) != len(propostas):
        raise ValueError('Não foi possível receber o PDF da proposta gerado na tela. Tente novamente.')

    proposta = propostas[0]
    cliente_email = (getattr(proposta.cliente, 'email', None) or '').strip().lower()
    destinarios = parse_emails(to_emails)
    if not destinarios and cliente_email:
        destinarios = [cliente_email]
    if cliente_email and cliente_email not in destinarios:
        destinarios.insert(0, cliente_email)
    if not destinarios:
        raise ValueError('Cadastre o e-mail do cliente ou informe um destinatário para enviar a proposta.')

    cc = [email for email in parse_emails(cc_emails) if email != google_from]

    contextos = [_build_context(item, user) for item in propostas]
    context = dict(contextos[0])
    numeros = [item['numero'] for item in contextos]
    servicos = [item['servico'] for item in contextos]
    context['numero'] = _juntar_lista(numeros)
    context['servico'] = _juntar_lista(servicos)
    context['plural'] = len(propostas) > 1
    context['itens'] = contextos
    html_body = render_to_string('comercial/emails/proposta.html', context)
    cliente_nome = context['cliente_nome']
    remetente = f'{_usuario_display(user)} <{google_from}>'
    from .proposta_tarifas import assunto_envio_propostas, marcar_envio_historico
    assunto = assunto_envio_propostas(propostas)

    email_obj = EmailMessage(
        subject=assunto,
        body=html_body,
        from_email=remetente,
        to=destinarios,
        cc=cc,
    )
    email_obj.content_subtype = 'html'
    logo_bytes = _logo_png_bytes()
    if logo_bytes:
        subtype = _logo_mime_subtype()
        logo = MIMEImage(logo_bytes, _subtype=subtype)
        logo.add_header('Content-ID', f'<{LOGO_CID}>')
        logo.add_header('Content-Disposition', 'inline', filename=f'logo-proposta.{subtype if subtype != "jpeg" else "jpg"}')
        email_obj.attach(logo)
    for item, pdf, ctx in zip(propostas, pdfs, contextos):
        email_obj.attach(proposta_pdf_filename(ctx['numero'], cliente_nome), pdf, 'application/pdf')
        if item.status == STATUS_PROPOSTA_RASCUNHO:
            item.status = STATUS_PROPOSTA_ENVIADA
        modo = getattr(item, 'modo_envio', '') or ''
        if modo:
            marcar_envio_historico(
                item,
                modo,
                user,
                'Errata enviada ao cliente' if modo == 'errata' else 'Revisão enviada ao cliente',
            )
            item.modo_envio = ''
        item.save(update_fields=['status', 'modo_envio', 'historico_revisoes', 'data_atualizacao'])

    send_gmail_as_user(user, email_obj)

    return {
        'to': destinarios,
        'cc': cc,
        'numero': context['numero'],
        'cliente': cliente_nome,
    }
