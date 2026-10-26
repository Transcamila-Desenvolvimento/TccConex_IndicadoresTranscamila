import { jsPDF } from 'jspdf';
import logoTranscamila from '../../assets/logo-transcamila-30-anos.png';
import type { CamiloAta } from '../../types/domain';

type Rgb = [number, number, number];

const INK: Rgb = [15, 23, 42];
const MUTED: Rgb = [100, 116, 139];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('logo'));
    image.src = src;
  });
}

function nomeArquivo(titulo: string): string {
  const base = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return `Ata_${base || 'reuniao'}.pdf`;
}

export async function blobCamiloAtaPdf(ata: CamiloAta): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const largura = pageWidth - margin * 2;
  let y = 14;

  const garantir = (altura: number) => {
    if (y + altura <= pageHeight - 16) return;
    doc.addPage();
    y = 16;
  };

  try {
    const logo = await loadImage(logoTranscamila);
    const logoLargura = 62;
    const logoAltura = Math.min(16, (logo.height / logo.width) * logoLargura);
    doc.addImage(logo, 'PNG', margin, y, logoLargura, logoAltura);
    y += logoAltura + 8;
  } catch {
    y += 4;
  }

  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Ata de reunião', margin, y);
  y += 7;
  doc.setFontSize(12);
  const titulo = doc.splitTextToSize(ata.titulo, largura) as string[];
  doc.text(titulo, margin, y);
  y += titulo.length * 5.2 + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(ata.data ? `Data: ${ata.data}` : 'Data não informada', margin, y);
  y += 8;

  const bloco = (rotulo: string, linhas: string[]) => {
    if (!linhas.length) return;
    garantir(14);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(rotulo, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    linhas.forEach((linha) => {
      const partes = doc.splitTextToSize(linha, largura) as string[];
      partes.forEach((parte) => {
        garantir(5);
        doc.text(parte, margin, y);
        y += 4.6;
      });
      y += 1.4;
    });
    y += 2;
  };

  bloco('Participantes', [ata.participantes.length ? ata.participantes.join(', ') : 'Não citados']);
  bloco('O que foi dito na reunião', ata.assuntos ?? []);
  bloco('Considerações do documento', ata.consideracoes ?? []);
  if (ata.aviso) bloco('Observação', [ata.aviso]);

  const total = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina += 1) {
    doc.setPage(pagina);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(`Página ${pagina} de ${total}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  return doc.output('blob');
}

export async function downloadCamiloAtaPdf(ata: CamiloAta): Promise<void> {
  const blob = await blobCamiloAtaPdf(ata);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo(ata.titulo);
  link.click();
  URL.revokeObjectURL(url);
}
