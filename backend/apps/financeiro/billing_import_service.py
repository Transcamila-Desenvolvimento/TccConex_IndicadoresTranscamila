import re
import unicodedata
from datetime import datetime
from decimal import Decimal, InvalidOperation
from html import unescape
from io import BytesIO

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
_HTML_CELL_RE = re.compile(r'<td[^>]*>(.*?)</td>', re.IGNORECASE | re.DOTALL)
_HTML_HEADER_RE = re.compile(r'<th[^>]*>(.*?)</th>', re.IGNORECASE | re.DOTALL)
_HTML_ROW_RE = re.compile(r'<tr>\s*((?:<td[^>]*>.*?</td>\s*)+)</tr>', re.IGNORECASE | re.DOTALL)


def _normalize_header(text: str) -> str:
    text = unicodedata.normalize('NFKD', text or '')
    text = ''.join(ch for ch in text if not unicodedata.combining(ch))
    text = unescape(text).replace('\xa0', ' ')
    return re.sub(r'\s+', ' ', text).strip().lower()


def _clean_cell_text(raw: str) -> str:
    raw = re.sub(r'<[^>]+>', '', raw or '')
    return unescape(raw).replace('\xa0', ' ').strip()


def _parse_frete_amount(raw) -> Decimal:
    if raw is None:
        return Decimal('0')
    if isinstance(raw, (int, float)):
        return Decimal(str(raw))
    value = str(raw).strip()
    if not value:
        return Decimal('0')
    if ',' in value:
        value = value.replace('.', '').replace(',', '.')
    try:
        return Decimal(value)
    except InvalidOperation:
        return Decimal('0')


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


def _resolve_billing_columns(headers: list[str]) -> dict[str, int | None]:
    norm_headers = [_normalize_header(h) for h in headers]

    def find_first(*predicates) -> int | None:
        for predicate in predicates:
            for index, header in enumerate(norm_headers):
                if predicate(header):
                    return index
        return None

    return {
        'transportadora': find_first(lambda h: 'transportadora' in h),
        'valor_frete': find_first(
            lambda h: 'valor' in h and 'frete' in h and 'peso' not in h,
        ),
        'emissao': find_first(
            lambda h: 'emiss' in h and 'ct' in h,
            lambda h: 'emiss' in h and 'ct-e' in h,
        ),
        'data_coleta': find_first(lambda h: h == 'coleta'),
        'data_cadastro': find_first(
            lambda h: 'data' in h and 'cadastro' in h and 'hora' not in h,
        ),
        'filial_emissao': find_first(
            lambda h: 'filial' in h and 'emiss' in h,
            lambda h: h == 'filial',
        ),
        'usuario': find_first(
            lambda h: 'usuario' in h and 'cadastro' in h,
            lambda h: 'usu' in h and 'cadastro' in h,
        ),
    }


def _resolve_row_date(cells: list[str], columns: dict[str, int | None]) -> str:
    # Faturamento diário segue a data de Coleta (como no ERP); Emissão CT-e é fallback.
    for key in ('data_coleta', 'emissao', 'data_cadastro'):
        index = columns.get(key)
        if index is None or index >= len(cells):
            continue
        value = cells[index].strip()
        if not value:
            continue
        if '/' in value or re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
            return value
    return ''


def _accumulate_billing_row(
    results: dict[str, dict[str, dict[str, Decimal | int]]],
    *,
    date_str: str,
    transportadora: str,
    usuario: str = '',
    filial_emissao: str = '',
    valor_frete,
) -> None:
    if not date_str:
        return
    branch = _detect_branch(transportadora, usuario, filial_emissao)
    frete = _parse_frete_amount(valor_frete)
    results.setdefault(date_str, {})
    bucket = results[date_str].setdefault(branch, {'value': Decimal('0'), 'count': 0})
    bucket['value'] += frete
    bucket['count'] += 1


