import type { DocumentoBipagem } from '../../types/domain';
import { agruparRelacaoBipagem, formatarTotalBipagem, somarTotaisBipagem } from './relacaoBipagem';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const celula = (valor: string) => escapeHtml(valor || '');

function linhaDocumento(documento: DocumentoBipagem, vencimento: string): string {
  return `
    <tr>
      <td>${celula(documento.codCliente)}</td>
      <td class="centro">${celula(documento.loja)}</td>
      <td>${celula(documento.cliente)}</td>
      <td class="centro">${celula(documento.origem)}</td>
      <td>${celula(documento.docto)}</td>
      <td>${celula(documento.emissao)}</td>
      <td>${celula(vencimento)}</td>
      <td class="num">${formatarTotalBipagem(documento.total)}</td>
      <td>${celula(documento.notas)}</td>
      <td>${celula(documento.fatura)}</td>
    </tr>
  `;
}

function montarHtml(documentos: DocumentoBipagem[], vencimento: string, emitidoEm: string): string {
  const grupos = agruparRelacaoBipagem(documentos);
  const totalGeral = somarTotaisBipagem(grupos.map((grupo) => grupo.total));
  const corpo = grupos.map((grupo) => {
    const lojas = grupo.lojas.map((loja) => `
      <tr class="divisao"><td colspan="10">Loja ${celula(loja.loja)}</td></tr>
      ${loja.documentos.map((documento) => linhaDocumento(documento, vencimento)).join('')}
      <tr class="total">
        <td colspan="7">Total da loja ${celula(loja.loja)}</td>
        <td class="num">${formatarTotalBipagem(loja.total)}</td>
        <td colspan="2"></td>
      </tr>
    `).join('');
    const totalOrigem = grupo.lojas.length > 1
      ? `<tr class="total origem">
          <td colspan="7">Total da origem ${celula(grupo.origem)}</td>
          <td class="num">${formatarTotalBipagem(grupo.total)}</td>
          <td colspan="2"></td>
        </tr>`
      : '';
    return `
      <tr class="divisao origem"><td colspan="10">Origem ${celula(grupo.origem)}</td></tr>
      ${lojas}
      ${totalOrigem}
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relação de faturamento</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #0f172a; font: 11px/1.35 Arial, Helvetica, sans-serif; }
    header { margin-bottom: 14px; }
    h1 { margin: 0 0 4px; font-size: 18px; }
    p { margin: 0; color: #475569; }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    th {
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
      background: #f8fafc;
      border-bottom: 1px solid #cbd5e1;
      padding: 6px;
    }
    td { padding: 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .centro { text-align: center; }
    tr.divisao td {
      background: #f1f5f9;
      font-weight: 700;
      border-bottom-color: #cbd5e1;
    }
    tr.divisao.origem td { background: #e2e8f0; }
    tr.total td { font-weight: 700; background: #fff; }
    tr.total.origem td { border-top: 1px solid #94a3b8; }
    tfoot td { border-bottom: 0; border-top: 2px solid #0f172a; font-weight: 700; padding-top: 8px; }
    tr { break-inside: avoid; page-break-inside: avoid; }
  </style>
</head>
<body>
  <header>
    <h1>Relação de faturamento</h1>
    <p>Rascunho da bipagem · ${escapeHtml(emitidoEm)} · ${documentos.length} documento(s) · Vencimento ${escapeHtml(vencimento)}</p>
  </header>
  <table>
    <thead>
      <tr>
        <th>Cod.Clien</th>
        <th>Loja</th>
        <th>Cliente</th>
        <th>Origem</th>
        <th>Docto</th>
        <th>Emissão</th>
        <th>Venc.</th>
        <th class="num">Total</th>
        <th>Notas</th>
        <th>Fatura</th>
      </tr>
    </thead>
    <tbody>${corpo}</tbody>
    <tfoot>
      <tr>
        <td colspan="7">Total da relação</td>
        <td class="num">${formatarTotalBipagem(totalGeral)}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
}

export function imprimirRelacaoBipagem(documentos: DocumentoBipagem[], vencimento: string) {
  if (documentos.length === 0) return;
  document.getElementById('bipagem-print-frame')?.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'bipagem-print-frame';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', 'Impressão da relação de faturamento');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    window.alert('Não foi possível preparar a impressão da relação.');
    return;
  }

  const emitidoEm = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  frameDocument.open();
  frameDocument.write(montarHtml(documentos, vencimento, emitidoEm));
  frameDocument.close();

  const disparar = () => {
    frameWindow.focus();
    frameWindow.print();
  };
  if (frameDocument.readyState === 'complete') {
    disparar();
  } else {
    iframe.onload = disparar;
  }
}
