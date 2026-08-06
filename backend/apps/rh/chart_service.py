import io

from PIL import Image, ImageDraw, ImageFont

# Paleta alinhada ao RHPayrollChart / design system TccConex
_COLOR_LINE = (17, 140, 196)           # #118CC4
_COLOR_FILL = (226, 241, 248)          # ~ rgba(17,140,196,0.12) sobre branco
_COLOR_TEXT_DARK = (15, 23, 42)        # #0f172a
_COLOR_TEXT_MUTED = (100, 116, 139)    # #64748b
_COLOR_TEXT_CURRENT = (17, 140, 196)   # #118CC4
_COLOR_GRID = (226, 232, 240)          # #e2e8f0
_COLOR_WHITE = (255, 255, 255)

_SCALE = 2


def _font(size):
    try:
        return ImageFont.load_default(size=size * _SCALE)
    except TypeError:
        return ImageFont.load_default()


def _text_width(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]


def _fit_font(draw, text, max_width, base_size):
    for size in range(base_size, base_size - 5, -1):
        font = _font(max(size, 7))
        if _text_width(draw, text, font) <= max_width:
            return font
    return _font(7)


def gerar_grafico_evolucao_folha(historico):
    """Gera gráfico de linha da evolução da folha (PNG bytes) para inline no e-mail.

    `historico`: lista de dicts com 'label', 'valor', 'valor_str' e opcional 'atual'.
    """
    if not historico:
        return b''

    n = len(historico)
    w, h = 640 * _SCALE, 230 * _SCALE
    pad_x = 24 * _SCALE
    top_pad = 34 * _SCALE
    bottom_pad = 32 * _SCALE
    chart_h = h - top_pad - bottom_pad

    img = Image.new('RGB', (w, h), _COLOR_WHITE)
    draw = ImageDraw.Draw(img)

    font_label = _font(11)
    usable_w = w - (pad_x * 2)
    slot_w = usable_w / max(n - 1, 1)
    label_max_w = slot_w * 0.95 if n > 1 else usable_w * 0.4

    max_valor = max((float(item['valor']) for item in historico), default=0) or 1
    y_max = max_valor * 1.08

    baseline_y = top_pad + chart_h
    draw.line([(pad_x - 4 * _SCALE, baseline_y), (w - pad_x + 4 * _SCALE, baseline_y)], fill=_COLOR_GRID, width=2)

    for step in range(1, 4):
        gy = baseline_y - (chart_h * step / 4)
        draw.line([(pad_x, gy), (w - pad_x, gy)], fill=_COLOR_GRID, width=1)

    points = []
    for i, item in enumerate(historico):
        cx = pad_x + slot_w * i if n > 1 else w / 2
        valor = float(item['valor'])
        ratio = valor / y_max if y_max else 0
        cy = baseline_y - ratio * (chart_h - 20 * _SCALE)
        points.append((cx, cy, item))

    if len(points) >= 2:
        fill_poly = [(points[0][0], baseline_y)]
        fill_poly.extend((p[0], p[1]) for p in points)
        fill_poly.append((points[-1][0], baseline_y))
        draw.polygon(fill_poly, fill=_COLOR_FILL)

        for i in range(len(points) - 1):
            draw.line(
                [points[i][:2], points[i + 1][:2]],
                fill=_COLOR_LINE,
                width=int(2.5 * _SCALE),
            )

    for cx, cy, item in points:
        is_current = bool(item.get('atual'))
        radius = int(4.5 * _SCALE) if is_current else int(3.5 * _SCALE)
        draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=_COLOR_LINE)
        inner = max(radius - int(1.2 * _SCALE), 1)
        draw.ellipse(
            [cx - inner, cy - inner, cx + inner, cy + inner],
            fill=_COLOR_WHITE if not is_current else _COLOR_LINE,
        )

        value_text = item.get('valor_str', '')
        base_size = 12 if is_current else 11
        vf = _fit_font(draw, value_text, label_max_w, base_size)
        vc = _COLOR_TEXT_CURRENT if is_current else _COLOR_TEXT_MUTED
        tw = _text_width(draw, value_text, vf)
        draw.text((cx - tw / 2, cy - 22 * _SCALE), value_text, font=vf, fill=vc)

        label_text = item.get('label', '')
        lf = _font(12) if is_current else font_label
        lc = _COLOR_TEXT_CURRENT if is_current else _COLOR_TEXT_MUTED
        tw2 = _text_width(draw, label_text, lf)
        draw.text((cx - tw2 / 2, baseline_y + 8 * _SCALE), label_text, font=lf, fill=lc)

    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return buffer.getvalue()
