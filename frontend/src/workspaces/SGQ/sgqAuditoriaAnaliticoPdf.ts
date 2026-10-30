import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  PieController,
  Tooltip,
  type Plugin,
} from 'chart.js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoTranscamila from '../../assets/logo-transcamila-30-anos.png';
import type { SgqAuditoriaExecucao, SgqNormaItem } from '../../types/domain';
import { SGQ_AUDITORIA_STATUS_LABEL } from '../../types/domain';
import { textoPlanoFormatado } from './SGQEditorTexto';
import { agregarRespostasAuditoria } from './SGQAuditoriaResultados';

Chart.register(ArcElement, BarController, BarElement, CategoryScale, LinearScale, PieController, Legend, Tooltip);

type Rgb = [number, number, number];

const INK: Rgb = [15, 23, 42];
const MUTED: Rgb = [100, 116, 139];
const LINE: Rgb = [203, 213, 225];
const RULE: Rgb = [15, 118, 196];
const HEAD_BG: Rgb = [232, 239, 244];

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

const rotuloPizzaPdf: Plugin<'pie'> = {
  id: 'sgq-pdf-rotulo-pizza',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const valores = (chart.data.datasets[0]?.data ?? []) as number[];
    const total = valores.reduce((soma, valor) => soma + Number(valor || 0), 0);
    if (!total) return;
    const nomes = chart.data.labels ?? [];
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    chart.getDatasetMeta(0).data.forEach((arco, indice) => {
      const valor = Number(valores[indice] ?? 0);
      if (!valor) return;
      const props = arco.getProps(['x', 'y', 'startAngle', 'endAngle', 'outerRadius'], true);
      const abertura = props.endAngle - props.startAngle;
      if (abertura < 0.28) return;
      const meio = (props.startAngle + props.endAngle) / 2;
      const raio = props.outerRadius * (abertura > Math.PI ? 0.52 : 0.68);
      const x = props.x + Math.cos(meio) * raio;
      const y = props.y + Math.sin(meio) * raio;
      const pct = Math.round((valor / total) * 100);
      ctx.fillStyle = '#1e293b';
      ctx.font = '600 28px sans-serif';
      ctx.fillText(`${valor} (${pct}%)`, x, y);
      if (abertura > 1.1) {
        ctx.font = '22px sans-serif';
        ctx.fillText(String(nomes[indice] ?? ''), x, y - 32);
      }
    });
    ctx.restore();
  },
};

function grafico(
  tipo: 'bar' | 'pie',
  data: unknown,
  options: unknown,
  largura: number,
  altura: number,
  plugins?: Plugin[],
): string {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const chart = new Chart(canvas, {
    type: tipo,
    data: data as never,
    plugins,
    options: {
      ...(options as object),
      animation: false,
      responsive: false,
      devicePixelRatio: 2,
    },
  });
  chart.update('none');
  const url = canvas.toDataURL('image/png');
  chart.destroy();
  return url;
}

interface Faixa {
  rotulo: string;
  perguntas: number;
  respondidas: number;
  aplicaveis: number;
  soma: number;
}

function faixaVazia(rotulo: string): Faixa {
  return { rotulo, perguntas: 0, respondidas: 0, aplicaveis: 0, soma: 0 };
}

function acumular(faixa: Faixa, valor: number | null, respondeu: boolean) {
  faixa.perguntas += 1;
  if (!respondeu) return;
  faixa.respondidas += 1;
  if (valor == null) return;
  faixa.aplicaveis += 1;
  faixa.soma += valor;
}

function pct(faixa: Faixa): string {
  if (!faixa.aplicaveis) return '—';
  return `${Math.round(faixa.soma / faixa.aplicaveis)}%`;
}

function resumir(dados: SgqAuditoriaExecucao) {
  const respostas = new Map(dados.respostas.map((resposta) => [resposta.itemId, resposta]));
  const perguntas = dados.itens.filter((item) => item.tipo === 'pergunta');
  const geral = faixaVazia('Geral');
  const classes = new Map<string, Faixa>();
  const areas = new Map<string, Faixa>();
  const nomesClasse = new Map<string, string>();
  const metas = new Map<string, { primeira: number; reavaliacao: number }>();
  const nomesArea = new Map<string, string>();

  dados.normas.forEach((norma) => {
    norma.classificacoes.forEach((classe) => {
      if (!nomesClasse.has(classe.sigla)) nomesClasse.set(classe.sigla, classe.nome || classe.sigla);
      if (!metas.has(classe.sigla)) {
        metas.set(classe.sigla, { primeira: classe.metaPrimeira, reavaliacao: classe.metaReavaliacao });
      }
    });
    norma.areas.forEach((area) => {
      if (!nomesArea.has(area.sigla)) nomesArea.set(area.sigla, area.nome || area.sigla);
    });
  });

  const marcar = (item: SgqNormaItem) => {
    const resposta = respostas.get(item.id);
    const respondeu = Boolean(resposta?.opcaoCodigo);
    const valor = respondeu ? (resposta?.valor ?? null) : null;
    acumular(geral, valor, respondeu);
    const sigla = item.classificacao.trim() || '—';
    const classe = classes.get(sigla) ?? faixaVazia(nomesClasse.get(sigla) || (sigla === '—' ? 'Sem classificação' : sigla));
    acumular(classe, valor, respondeu);
    classes.set(sigla, classe);
    item.areas.forEach((area) => {
      const chave = area.trim();
      if (!chave) return;
      const faixa = areas.get(chave) ?? faixaVazia(nomesArea.get(chave) || chave);
      acumular(faixa, valor, respondeu);
      areas.set(chave, faixa);
    });
  };
  perguntas.forEach(marcar);

  return { geral, classes, areas, metas, fortes: dados.respostas.filter((item) => item.destaque === 'forte').length, fracos: dados.respostas.filter((item) => item.destaque === 'fraco').length };
}

