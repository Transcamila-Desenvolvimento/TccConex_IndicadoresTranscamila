from __future__ import annotations

import logging
import math
import os
import tempfile
from datetime import datetime
from io import BytesIO

from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import ProtocoloEnvio

logger = logging.getLogger(__name__)

# Altura reservada para assinatura + rodapé no bottomMargin
_SIGNATURE_AREA_HEIGHT = 5.5 * cm
_FOOTER_HEIGHT = 1.6 * cm


def _make_page_callback(protocolo_by_page: list[ProtocoloEnvio]):
    """Retorna um callback que desenha rodapé + assinatura fixa na base de cada página."""

    def callback(canvas, doc):
        canvas.saveState()
        page_idx = max(0, doc.page - 1)
        if not protocolo_by_page:
            canvas.restoreState()
            return
        protocolo = protocolo_by_page[min(page_idx, len(protocolo_by_page) - 1)]

        cliente_nome = protocolo.cliente.nome
        cliente_cnpj = _format_cnpj(protocolo.cliente.cnpj)

        # ── Linha separadora da área de assinatura ──────────────────────────
        sep_y = _SIGNATURE_AREA_HEIGHT + _FOOTER_HEIGHT
        canvas.setStrokeColor(colors.HexColor('#bdc3c7'))
        canvas.setLineWidth(0.6)
        canvas.line(1.5 * cm, sep_y, A4[0] - 1.5 * cm, sep_y)

        # ── Declaração ──────────────────────────────────────────────────────
        decl_y = sep_y - 1.0 * cm
        canvas.setFont('Helvetica', 9)
        canvas.setFillColor(colors.HexColor('#2c3e50'))
        canvas.drawCentredString(
            A4[0] / 2,
            decl_y,
            'Declaro que recebi de TRANSCAMILA CARGAS E ARMAZÉNS GERAIS LTDA, os documentos acima listados:',
        )

        # ── Linha de assinatura ──────────────────────────────────────────────
        sig_y = decl_y - 1.4 * cm
        sig_x_start = A4[0] / 2 - 5 * cm
        sig_x_end = A4[0] / 2 + 5 * cm
        canvas.setStrokeColor(colors.HexColor('#3498db'))
        canvas.setLineWidth(1)
        canvas.line(sig_x_start, sig_y, sig_x_end, sig_y)

        # ── Nome e CNPJ do cliente ───────────────────────────────────────────
        client_y = sig_y - 0.5 * cm
        canvas.setFont('Helvetica', 9)
        canvas.setFillColor(colors.HexColor('#2c3e50'))
        canvas.drawCentredString(
            A4[0] / 2,
            client_y,
            f'{cliente_nome} ({cliente_cnpj})',
        )

        # ── Rodapé de data/página ────────────────────────────────────────────
        canvas.setFont('Helvetica-Bold', 8)
        canvas.setFillColor(colors.HexColor('#7f8c8d'))
        canvas.drawCentredString(
            A4[0] / 2,
            1 * cm,
            f"Emitido em {datetime.now().strftime('%d/%m/%Y %H:%M')} | Página {doc.page}",
        )
        canvas.setFont('Helvetica', 8)
        canvas.drawCentredString(
            A4[0] / 2,
            0.6 * cm,
            '© Transcamila Cargas e Armazéns Gerais LTDA. | Todos os direitos reservados',
        )
        canvas.setStrokeColor(colors.HexColor('#bdc3c7'))
        canvas.setLineWidth(0.8)
        canvas.line(1.5 * cm, 1.4 * cm, A4[0] - 1.5 * cm, 1.4 * cm)

        canvas.restoreState()

    return callback


def _format_cnpj(cnpj: str | None) -> str:
    if not cnpj:
        return 'N/A'
    digits = ''.join(c for c in cnpj if c.isdigit())
    if len(digits) == 14:
        return f'{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}'
    return cnpj


def _logo_path() -> str | None:
    # Logo institucional do protocolo (static/img). Demais caminhos são fallback.
    candidates = [
        settings.BASE_DIR / 'static' / 'img' / 'LogoTcc.png',
        settings.BASE_DIR.parent / 'frontend' / 'src' / 'assets' / 'Logo_TccConex.png',
        settings.BASE_DIR / 'apps' / 'rh' / 'static' / 'rh' / 'img' / 'logo_tccconex.png',
    ]
    for path in candidates:
        if path.exists():
            return str(path)
    return None


