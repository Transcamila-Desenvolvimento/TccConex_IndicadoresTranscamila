import re
from datetime import datetime
from decimal import Decimal

from .models import BillingRecord

# Filiais de faturamento (domínio de billing/XML) — distintas das filiais de
# permissão/escopo de usuário em apps/accounts/constants.py (ALL_BRANCHES).
# Faturamento rastreia unidades adicionais (Barueri, Armazém) que não são
# filiais atribuíveis a usuários no sistema de permissões.
BILLING_BRANCHES = ['Ibiporã', 'Rondonópolis', 'Barueri', 'Paranaguá', 'Armazém']

# Código ERP de filial de emissão (prefixo da transportadora, ex.: "10 - TRANSCAMILA - ...").
# Mapeamento oficial: 1=Ibiporã, 11=Paranaguá, 5=Rondonópolis, 10=Armazém, 9=Barueri.
BILLING_FILIAL_CODES: dict[str, str] = {
    '01': 'Ibiporã',
    '05': 'Rondonópolis',
    '09': 'Barueri',
    '10': 'Armazém',
    '11': 'Paranaguá',
}

_FILIAL_CODE_PREFIX_RE = re.compile(r'^\s*(\d{1,2})\s*-\s*', re.IGNORECASE)
_FILIAL_EMISSAO_TAG_RES = (
    re.compile(r'<Filial_x0020_de_x0020_emissão>(.*?)</Filial_x0020_de_x0020_emissão>', re.IGNORECASE),
    re.compile(r'<Filial_x0020_emissão>(.*?)</Filial_x0020_emissão>', re.IGNORECASE),
    re.compile(r'<Filial_x0020_emissao>(.*?)</Filial_x0020_emissao>', re.IGNORECASE),
    re.compile(r'<Filial>(.*?)</Filial>', re.IGNORECASE),
)


def _normalize_filial_code(raw: str) -> str:
    raw = raw.strip()
    if raw.isdigit():
        return raw.zfill(2) if len(raw) == 1 else raw
    return raw


def _branch_from_filial_code(raw: str) -> str | None:
    code = _normalize_filial_code(raw)
    return BILLING_FILIAL_CODES.get(code)


def _extract_filial_code(*texts: str) -> str | None:
    for text in texts:
        if not text:
            continue
        stripped = text.strip()
        prefix = _FILIAL_CODE_PREFIX_RE.match(stripped)
        if prefix:
            return _normalize_filial_code(prefix.group(1))
        if stripped.isdigit():
            return _normalize_filial_code(stripped)
    return None


def _detect_branch(transp: str, user: str, filial_emissao: str = '') -> str:
    code = _extract_filial_code(filial_emissao, transp, user)
    if code:
        branch = _branch_from_filial_code(code)
        if branch:
            return branch

    transp = transp.upper()
    user = user.upper()
    filial_emissao = filial_emissao.upper()
    if 'BARUERI' in transp or 'BARUERI' in user or 'BARUERI' in filial_emissao:
        return 'Barueri'
    if any(k in transp or k in user for k in ('RONDONOPOLIS', 'RONDONI')):
        return 'Rondonópolis'
    if 'PARANAGUA' in transp or 'PARANAGUA' in user:
        return 'Paranaguá'
    if 'IBIPORA' in transp or 'IBIPORA' in user:
        return 'Ibiporã'
    if 'ARMAZEM' in transp or 'ARMAZEM' in user:
        return 'Armazém'
    if transp:
        if 'BAR' in transp:
            return 'Barueri'
        if 'RON' in transp:
            return 'Rondonópolis'
        if 'PAR' in transp:
            return 'Paranaguá'
        if 'IBI' in transp:
            return 'Ibiporã'
        if 'ARM' in transp:
            return 'Armazém'
    return 'Ibiporã'


