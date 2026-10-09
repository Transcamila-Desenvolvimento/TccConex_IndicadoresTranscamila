import os
from io import BytesIO
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.accounts.cpf import formatar_cpf
from apps.camilo.models import TermoAceite
from apps.camilo.termo import ASSINATURA

_ASSETS = os.path.join(os.path.dirname(__file__), 'assets')
_LOGO_CAMILO = os.path.join(_ASSETS, 'camilo-logo.png')
_LOGO_TRANSCAMILA = os.path.join(_ASSETS, 'Logo_Indicadores.png')

CINZA = colors.HexColor('#374151')
MUTED = colors.HexColor('#6b7280')


def _estilo(nome: str, **kwargs) -> ParagraphStyle:
    base = dict(
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=CINZA,
    )
    base.update(kwargs)
    return ParagraphStyle(nome, **base)


def _logo(caminho: str, altura: float) -> Image | None:
    if not os.path.isfile(caminho):
        return None
    largura_px, altura_px = ImageReader(caminho).getSize()
    if not altura_px:
        return None
    imagem = Image(caminho, width=altura * (largura_px / altura_px), height=altura, mask='auto')
    return imagem


def _cabecalho_logos() -> list:
    altura = 0.72 * cm
    camilo = _logo(_LOGO_CAMILO, altura)
    transcamila = _logo(_LOGO_TRANSCAMILA, altura)
    if camilo is None and transcamila is None:
        return []
    camilo = camilo or Spacer(1, altura)
    transcamila = transcamila or Spacer(1, altura)
    camilo.hAlign = 'LEFT'
    transcamila.hAlign = 'RIGHT'
    largura = A4[0] - 4 * cm
    tabela = Table([[camilo, transcamila]], colWidths=[largura / 2, largura / 2])
    tabela.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LINEBELOW', (0, 0), (-1, -1), 0.4, colors.HexColor('#e5e7eb')),
    ]))
    return [tabela, Spacer(1, 28)]


def cpf_do_aceite(aceite: TermoAceite) -> str:
    gravado = formatar_cpf(aceite.cpf or '')
    if gravado:
        return gravado
    usuario = getattr(aceite, 'usuario', None)
    if usuario is not None:
        return formatar_cpf(getattr(usuario, 'cpf', '') or '')
    return ''


def comprovante_pdf(aceite: TermoAceite) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2.8 * cm,
        bottomMargin=1.8 * cm,
        title='Comprovante de aceitação do termo de uso do Camilo IA',
    )
    texto = aceite.texto or {}
    quando = timezone.localtime(aceite.aceito_em).strftime('%d/%m/%Y às %H:%M')
    titulo = ParagraphStyle(
        'titulo',
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#111827'),
        alignment=0,
        spaceAfter=4,
    )
    secao = ParagraphStyle(
        'secao',
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#111827'),
        spaceBefore=12,
        spaceAfter=4,
    )
    corpo = _estilo('corpo', alignment=4)
    meta = _estilo('meta', fontSize=10, leading=14, textColor=MUTED)
    declaracao = _estilo('declaracao', fontName='Helvetica-Oblique', spaceBefore=16)

    story = [
        *_cabecalho_logos(),
        Paragraph('Comprovante de aceitação', titulo),
        Paragraph(escape(str(texto.get('titulo') or 'Termo de uso do Camilo IA')), _estilo('sub', alignment=0, spaceAfter=8)),
        Paragraph(escape(str(texto.get('assinatura') or ASSINATURA)), meta),
        Spacer(1, 14),
        Paragraph(f'<b>Protocolo:</b> {escape(str(aceite.id))}', corpo),
        Paragraph(f'<b>Colaborador:</b> {escape(aceite.nome or aceite.username)}', corpo),
        Paragraph(f'<b>CPF:</b> {escape(cpf_do_aceite(aceite) or "não informado")}', corpo),
        Paragraph(f'<b>Usuário:</b> {escape(aceite.username)}', corpo),
        Paragraph(f'<b>Aceito em:</b> {escape(quando)}', corpo),
        Paragraph(f'<b>Versão do termo:</b> {escape(aceite.versao)}', corpo),
        Spacer(1, 8),
    ]
    if aceite.ip:
        story.append(Paragraph(f'<b>Endereço de origem:</b> {escape(aceite.ip)}', corpo))

    introducao = str(texto.get('introducao') or '').strip()
    if introducao:
        story.append(Spacer(1, 10))
        story.append(Paragraph(escape(introducao), corpo))

    for item in texto.get('secoes') or []:
        story.append(Paragraph(escape(str(item.get('titulo') or '')), secao))
        story.append(Paragraph(escape(str(item.get('texto') or '')), corpo))

    declaracao_texto = str(texto.get('declaracao') or 'Li e concordo com o termo de uso do Camilo IA.')
    story.append(Paragraph(
        f'O colaborador declarou: “{escape(declaracao_texto)}”',
        declaracao,
    ))
    story.append(Spacer(1, 18))
    story.append(Paragraph(
        'Este comprovante registra o aceite do termo de uso do Camilo IA no TccConex.',
        meta,
    ))

    doc.build(story)
    return buffer.getvalue()