def _parse_billing_tabular_rows(headers: list[str], rows: list[list]) -> dict[str, dict[str, dict[str, Decimal | int]]]:
    columns = _resolve_billing_columns(headers)
    required = ('transportadora', 'valor_frete')
    missing = [name for name in required if columns.get(name) is None]
    if missing:
        raise ValueError(
            'Colunas obrigatórias não encontradas no arquivo: '
            + ', '.join(missing)
            + '. Esperado, no mínimo, Transportadora e Valor Frete.'
        )
    if columns.get('emissao') is None and columns.get('data_coleta') is None and columns.get('data_cadastro') is None:
        raise ValueError(
            'Nenhuma coluna de data encontrada. Informe Coleta, Emissão CT-e ou Data cadastro.'
        )

    results: dict[str, dict[str, dict[str, Decimal | int]]] = {}
    for row in rows:
        if not row:
            continue
        cells = [str(cell).strip() if cell is not None else '' for cell in row]
        if len(cells) <= max(v for v in columns.values() if v is not None):
            continue
        _accumulate_billing_row(
            results,
            date_str=_resolve_row_date(cells, columns),
            transportadora=cells[columns['transportadora']],
            usuario=cells[columns['usuario']] if columns['usuario'] is not None else '',
            filial_emissao=cells[columns['filial_emissao']] if columns['filial_emissao'] is not None else '',
            valor_frete=cells[columns['valor_frete']],
        )
    return results


def parse_billing_html_table(html_text: str) -> dict[str, dict[str, dict[str, Decimal | int]]]:
    headers = [_clean_cell_text(h) for h in _HTML_HEADER_RE.findall(html_text)]
    if not headers:
        return {}
    rows = []
    for row_html in _HTML_ROW_RE.findall(html_text):
        cells = [_clean_cell_text(c) for c in _HTML_CELL_RE.findall(row_html)]
        if cells:
            rows.append(cells)
    return _parse_billing_tabular_rows(headers, rows)


def parse_billing_xlsx(file_bytes: bytes) -> dict[str, dict[str, dict[str, Decimal | int]]]:
    import openpyxl

    workbook = openpyxl.load_workbook(BytesIO(file_bytes), read_only=True, data_only=True)
    worksheet = workbook.active
    all_rows = list(worksheet.iter_rows(values_only=True))
    if not all_rows:
        return {}

    header_index = None
    for index, row in enumerate(all_rows[:40]):
        headers = [str(cell).strip() if cell is not None else '' for cell in row]
        columns = _resolve_billing_columns(headers)
        has_date = any(columns.get(key) is not None for key in ('emissao', 'data_coleta', 'data_cadastro'))
        if columns['transportadora'] is not None and columns['valor_frete'] is not None and has_date:
            header_index = index
            break
    if header_index is None:
        raise ValueError('Cabeçalho de faturamento não encontrado na planilha Excel.')

    headers = [str(cell).strip() if cell is not None else '' for cell in all_rows[header_index]]
    data_rows = all_rows[header_index + 1:]
    return _parse_billing_tabular_rows(headers, data_rows)


def parse_billing_xls(file_bytes: bytes) -> dict[str, dict[str, dict[str, Decimal | int]]]:
    import xlrd

    workbook = xlrd.open_workbook(file_contents=file_bytes)
    sheet = workbook.sheet_by_index(0)
    all_rows = [sheet.row_values(r) for r in range(sheet.nrows)]
    if not all_rows:
        return {}

    header_index = None
    for index, row in enumerate(all_rows[:40]):
        headers = [str(cell).strip() for cell in row]
        columns = _resolve_billing_columns(headers)
        has_date = any(columns.get(key) is not None for key in ('emissao', 'data_coleta', 'data_cadastro'))
        if columns['transportadora'] is not None and columns['valor_frete'] is not None and has_date:
            header_index = index
            break
    if header_index is None:
        raise ValueError('Cabeçalho de faturamento não encontrado na planilha Excel.')

    headers = [str(cell).strip() for cell in all_rows[header_index]]
    data_rows = all_rows[header_index + 1:]
    return _parse_billing_tabular_rows(headers, data_rows)


