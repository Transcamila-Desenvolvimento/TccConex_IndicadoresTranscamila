"""Planilha (.xlsx) com os dados da proposta comercial, usada no repasse para a operação."""

import io

from openpyxl import Workbook
from openpyxl.styles import Alignment

from .models import TIPO_GENERALIDADE_CHOICES
from .proposta_email_service import _safe_filename_part
from .proposta_tarifas import (
    rotulo_revisao,
    snapshot_distribuicao,
)
from .tabela_frete_export import _LABEL_FONT, _as_number, _autosize, _write_header_row

_MODALIDADE_LABEL = {
    'transferencia': 'Transferência',
    'carga_fechada': 'Carga Fechada',
    'spot': 'Spot',
    'op_portuaria': 'Logística retroportuária',
}
_FMT_MOEDA = '#,##0.00'
_FMT_PCT = '0.00%'


def proposta_excel_filename(proposta) -> str:
    numero = _safe_filename_part(rotulo_revisao(proposta), 40) or 'proposta'
    cliente = _safe_filename_part(proposta.cliente_nome or '')
    return f'Proposta_{numero}_{cliente}.xlsx' if cliente else f'Proposta_{numero}.xlsx'


def _preenchido(valor) -> bool:
    return valor not in (None, '') and str(valor).strip() != ''


def _gris_adv_unificado(proposta, linhas) -> bool:
    """Mesmo critério do PDF: uma coluna GRIS/ADV quando a tabela unifica ou todos os trechos coincidem."""
    if (proposta.tabela_distribuicao or {}).get('grisAdvUnificado'):
        return True
    com_taxa = [linha for linha in linhas if _preenchido(linha.gris) or _preenchido(linha.ad_valorem)]
    return bool(com_taxa) and all((linha.gris or '').strip() == (linha.ad_valorem or '').strip() for linha in com_taxa)


def _colunas_trechos(proposta, linhas):
    """(cabeçalho, valor(linha), formato) só com o que este tipo de proposta usa."""
    modalidades = {(linha.modalidade or 'transferencia') for linha in linhas}
    portuaria = 'op_portuaria' in modalidades
    spot = 'spot' in modalidades

    colunas = []
    if len(modalidades) > 1:
        colunas.append(('Operação', lambda l: _MODALIDADE_LABEL.get(l.modalidade or 'transferencia', l.modalidade), None))
    colunas += [
        ('Origem', lambda l: l.origem, None),
        ('Destino', lambda l: l.entrega, None),
        ('Veículo', lambda l: l.veiculo, None),
        ('KM', lambda l: _as_number(l.km), None),
        ('Frete (R$)', lambda l: _as_number(l.tarifa_frete), _FMT_MOEDA),
        ('Pedágio (R$)', lambda l: _as_number(l.pedagio), _FMT_MOEDA),
    ]
    if portuaria:
        colunas += [
            ('Retirada CTNR (R$)', lambda l: _as_number(l.retirada_ctnt), _FMT_MOEDA),
            ('Desova CTNR (R$)', lambda l: _as_number(l.desova_ctnt), _FMT_MOEDA),
        ]
    if _gris_adv_unificado(proposta, linhas):
        colunas.append(('GRIS/ADV', lambda l: l.gris or l.ad_valorem, None))
    else:
        colunas += [
            ('GRIS', lambda l: l.gris, None),
            ('Ad valorem', lambda l: l.ad_valorem, None),
        ]
    colunas += [
        ('ICMS', lambda l: l.icms, None),
        ('Prazo', lambda l: l.prazo_dias, None),
    ]
    if spot:
        colunas.append(('Outros valores', lambda l: l.outros_valores, None))
    if portuaria and any(_preenchido(linha.devolucao_container) for linha in linhas):
        colunas.append(('Devolução CTNR', lambda l: l.devolucao_container, None))
    if any(_preenchido(linha.observacoes) for linha in linhas):
        colunas.append(('Observações', lambda l: l.observacoes, None))
    return colunas


def _sheet_trechos(wb, proposta):
    linhas = [
        linha for linha in proposta.linhas.all().order_by('ordem', 'pk')
        if any(_preenchido(v) for v in (linha.origem, linha.entrega, linha.veiculo, linha.km, linha.tarifa_frete))
    ]
    if not linhas:
        return
    colunas = _colunas_trechos(proposta, linhas)
    ws = wb.create_sheet('Trechos')
    _write_header_row(ws, [cabecalho for cabecalho, _valor, _fmt in colunas])
    for row, linha in enumerate(linhas, start=2):
        for col, (_cabecalho, valor, fmt) in enumerate(colunas, start=1):
            conteudo = valor(linha)
            cell = ws.cell(row=row, column=col, value=conteudo if _preenchido(conteudo) else None)
            if fmt:
                cell.number_format = fmt
    ws.freeze_panes = 'C2'
    _autosize(ws, max_width=30)


def _faixas_distribuicao(proposta):
    """Tabela de frete da distribuição, sem o bloco de margens da proposta."""
    if not getattr(proposta, 'inclui_distribuicao', False):
        return [], ''
    gravada = proposta.tabela_distribuicao or {}
    faixas = gravada.get('faixas') or []
    nome = gravada.get('nome') or ''
    if not faixas and proposta.cliente_id:
        snap = snapshot_distribuicao(proposta.cliente_id) or {}
        faixas = snap.get('faixas') or []
        nome = nome or snap.get('nome') or ''
    return faixas, nome or 'Tabela de distribuição'


