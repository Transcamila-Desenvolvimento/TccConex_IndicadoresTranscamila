import io

from PIL import Image, ImageDraw, ImageFont

# Paleta do design system do TccConex (frontend/src/styles/style.css)
_COLOR_BAR_PAST = (207, 233, 247)      # azul claro (#cfe9f7)
_COLOR_BAR_CURRENT = (17, 140, 196)    # azul primário (#118CC4)
_COLOR_TEXT_DARK = (15, 23, 42)        # #0f172a
_COLOR_TEXT_MUTED = (100, 116, 139)    # #64748b
_COLOR_TEXT_CURRENT = (17, 140, 196)   # #118CC4
_COLOR_BASELINE = (226, 232, 240)      # #e2e8f0
_COLOR_WHITE = (255, 255, 255)

_SCALE = 2  # renderiza em alta resolução (retina) e exibe reduzido via CSS


def _font(size):
    try:
        return ImageFont.load_default(size=size * _SCALE)
    except TypeError:
        return ImageFont.load_default()


def _text_width(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]


def _fit_font(draw, text, max_width, base_size, bold=False):
    """Reduz o tamanho da fonte até o texto (valor completo em R$) caber no espaço da barra."""
    for size in range(base_size, base_size - 5, -1):
        font = _font(max(size, 7))
        if _text_width(draw, text, font) <= max_width:
            return font
    return _font(7)


def gerar_grafico_evolucao_folha(historico):
    """Gera um gráfico de barras simples (folha de pagamento nos últimos meses) como PNG (bytes).

    `historico`: lista de dicts com chaves 'label' (str), 'valor' (Decimal/float) e
    'valor_str' (str já formatado, ex: 'R$ 244k'), em ordem cronológica (mais antigo -> atual).

    Os bytes retornados devem ser anexados ao e-mail como imagem inline (Content-ID),
    já que a maioria dos clientes de e-mail (Gmail incluso) bloqueia imagens em base64
    embutidas diretamente no HTML (`data:image/...;base64,...`).
    """
    if not historico:
        return b''

    n = len(historico)
    w, h = 640 * _SCALE, 230 * _SCALE
    pad_x = 20 * _SCALE
    top_pad = 38 * _SCALE
    bottom_pad = 30 * _SCALE
    chart_h = h - top_pad - bottom_pad

    img = Image.new('RGB', (w, h), _COLOR_WHITE)
    draw = ImageDraw.Draw(img)

    font_label = _font(11)

    max_valor = max((float(item['valor']) for item in historico), default=0) or 1

    usable_w = w - (pad_x * 2)
    slot_w = usable_w / n
    bar_w = min(slot_w * 0.5, 62 * _SCALE)
    label_max_w = slot_w * 0.92

    baseline_y = top_pad + chart_h
    draw.line([(pad_x - 6 * _SCALE, baseline_y), (w - pad_x + 6 * _SCALE, baseline_y)], fill=_COLOR_BASELINE, width=2)

    for i, item in enumerate(historico):
        is_current = bool(item.get('atual'))
        valor = float(item['valor'])
        bar_h = max((valor / max_valor) * (chart_h - 26 * _SCALE), 6 * _SCALE)

        cx = pad_x + slot_w * i + slot_w / 2
        x0 = cx - bar_w / 2
        x1 = cx + bar_w / 2
        y1 = baseline_y
        y0 = baseline_y - bar_h

        color = _COLOR_BAR_CURRENT if is_current else _COLOR_BAR_PAST
        radius = min(6 * _SCALE, bar_w / 2)
        draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=color)

        value_text = item.get('valor_str', '')
        base_size = 12 if is_current else 11
        vf = _fit_font(draw, value_text, label_max_w, base_size)
        vc = _COLOR_TEXT_CURRENT if is_current else _COLOR_TEXT_MUTED
        tw = _text_width(draw, value_text, vf)
        draw.text((cx - tw / 2, y0 - 22 * _SCALE), value_text, font=vf, fill=vc)

        label_text = item.get('label', '')
        lf = _font(12) if is_current else font_label
        lc = _COLOR_TEXT_CURRENT if is_current else _COLOR_TEXT_MUTED
        tw2 = _text_width(draw, label_text, lf)
        draw.text((cx - tw2 / 2, baseline_y + 8 * _SCALE), label_text, font=lf, fill=lc)

    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return buffer.getvalue()
