"""Envio do cronograma da auditoria, em um convite próprio da agenda."""

from datetime import date
from email.mime.image import MIMEImage

from django.core.mail import EmailMessage
from django.template.loader import render_to_string

from apps.comercial.proposta_email_service import LOGO_CID, _logo_mime_subtype, _logo_png_bytes

from .models import AUDITORIA_STATUS_CHOICES
from .pesquisa_email_service import parse_emails


def _usuario_display(user) -> str:
    if not user or not getattr(user, 'is_authenticated', False):
        return 'Sistema'
    return user.name or user.get_full_name() or user.username


def _emails_unicos(valor) -> list[str]:
    vistos = []
    chaves = set()
    for email in parse_emails(valor):
        chave = email.lower()
        if chave in chaves:
            continue
        chaves.add(chave)
        vistos.append(email)
    return vistos


def _data_br(valor) -> str:
    if isinstance(valor, date):
        return valor.strftime('%d/%m/%Y')
    if not valor:
        return '—'
    return date.fromisoformat(str(valor)[:10]).strftime('%d/%m/%Y')


_MESES = ('jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez')
_SEMANA = ('segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo')


def _hora(valor: str) -> str:
    texto = str(valor or '')[:5]
    return texto.replace(':', 'h') if texto else '—'


def _partes_data(valor) -> dict:
    dia = valor if isinstance(valor, date) else date.fromisoformat(str(valor)[:10])
    return {
        'data': dia.strftime('%d/%m/%Y'),
        'numero': f'{dia.day:02d}',
        'mes': _MESES[dia.month - 1],
        'semana': _SEMANA[dia.weekday()],
    }


def itens_cronograma(auditoria) -> list[dict]:
    itens = []
    for item in auditoria.planejamento or []:
        atividade = str(item.get('atividade') or '').strip()
        if not item.get('data') or not atividade:
            continue
        partes = _partes_data(item.get('data'))
        itens.append({
            **partes,
            'horario': f"{_hora(item.get('horaInicio'))} às {_hora(item.get('horaFim'))}",
            'atividade': atividade,
        })
    return itens


def _assunto_cronograma(auditoria) -> str:
    nomes = list(auditoria.normas.order_by('nome').values_list('nome', flat=True))
    norma = ', '.join(nomes) or auditoria.titulo
    periodo = f'{_data_br(auditoria.data_inicio)} a {_data_br(auditoria.data_termino)}'
    return f'Cronograma Auditoria {norma} - {periodo} ({auditoria.codigo})'


def send_cronograma_auditoria_email(user, auditoria, *, to_emails, cc_emails=None) -> None:
    destinatarios = _emails_unicos(to_emails)
    if not destinatarios:
        raise ValueError('Informe ao menos um destinatário.')
    itens = itens_cronograma(auditoria)
    if not itens:
        raise ValueError('Lance o planejamento da auditoria antes de enviar o cronograma.')
    ja_usados = {email.lower() for email in destinatarios}
    copias = [email for email in _emails_unicos(cc_emails) if email.lower() not in ja_usados]
    logo = _logo_png_bytes()
    context = {
        'codigo': auditoria.codigo,
        'titulo': auditoria.titulo,
        'categoria': auditoria.categoria,
        'filial': auditoria.filial,
        'periodo': f'{_data_br(auditoria.data_inicio)} a {_data_br(auditoria.data_termino)}',
        'inicio': _partes_data(auditoria.data_inicio),
        'termino': _partes_data(auditoria.data_termino),
        'status': dict(AUDITORIA_STATUS_CHOICES).get(auditoria.status, auditoria.status),
        'auditor_lider': auditoria.auditor_lider or '—',
        'auditores': ', '.join(auditoria.auditores or []) or '—',
        'normas': ', '.join(auditoria.normas.order_by('nome').values_list('nome', flat=True)) or '—',
        'assunto': _assunto_cronograma(auditoria),
        'escopo': (auditoria.escopo or '').strip(),
        'itens': itens,
        'saudacao': 'Prezados,',
        'enviado_por': _usuario_display(user),
        'enviado_por_cargo': (getattr(user, 'cargo', None) or '').strip(),
        'enviado_por_telefone': (getattr(user, 'telefone', None) or '').strip(),
        'logo_cid': LOGO_CID if logo else '',
    }
    html = render_to_string('sgq/emails/cronograma_auditoria.html', context)
    email = EmailMessage(
        subject=context['assunto'],
        body=html,
        to=destinatarios,
        cc=copias,
    )
    email.content_subtype = 'html'
    if logo:
        subtype = _logo_mime_subtype()
        imagem = MIMEImage(logo, _subtype=subtype)
        imagem.add_header('Content-ID', f'<{LOGO_CID}>')
        imagem.add_header('Content-Disposition', 'inline', filename=f'logo.{subtype if subtype != "jpeg" else "jpg"}')
        email.attach(imagem)
    email.send(fail_silently=False)