def parse_billing_xml(xml_text: str) -> dict[str, dict[str, dict[str, Decimal | int]]]:
    results: dict[str, dict[str, dict[str, Decimal | int]]] = {}
    row_regex = re.compile(r'<Row>([\s\S]*?)</Row>', re.IGNORECASE)

    for row_content in row_regex.findall(xml_text):
        coleta_match = re.search(r'<Coleta>(.*?)</Coleta>', row_content, re.IGNORECASE)
        coleta_str = coleta_match.group(1).strip() if coleta_match else ''

        date_match = (
            re.search(r'<Emissão_x0020_CT_x002d_e>(.*?)</Emissão_x0020_CT_x002d_e>', row_content, re.IGNORECASE)
            or re.search(r'<Emiss.*_x002d_e>(.*?)</Emiss.*_x002d_e>', row_content, re.IGNORECASE)
        )
        emissao_str = date_match.group(1).strip() if date_match else ''
        date_str = coleta_str or emissao_str
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

        _accumulate_billing_row(
            results,
            date_str=date_str,
            transportadora=transp,
            usuario=user,
            filial_emissao=filial_emissao,
            valor_frete=frete_str,
        )

    return results


def _decode_billing_text(file_bytes: bytes) -> str:
    for encoding in ('utf-8', 'latin-1', 'cp1252'):
        text = file_bytes.decode(encoding, errors='ignore')
        if text.strip():
            return text
    return file_bytes.decode('utf-8', errors='ignore')


def parse_billing_file(file_bytes: bytes, filename: str = '') -> dict[str, dict[str, dict[str, Decimal | int]]]:
    lowered_name = (filename or '').lower()
    head = file_bytes[:1024].lstrip().lower()

    if head.startswith(b'pk'):
        return parse_billing_xlsx(file_bytes)

    if head.startswith(b'<?xml') or b'<row>' in head or lowered_name.endswith('.xml'):
        return parse_billing_xml(_decode_billing_text(file_bytes))

    if head.startswith(b'<html') or b'<table' in head or b'<th' in head:
        return parse_billing_html_table(_decode_billing_text(file_bytes))

    if lowered_name.endswith('.xlsx'):
        return parse_billing_xlsx(file_bytes)

    if lowered_name.endswith('.xls'):
        try:
            return parse_billing_xls(file_bytes)
        except Exception:
            text = _decode_billing_text(file_bytes)
            if '<table' in text.lower() or '<th' in text.lower():
                return parse_billing_html_table(text)
            raise

    text = _decode_billing_text(file_bytes)
    lowered_text = text.lower()
    if '<table' in lowered_text or '<th' in lowered_text:
        return parse_billing_html_table(text)
    if '<row>' in lowered_text or '<?xml' in lowered_text:
        return parse_billing_xml(text)

    return parse_billing_xlsx(file_bytes)


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


def _persist_billing_parsed(parsed: dict[str, dict[str, dict[str, Decimal | int]]]) -> dict:
    if not parsed:
        return {
            'success': False,
            'rowCount': 0,
            'totalValue': 0,
            'totalNotes': 0,
            'dates': [],
            'detail': 'Nenhum registro válido encontrado no arquivo.',
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


def import_billing_file(file_bytes: bytes, filename: str = '') -> dict:
    try:
        parsed = parse_billing_file(file_bytes, filename)
    except ValueError as exc:
        return {
            'success': False,
            'rowCount': 0,
            'totalValue': 0,
            'totalNotes': 0,
            'dates': [],
            'detail': str(exc),
        }
    except Exception:
        return {
            'success': False,
            'rowCount': 0,
            'totalValue': 0,
            'totalNotes': 0,
            'dates': [],
            'detail': 'Não foi possível ler o arquivo de faturamento. Verifique o formato (.xls, .xlsx ou .xml).',
        }
    return _persist_billing_parsed(parsed)


def import_billing_xml(file_bytes: bytes) -> dict:
    """Compatibilidade com chamadas legadas — detecta XML ou Excel automaticamente."""
    return import_billing_file(file_bytes)