def _logo_for_pdf(src_path: str) -> str | None:
    """Prepara a logo para o ReportLab: RGB em fundo branco (sem canal alpha).

    PNG com transparência costuma aparecer com fundo preto no PDF do ReportLab.
    Remove fundo preto opaco (ou já transparente) e compõe sobre branco da página.
    """
    try:
        from PIL import Image as PILImage
    except ImportError:
        logger.warning('Pillow não instalado — usando logo original.')
        return None

    try:
        img = PILImage.open(src_path).convert('RGBA')
        # Fundo preto (e anti-alias quase preto) -> transparente, preservando o recorte do emblema.
        cleaned = [
            (0, 0, 0, 0) if (a < 30 or (r < 40 and g < 40 and b < 40)) else (r, g, b, 255)
            for r, g, b, a in img.getdata()
        ]
        img.putdata(cleaned)

        rgb = PILImage.new('RGB', img.size, (255, 255, 255))
        rgb.paste(img, mask=img.split()[3])
        tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
        rgb.save(tmp.name, 'PNG')
        tmp.close()
        return tmp.name
    except Exception:
        logger.exception('Falha ao processar logo para PDF — usando original.')
        return None


def _build_logo_flowable(logo_path: str | None):
    if not logo_path or not os.path.exists(logo_path):
        return Spacer(1, 2.8 * cm)
    try:
        # Só fixa a largura — ReportLab preserva o aspect ratio da imagem.
        max_width = 5.5 * cm
        max_height = 2.8 * cm
        img = Image(logo_path)
        if img.imageWidth and img.imageHeight:
            ratio = img.imageWidth / float(img.imageHeight)
            width = max_width
            height = width / ratio
            if height > max_height:
                height = max_height
                width = height * ratio
            img.drawWidth = width
            img.drawHeight = height
        else:
            img.drawWidth = max_width
            img.drawHeight = max_height
        return img
    except Exception:
        logger.exception('Falha ao carregar logo no PDF — seguindo sem imagem.')
        return Spacer(1, 2.8 * cm)


def _protocolo_numero(protocolo: ProtocoloEnvio) -> str:
    seq = protocolo.numero_sequencial or protocolo.pk or 0
    return f'{protocolo.data.year}-{seq:04d}'


