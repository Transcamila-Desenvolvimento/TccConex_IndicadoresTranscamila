import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoPadrao from '../../assets/Logo_Indicadores.png';
import type { ApuracaoMotorista, ApuracaoResumo, FaixaBonificacao, OcorrenciaDesempenho } from '../../types/domain';
import { dataBr, MESES } from './desempenhoFormat';

type Rgb = [number, number, number];

const INK: Rgb = [31, 58, 77];
const MUTED: Rgb = [90, 107, 122];
const LINE: Rgb = [208, 218, 226];
const RULE: Rgb = [91, 122, 148];
const HEAD_BG: Rgb = [232, 239, 244];
const BOX_BG: Rgb = [244, 247, 249];
const FOOT_BG: Rgb = [236, 242, 246];

function textColor(doc: jsPDF, color: Rgb): void {
  doc.setTextColor(color[0], color[1], color[2]);
}

function drawColor(doc: jsPDF, color: Rgb): void {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function fillColor(doc: jsPDF, color: Rgb): void {
  doc.setFillColor(color[0], color[1], color[2]);
}

function formatMoney(value: number): string {
  const sign = value < 0 ? '-' : '';
  const [inteiro, decimal] = Math.abs(value).toFixed(2).split('.');
  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${agrupado},${decimal}`;
}

function formatNota(valor: string): string {
  const numero = Number(valor);
  if (Number.isNaN(numero)) return valor;
  return numero.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('logo'));
    image.src = src;
  });
}

export async function downloadBonificacaoExtratoPdf(dados: {
  ano: number;
  mes: number;
  filial: string;
  motoristas: ApuracaoMotorista[];
  resumo: ApuracaoResumo;
}): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const right = pageWidth - margin;

  const logo = await loadImage(logoPadrao).catch(() => null);

  textColor(doc, INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Extrato de bonificação', margin, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  textColor(doc, MUTED);
  doc.text('Pagamento das bonificações', margin, 21.5);

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

  drawColor(doc, RULE);
  doc.setLineWidth(0.45);
  doc.line(margin, 27, right, 27);

  doc.setFontSize(8);
  textColor(doc, MUTED);
  doc.text('PERÍODO', margin, 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  textColor(doc, INK);
  doc.text(`${MESES[dados.mes - 1]} de ${dados.ano}`, margin, 40);
  if (dados.filial) {
    doc.setFontSize(8);
    textColor(doc, MUTED);
    doc.text(dados.filial, margin, 46, { maxWidth: 84 });
  }

  const boxX = margin + 92;
  const boxW = right - boxX;
  const boxY = 31;
  const totalPagar = Number(dados.resumo.totalPagar);
  const resumo = [
    ['Motoristas', String(dados.resumo.motoristas)],
    ['Com bonificação', String(dados.resumo.comBonificacao)],
    ['Sem bonificação', String(dados.resumo.motoristas - dados.resumo.comBonificacao)],
    ['Total a pagar', formatMoney(totalPagar)],
  ] as const;

  fillColor(doc, BOX_BG);
  drawColor(doc, LINE);
  doc.setLineWidth(0.25);
  doc.rect(boxX, boxY, boxW, 28, 'FD');

  resumo.forEach(([label, value], index) => {
    const y = boxY + 6.2 + index * 6.2;
    const fechamento = index === resumo.length - 1;
    doc.setFont('helvetica', fechamento ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    textColor(doc, fechamento ? INK : MUTED);
    doc.text(label, boxX + 4, y);
    textColor(doc, INK);
    doc.text(value, right - 2, y, { align: 'right' });
  });

  const colNota = 22;
  const colBonus = 32;
  const colValor = 32;
  const colNome = contentWidth - (colNota + colBonus + colValor);

  const linhas = dados.motoristas.map((item) => {
    const semBonus = item.zerado || Number(item.percentual) <= 0;
    return [
      item.nomeCompleto,
      formatNota(item.nota),
      semBonus ? '—' : `${formatNota(item.percentual)}%`,
      formatMoney(Number(item.valor)),
    ];
  });

  autoTable(doc, {
    startY: 66,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'plain',
    head: [['Motorista', 'Nota', 'Bonificação', 'Valor']],
    body: linhas.length > 0 ? linhas : [['Nenhum motorista no período.', '', '', '']],
    foot: [['Totais do período', '', '', formatMoney(totalPagar)]],
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 2.4, right: 2, bottom: 2.4, left: 2 },
      textColor: INK,
      fillColor: [255, 255, 255],
      lineWidth: 0,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: HEAD_BG,
      textColor: MUTED,
      fontStyle: 'bold',
      fontSize: 9,
    },
    footStyles: {
      fillColor: FOOT_BG,
      textColor: INK,
      fontStyle: 'bold',
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: colNome, halign: 'left' },
      1: { cellWidth: colNota, halign: 'right' },
      2: { cellWidth: colBonus, halign: 'right' },
      3: { cellWidth: colValor, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.column.index === 1 || data.column.index === 2 || data.column.index === 3) {
        data.cell.styles.halign = 'right';
      }
    },
    didDrawCell: (data) => {
      const { x, y, width, height } = data.cell;
      if (data.section === 'head') {
        drawColor(doc, RULE);
        doc.setLineWidth(0.35);
        doc.line(x, y + height, x + width, y + height);
        return;
      }
      if (data.section === 'foot') {
        drawColor(doc, RULE);
        doc.setLineWidth(0.3);
        doc.line(x, y, x + width, y);
        doc.line(x, y + height, x + width, y + height);
        return;
      }
      drawColor(doc, LINE);
      doc.setLineWidth(0.15);
      doc.line(x, y + height, x + width, y + height);
    },
  });

  const mes = String(dados.mes).padStart(2, '0');
  doc.save(`Extrato_Bonificacao_${dados.ano}-${mes}.pdf`);
}

function cpfMascarado(valor: string) {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length !== 11) return valor.trim();
  return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function efeitoOcorrencia(item: OcorrenciaDesempenho) {
  if (item.zeraBonus) return 'Zera o bônus';
  const pontos = Number(item.pontos);
  const texto = `${pontos > 0 ? '-' : ''}${formatNota(item.pontos)}`;
  return item.quantidade > 1 ? `${texto} x ${item.quantidade}` : texto;
}

function nomeArquivo(nome: string) {
  const limpo = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  return limpo || 'motorista';
}

function fimDaTabela(doc: jsPDF, reserva: number) {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? reserva;
}

function textoFaixa(faixa: FaixaBonificacao) {
  if (faixa.modo === 'integral') return '100% do bônus';
  if (faixa.modo === 'proporcional') return 'proporcional à nota';
  if (faixa.modo === 'percentual') return `${formatNota(faixa.percentual)}% do bônus`;
  return 'sem bônus';
}

export async function downloadReciboBonificacaoPdf(dados: {
  ano: number;
  mes: number;
  motorista: ApuracaoMotorista;
  ocorrencias: OcorrenciaDesempenho[];
  aviso?: string;
  impressoPor?: string;
  notaInicial?: string;
  faixas?: FaixaBonificacao[];
}): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const right = pageWidth - margin;
  const motorista = dados.motorista;
  const semBonus = motorista.zerado || Number(motorista.percentual) <= 0;
  const logo = await loadImage(logoPadrao).catch(() => null);
  const descontos = dados.ocorrencias.length > 0
    ? dados.ocorrencias.map((item) => [
      dataBr(item.data),
      item.criterioNome,
      item.descricao?.trim() || '—',
      efeitoOcorrencia(item),
    ])
    : [['Nenhuma ocorrência neste mês.', '', '', '']];

  const desenharVia = (inicio: number, via: string) => {
    let cursor = inicio;
    textColor(doc, INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Recibo de bonificação (Motorista Nota ${formatNota(dados.notaInicial || '100')})`, margin, cursor + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    textColor(doc, MUTED);
    doc.text(`${via} · ${MESES[dados.mes - 1]} de ${dados.ano}`, margin, cursor + 8.5);

    if (logo) {
      const ratio = logo.naturalWidth / logo.naturalHeight || 1;
      let logoH = 8;
      let logoW = logoH * ratio;
      if (logoW > 46) {
        logoW = 46;
        logoH = logoW / ratio;
      }
      doc.addImage(logo, 'PNG', right - logoW, cursor, logoW, logoH);
    }

    cursor += 12;
    drawColor(doc, RULE);
    doc.setLineWidth(0.35);
    doc.line(margin, cursor, right, cursor);
    cursor += 6;

    doc.setFontSize(7);
    textColor(doc, MUTED);
    doc.text('MOTORISTA', margin, cursor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    textColor(doc, INK);
    doc.text(motorista.nomeCompleto, margin, cursor + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    textColor(doc, MUTED);
    const cargo = motorista.cargo || 'Motorista';
    const cpf = cpfMascarado(motorista.cpf || '');
    doc.text(cpf ? `${cargo} · CPF ${cpf}` : cargo, margin, cursor + 9);

    const boxX = margin + 112;
    const boxW = right - boxX;
    const resumo = [
      ['Nota', formatNota(motorista.nota)],
      ['Bonificação', semBonus ? 'Sem bônus' : `${formatNota(motorista.percentual)}%`],
      ['Valor a receber', formatMoney(Number(motorista.valor))],
    ] as const;
    fillColor(doc, BOX_BG);
    drawColor(doc, LINE);
    doc.setLineWidth(0.2);
    doc.rect(boxX, cursor - 3, boxW, 16, 'FD');
    resumo.forEach(([label, value], index) => {
      const y = cursor + index * 4.6;
      doc.setFont('helvetica', index === resumo.length - 1 ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      textColor(doc, index === resumo.length - 1 ? INK : MUTED);
      doc.text(label, boxX + 2.5, y);
      textColor(doc, INK);
      doc.text(value, right - 2.5, y, { align: 'right' });
    });

    cursor += 14;
    if (dados.aviso) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const linhasAviso = doc.splitTextToSize(dados.aviso, contentWidth - 6);
      const altura = linhasAviso.length * 3.4 + 4;
      fillColor(doc, [243, 244, 246]);
      doc.rect(margin, cursor, contentWidth, altura, 'F');
      textColor(doc, [16, 120, 186]);
      doc.text(linhasAviso, margin + 3, cursor + 3.4);
      cursor += altura + 3;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    textColor(doc, INK);
    doc.text('Ocorrências', margin, cursor + 3);

    autoTable(doc, {
      startY: cursor + 5,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      theme: 'plain',
      head: [['Data', 'Desconto', 'Descrição', 'Pontos']],
      body: descontos,
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: { top: 1.6, right: 1.5, bottom: 1.6, left: 1.5 },
        textColor: INK,
        fillColor: [255, 255, 255],
        lineWidth: 0,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: { fillColor: HEAD_BG, textColor: MUTED, fontStyle: 'bold', fontSize: 7.5, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 22, valign: 'middle' },
        1: { cellWidth: 36, valign: 'middle' },
        2: { cellWidth: contentWidth - 80, valign: 'middle' },
        3: { cellWidth: 22, halign: 'right', valign: 'middle' },
      },
      didParseCell: (data) => {
        if (data.column.index === 3) data.cell.styles.halign = 'right';
        data.cell.styles.valign = 'middle';
      },
      didDrawCell: (data) => {
        const { x, y, width, height } = data.cell;
        if (data.section === 'head') {
          drawColor(doc, RULE);
          doc.setLineWidth(0.25);
          doc.line(x, y + height, x + width, y + height);
          return;
        }
        drawColor(doc, LINE);
        doc.setLineWidth(0.12);
        doc.line(x, y + height, x + width, y + height);
      },
    });

    let assinatura = fimDaTabela(doc, cursor + 18) + 4;
    const faixas = [...(dados.faixas ?? [])].sort((a, b) => Number(b.notaMin) - Number(a.notaMin));
    const nota = Number(motorista.nota);
    const faixaAtual = faixas.find((faixa) => nota >= Number(faixa.notaMin) && nota <= Number(faixa.notaMax));
    if (faixas.length > 0) {
      const notaCheia = formatNota(dados.notaInicial || '100');
      const regras = faixas
        .map((faixa) => `${formatNota(faixa.notaMin)} a ${formatNota(faixa.notaMax)}: ${textoFaixa(faixa)}`)
        .join('; ');
      const enquadramento = faixaAtual
        ? `Esta pontuação (${formatNota(motorista.nota)}) está na faixa de ${formatNota(faixaAtual.notaMin)} a ${formatNota(faixaAtual.notaMax)}: ${textoFaixa(faixaAtual)}.`
        : `Esta pontuação (${formatNota(motorista.nota)}) não se enquadra em nenhuma faixa.`;
      const tituloRegra = `Motorista Nota ${notaCheia}:`;
      doc.setFontSize(7.5);
      const textoRegras = doc.splitTextToSize(
        `A nota começa nesse valor. Cada desconto reduz essa nota, e a faixa define a bonificação. ${regras}. ${enquadramento}`,
        contentWidth - 6,
      );
      const alturaRegras = 4 + textoRegras.length * 3.3 + 3;
      if (assinatura + alturaRegras > pageHeight - 28) {
        doc.addPage();
        assinatura = 16;
      }
      fillColor(doc, BOX_BG);
      doc.rect(margin, assinatura, contentWidth, alturaRegras, 'F');
      textColor(doc, INK);
      doc.setFont('helvetica', 'bold');
      doc.text(tituloRegra, margin + 3, assinatura + 3.6);
      doc.setFont('helvetica', 'normal');
      doc.text(textoRegras, margin + 3, assinatura + 7.2);
      assinatura += alturaRegras + 4;
    }
    if (assinatura > pageHeight - 28) {
      doc.addPage();
      assinatura = 16;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    textColor(doc, INK);
    const declaracao = doc.splitTextToSize(
      `Declaro que conferi os descontos de ${MESES[dados.mes - 1].toLowerCase()} de ${dados.ano} e o valor a receber informado neste recibo.`,
      contentWidth,
    );
    doc.text(declaracao, margin, assinatura);
    assinatura += declaracao.length * 3.6 + 8;

    const campos = [
      ['Responsável frota', dados.impressoPor || ''],
      ['Responsável do financeiro', ''],
      ['Motorista', motorista.nomeCompleto],
    ] as const;
    const largura = (contentWidth - 8) / campos.length;
    campos.forEach(([rotulo, nome], indice) => {
      const x = margin + indice * (largura + 4);
      drawColor(doc, INK);
      doc.setLineWidth(0.25);
      doc.line(x, assinatura, x + largura - 2, assinatura);
      doc.setFontSize(7);
      textColor(doc, MUTED);
      doc.text(rotulo, x, assinatura + 3.6);
      if (nome) doc.text(nome, x, assinatura + 7);
    });
    return assinatura + 10;
  };

  const fimPrimeira = desenharVia(10, '1ª via — Empresa');
  if (fimPrimeira < pageHeight - 78) {
    const corte = fimPrimeira + 4;
    doc.setLineDashPattern([1, 1.2], 0);
    drawColor(doc, LINE);
    doc.setLineWidth(0.3);
    doc.line(margin, corte, right, corte);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(7);
    textColor(doc, MUTED);
    doc.text('Corte aqui', pageWidth / 2, corte - 1.4, { align: 'center' });
    desenharVia(corte + 6, '2ª via — Motorista');
  } else {
    doc.addPage();
    desenharVia(10, '2ª via — Motorista');
  }

  const competencia = String(dados.mes).padStart(2, '0');
  doc.save(`Recibo_Bonificacao_${nomeArquivo(motorista.nomeCompleto)}_${dados.ano}-${competencia}.pdf`);
}