export async function downloadSgqAuditoriaAnaliticoPdf(dados: SgqAuditoriaExecucao): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const right = pageWidth - margin;
  const contentWidth = right - margin;
  const auditoria = dados.auditoria;
  const logo = await loadImage(logoTranscamila).catch(() => null);
  const agregado = agregarRespostasAuditoria(dados);
  const numeros = resumir(dados);

  const logoBox = desenharLogo(doc, logo, margin, 10, 62, 14);
  textColor(doc, INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Relatório analítico', right, 14, { align: 'right' });
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
    ['Conformidade', pct(numeros.geral)],
    ['Respostas', `${numeros.geral.respondidas} de ${numeros.geral.perguntas}`],
    ['Pontos fortes', String(numeros.fortes)],
    ['Pontos fracos', String(numeros.fracos)],
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
  y += 4 + escopo.length * 4.1 + 4;

  const linhasClasse = [...numeros.classes.entries()].map(([sigla, faixa]) => {
    const meta = numeros.metas.get(sigla);
    return [
      faixa.rotulo,
      String(faixa.perguntas),
      String(faixa.respondidas),
      pct(faixa),
      meta ? `${meta.primeira}%` : '—',
      meta ? `${meta.reavaliacao}%` : '—',
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    head: [['Classificação', 'Perguntas', 'Respondidas', 'Conformidade', 'Meta 1ª', 'Meta reavaliação']],
    body: linhasClasse.length ? linhasClasse : [['Sem perguntas', '0', '0', '—', '—', '—']],
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.6, textColor: INK, lineColor: LINE, lineWidth: 0.15 },
    headStyles: { fillColor: HEAD_BG, textColor: INK, fontStyle: 'bold', fontSize: 8 },
  });
  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  y += 6;

  if (numeros.areas.size) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      theme: 'grid',
      head: [['Área', 'Perguntas', 'Respondidas', 'Conformidade']],
      body: [...numeros.areas.values()].map((faixa) => [
        faixa.rotulo, String(faixa.perguntas), String(faixa.respondidas), pct(faixa),
      ]),
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.6, textColor: INK, lineColor: LINE, lineWidth: 0.15 },
      headStyles: { fillColor: HEAD_BG, textColor: INK, fontStyle: 'bold', fontSize: 8 },
    });
    y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
    y += 8;
  }

  if (agregado.total > 0 && agregado.series.length) {
    const barras = grafico('bar', {
      labels: agregado.categorias.map((categoria) => categoria.rotulo),
      datasets: agregado.series.map((serie) => ({
        label: serie.rotulo,
        data: agregado.categorias.map((categoria) => categoria.contagens.get(serie.chave) ?? 0),
        backgroundColor: serie.cor,
        borderWidth: 0,
      })),
    }, {
      indexAxis: 'y',
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 12 } } } },
      scales: {
        x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
        y: { stacked: true },
      },
    }, 1400, Math.max(420, agregado.categorias.length * 70 + 160));

    const pizza = grafico('pie', {
      labels: agregado.series.map((serie) => serie.rotulo),
      datasets: [{
        data: agregado.series.map((serie) => agregado.porResposta.get(serie.chave) ?? 0),
        backgroundColor: agregado.series.map((serie) => serie.cor),
        borderColor: '#ffffff',
        borderWidth: 2,
      }],
    }, {
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 14,
            font: { size: 20 },
            generateLabels(chart: Chart<'pie'>) {
              const dataset = chart.data.datasets[0];
              const valores = (dataset?.data ?? []) as number[];
              const cores = (dataset?.backgroundColor ?? []) as string[];
              const total = valores.reduce((soma, valor) => soma + Number(valor || 0), 0);
              return (chart.data.labels ?? []).map((label: unknown, index: number) => {
                const valor = Number(valores[index] ?? 0);
                const pct = total ? Math.round((valor / total) * 100) : 0;
                return {
                  text: `${label}: ${valor} (${pct}%)`,
                  fillStyle: cores[index],
                  strokeStyle: cores[index],
                  fontColor: '#334155',
                  hidden: false,
                  index,
                  datasetIndex: 0,
                };
              });
            },
          },
        },
      },
    }, 900, 760, [rotuloPizzaPdf as unknown as Plugin]);

    const alturaBarra = Math.max(52, agregado.categorias.length * 14 + 28);
    if (y + alturaBarra > pageHeight - 18) {
      doc.addPage();
      y = 18;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    textColor(doc, INK);
    doc.text('Respostas por classificação', margin, y);
    doc.addImage(barras, 'PNG', margin, y + 3, contentWidth, alturaBarra);
    y += alturaBarra + 12;

    const alturaPizza = 88;
    if (y + alturaPizza > pageHeight - 18) {
      doc.addPage();
      y = 18;
    }
    doc.text('Respostas da auditoria', margin, y);
    const larguraPizza = 110;
    doc.addImage(pizza, 'PNG', margin + (contentWidth - larguraPizza) / 2, y + 3, larguraPizza, alturaPizza);
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
  doc.save(`Auditoria_${codigo}_analitico.pdf`);
}
