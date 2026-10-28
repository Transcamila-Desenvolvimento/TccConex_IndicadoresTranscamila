"""Termo de recebimento de uniforme, o mesmo documento impresso na tela."""

from io import BytesIO
from pathlib import Path

from django.conf import settings
from django.utils import timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

DECLARACAO = (
    'Declaro neste ato, que todos os uniformes especificados e entregues GRATUITAMENTE nesta data são '
    'para exercício da minha função, sendo os mesmos de propriedade da empresa bem como a obrigatoriedade '
    'de seu uso no exercício das minhas atividades, comprometendo-me assim a respeitar e cumprir o que segue abaixo:'
)
REGRAS = [
    'Fazer uso do uniforme, abstendo-me de usá-lo para fins extraprofissionais;',
    'Zelar pela boa conservação deste;',
    'Nos casos de perda, roubo ou extravio, o colaborador deverá comunicar imediatamente ao Departamento Pessoal, '
    'para que sejam tomadas as providências cabíveis. Lembrando que no caso de perda os indenizarei no valor integral.',
    'Em caso de demissão, o uniforme deverá ser devolvido ao Departamento Pessoal no momento da assinatura do aviso prévio.',
]
TAMANHO_UNICO = {'', '-', 'U', 'UN', 'UNICO', 'ÚNICO', 'TAMANHO ÚNICO', 'TAMANHO UNICO'}


def gerar_termo_pdf(entrega) -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    largura, altura = A4
    margem = 18 * mm
    direita = largura - margem
    miolo = direita - margem
    y = altura - 16 * mm

    logo = _logo()
    if logo:
        imagem = ImageReader(logo)
        px_w, px_h = imagem.getSize()
        logo_h = 11 * mm
        logo_w = logo_h * (px_w / px_h) if px_h else 40 * mm
        if logo_w > 50 * mm:
            logo_w = 50 * mm
            logo_h = logo_w * (px_h / px_w)
        pdf.drawImage(imagem, margem, y - logo_h + 4 * mm, logo_w, logo_h, mask='auto')

    pdf.setFillColorRGB(0.35, 0.35, 0.35)
    pdf.setFont('Helvetica', 8)
    pdf.drawRightString(direita, y, f'Nº {entrega.numero}')

    y -= 16 * mm
    pdf.setFillColorRGB(0.08, 0.08, 0.08)
    pdf.setFont('Helvetica-Bold', 13)
    pdf.drawCentredString(largura / 2, y, 'TERMO DE RECEBIMENTO DE UNIFORME')
    y -= 3 * mm
    pdf.setStrokeColorRGB(0.08, 0.08, 0.08)
    pdf.setLineWidth(0.8)
    pdf.line(margem, y, direita, y)

    y -= 8 * mm
    y = _campos(pdf, margem, direita, y, [
        ('NOME', (entrega.colaborador_nome or '').upper()),
        ('CARGO', (entrega.colaborador_cargo or '—').upper()),
        ('CPF', _cpf(entrega.colaborador_cpf)),
        ('SETOR', (entrega.colaborador_setor or '—').upper()),
    ])
    y -= 6 * mm

    y = _paragrafo(pdf, DECLARACAO, margem, y, miolo, 'Helvetica', 10, 4.6 * mm)
    y -= 4 * mm
    pdf.setFont('Helvetica-Bold', 10)
    pdf.drawString(margem, y, 'REGRAS BÁSICAS')
    y -= 6 * mm
    for indice, regra in enumerate(REGRAS, start=1):
        pdf.setFont('Helvetica', 10)
        pdf.drawString(margem, y, f'{indice}.')
        y = _paragrafo(pdf, regra, margem + 8 * mm, y, miolo - 8 * mm, 'Helvetica', 10, 4.6 * mm)
        y -= 1.5 * mm
    y -= 4 * mm
    pdf.setFont('Helvetica-Bold', 10)
    pdf.drawString(margem, y, 'RELAÇÃO DE UNIFORMES ENTREGUES:')
    y -= 4 * mm

    colunas = [26 * mm, 16 * mm, miolo - 94 * mm, 52 * mm]
    cabecalho = ['DATA', 'QTD', 'DESCRIÇÃO', 'ASSINATURA']
    y = _tabela(pdf, margem, y, colunas, cabecalho, [
        [_data(entrega.data_entrega), str(item.quantidade), _descricao(item), '']
        for item in entrega.itens.all()
    ])
    y -= 6 * mm

    if entrega.observacoes:
        y = _paragrafo(
            pdf, f'Observações: {entrega.observacoes}', margem, y, miolo, 'Helvetica', 9.5, 4.4 * mm,
        )
        y -= 3 * mm

    y -= 8 * mm
    if y < 40 * mm:
        pdf.showPage()
        y = altura - 20 * mm
    _assinatura(pdf, margem, direita, y, 'Data: ', _data(entrega.data_entrega), 'Assinatura:')
    _assinatura(pdf, margem, direita, y - 11 * mm, 'Data da Devolução: ', '', 'Recebido por:')

    pdf.setFillColorRGB(0.35, 0.35, 0.35)
    pdf.setFont('Helvetica', 7.5)
    emitido = timezone.localtime().strftime('%d/%m/%Y %H:%M')
    pdf.drawCentredString(
        largura / 2,
        10 * mm,
        f'Termo {entrega.numero} · entregue por {entrega.usuario_nome or "—"} · emitido em {emitido}',
    )
    pdf.save()
    return buffer.getvalue()


