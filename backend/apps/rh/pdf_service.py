import base64
import io
import os

from django.template.loader import render_to_string
from django.utils import timezone
from xhtml2pdf import pisa

_LOGO_PATH = os.path.join(os.path.dirname(__file__), 'static', 'rh', 'img', 'logo_tccconex.png')


def _logo_base64():
    try:
        with open(_LOGO_PATH, 'rb') as f:
            return base64.b64encode(f.read()).decode('ascii')
    except OSError:
        return ''


def gerar_pdf_relatorio_movimentacoes(context):
    """Renderiza o template do relatório de movimentações de RH e retorna os bytes do PDF gerado."""
    pdf_context = dict(context)
    pdf_context['logo_base64'] = _logo_base64()
    pdf_context['gerado_em'] = timezone.localtime(timezone.now()).strftime('%d/%m/%Y às %H:%M')

    html = render_to_string('rh/pdf_relatorio_movimentacoes.html', pdf_context)

    buffer = io.BytesIO()
    resultado = pisa.CreatePDF(src=html, dest=buffer, encoding='utf-8')
    if resultado.err:
        raise RuntimeError('Falha ao gerar o PDF do relatório de movimentações.')
    return buffer.getvalue()
