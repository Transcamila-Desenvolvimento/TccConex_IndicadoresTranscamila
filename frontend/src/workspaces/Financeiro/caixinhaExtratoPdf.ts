import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CaixinhaExtrato } from '../../types/domain';
import logoTranscamila from '../../assets/logo-transcamila-30-anos.png';

const INK = [31, 58, 77] as const;
const MUTED = [90, 107, 122] as const;
const LINE = [208, 218, 226] as const;
const RULE = [91, 122, 148] as const;
const HEAD_BG = [232, 239, 244] as const;
const BOX_BG = [244, 247, 249] as const;
const FOOT_BG = [236, 242, 246] as const;

function formatDateBr(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function formatMoney(value: number): string {
  const sign = value < 0 ? '-' : '';
  const [inteiro, decimal] = Math.abs(value).toFixed(2).split('.');
  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${agrupado},${decimal}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('logo'));
    image.src = src;
  });
}

export async function downloadCaixinhaExtratoPdf(extrato: CaixinhaExtrato): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const right = pageWidth - margin;

  let logo: HTMLImageElement | null = null;
  try {
    logo = await loadImage(logoTranscamila);
  } catch {
    logo = null;
  }

  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Extrato do Caixinha', margin, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text('Movimentações do Caixinha', margin, 21.5);

  if (logo) {
    const maxLogoW = 54;
    const ratio = logo.naturalWidth / logo.naturalHeight || 1;
    let logoH = 9.5;
    let logoW = logoH * ratio;
    if (logoW > maxLogoW) {
      logoW = maxLogoW;
      logoH = logoW / ratio;
    }
    doc.addImage(logo, 'PNG', right - logoW, 11, logoW, logoH);
  }

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.45);
  doc.line(margin, 27, right, 27);

  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('PERÍODO', margin, 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(`${formatDateBr(extrato.startDate)} a ${formatDateBr(extrato.endDate)}`, margin, 40);

  const boxX = margin + 92;
  const boxW = right - boxX;
  const boxY = 31;
  const resumo = [
    ['Saldo anterior', extrato.saldoAnterior],
    ['Entradas', extrato.totalEntradas],
    ['Saídas', extrato.totalSaidas],
    ['Saldo final', extrato.saldoFinal],
  ] as const;

  doc.setFillColor(...BOX_BG);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.rect(boxX, boxY, boxW, 28, 'FD');

  resumo.forEach(([label, value], index) => {
    const y = boxY + 6.2 + index * 6.2;
    const fechamento = index === resumo.length - 1;
    doc.setFont('helvetica', fechamento ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...(fechamento ? INK : MUTED));
    doc.text(label, boxX + 4, y);
    doc.setTextColor(...INK);
    doc.text(formatMoney(value), right - 2, y, { align: 'right' });
  });

  const colEntrada = 32;
  const colSaida = 32;
  const colSaldo = 32;
  const colData = 26;
  const colHistorico = contentWidth - (colData + colEntrada + colSaida + colSaldo);

  const movimentos = extrato.lancamentos.map((item) => [
    formatDateBr(item.date),
    item.description,
    item.type === 'Entrada' ? formatMoney(item.value) : '',
    item.type === 'Saída' ? formatMoney(item.value) : '',
    formatMoney(item.saldo),
  ]);

  const body = [
    ['', 'Saldo anterior', '', '', formatMoney(extrato.saldoAnterior)],
    ...(movimentos.length > 0
      ? movimentos
      : [['', 'Nenhum lançamento no período.', '', '', '']]),
  ];

  autoTable(doc, {
    startY: 66,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'plain',
    head: [['Data', 'Histórico', 'Entrada', 'Saída', 'Saldo']],
    body,
    foot: [[
      '',
      'Totais do período',
      formatMoney(extrato.totalEntradas),
      formatMoney(extrato.totalSaidas),
      formatMoney(extrato.saldoFinal),
    ]],
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 2.4, right: 2, bottom: 2.4, left: 2 },
      textColor: [...INK],
      fillColor: [255, 255, 255],
      lineWidth: 0,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [...HEAD_BG],
      textColor: [...MUTED],
      fontStyle: 'bold',
      fontSize: 9,
    },
    footStyles: {
      fillColor: [...FOOT_BG],
      textColor: [...INK],
      fontStyle: 'bold',
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: colData, halign: 'left' },
      1: { cellWidth: colHistorico, halign: 'left' },
      2: { cellWidth: colEntrada, halign: 'right' },
      3: { cellWidth: colSaida, halign: 'right' },
      4: { cellWidth: colSaldo, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.column.index >= 2) data.cell.styles.halign = 'right';
      if (data.section === 'body' && data.row.index === 0) {
        data.cell.styles.textColor = [...MUTED];
      }
    },
    didDrawCell: (data) => {
      const { x, y, width, height } = data.cell;
      if (data.section === 'head') {
        doc.setDrawColor(...RULE);
        doc.setLineWidth(0.35);
        doc.line(x, y + height, x + width, y + height);
        return;
      }
      if (data.section === 'foot') {
        doc.setDrawColor(...RULE);
        doc.setLineWidth(0.3);
        doc.line(x, y, x + width, y);
        doc.line(x, y + height, x + width, y + height);
        return;
      }
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.15);
      doc.line(x, y + height, x + width, y + height);
    },
  });

  doc.save(`Extrato_Caixinha_${extrato.startDate}_${extrato.endDate}.pdf`);
}
