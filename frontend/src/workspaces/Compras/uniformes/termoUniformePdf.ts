import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EntregaUniforme, EntregaUniformeItem } from '../../../types/domain';
import logoTranscamila from '../../../assets/logo-transcamila-30-anos.png';

type Rgb = [number, number, number];

const INK: Rgb = [20, 20, 20];
const MUTED: Rgb = [90, 90, 90];
const LINE: Rgb = [120, 120, 120];
const HEAD_BG: Rgb = [235, 235, 235];

const DECLARACAO =
  'Declaro neste ato, que todos os uniformes especificados e entregues GRATUITAMENTE nesta data são ' +
  'para exercício da minha função, sendo os mesmos de propriedade da empresa bem como a obrigatoriedade ' +
  'de seu uso no exercício das minhas atividades, comprometendo-me assim a respeitar e cumprir o que segue abaixo:';

const REGRAS = [
  'Fazer uso do uniforme, abstendo-me de usá-lo para fins extraprofissionais;',
  'Zelar pela boa conservação deste;',
  'Nos casos de perda, roubo ou extravio, o colaborador deverá comunicar imediatamente ao Departamento Pessoal, ' +
    'para que sejam tomadas as providências cabíveis. Lembrando que no caso de perda os indenizarei no valor integral.',
  'Em caso de demissão, o uniforme deverá ser devolvido ao Departamento Pessoal no momento da assinatura do aviso prévio.',
];

const TAMANHO_UNICO = new Set(['', '-', 'U', 'UN', 'UNICO', 'ÚNICO', 'TAMANHO ÚNICO', 'TAMANHO UNICO']);

const textColor = (doc: jsPDF, c: Rgb) => doc.setTextColor(c[0], c[1], c[2]);
const drawColor = (doc: jsPDF, c: Rgb) => doc.setDrawColor(c[0], c[1], c[2]);

function formatDateBr(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function formatCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf;
}

function descricaoItem(item: EntregaUniformeItem): string {
  const tamanho = item.uniformeTamanho.trim().toUpperCase();
  const partes = [item.uniformeNome.toUpperCase()];
  if (!TAMANHO_UNICO.has(tamanho)) partes.push(`TAM ${tamanho}`);
  const descricao = partes.join(' – ');
  return item.condicao === 'usado' ? `${descricao} (USADO)` : descricao;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('logo'));
    image.src = src;
  });
}