def _write_faixas(ws, faixas, row, titulo) -> None:
    ws.cell(row=row, column=1, value=titulo).font = _LABEL_FONT
    row += 1
    primeira = faixas[0]
    tarifas = primeira.get('tarifas') or []
    extras = primeira.get('extras') or []
    cabecalho = ['KM de', 'KM até', 'Frete mínimo (R$)']
    cabecalho += [f"{t.get('rotulo') or t.get('key')} (R$/{t.get('unidade') or 'ton'})" for t in tarifas]
    cabecalho += ['Pedágio (R$/ton)', 'GRIS', 'Ad valorem', 'Prazo fracionado', 'Prazo fechado']
    cabecalho += [e.get('rotulo') or e.get('key') for e in extras]
    _write_header_row(ws, cabecalho, row=row)
    col_gris = 3 + len(tarifas) + 2
    for faixa in faixas:
        row += 1
        valores = [faixa.get('kmDe'), faixa.get('kmAte'), _as_number(faixa.get('freteMinimo'))]
        valores += [_as_number(t.get('valor')) for t in faixa.get('tarifas') or []]
        valores += [
            _as_number(faixa.get('pedagioTon')), _as_number(faixa.get('grisPercent')),
            _as_number(faixa.get('advPercent')), faixa.get('prazoFracionado'), faixa.get('prazoFechado'),
        ]
        valores += [_as_number(e.get('valor')) for e in faixa.get('extras') or []]
        for col, valor in enumerate(valores, start=1):
            cell = ws.cell(row=row, column=col, value=valor)
            if col in (col_gris, col_gris + 1):
                cell.number_format = _FMT_PCT
            elif col >= 3:
                cell.number_format = _FMT_MOEDA


def _sheet_grade_calculo(wb, proposta):
    """Só a proposta de distribuição leva a tabela de frete, e sem as margens."""
    if not getattr(proposta, 'inclui_distribuicao', False):
        return
    faixas, nome = _faixas_distribuicao(proposta)
    if not faixas:
        return
    ws = wb.create_sheet('Tabela de frete')
    _write_faixas(ws, faixas, 1, nome)
    _autosize(ws, max_width=24)


def _sheet_armazenagem(wb, proposta):
    tabela = proposta.tabela_armazenagem or {}
    if not proposta.inclui_armazenagem or not tabela:
        return
    ws = wb.create_sheet('Tabela Armazenagem')
    periodo = ' a '.join(p for p in (tabela.get('periodoInicio'), tabela.get('periodoFim')) if p) or '—'
    cabecalho = [
        ('Código', tabela.get('codigo') or '—'),
        ('Local', tabela.get('local') or '—'),
        ('Período', periodo),
        ('Unidade', tabela.get('unidade') or '—'),
    ]
    row = 1
    for campo, valor in cabecalho:
        ws.cell(row=row, column=1, value=campo).font = _LABEL_FONT
        ws.cell(row=row, column=2, value=valor)
        row += 1
    row += 1
    _write_header_row(ws, ['Tarifa', 'Valor'], row=row)
    for item in tabela.get('itens') or []:
        row += 1
        ws.cell(row=row, column=1, value=item.get('rotulo'))
        ws.cell(row=row, column=2, value=item.get('valor'))
    hora_extra = tabela.get('horaExtra') or tabela.get('hora_extra') or []
    if hora_extra:
        row += 2
        _write_header_row(ws, [tabela.get('horaExtraTitulo') or 'Hora-extra', 'Valor'], row=row)
        for item in hora_extra:
            row += 1
            ws.cell(row=row, column=1, value=item.get('periodo'))
            ws.cell(row=row, column=2, value=item.get('valor'))
    if tabela.get('expediente'):
        row += 2
        ws.cell(row=row, column=1, value=tabela['expediente'])
    ws.column_dimensions['A'].width = 70
    ws.column_dimensions['B'].width = 22


def _sheet_generalidades(wb, proposta):
    itens = [item for item in proposta.condicoes or [] if isinstance(item, dict)]
    if not itens:
        return
    ws = wb.create_sheet('Generalidades')
    tipos = dict(TIPO_GENERALIDADE_CHOICES)
    _write_header_row(ws, ['Serviço', 'Item', 'Condição'])
    for row, item in enumerate(itens, start=2):
        ws.cell(row=row, column=1, value=tipos.get(item.get('tipo'), item.get('tipo') or '—'))
        ws.cell(row=row, column=2, value=item.get('rotulo') or '')
        ws.cell(row=row, column=3, value=item.get('valor') or '').alignment = Alignment(wrap_text=True, vertical='top')
    ws.column_dimensions['A'].width = 18
    ws.column_dimensions['B'].width = 36
    ws.column_dimensions['C'].width = 90


def build_proposta_excel(proposta) -> tuple[bytes, str]:
    wb = Workbook()
    wb.remove(wb.active)
    _sheet_trechos(wb, proposta)
    _sheet_grade_calculo(wb, proposta)
    _sheet_armazenagem(wb, proposta)
    _sheet_generalidades(wb, proposta)
    if not wb.sheetnames:
        _write_header_row(wb.create_sheet('Proposta'), ['Proposta', rotulo_revisao(proposta)])
    wb.active = 0
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue(), proposta_excel_filename(proposta)