def _logo() -> str | None:
    candidatos = [
        Path(settings.BASE_DIR) / 'apps' / 'compras' / 'assets' / 'logo-transcamila-30-anos.png',
        Path(settings.BASE_DIR).parent / 'frontend' / 'src' / 'assets' / 'logo-transcamila-30-anos.png',
    ]
    for caminho in candidatos:
        if caminho.is_file():
            return str(caminho)
    return None


def _cpf(valor: str) -> str:
    digitos = ''.join(caractere for caractere in (valor or '') if caractere.isdigit())
    if len(digitos) != 11:
        return valor or '—'
    return f'{digitos[:3]}.{digitos[3:6]}.{digitos[6:9]}-{digitos[9:]}'


def _data(valor) -> str:
    if hasattr(valor, 'strftime'):
        return valor.strftime('%d/%m/%Y')
    texto = str(valor or '')
    partes = texto[:10].split('-')
    if len(partes) == 3 and len(partes[0]) == 4:
        return f'{partes[2]}/{partes[1]}/{partes[0]}'
    return texto


def _descricao(item) -> str:
    tamanho = (item.uniforme_tamanho or '').strip().upper()
    partes = [(item.uniforme_nome or '').upper()]
    if tamanho not in TAMANHO_UNICO:
        partes.append(f'TAM {tamanho}')
    descricao = ' – '.join(partes)
    if item.condicao == 'usado':
        descricao = f'{descricao} (USADO)'
    return descricao


def _campos(pdf, esquerda: float, direita: float, y: float, campos: list[tuple[str, str]]) -> float:
    miolo = direita - esquerda
    intervalo = 8 * mm
    coluna = (miolo - intervalo) / 2
    for inicio in range(0, len(campos), 2):
        par = campos[inicio:inicio + 2]
        bases = []
        for indice, (rotulo, valor) in enumerate(par):
            x = esquerda + indice * (coluna + intervalo)
            bases.append(_campo(pdf, x, y, coluna, rotulo, valor))
        y = min(bases) - 5 * mm
    return y