async function montarTermo(entrega: EntregaUniforme): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const right = pageWidth - margin;
  const contentWidth = right - margin;

  const logo = await loadImage(logoTranscamila).catch(() => null);
  if (logo) {
    const ratio = logo.naturalWidth / logo.naturalHeight || 1;
    let logoH = 11;
    let logoW = logoH * ratio;
    if (logoW > 50) {
      logoW = 50;
      logoH = logoW / ratio;
    }
    doc.addImage(logo, 'PNG', margin, 10, logoW, logoH);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  textColor(doc, MUTED);
  doc.text(`Nº ${entrega.numero}`, right, 14, { align: 'right' });

  textColor(doc, INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('TERMO DE RECEBIMENTO DE UNIFORME', pageWidth / 2, 30, { align: 'center' });
  drawColor(doc, INK);
  doc.setLineWidth(0.4);
  doc.line(margin, 33, right, 33);

  const campos: Array<[string, string]> = [
    ['NOME', entrega.colaboradorNome.toUpperCase()],
    ['CARGO', (entrega.colaboradorCargo || '—').toUpperCase()],
    ['CPF', entrega.colaboradorCpf ? formatCpf(entrega.colaboradorCpf) : '—'],
    ['SETOR', (entrega.colaboradorSetor || '—').toUpperCase()],
  ];
  doc.setFontSize(10);
  campos.forEach(([label, valor], index) => {
    const x = margin + (index % 2 === 0 ? 0 : contentWidth * 0.62);
    const y = 41 + Math.floor(index / 2) * 7;
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, x, y);
    doc.setFont('helvetica', 'normal');
    const offset = doc.getTextWidth(`${label}: `);
    const largura = (index % 2 === 0 ? contentWidth * 0.6 : contentWidth * 0.38) - offset;
    doc.text(doc.splitTextToSize(valor, largura)[0] ?? '', x + offset, y);
  });

  let y = 58;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const declaracao = doc.splitTextToSize(DECLARACAO, contentWidth) as string[];
  doc.text(declaracao, margin, y, { align: 'justify', maxWidth: contentWidth, lineHeightFactor: 1.4 });
  y += declaracao.length * 5 + 4;

  doc.setFont('helvetica', 'bold');
  doc.text('REGRAS BÁSICAS', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  REGRAS.forEach((regra, index) => {
    const linhas = doc.splitTextToSize(regra, contentWidth - 8) as string[];
    doc.text(`${index + 1}.`, margin, y);
    doc.text(linhas, margin + 8, y, { align: 'justify', maxWidth: contentWidth - 8, lineHeightFactor: 1.4 });
    y += linhas.length * 5 + 1.5;
  });
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('RELAÇÃO DE UNIFORMES ENTREGUES:', margin, y);

  autoTable(doc, {
    startY: y + 3,
    margin: { left: margin, right: margin },
    head: [['DATA', 'QTD', 'DESCRIÇÃO', 'ASSINATURA']],
    body: entrega.itens.map((item) => [
      formatDateBr(entrega.dataEntrega),
      String(item.quantidade),
      descricaoItem(item),
      '',
    ]),
    theme: 'grid',
    styles: {
      font: 'helvetica', fontSize: 9.5, cellPadding: 2.4, textColor: INK, lineColor: LINE, lineWidth: 0.2,
      minCellHeight: 9, valign: 'middle',
    },
    headStyles: { fillColor: HEAD_BG, textColor: INK, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center' },
      1: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 52 },
    },
  });

  const docComTabela = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  y = (docComTabela.lastAutoTable?.finalY ?? y) + 6;

  const observacoes = entrega.observacoes
    ? (doc.splitTextToSize(`Observações: ${entrega.observacoes}`, contentWidth) as string[])
    : [];
  const alturaRestante = observacoes.length * 5 + 34;
  if (y + alturaRestante > pageHeight - 16) {
    doc.addPage();
    y = 20;
  }

  if (observacoes.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(observacoes, margin, y);
    y += observacoes.length * 5 + 3;
  }

  doc.setFontSize(10);
  const linhaAssinatura = (rotuloEsq: string, valorEsq: string, rotuloDir: string, linhaY: number) => {
    doc.setFont('helvetica', 'normal');
    doc.text(rotuloEsq, margin, linhaY);
    const xData = margin + doc.getTextWidth(rotuloEsq) + 1;
    if (valorEsq) {
      doc.text(valorEsq, xData, linhaY);
    } else {
      doc.text('____/____/______', xData, linhaY);
    }
    const xDir = margin + contentWidth * 0.45;
    doc.text(rotuloDir, xDir, linhaY);
    drawColor(doc, INK);
    doc.setLineWidth(0.25);
    doc.line(xDir + doc.getTextWidth(rotuloDir) + 1, linhaY + 0.8, right, linhaY + 0.8);
  };
  y += 8;
  linhaAssinatura('Data: ', formatDateBr(entrega.dataEntrega), 'Assinatura:', y);
  y += 11;
  linhaAssinatura('Data da Devolução: ', '', 'Recebido por:', y);

  doc.setFontSize(7.5);
  textColor(doc, MUTED);
  doc.text(
    `Termo ${entrega.numero} · entregue por ${entrega.usuarioNome || '—'} · emitido em ${new Date().toLocaleString('pt-BR')}`,
    pageWidth / 2, pageHeight - 10, { align: 'center' },
  );

  return doc;
}

/** Abre o termo em nova aba já com a janela de impressão. A aba é aberta antes da
 * geração para não ser bloqueada pelo navegador como pop-up. */
export async function imprimirTermoUniforme(entrega: EntregaUniforme): Promise<void> {
  const janela = window.open('', '_blank');
  const doc = await montarTermo(entrega);
  doc.autoPrint();
  const url = doc.output('bloburl').toString();
  if (janela) {
    janela.location.href = url;
  } else {
    doc.save(`Termo_${entrega.numero}.pdf`);
  }
}

export async function baixarTermoUniforme(entrega: EntregaUniforme): Promise<void> {
  const doc = await montarTermo(entrega);
  doc.save(`Termo_${entrega.numero}_${entrega.colaboradorNome.replace(/\s+/g, '_')}.pdf`);
}
