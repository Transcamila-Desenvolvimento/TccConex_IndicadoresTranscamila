import ExcelJS from 'exceljs';
import type { PagarDiffBatchRef, PagarDiffDay, PagarDiffResponse } from '../types/domain';

const FILL_ORANGE: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFC000' },
};

const FILL_YELLOW: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFF00' },
};

const FILL_BLUE: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFB4E4FF' },
};

const FMT_PAYABLE = '#.##0,00_);(#.##0,00)';
const FMT_DIFF_POS = '#.##0,00';
const FMT_DIFF_NEG = '- #.##0,00';

const BORDER_MEDIUM: Partial<ExcelJS.Borders> = {
  top: { style: 'medium', color: { argb: 'FF000000' } },
  left: { style: 'medium', color: { argb: 'FF000000' } },
  bottom: { style: 'medium', color: { argb: 'FF000000' } },
  right: { style: 'medium', color: { argb: 'FF000000' } },
};

function positionSlug(batch?: PagarDiffBatchRef | null): string {
  if (!batch) return 'sem-data';
  const parts = batch.referenceDateLabel.split('/');
  if (parts.length >= 3) {
    return `${parts[0]}-${parts[1]}`;
  }
  return batch.referenceDateLabel.replace(/\//g, '-');
}

function shortDateLabel(isoDate: string, fallback: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return fallback;
  return `${day}/${month}/${year.slice(2)}`;
}

function applyBorder(cell: ExcelJS.Cell, border: Partial<ExcelJS.Borders>) {
  cell.border = {
    top: border.top,
    left: border.left,
    bottom: border.bottom,
    right: border.right,
  };
}

function stylePayableCell(cell: ExcelJS.Cell, value: number) {
  cell.value = -Math.abs(value);
  cell.numFmt = FMT_PAYABLE;
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
}

function styleDiffCell(cell: ExcelJS.Cell, diff: number) {
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
  if (diff === 0) {
    cell.value = '-';
    return;
  }
  cell.value = diff;
  if (diff > 0) {
    cell.numFmt = FMT_DIFF_POS;
    cell.fill = FILL_YELLOW;
  } else {
    cell.numFmt = FMT_DIFF_NEG;
    cell.fill = FILL_BLUE;
  }
}

async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildConsolidadoSheet(workbook: ExcelJS.Workbook, data: PagarDiffResponse) {
  const sheet = workbook.addWorksheet('Consolidado', {
    views: [{ showGridLines: true }],
  });

  sheet.getColumn(1).width = 12;
  sheet.getColumn(2).width = 18;
  sheet.getColumn(3).width = 18;
  sheet.getColumn(4).width = 18;

  const currentHeader = data.currentBatch.referenceDateLabel;
  const previousHeader = data.previousBatch?.referenceDateLabel ?? '—';

  const headerRow = sheet.getRow(1);
  headerRow.getCell(2).value = currentHeader;
  headerRow.getCell(3).value = previousHeader;

  for (const col of [2, 3]) {
    const cell = headerRow.getCell(col);
    cell.font = { bold: true };
    cell.fill = FILL_ORANGE;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    applyBorder(cell, BORDER_MEDIUM);
  }

  data.days.forEach((day, index) => {
    const rowIndex = index + 2;
    const row = sheet.getRow(rowIndex);

    const dateCell = row.getCell(1);
    dateCell.value = shortDateLabel(day.date, day.dateLabel);
    dateCell.font = { bold: true };
    dateCell.alignment = { horizontal: 'left', vertical: 'middle' };

    stylePayableCell(row.getCell(2), day.totalCurrent);
    stylePayableCell(row.getCell(3), day.totalPrevious);
    styleDiffCell(row.getCell(4), day.diff);
  });

  const totalRowIndex = data.days.length + 2;
  const totalRow = sheet.getRow(totalRowIndex);

  stylePayableCell(totalRow.getCell(2), data.totalCurrent);
  stylePayableCell(totalRow.getCell(3), data.totalPrevious);

  const totalDiffCell = totalRow.getCell(4);
  totalDiffCell.value = data.totalDiff;
  totalDiffCell.numFmt = FMT_DIFF_POS;
  totalDiffCell.fill = FILL_YELLOW;
  totalDiffCell.font = { bold: true };
  totalDiffCell.alignment = { horizontal: 'right', vertical: 'middle' };

  for (const col of [2, 3, 4]) {
    const cell = totalRow.getCell(col);
    cell.font = { ...cell.font, bold: true };
    if (col <= 3) {
      cell.fill = FILL_ORANGE;
    }
    applyBorder(cell, BORDER_MEDIUM);
  }
}

function pushTituloRows(
  sheet: ExcelJS.Worksheet,
  day: PagarDiffDay,
  categoria: string,
  items: PagarDiffDay['novosTitulos'],
  sinal: '+' | '-',
) {
  for (const item of items) {
    sheet.addRow([
      day.dateLabel,
      categoria,
      item.filial,
      item.codForn,
      item.fornecedor,
      item.titulo,
      item.tipo,
      item.vencimentoReal,
      sinal === '+' ? item.saldo : -item.saldo,
      '',
      '',
    ]);
  }
}

function buildDetalhadoSheet(workbook: ExcelJS.Workbook, data: PagarDiffResponse) {
  const sheet = workbook.addWorksheet('Detalhado');

  const headers = [
    'Data vencimento',
    'Categoria',
    'Filial',
    'Cód. fornecedor',
    'Fornecedor',
    'Documento',
    'Tipo',
    'Vencimento real',
    'Valor',
    'De',
    'Para',
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
  });

  for (const day of data.days) {
    pushTituloRows(sheet, day, 'Novo título', day.novosTitulos, '+');
    pushTituloRows(sheet, day, 'Nova NF', day.novasNfs, '+');
    pushTituloRows(sheet, day, 'Baixado', day.titulosBaixados, '-');

    for (const item of day.reprogramados) {
      const isDe = item.tipoReprogramacao === 'reprogramado_de';
      sheet.addRow([
        day.dateLabel,
        'Reprogramado',
        item.titulo.filial,
        item.titulo.codForn,
        item.titulo.fornecedor,
        item.titulo.titulo,
        item.titulo.tipo,
        item.titulo.vencimentoReal,
        isDe ? item.saldo : -item.saldo,
        item.dataAnterior,
        item.dataNova,
      ]);
    }
  }

  sheet.columns.forEach((column) => {
    let max = 12;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length;
      if (len > max) max = len;
    });
    column.width = Math.min(max + 2, 40);
  });

  const valueCol = sheet.getColumn(9);
  valueCol.numFmt = '#.##0,00';
  valueCol.alignment = { horizontal: 'right' };
}

export async function exportPagarDiffToExcel(data: PagarDiffResponse): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TccConex ERP';
  workbook.created = new Date();

  buildConsolidadoSheet(workbook, data);
  buildDetalhadoSheet(workbook, data);

  const filename = `Novos_Titulos_${positionSlug(data.currentBatch)}_vs_${positionSlug(data.previousBatch)}.xlsx`;
  await downloadWorkbook(workbook, filename);
}