def parse_billing_xml(xml_text: str) -> dict[str, dict[str, dict[str, Decimal | int]]]:
    results: dict[str, dict[str, dict[str, Decimal | int]]] = {}
    row_regex = re.compile(r'<Row>([\s\S]*?)</Row>', re.IGNORECASE)

    for row_content in row_regex.findall(xml_text):
        date_match = (
            re.search(r'<Emissão_x0020_CT_x002d_e>(.*?)</Emissão_x0020_CT_x002d_e>', row_content, re.IGNORECASE)
            or re.search(r'<Emiss.*_x002d_e>(.*?)</Emiss.*_x002d_e>', row_content, re.IGNORECASE)
        )
        date_str = date_match.group(1).strip() if date_match else ''
        if not date_str:
            continue

        transp_match = re.search(r'<Transportadora>(.*?)</Transportadora>', row_content, re.IGNORECASE)
        transp = transp_match.group(1).upper() if transp_match else ''

        user_match = (
            re.search(r'<Usuário_x0020_cadastro>(.*?)</Usuário_x0020_cadastro>', row_content, re.IGNORECASE)
            or re.search(r'<Usu.*_x0020_cadastro>(.*?)</Usu.*_x0020_cadastro>', row_content, re.IGNORECASE)
        )
        user = user_match.group(1).upper() if user_match else ''

        filial_emissao = ''
        for filial_pattern in _FILIAL_EMISSAO_TAG_RES:
            filial_match = filial_pattern.search(row_content)
            if filial_match:
                filial_emissao = filial_match.group(1).strip()
                break

        frete_match = re.search(r'<Valor_x0020_Frete>(.*?)</Valor_x0020_Frete>', row_content, re.IGNORECASE)
        frete_str = frete_match.group(1).strip() if frete_match else ''
        frete = Decimal(frete_str.replace('.', '').replace(',', '.') or '0')

        branch = _detect_branch(transp, user, filial_emissao)
        results.setdefault(date_str, {})
        bucket = results[date_str].setdefault(branch, {'value': Decimal('0'), 'count': 0})
        bucket['value'] += frete
        bucket['count'] += 1

    return results


def _to_iso_date(date_str: str) -> str | None:
    if '/' in date_str:
        parts = date_str.split('/')
        if len(parts) == 3:
            d, m, y = parts
            return f'{y}-{m.zfill(2)}-{d.zfill(2)}'
    try:
        datetime.strptime(date_str, '%Y-%m-%d')
        return date_str
    except ValueError:
        return None


def import_billing_xml(file_bytes: bytes) -> dict:
    text = file_bytes.decode('utf-8', errors='ignore')
    parsed = parse_billing_xml(text)
    if not parsed:
        return {
            'success': False,
            'rowCount': 0,
            'totalValue': 0,
            'totalNotes': 0,
            'dates': [],
            'detail': 'Nenhum registro válido encontrado no XML.',
        }

    created = 0
    total_value = Decimal('0')
    total_notes = 0
    display_dates: list[str] = []

    for date_str, branches in parsed.items():
        iso_date = _to_iso_date(date_str)
        if not iso_date:
            continue
        ref_date = datetime.strptime(iso_date, '%Y-%m-%d').date()

        BillingRecord.objects.filter(reference_date=ref_date).delete()

        for branch in BILLING_BRANCHES:
            data = branches.get(branch, {'value': Decimal('0'), 'count': 0})
            value = Decimal(str(data['value']))
            count = int(data['count'])
            BillingRecord.objects.create(
                reference_date=ref_date,
                branch=branch,
                value=value,
                notes_count=count,
            )
            created += 1
            total_value += value
            total_notes += count

        parts = date_str.split('/')
        display_dates.append(
            f'{parts[0]}/{parts[1]}/{parts[2]}' if len(parts) == 3 else date_str
        )

    return {
        'success': True,
        'rowCount': created,
        'totalValue': float(total_value),
        'totalNotes': total_notes,
        'dates': display_dates,
    }