def _campo(pdf, x: float, y: float, largura: float, rotulo: str, valor: str) -> float:
    prefixo = f'{rotulo}: '
    pdf.setFillColorRGB(0.08, 0.08, 0.08)
    pdf.setFont('Helvetica-Bold', 10)
    pdf.drawString(x, y, prefixo)
    largura_prefixo = stringWidth(prefixo, 'Helvetica-Bold', 10)
    palavras = (valor or '—').split()
    linha = ''
    primeira = True
    limite = max(largura - largura_prefixo, 20 * mm)
    cursor = y
    for palavra in palavras:
        candidato = palavra if not linha else f'{linha} {palavra}'
        if stringWidth(candidato, 'Helvetica', 10) <= limite:
            linha = candidato
            continue
        if linha:
            pdf.setFont('Helvetica', 10)
            pdf.drawString(x + (largura_prefixo if primeira else 0), cursor, linha)
            primeira = False
            cursor -= 4.6 * mm
            limite = largura
        linha = palavra
    if linha:
        pdf.setFont('Helvetica', 10)
        pdf.drawString(x + (largura_prefixo if primeira else 0), cursor, linha)
    return cursor


def _quebrar(pdf, texto: str, fonte: str, tamanho: float, largura: float) -> list[str]:
    palavras = texto.split()
    linhas = []
    atual = ''
    for palavra in palavras:
        candidato = palavra if not atual else f'{atual} {palavra}'
        if stringWidth(candidato, fonte, tamanho) <= largura:
            atual = candidato
        else:
            if atual:
                linhas.append(atual)
            atual = palavra
    if atual:
        linhas.append(atual)
    return linhas or ['']


def _paragrafo(pdf, texto, x, y, largura, fonte, tamanho, entrelinha) -> float:
    pdf.setFillColorRGB(0.08, 0.08, 0.08)
    pdf.setFont(fonte, tamanho)
    for linha in _quebrar(pdf, texto, fonte, tamanho, largura):
        pdf.drawString(x, y, linha)
        y -= entrelinha
    return y


def _tabela(pdf, x, y, colunas, cabecalho, linhas) -> float:
    altura = 8 * mm
    pdf.setFillColorRGB(0.92, 0.92, 0.92)
    pdf.rect(x, y - altura, sum(colunas), altura, fill=1, stroke=0)
    pdf.setStrokeColorRGB(0.47, 0.47, 0.47)
    pdf.setLineWidth(0.4)
    pdf.setFillColorRGB(0.08, 0.08, 0.08)
    pdf.setFont('Helvetica-Bold', 8)
    cursor = x
    for titulo, largura in zip(cabecalho, colunas):
        pdf.rect(cursor, y - altura, largura, altura, fill=0, stroke=1)
        pdf.drawCentredString(cursor + largura / 2, y - 5.2 * mm, titulo)
        cursor += largura
    y -= altura
    pdf.setFont('Helvetica', 9)
    for linha in linhas:
        cursor = x
        for valor, largura in zip(linha, colunas):
            pdf.rect(cursor, y - altura, largura, altura, fill=0, stroke=1)
            texto = valor if stringWidth(valor, 'Helvetica', 9) <= largura - 4 * mm else valor[:28]
            if largura < 30 * mm:
                pdf.drawCentredString(cursor + largura / 2, y - 5.2 * mm, texto)
            else:
                pdf.drawString(cursor + 2 * mm, y - 5.2 * mm, texto)
            cursor += largura
        y -= altura
    return y


def _assinatura(pdf, esquerda, direita, y, rotulo_esq, valor_esq, rotulo_dir) -> None:
    pdf.setFillColorRGB(0.08, 0.08, 0.08)
    pdf.setFont('Helvetica', 10)
    pdf.drawString(esquerda, y, rotulo_esq)
    inicio = esquerda + stringWidth(rotulo_esq, 'Helvetica', 10) + 2
    pdf.drawString(inicio, y, valor_esq or '____/____/______')
    meio = esquerda + (direita - esquerda) * 0.45
    pdf.drawString(meio, y, rotulo_dir)
    pdf.setStrokeColorRGB(0.08, 0.08, 0.08)
    pdf.setLineWidth(0.5)
    pdf.line(meio + stringWidth(rotulo_dir, 'Helvetica', 10) + 2, y - 1, direita, y - 1)
