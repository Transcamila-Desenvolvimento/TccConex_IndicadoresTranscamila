"""Envio do cronograma da auditoria, em um convite próprio da agenda."""

from datetime import date, datetime, timedelta, timezone
from email import encoders
from email.mime.base import MIMEBase
from email.mime.image import MIMEImage

from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

from apps.comercial.proposta_email_service import LOGO_CID, _logo_mime_subtype, _logo_png_bytes

from .models import AUDITORIA_STATUS_CHOICES
from .pesquisa_email_service import parse_emails
from .serializers import html_email_texto_formatado


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


def _instante_ics(valor, hora: str) -> str | None:
    try:
        dia = valor if isinstance(valor, date) else date.fromisoformat(str(valor)[:10])
        horas, minutos = str(hora or '')[:5].split(':')
        if int(horas) > 23 or int(minutos) > 59:
            return None
    except (TypeError, ValueError):
        return None
    return f'{dia:%Y%m%d}T{int(horas):02d}{int(minutos):02d}00'


def _ics_texto(valor: str) -> str:
    texto = str(valor or '').replace('—', '-').replace('–', '-')
    return (
        texto
        .replace('\\', '\\\\')
        .replace('\r\n', '\\n')
        .replace('\n', '\\n')
        .replace(',', '\\,')
        .replace(';', '\\;')
    )


def _ics_linha(conteudo: str) -> str:
    if len(conteudo.encode('utf-8')) <= 73:
        return conteudo
    partes = []
    atual = ''
    for caractere in conteudo:
        if len((atual + caractere).encode('utf-8')) > 73:
            partes.append(atual)
            atual = ' ' + caractere
        else:
            atual += caractere
    partes.append(atual)
    return '\r\n'.join(partes)


def _eventos_agenda(auditoria) -> list[dict]:
    eventos = []
    for item in auditoria.planejamento or []:
        atividade = str(item.get('atividade') or '').strip()
        inicio = _instante_ics(item.get('data'), item.get('horaInicio'))
        fim = _instante_ics(item.get('data'), item.get('horaFim'))
        if not atividade or not inicio or not fim or fim <= inicio:
            continue
        eventos.append({
            'atividade': atividade,
            'inicio': inicio,
            'fim': fim,
            'hora_inicio': str(item.get('horaInicio') or '')[:5],
            'hora_fim': str(item.get('horaFim') or '')[:5],
            'data': _data_br(item.get('data')),
        })
    return eventos


def _titulo_compromisso(auditoria, atividade: str) -> str:
    tipo = str(auditoria.categoria or '').strip()
    filial = str(auditoria.filial or '').strip()
    prefixo = ' '.join(parte for parte in (tipo, filial) if parte)
    if prefixo:
        return f'{atividade} - {prefixo}'
    return atividade


def _nome_auditoria(auditoria) -> str:
    return str(auditoria.titulo or '').strip() or str(auditoria.codigo or '').strip()


def _parte_agenda(linhas: list[str], filename: str) -> MIMEBase:
    bloco = [
        'BEGIN:VCALENDAR',
        'PRODID:-//TccConex//SGQ//PT',
        'VERSION:2.0',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        *linhas,
        'END:VCALENDAR',
    ]
    parte = MIMEBase('text', 'calendar', charset='UTF-8', method='PUBLISH')
    parte.set_payload(('\r\n'.join(_ics_linha(linha) for linha in bloco) + '\r\n').encode('utf-8'))
    encoders.encode_base64(parte)
    parte.add_header('Content-Disposition', 'attachment', filename=filename)
    return parte


def _evento_tema(auditoria, carimbo: str) -> list[str] | None:
    """Compromisso do dia, com o nome da auditoria, para o cartão não pegar um horário qualquer."""
    try:
        inicio = auditoria.data_inicio
        termino = auditoria.data_termino
        dia_inicio = inicio if isinstance(inicio, date) else date.fromisoformat(str(inicio)[:10])
        dia_fim = termino if isinstance(termino, date) else date.fromisoformat(str(termino)[:10])
    except (TypeError, ValueError):
        return None
    if dia_fim < dia_inicio:
        return None
    return [
        'BEGIN:VEVENT',
        f'UID:{auditoria.pk}-auditoria@tccconex.local',
        f'DTSTAMP:{carimbo}',
        f'DTSTART;VALUE=DATE:{dia_inicio:%Y%m%d}',
        f'DTEND;VALUE=DATE:{(dia_fim + timedelta(days=1)):%Y%m%d}',
        f'SUMMARY:{_ics_texto(_nome_auditoria(auditoria))}',
        f'DESCRIPTION:{_ics_texto(auditoria.codigo)}',
        'TRANSP:TRANSPARENT',
        'END:VEVENT',
    ]


