import { jsPDF } from 'jspdf';
import logoTranscamila from '../../assets/logo-transcamila-30-anos.png';
import type { SgqSipocEsquema } from '../../types/domain';
import { svgSipoc } from './SGQSipocLousa';

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.onload = () => resolve(imagem);
    imagem.onerror = () => reject(new Error('logo'));
    imagem.src = src;
  });
}

function rasterizar(svg: string, largura: number, altura: number): Promise<string> {
  const escala = Math.min(2, 2800 / Math.max(largura, altura));
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    imagem.onload = () => {
      const tela = document.createElement('canvas');
      tela.width = Math.max(1, Math.round(largura * escala));
      tela.height = Math.max(1, Math.round(altura * escala));
      const contexto = tela.getContext('2d');
      if (!contexto) {
        URL.revokeObjectURL(url);
        reject(new Error('canvas'));
        return;
      }
      contexto.fillStyle = '#ffffff';
      contexto.fillRect(0, 0, tela.width, tela.height);
      contexto.drawImage(imagem, 0, 0, tela.width, tela.height);
      URL.revokeObjectURL(url);
      resolve(tela.toDataURL('image/png'));
    };
    imagem.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('svg'));
    };
    imagem.src = url;
  });
}

const TINTA: [number, number, number] = [15, 23, 42];
const SUAVE: [number, number, number] = [100, 116, 139];
const TRAÇO: [number, number, number] = [15, 118, 196];

function medidaLogo(logo: HTMLImageElement | null, maxW: number, maxH: number) {
  if (!logo) return { w: 0, h: 0 };
  const proporcao = logo.naturalWidth / logo.naturalHeight || 1;
  let largura = maxW;
  let altura = largura / proporcao;
  if (altura > maxH) {
    altura = maxH;
    largura = altura * proporcao;
  }
  return { w: largura, h: altura };
}

function desenharLogo(doc: jsPDF, logo: HTMLImageElement | null, x: number, y: number, maxW: number, maxH: number) {
  const caixa = medidaLogo(logo, maxW, maxH);
  if (logo && caixa.w) doc.addImage(logo, 'PNG', x, y, caixa.w, caixa.h);
  return caixa;
}

function larguraPar(doc: jsPDF, rotulo: string, valor: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const rotuloLargura = doc.getTextWidth(rotulo);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  return rotuloLargura + 2 + doc.getTextWidth(valor || '—');
}

function desenharPar(doc: jsPDF, rotulo: string, valor: string, x: number, y: number, maximo: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(SUAVE[0], SUAVE[1], SUAVE[2]);
  doc.text(rotulo, x, y);
  const inicio = x + doc.getTextWidth(rotulo) + 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
  const linhas = doc.splitTextToSize(valor || '—', Math.max(12, maximo)) as string[];
  doc.text(linhas[0], inicio, y);
  return inicio + doc.getTextWidth(linhas[0]);
}

function desenharCabecalho(
  doc: jsPDF,
  logo: HTMLImageElement | null,
  dados: { nome: string; setor: string; descricao: string },
  margem: number,
  direita: number,
  emissao: string,
) {
  const topo = 10;
  const reservado = medidaLogo(logo, 44, 12);
  if (reservado.h) desenharLogo(doc, logo, margem, topo, 44, 12);

  const textoX = margem + (reservado.w ? reservado.w + 7 : 0);
  const meio = topo + reservado.h / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(SUAVE[0], SUAVE[1], SUAVE[2]);
  doc.text('SIPOC', textoX, meio - 1.2);
  doc.setFontSize(16);
  doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
  const linhasNome = (doc.splitTextToSize(dados.nome || 'Procedimento', direita - textoX) as string[]).slice(0, 1);
  doc.text(linhasNome, textoX, meio + 5.4);

  const metaY = topo + Math.max(reservado.h, 14) + 7;
  const xEmissao = direita - larguraPar(doc, 'EMISSÃO', emissao);
  desenharPar(doc, 'EMISSÃO', emissao, xEmissao, metaY, 40);

  const descricao = dados.descricao.trim();
  const fimSetor = desenharPar(doc, 'SETOR', dados.setor || '—', margem, metaY, 48);
  if (descricao && fimSetor + 28 < xEmissao) {
    desenharPar(doc, 'DESCRIÇÃO', descricao, fimSetor + 12, metaY, xEmissao - fimSetor - 20);
  }

  const linha = metaY + 4;
  doc.setDrawColor(TRAÇO[0], TRAÇO[1], TRAÇO[2]);
  doc.setLineWidth(0.6);
  doc.line(margem, linha, direita, linha);
  return linha;
}

function nomeArquivo(nome: string) {
  const base = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return `SIPOC_${base || 'procedimento'}.pdf`;
}

export async function baixarSipocPdf(dados: {
  nome: string;
  setor: string;
  descricao: string;
  esquema: SgqSipocEsquema;
}) {
  const desenho = svgSipoc(dados.esquema);
  const png = await rasterizar(desenho.svg, desenho.largura, desenho.altura);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const margem = 14;
  const direita = largura - margem;
  const logo = await carregarImagem(logoTranscamila).catch(() => null);
  const agora = new Date();
  const emissao = agora.toLocaleDateString('pt-BR');
  const geradoEm = agora.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const depoisDosCampos = desenharCabecalho(doc, logo, dados, margem, direita, emissao);

  const areaLargura = direita - margem;
  const areaAltura = altura - depoisDosCampos - 14;
  const proporcao = desenho.largura / desenho.altura;
  let desenhoLargura = areaLargura;
  let desenhoAltura = desenhoLargura / proporcao;
  if (desenhoAltura > areaAltura) {
    desenhoAltura = areaAltura;
    desenhoLargura = desenhoAltura * proporcao;
  }
  doc.addImage(
    png,
    'PNG',
    margem + (areaLargura - desenhoLargura) / 2,
    depoisDosCampos + 4,
    desenhoLargura,
    desenhoAltura,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(SUAVE[0], SUAVE[1], SUAVE[2]);
  doc.text(`Gerado em ${geradoEm}`, margem, altura - 8);
  doc.text('Página 1 de 1', direita, altura - 8, { align: 'right' });
  doc.save(nomeArquivo(dados.nome));
}
