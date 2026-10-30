import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoTranscamila from '../../assets/logo-transcamila-30-anos.png';
import type { SgqAuditoriaExecucao, SgqAuditoriaResposta, SgqNormaItem } from '../../types/domain';
import { SGQ_AUDITORIA_STATUS_LABEL } from '../../types/domain';
import { textoPlanoFormatado } from './SGQEditorTexto';

type Rgb = [number, number, number];
type Norma = SgqAuditoriaExecucao['normas'][number];
type Celula = string | { content: string; colSpan: number; styles: Record<string, string | number | Rgb> };

const INK: Rgb = [15, 23, 42];
const MUTED: Rgb = [100, 116, 139];
const LINE: Rgb = [203, 213, 225];
const RULE: Rgb = [15, 118, 196];
const HEAD_BG: Rgb = [232, 239, 244];
const SECAO_BG: Rgb = [241, 245, 249];

const textColor = (doc: jsPDF, color: Rgb) => doc.setTextColor(color[0], color[1], color[2]);
const drawColor = (doc: jsPDF, color: Rgb) => doc.setDrawColor(color[0], color[1], color[2]);

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('logo'));
    image.src = src;
  });
}

function formatarData(iso: string): string {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  if (ano?.length === 4 && mes && dia) return `${dia}/${mes}/${ano}`;
  return iso;
}