def _anexos_agenda(auditoria) -> list[MIMEBase]:
    """O primeiro arquivo nomeia o cartão. Cada horário seguinte entra separado na agenda."""
    eventos = sorted(_eventos_agenda(auditoria), key=lambda evento: evento['inicio'])
    carimbo = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    anexos = []
    tema = _evento_tema(auditoria, carimbo)
    if tema:
        anexos.append(_parte_agenda(tema, f'cronograma-{auditoria.codigo}.ics'))
    for indice, evento in enumerate(eventos):
        bloco = [
            'BEGIN:VEVENT',
            f'UID:{auditoria.pk}-{indice}@tccconex.local',
            f'DTSTAMP:{carimbo}',
            f'DTSTART:{evento["inicio"]}',
            f'DTEND:{evento["fim"]}',
            f'SUMMARY:{_ics_texto(_titulo_compromisso(auditoria, evento["atividade"]))}',
            f'DESCRIPTION:{_ics_texto(auditoria.codigo)}',
            'BEGIN:VALARM',
            'ACTION:DISPLAY',
            'DESCRIPTION:Lembrete',
            'TRIGGER:-PT30M',
            'END:VALARM',
            'END:VEVENT',
        ]
        anexos.append(_parte_agenda(bloco, f'cronograma-{auditoria.codigo}-{indice + 1:02d}.ics'))
    return anexos


def _texto_simples(context) -> str:
    linhas = [
        context['saudacao'],
        '',
        f"Segue o cronograma da auditoria {context['codigo']}, {context['titulo']}, de {context['periodo']}.",
        '',
        f"Status: {context['status']}",
        f"Filial: {context['filial']}",
        f"Categoria: {context['categoria']}",
        f"Auditor líder: {context['auditor_lider']}",
        f"Auditores: {context['auditores']}",
        f"Normas: {context['normas']}",
        '',
        'Programação',
    ]
    for item in context['itens']:
        linhas.append(f"{item['data']} {item['semana']} {item['horario']} {item['atividade']}")
    linhas.extend([
        '',
        'O cartão mostra o nome da auditoria. Cada horário segue neste e-mail, em um arquivo próprio, e entra separado na agenda.',
    ])
    linhas.extend([
        '',
        context['enviado_por'],
        'Gestão da Qualidade · Transcamila Cargas e Armazéns Gerais Ltda.',
    ])
    return '\n'.join(linhas)


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
        'escopo': html_email_texto_formatado(auditoria.escopo),
        'itens': itens,
        'saudacao': 'Prezados,',
        'enviado_por': _usuario_display(user),
        'enviado_por_cargo': (getattr(user, 'cargo', None) or '').strip(),
        'enviado_por_telefone': (getattr(user, 'telefone', None) or '').strip(),
        'logo_cid': LOGO_CID if logo else '',
    }
    html = render_to_string('sgq/emails/cronograma_auditoria.html', context)
    email = EmailMultiAlternatives(
        subject=context['assunto'],
        body=_texto_simples(context),
        to=destinatarios,
        cc=copias,
    )
    email.attach_alternative(html, 'text/html')
    if logo:
        subtype = _logo_mime_subtype()
        imagem = MIMEImage(logo, _subtype=subtype)
        imagem.add_header('Content-ID', f'<{LOGO_CID}>')
        imagem.add_header('Content-Disposition', 'inline', filename=f'logo.{subtype if subtype != "jpeg" else "jpg"}')
        email.attach(imagem)
    for anexo in _anexos_agenda(auditoria):
        email.attach(anexo)
    email.send(fail_silently=False)