def generate_pdf_protocol(buffer, protocolos: list[ProtocoloEnvio]) -> None:
    if not protocolos:
        raise ValueError('Nenhum protocolo para gerar PDF.')

    bottom_margin = _SIGNATURE_AREA_HEIGHT + _FOOTER_HEIGHT

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=1 * cm,
        rightMargin=1 * cm,
        topMargin=1.5 * cm,
        bottomMargin=bottom_margin,
    )

    elements = []
    styles = getSampleStyleSheet()

    if 'ProtocolInfoOriginal' not in styles:
        styles.add(ParagraphStyle(
            name='ProtocolInfoOriginal',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#2c3e50'),
            leading=11,
            spaceAfter=5,
        ))

    raw_logo_path = _logo_path()
    processed_logo = _logo_for_pdf(raw_logo_path) if raw_logo_path else None
    logo_path = processed_logo or raw_logo_path
    _tmp_logo = processed_logo

    # Mapeia cada página gerada ao protocolo correspondente (1 protocolo pode ocupar N páginas).
    protocolo_by_page: list[ProtocoloEnvio] = []

    for index, protocolo in enumerate(protocolos):
        if index > 0:
            elements.append(PageBreak())

        indexador = protocolo.usuario_nome or (
            protocolo.usuario.get_full_name() if protocolo.usuario else ''
        ) or (protocolo.usuario.username if protocolo.usuario else '—')

        protocol_data = {
            'protocolo_numero': _protocolo_numero(protocolo),
            'protocolo_cliente': protocolo.cliente.nome if protocolo.cliente_id else '—',
            'data_envio': protocolo.data.strftime('%d/%m/%Y') if protocolo.data else '—',
            'indexador': indexador,
            'expedicao': protocolo.expedicao or 'Não informado',
        }

        raw_nfs = [
            nf.strip()
            for nf in (protocolo.nota_fiscal or '').split(',')
            if nf.strip()
        ]
        notas_filiais = protocolo.notas_filiais if isinstance(protocolo.notas_filiais, dict) else {}

        def _nf_cell(nf: str) -> str:
            filial = notas_filiais.get(nf)
            if filial:
                return f'{nf}  —  {filial}'
            return nf

        items = [(f'{idx:03d}', _nf_cell(nf)) for idx, nf in enumerate(raw_nfs, 1)]
        num_cols = 3
        cells_per_col = 2
        total_items = len(items)
        num_rows = math.ceil(total_items / num_cols) if total_items else 1
        table_data = [[''] * (num_cols * cells_per_col) for _ in range(num_rows)]

        current_idx = 0
        for col in range(num_cols):
            for row in range(num_rows):
                if current_idx < total_items:
                    seq, nf_text = items[current_idx]
                    table_data[row][col * cells_per_col] = seq
                    table_data[row][col * cells_per_col + 1] = nf_text
                    current_idx += 1

        logo = _build_logo_flowable(logo_path)

        expedicao_line = (
            f"<b>EXPEDIÇÃO:</b> {protocol_data['expedicao']}<br/>"
            if protocolo.expedicao
            else ''
        )
        protocol_info = Paragraph(
            f"<b>PROTOCOLO:</b> {protocol_data['protocolo_numero']}<br/>"
            f"<b>CLIENTE:</b> {protocol_data['protocolo_cliente']}<br/>"
            f"{expedicao_line}"
            f"<b>EMISSÃO:</b> {datetime.now().strftime('%d/%m/%Y %H:%M')}<br/>"
            f"<b>DATA DE ENVIO:</b> {protocol_data['data_envio']}<br/>"
            f"<b>INDEXADOR:</b> {protocol_data['indexador']}",
            styles['ProtocolInfoOriginal'],
        )

        header_table = Table([[logo, protocol_info]], colWidths=[6 * cm, 12.5 * cm])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('LEFTPADDING', (1, 0), (1, 0), 15),
            ('RIGHTPADDING', (1, 0), (1, 0), 15),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8f9fa')),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 0.3 * cm))
        elements.append(Table([['']], colWidths=[18.5 * cm], style=[
            ('LINEABOVE', (0, 0), (0, 0), 0.8, colors.HexColor('#3498db')),
        ]))
        elements.append(Spacer(1, 0.5 * cm))

        table_header = ['SEQ', 'Número da NF'] * num_cols
        col_widths = [1.5 * cm, 4.0 * cm] * num_cols
        full_table_data = [table_header] + table_data
        nf_table = Table(full_table_data, colWidths=col_widths, repeatRows=1)
        style_cmds = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498db')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 1), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            # Padding compacto nas linhas de dados para o protocolo cheio
            # (78 NFs = 26 linhas) caber em uma única página A4.
            ('TOPPADDING', (0, 1), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 2),
        ]
        for row_idx, row in enumerate(table_data):
            for col in range(num_cols):
                nf_col = col * cells_per_col + 1
                if ' — ' in str(row[nf_col]):
                    style_cmds.append(('ALIGN', (nf_col, row_idx + 1), (nf_col, row_idx + 1), 'LEFT'))
        nf_table.setStyle(TableStyle(style_cmds))
        elements.append(nf_table)

        # Estimativa conservadora: cada protocolo começa em uma página nova.
        # Páginas extras do mesmo protocolo reutilizam o mesmo cliente no rodapé.
        protocolo_by_page.append(protocolo)

    def _on_page(canvas, doc):
        # Se o protocolo ultrapassar 1 página, reutiliza o último protocolo conhecido.
        while len(protocolo_by_page) < doc.page:
            protocolo_by_page.append(protocolo_by_page[-1])
        _make_page_callback(protocolo_by_page)(canvas, doc)

    doc.build(elements, onFirstPage=_on_page, onLaterPages=_on_page)

    if _tmp_logo and _tmp_logo != raw_logo_path:
        try:
            os.unlink(_tmp_logo)
        except OSError:
            pass


def render_protocols_pdf(protocolos: list[ProtocoloEnvio]) -> bytes:
    buffer = BytesIO()
    generate_pdf_protocol(buffer, protocolos)
    return buffer.getvalue()