function formatarDataHora(iso: string): string {
  if (!iso) return '—';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function nomeClasse(norma: Norma, sigla: string): string {
  const classe = norma.classificacoes.find((item) => item.sigla === sigla);
  return classe?.nome || sigla;
}

function nomesAreas(norma: Norma, siglas: string[]): string {
  return siglas
    .map((sigla) => norma.areas.find((area) => area.sigla === sigla)?.nome || sigla)
    .filter(Boolean)
    .join(', ');
}

function textoResposta(resposta: SgqAuditoriaResposta | undefined): string {
  if (!resposta?.opcaoCodigo) return 'Sem resposta';
  const base = resposta.opcaoTexto || resposta.opcaoCodigo;
  if (resposta.destaque === 'forte') return `${base} · Ponto forte`;
  if (resposta.destaque === 'fraco') return `${base} · Ponto fraco`;
  return base;
}

function textoObservacoes(resposta: SgqAuditoriaResposta | undefined): string {
  if (!resposta?.opcaoCodigo && !resposta?.observacoes && !resposta?.anexos.length) return '';
  const partes: string[] = [];
  if (resposta?.observacoes.trim()) partes.push(resposta.observacoes.trim());
  if (resposta?.anexos.length) partes.push(`Anexos: ${resposta.anexos.map((anexo) => anexo.nome).join(', ')}`);
  if (resposta?.opcaoCodigo && resposta.respondidoPor) {
    partes.push(`${resposta.respondidoPor} · ${formatarDataHora(resposta.atualizadoEm)}`);
  }
  return partes.join('\n');
}

interface PerguntaPdf {
  normaId: string;
  normaNome: string;
  secao: string;
  codigo: string;
  titulo: string;
  classificacao: string;
  resposta: string;
  observacoes: string;
}

function listarPerguntas(dados: SgqAuditoriaExecucao): PerguntaPdf[] {
  const porPai = new Map<string, SgqNormaItem[]>();
  dados.itens.forEach((item) => {
    const chave = item.parentId ?? `norma:${item.normaId}`;
    const lista = porPai.get(chave);
    if (lista) lista.push(item);
    else porPai.set(chave, [item]);
  });
  const respostas = new Map(dados.respostas.map((resposta) => [resposta.itemId, resposta]));
  const perguntas: PerguntaPdf[] = [];

  const visitar = (chave: string, caminho: string[], norma: Norma) => {
    (porPai.get(chave) ?? []).forEach((item) => {
      const rotulo = [item.codigo, item.titulo].filter(Boolean).join(' ').trim();
      if (item.tipo === 'pergunta') {
        const resposta = respostas.get(item.id);
        const classe = item.classificacao.trim() ? nomeClasse(norma, item.classificacao.trim()) : '';
        const areas = nomesAreas(norma, item.areas);
        perguntas.push({
          normaId: norma.id,
          normaNome: norma.nome,
          secao: caminho.join(' · '),
          codigo: item.codigo,
          titulo: item.titulo,
          classificacao: [classe, areas].filter(Boolean).join('\n'),
          resposta: textoResposta(resposta),
          observacoes: textoObservacoes(resposta),
        });
        visitar(item.id, caminho, norma);
      } else {
        visitar(item.id, rotulo ? [...caminho, rotulo] : caminho, norma);
      }
    });
  };

  dados.normas.forEach((norma) => visitar(`norma:${norma.id}`, [], norma));
  return perguntas;
}

function linhasDaTabela(perguntas: PerguntaPdf[]): Celula[][] {
  const linhas: Celula[][] = [];
  let normaAtual = '';
  let secaoAtual = '';
  perguntas.forEach((pergunta) => {
    if (pergunta.normaNome !== normaAtual) {
      normaAtual = pergunta.normaNome;
      secaoAtual = '';
      linhas.push([{
        content: pergunta.normaNome,
        colSpan: 5,
        styles: { fillColor: RULE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      }]);
    }
    if (pergunta.secao && pergunta.secao !== secaoAtual) {
      secaoAtual = pergunta.secao;
      linhas.push([{
        content: pergunta.secao,
        colSpan: 5,
        styles: { fillColor: SECAO_BG, textColor: INK, fontStyle: 'bold', fontSize: 8 },
      }]);
    }
    linhas.push([
      pergunta.codigo,
      pergunta.titulo,
      pergunta.classificacao,
      pergunta.resposta,
      pergunta.observacoes,
    ]);
  });
  return linhas;
}

function desenharCampo(doc: jsPDF, rotulo: string, valor: string, x: number, y: number, largura: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  textColor(doc, MUTED);
  doc.text(rotulo.toUpperCase(), x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  textColor(doc, INK);
  const linhas = doc.splitTextToSize(valor || '—', largura) as string[];
  doc.text(linhas, x, y + 4);
  return 4 + linhas.length * 4.1 + 2.4;
}

function desenharLogo(doc: jsPDF, logo: HTMLImageElement | null, x: number, y: number, maxW: number, maxH: number) {
  if (!logo) return { w: 0, h: 0 };
  const ratio = logo.naturalWidth / logo.naturalHeight || 1;
  let largura = maxW;
  let altura = largura / ratio;
  if (altura > maxH) {
    altura = maxH;
    largura = altura * ratio;
  }
  doc.addImage(logo, 'PNG', x, y, largura, altura);
  return { w: largura, h: altura };
}

export async function downloadSgqAuditoriaRegistroPdf(dados: SgqAuditoriaExecucao): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const right = pageWidth - margin;
  const contentWidth = right - margin;
  const auditoria = dados.auditoria;
  const logo = await loadImage(logoTranscamila).catch(() => null);

  const logoBox = desenharLogo(doc, logo, margin, 10, 62, 14);
  textColor(doc, INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Relatório detalhado', right, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  textColor(doc, MUTED);
  doc.text(auditoria.codigo, right, 19.5, { align: 'right' });

  const linhaCabecalho = Math.max(26, 10 + logoBox.h + 2);
  drawColor(doc, RULE);
  doc.setLineWidth(0.5);
  doc.line(margin, linhaCabecalho, right, linhaCabecalho);

  const status = SGQ_AUDITORIA_STATUS_LABEL[auditoria.status];
  const pares: Array<[string, string]> = [
    ['Código', auditoria.codigo],
    ['Status', auditoria.atrasada ? `${status} · atrasada` : status],
    ['Título', auditoria.titulo],
    ['Auditor líder', auditoria.auditorLider || '—'],
    ['Auditores', auditoria.auditores?.join(', ') || '—'],
    ['Categoria', auditoria.categoria || '—'],
    ['Período', `${formatarData(auditoria.dataInicio)} a ${formatarData(auditoria.dataTermino)}`],
    ['Normas', auditoria.normas.map((norma) => norma.nome).join(', ') || '—'],
    ['Filial', auditoria.filial || '—'],
    ['Criada por', [auditoria.criadoPor, formatarDataHora(auditoria.criadoEm)].filter(Boolean).join(' · ') || '—'],
    ['Atualização', formatarDataHora(auditoria.atualizadoEm)],
  ];

  const colW = (contentWidth - 8) / 2;
  let y = linhaCabecalho + 7;
  for (let i = 0; i < pares.length; i += 2) {
    const esquerda = desenharCampo(doc, pares[i][0], pares[i][1], margin, y, colW);
    const direita = pares[i + 1]
      ? desenharCampo(doc, pares[i + 1][0], pares[i + 1][1], margin + colW + 8, y, colW)
      : 0;
    y += Math.max(esquerda, direita);
  }

  const escopo = doc.splitTextToSize(textoPlanoFormatado(auditoria.escopo) || '—', contentWidth) as string[];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  textColor(doc, MUTED);
  doc.text('ESCOPO / OBJETIVO', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  textColor(doc, INK);
  doc.text(escopo, margin, y + 4);
  y += 4 + escopo.length * 4.1 + 2;

  const perguntas = listarPerguntas(dados);
  const respostas = new Map(dados.respostas.map((resposta) => [resposta.itemId, resposta]));
  const respondidas = dados.itens.filter((item) => item.tipo === 'pergunta' && respostas.get(item.id)?.opcaoCodigo).length;
  const fortes = dados.respostas.filter((resposta) => resposta.destaque === 'forte').length;
  const fracos = dados.respostas.filter((resposta) => resposta.destaque === 'fraco').length;
  doc.setFontSize(8.5);
  textColor(doc, MUTED);
  doc.text(
    `${perguntas.length} perguntas · ${respondidas} respondidas · ${fortes} pontos fortes · ${fracos} pontos fracos`,
    margin,
    y + 2,
  );
  y += 6;

  const corpo = linhasDaTabela(perguntas);
  if (corpo.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    textColor(doc, MUTED);
    doc.text('As normas desta auditoria ainda não têm perguntas.', margin, y + 4);
  } else {
    autoTable(doc, {
      startY: y,
      margin: { top: 18, right: margin, bottom: 14, left: margin },
      tableWidth: contentWidth,
      theme: 'grid',
      head: [['Código', 'Pergunta', 'Classificação', 'Resposta', 'Observações']],
      body: corpo,
      showHead: 'everyPage',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 1.6,
        textColor: INK,
        lineColor: LINE,
        lineWidth: 0.15,
        overflow: 'linebreak',
        valign: 'top',
      },
      headStyles: {
        fillColor: HEAD_BG,
        textColor: INK,
        fontStyle: 'bold',
        fontSize: 8,
        valign: 'middle',
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 68 },
        2: { cellWidth: 28 },
        3: { cellWidth: 28 },
        4: { cellWidth: contentWidth - 144 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3 && data.cell.raw === 'Sem resposta') {
          data.cell.styles.textColor = MUTED;
          data.cell.styles.fontStyle = 'italic';
        }
      },
      didDrawPage: (data) => {
        if (data.pageNumber === 1) return;
        desenharLogo(doc, logo, margin, 6, 36, 8);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        textColor(doc, INK);
        doc.text(`Relatório detalhado ${auditoria.codigo}`, right, 11, { align: 'right' });
        drawColor(doc, RULE);
        doc.setLineWidth(0.4);
        doc.line(margin, 15, right, 15);
      },
    });
  }

  const agora = formatarDataHora(new Date().toISOString());
  const total = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina += 1) {
    doc.setPage(pagina);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    textColor(doc, MUTED);
    doc.text(`Gerado em ${agora}`, margin, pageHeight - 8);
    doc.text(`Página ${pagina} de ${total}`, right, pageHeight - 8, { align: 'right' });
  }

  const codigo = auditoria.codigo.replace(/[^\w.-]+/g, '_');
  doc.save(`Auditoria_${codigo}_detalhado.pdf`);
}
