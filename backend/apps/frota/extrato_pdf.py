import io
from decimal import Decimal

from django.template.loader import render_to_string
from django.utils import timezone
from xhtml2pdf import pisa

from apps.rh.pdf_service import _LOGO_TCCCONEX_PATH, _LOGO_TRANSCAMILA_PATH, _img_base64

MESES = (
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
)


def _moeda(valor: str) -> str:
    numero = Decimal(valor)
    texto = f'{numero:.2f}'
    inteiro, centavos = texto.split('.')
    sinal = '-' if inteiro.startswith('-') else ''
    digitos = inteiro.lstrip('-')
    grupos = []
    while digitos:
        grupos.append(digitos[-3:])
        digitos = digitos[:-3]
    return f'{sinal}R$ {".".join(reversed(grupos))},{centavos}'


def _cpf(valor: str) -> str:
    digitos = ''.join(caractere for caractere in (valor or '') if caractere.isdigit())
    if len(digitos) != 11:
        return valor or '—'
    return f'{digitos[:3]}.{digitos[3:6]}.{digitos[6:9]}-{digitos[9:]}'


def _nota(valor: str) -> str:
    numero = Decimal(valor)
    texto = f'{numero:.2f}'.replace('.', ',')
    return texto[:-3] if texto.endswith(',00') else texto


def gerar_extrato_bonificacao(apuracao: dict, filial: str) -> bytes:
    motoristas = apurar_linhas(apuracao['motoristas'])
    total = sum((Decimal(item['valor']) for item in apuracao['motoristas']), Decimal('0'))
    com_bonus = sum(1 for item in apuracao['motoristas'] if not item['zerado'] and Decimal(item['percentual']) > 0)
    html = render_to_string('frota/extrato_bonificacao.html', {
        'logo_base64': _img_base64(_LOGO_TRANSCAMILA_PATH),
        'logo_tccconex_base64': _img_base64(_LOGO_TCCCONEX_PATH),
        'gerado_em': timezone.localtime(timezone.now()).strftime('%d/%m/%Y às %H:%M'),
        'periodo': f'{MESES[apuracao["mes"] - 1]} de {apuracao["ano"]}',
        'filial': filial or '—',
        'nota_inicial': _nota(apuracao['notaInicial']),
        'valor_bonus': _moeda(apuracao['valorBonus']),
        'quantidade': len(apuracao['motoristas']),
        'com_bonus': com_bonus,
        'total': _moeda(f'{total:.2f}'),
        'motoristas': motoristas,
    })
    buffer = io.BytesIO()
    resultado = pisa.CreatePDF(src=html, dest=buffer, encoding='utf-8')
    if resultado.err:
        raise RuntimeError('Não foi possível gerar o extrato de bonificação.')
    return buffer.getvalue()


def apurar_linhas(motoristas: list[dict]) -> list[dict]:
    linhas = []
    for indice, item in enumerate(motoristas):
        sem_bonus = item['zerado'] or Decimal(item['percentual']) <= 0
        linhas.append({
            'par': indice % 2 == 1,
            'nome': item['nomeCompleto'],
            'cpf': _cpf(item.get('cpf') or ''),
            'cargo': item.get('cargo') or 'Motorista',
            'nota': _nota(item['nota']),
            'percentual': 'Sem bônus' if sem_bonus else f'{_nota(item["percentual"])}%',
            'valor': _moeda(item['valor']),
            'situacao': 'Experiência' if item.get('emExperiencia') else (item['motivoZero'] if item['zerado'] and item['motivoZero'] else ('Sem bonificação' if sem_bonus else 'A pagar')),
        })
    return linhas
