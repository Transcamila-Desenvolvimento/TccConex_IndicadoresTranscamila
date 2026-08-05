from __future__ import annotations

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

from .models import ProtocoloEnvio

LABEL_W = 9.5 * cm
LABEL_H = 2.7 * cm
COLS = 2
ROWS = 8
LABELS_PER_PAGE = COLS * ROWS
MARGIN_LEFT = 1.0 * cm
MARGIN_TOP = 1.0 * cm
GAP_X = 0.5 * cm
GAP_Y = 0.25 * cm
PAD_X = 0.4 * cm
PAD_Y = 0.2 * cm
LINE_STEP = 0.52 * cm


def _protocolo_numero(protocolo: ProtocoloEnvio) -> str:
    seq = protocolo.numero_sequencial or protocolo.pk or 0
    return f'{protocolo.data.year}-{seq:04d}'


def _truncate_text(c: canvas.Canvas, text: str, font_name: str, font_size: float, max_width: float) -> str:
    if c.stringWidth(text, font_name, font_size) <= max_width:
        return text
    ellipsis = '…'
    while text and c.stringWidth(text + ellipsis, font_name, font_size) > max_width:
        text = text[:-1]
    return (text + ellipsis) if text else ellipsis


def _draw_label(c: canvas.Canvas, x: float, y: float, protocolo: ProtocoloEnvio) -> None:
    c.setStrokeColor(colors.HexColor('#cbd5e1'))
    c.setLineWidth(0.8)
    c.rect(x, y, LABEL_W, LABEL_H, stroke=1, fill=0)

    inner_w = LABEL_W - 2 * PAD_X
    text_x = x + PAD_X
    cursor_y = y + LABEL_H - PAD_Y - 0.28 * cm

    c.setFillColor(colors.HexColor('#0f172a'))
    c.setFont('Helvetica-Bold', 11)
    c.drawString(text_x, cursor_y, 'Protocolo')
    cursor_y -= LINE_STEP

    cliente_nome = protocolo.cliente.nome if protocolo.cliente_id else '—'
    c.setFont('Helvetica-Bold', 10)
    c.drawString(text_x, cursor_y, _truncate_text(c, cliente_nome, 'Helvetica-Bold', 10, inner_w))
    cursor_y -= LINE_STEP

    c.setFont('Helvetica', 10)
    c.drawString(text_x, cursor_y, _protocolo_numero(protocolo))
    cursor_y -= LINE_STEP

    if protocolo.expedicao:
        c.setFont('Helvetica', 8)
        c.setFillColor(colors.HexColor('#475569'))
        expedicao = _truncate_text(
            c,
            f'Expedição: {protocolo.expedicao}',
            'Helvetica',
            8,
            inner_w,
        )
        c.drawString(text_x, cursor_y, expedicao)


def generate_labels_pdf(buffer, protocolos: list[ProtocoloEnvio]) -> None:
    if not protocolos:
        raise ValueError('Nenhum protocolo para gerar etiquetas.')

    page_width, page_height = A4
    c = canvas.Canvas(buffer, pagesize=A4)

    for idx, protocolo in enumerate(protocolos):
        pos_on_page = idx % LABELS_PER_PAGE
        if idx > 0 and pos_on_page == 0:
            c.showPage()

        col = pos_on_page % COLS
        row = pos_on_page // COLS
        x = MARGIN_LEFT + col * (LABEL_W + GAP_X)
        y = page_height - MARGIN_TOP - (row + 1) * LABEL_H - row * GAP_Y
        _draw_label(c, x, y, protocolo)

    c.save()


def render_protocol_labels_pdf(protocolos: list[ProtocoloEnvio]) -> bytes:
    buffer = BytesIO()
    generate_labels_pdf(buffer, protocolos)
    return buffer.getvalue()
