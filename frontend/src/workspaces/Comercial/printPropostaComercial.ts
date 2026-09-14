import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import logoTranscamila from '../../assets/logo-transcamila-30-anos.png';
import { apiService } from '../../services/apiService';
import type {
  ClienteComercial,
  PropostaComercial,
  PropostaCondicaoComercial,
  TabelaFrete,
  TabelaFreteFaixa,
} from '../../types/domain';
import {
  formatColunaExtraValor,
  formatTabelaMoneyPdf,
  formatTabelaPercentFator,
  isTarifaVeiculo,
  isGrisAdvUnificado,
} from './formatTabelaFrete';
import {
  CONDICOES_FRETE_PADRAO,
  PROPOSTA_COMERCIAL_STATUS_LABEL,
  PROPOSTA_COMERCIAL_TIPO_LABEL,
} from '../../types/domain';

const A4_LANDSCAPE_PX = 1123;
const A4_LANDSCAPE_HEIGHT_PX = 794;
const A4_PORTRAIT_PX = 794;
const A4_PORTRAIT_HEIGHT_PX = 1123;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const dash = (value?: string | null) => {
  const trimmed = (value ?? '').trim();
  return trimmed ? escapeHtml(trimmed) : '—';
};

const formatDateBr = (value?: string | null) => {
  if (!value) return '—';
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return escapeHtml(value);
  return `${day}/${month}/${year}`;
};

const formatMoneyBr = (value?: string | number | null) => {
  if (value == null || value === '') return '—';
  const amount = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (Number.isNaN(amount)) return escapeHtml(String(value));
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const field = (label: string, value: string) => `
  <div class="field">
    <span>${escapeHtml(label)}</span>
    <strong>${value}</strong>
  </div>
`;

const buildDestinosTable = (proposta: PropostaComercial) => {
  if (proposta.tipo !== 'transporte_rodoviario') return '';
  const linhas = proposta.linhas.filter((linha) =>
    [linha.origem, linha.entrega, linha.veiculo, linha.tarifaFrete, linha.pedagio].some((item) => String(item ?? '').trim()),
  );
  const source = linhas.length ? linhas : proposta.linhas;
  const rows = source.map((linha) => `
    <tr>
      <td>${dash(linha.origem)}</td>
      <td>${dash(linha.entrega)}</td>
      <td>${dash(linha.veiculo)}</td>
      <td>${formatMoneyBr(linha.tarifaFrete)}</td>
      <td>${formatMoneyBr(linha.pedagio)}</td>
      <td>${dash(linha.gris)}</td>
      <td>${dash(linha.adValorem)}</td>
      <td>${dash(linha.icms)}</td>
      <td>${dash(linha.prazoDias)}</td>
    </tr>
  `).join('');

  return `
    <section class="block">
      <h2>Destinos</h2>
      <table class="destinos">
        <thead>
          <tr>
            <th>Origem</th>
            <th>Destino</th>
            <th>Veículo</th>
            <th>Frete</th>
            <th>Pedágio</th>
            <th>GRIS</th>
            <th>Ad-VL</th>
            <th>ICMS</th>
            <th>Prazo</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="9">Nenhum destino informado.</td></tr>'}</tbody>
      </table>
    </section>
  `;
};

const buildArmazenagemTable = (proposta: PropostaComercial) => {
  if (proposta.tipo !== 'armazenagem') return '';
  const tabela = proposta.tabelaArmazenagem;
  if (!tabela?.itens?.length) return '';
  const rows = tabela.itens.map((item) => `
    <tr>
      <td>${dash(item.rotulo)}</td>
      <td class="money">${dash(item.valor)}</td>
    </tr>
  `).join('');
  const horaRows = (tabela.horaExtra ?? []).map((item) => `
    <tr>
      <td>${dash(item.periodo)}</td>
      <td class="money">${dash(item.valor)}</td>
    </tr>
  `).join('');
  return `
    <section class="block">
      <h2>Armazém</h2>
      <p class="armaz-id"><strong>${escapeHtml(tabela.codigo || 'AG')}</strong> · ${escapeHtml(tabela.local || 'RONDONÓPOLIS-MT')}</p>
      <table class="tarifas">
        <thead>
          <tr>
            <th>Item</th>
            <th>${dash(tabela.unidade || 'MT')}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
    ${horaRows ? `
    <section class="block">
      <h2>${dash(tabela.horaExtraTitulo)}</h2>
      <table class="tarifas">
        <thead>
          <tr>
            <th>Período</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>${horaRows}</tbody>
      </table>
    </section>
    ` : ''}
    ${tabela.expediente?.trim() ? `
    <section class="block expediente">
      <span>Expediente do CD</span>
      <strong>${escapeHtml(tabela.expediente.trim())}</strong>
    </section>
    ` : ''}
  `;
};

const observacoesArmazenagem = (proposta: PropostaComercial): PropostaCondicaoComercial[] =>
  (proposta.condicoes || []).filter((item) => {
    if (item.tipo && item.tipo !== 'armazenagem') return false;
    return Boolean(item.rotulo.trim() || item.valor.trim());
  });

type ArmazHtmlOpcoes = {
  includeMeta: boolean;
  includeTabela: boolean;
  includeCondicoes: boolean;
  includeAssinatura: boolean;
  obsPagina?: PropostaCondicaoComercial[];
};

const buildArmazenagemObservacoes = (items: PropostaCondicaoComercial[]) => {
  if (!items.length) return '';
  const linhas = items.map((item) => {
    const rotulo = item.rotulo.trim();
    const valor = item.valor.trim();
    if (!rotulo) return escapeHtml(valor);
    if (!valor) return escapeHtml(rotulo);
    return `<span class="obs-mark">${escapeHtml(rotulo)}</span> ${escapeHtml(valor)}`;
  });
  return `
    <section class="block">
      <h2>Observações</h2>
      <ul class="obs-list">
        ${linhas.map((linha) => `<li>${linha}</li>`).join('')}
      </ul>
    </section>
  `;
};

const buildArmazenagemDocumentoHtml = (
  proposta: PropostaComercial,
  cliente: ClienteComercial | null | undefined,
  opcoes: ArmazHtmlOpcoes,
) => {
  const logoUrl = new URL(logoTranscamila, window.location.href).href;
  const clienteNome = cliente?.razaoSocial || proposta.clienteNome;
  const revisao = formatDateBr(proposta.dataProposta || proposta.dataCriacao);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Tarifas de Armazenagem</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #2d2d2d;
      font: 11px/1.4 "Segoe UI", Calibri, Arial, sans-serif;
    }
    body { padding: 10mm 10mm 12mm; }
    .brand {
      display: inline-block;
      margin: 0 0 10px;
    }
    .brand h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 400;
      color: #1179b9;
      line-height: 1.2;
    }
    .brand .company {
      margin: 4px 0 0;
      font-size: 12px;
      font-weight: 400;
      color: #333;
    }
    .brand-rule {
      display: block;
      height: 1px;
      margin-top: 6px;
      background: #2a3b66;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      column-gap: 18px;
      row-gap: 8px;
      margin: 0 0 12px;
    }
    .field span {
      display: block;
      font-size: 9.5px;
      color: #4a4a4a;
      margin-bottom: 2px;
    }
    .field strong {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #222;
      border-bottom: 1px solid #e6e6e6;
      padding-bottom: 5px;
    }
    .block { margin: 0 0 14px; }
    .armaz-id {
      margin: 0 0 8px;
      font-size: 12px;
      color: #333;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 12px;
      font-weight: 600;
      color: #1179b9;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .tarifas {
      width: 100%;
      border-collapse: collapse;
    }
    .tarifas th {
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      color: #1179b9;
      padding: 0 8px 8px 0;
      border-bottom: 1.5px solid #3a3a3a;
    }
    .tarifas th:last-child,
    .tarifas td.money {
      text-align: right;
    }
    .tarifas td {
      font-size: 11px;
      color: #333;
      padding: 7px 8px 7px 0;
      border-bottom: 1px solid #ececec;
    }
    .tarifas td.money {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      font-weight: 500;
    }
    .expediente span {
      display: block;
      font-size: 9.5px;
      color: #4a4a4a;
      margin-bottom: 2px;
    }
    .expediente strong {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #222;
      border-bottom: 1px solid #e6e6e6;
      padding-bottom: 5px;
    }
    .obs-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .obs-list li {
      font-size: 11px;
      color: #333;
      padding: 5px 0;
      border-bottom: 1px solid #f0f0f0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .obs-mark {
      color: #1179b9;
      font-weight: 600;
      margin-right: 6px;
    }
    .assinatura {
      margin-top: 12mm;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .sign-line {
      display: block;
      width: 62mm;
      height: 1px;
      background: #4a4a4a;
      margin-bottom: 6px;
    }
    .sign-name {
      margin: 0;
      font-size: 12px;
      color: #333;
    }
    .page-footer {
      margin-top: 10mm;
      height: 18mm;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
    }
    .logo-30 { height: 32px; width: auto; }
    .page-ornament { width: 52%; height: 16mm; max-width: 88mm; }
  </style>
</head>
<body>
  ${opcoes.includeMeta ? `
  <header class="brand">
    <h1>Proposta comercial — ${escapeHtml(PROPOSTA_COMERCIAL_TIPO_LABEL[proposta.tipo])}</h1>
    <p class="company">Transcamila Cargas E Armazéns Gerais Ltda.</p>
    <span class="brand-rule"></span>
  </header>
  <section class="meta">
    ${field('Número da proposta', dash(proposta.numeroIdentificacao))}
    ${field('Cliente', dash(clienteNome))}
    ${field('CNPJ', dash(cliente?.cnpj))}
    ${field('Serviço', dash(PROPOSTA_COMERCIAL_TIPO_LABEL[proposta.tipo]))}
    ${field('Emissão da proposta', revisao)}
    ${field('Validade da proposta', dash(proposta.validade))}
    ${field('Vigência do contrato', dash(proposta.vigencia))}
    ${field('Faturamento', dash(proposta.faturamento))}
    ${field('Status da proposta', dash(PROPOSTA_COMERCIAL_STATUS_LABEL[proposta.status]))}
  </section>
  ` : ''}
  ${opcoes.includeTabela ? buildArmazenagemTable(proposta) : ''}
  ${opcoes.includeCondicoes
    ? buildArmazenagemObservacoes(opcoes.obsPagina ?? observacoesArmazenagem(proposta))
    : ''}
  ${opcoes.includeAssinatura ? buildAssinaturaHtml(proposta, logoUrl) : ''}
</body>
</html>`;
};

const buildDistribuicaoTable = (tabela: TabelaFrete | null, faixasPagina?: TabelaFreteFaixa[]) => {
  const faixasTodas = tabela?.faixas ?? [];
  const faixas = faixasPagina ?? faixasTodas;
  const bandas = faixasTodas[0]?.tarifas ?? faixas[0]?.tarifas ?? [];
  const extras = faixasTodas[0]?.extras ?? faixas[0]?.extras ?? [];
  if (!tabela) {
    return `
      <section class="block">
        <h2>Distribuição</h2>
        <p>Nenhuma tabela de distribuição vinculada a este cliente.</p>
      </section>
    `;
  }
  const grisAdvUnificado = isGrisAdvUnificado(tabela.config);
  const grisAdvCols = grisAdvUnificado ? 1 : 2;
  const headBandas = bandas.map((banda) => `<th class="grp">${dash(banda.rotulo)}</th>`).join('');
  const unitBandas = bandas.map((banda) => (
    isTarifaVeiculo(banda)
      ? '<th class="unit unit-veiculo">R$ p/veículo</th>'
      : '<th class="unit">R$ p/ton</th>'
  )).join('');
  const moneyCols = 1 + bandas.length + 1 + extras.filter((item) => item.formato !== 'percentual').length;
  const pctCols = grisAdvCols + extras.filter((item) => item.formato === 'percentual').length;
  const colgroup = `
        <colgroup>
          <col class="col-km" />
          <col class="col-km" />
          ${Array.from({ length: moneyCols }, () => '<col class="col-money" />').join('')}
          ${Array.from({ length: pctCols }, () => '<col class="col-pct" />').join('')}
          <col class="col-prazo" />
          <col class="col-prazo" />
        </colgroup>`;
  const grisAdvHead = grisAdvUnificado
    ? '<th class="unit">GRIS/ADV</th>'
    : '<th class="unit">GRIS</th><th class="unit">ADV</th>';
  const rows = faixas.map((faixa) => `
    <tr>
      <td>${faixa.kmDe}</td>
      <td>${faixa.kmAte}</td>
      <td class="money">${formatTabelaMoneyPdf(faixa.freteMinimo)}</td>
      ${faixa.tarifas.map((tarifa) => `<td class="money">${formatTabelaMoneyPdf(tarifa.valor)}</td>`).join('')}
      <td class="money">${formatTabelaMoneyPdf(faixa.pedagioTon)}</td>
      ${grisAdvUnificado
        ? `<td>${formatTabelaPercentFator(faixa.grisPercent)}</td>`
        : `<td>${formatTabelaPercentFator(faixa.grisPercent)}</td><td>${formatTabelaPercentFator(faixa.advPercent)}</td>`}
      ${extras.map((coluna) => {
        const extra = (faixa.extras || []).find((item) => item.key === coluna.key) ?? coluna;
        const classe = extra.formato === 'percentual' ? '' : ' class="money"';
        return `<td${classe}>${formatColunaExtraValor(extra)}</td>`;
      }).join('')}
      <td>${faixa.prazoFracionado}</td>
      <td>${faixa.prazoFechado}</td>
    </tr>
  `).join('');
  return `
    <section class="block">
      <h2>Distribuição</h2>
      <table class="destinos faixas">
        ${colgroup}
        <thead>
          <tr>
            <th class="grp" colspan="2">Faixa km</th>
            <th class="grp" rowspan="2">Frete mínimo</th>
            ${headBandas}
            <th class="grp" colspan="${1 + grisAdvCols + extras.length}">Adicionais</th>
            <th class="grp" colspan="2">Prazo (dias úteis)</th>
          </tr>
          <tr>
            <th class="unit">De</th>
            <th class="unit">Até</th>
            ${unitBandas}
            <th class="unit">Pedágio p/ ton</th>
            ${grisAdvHead}
            ${extras.map((coluna) => `<th class="unit">${dash(coluna.rotulo)}</th>`).join('')}
            <th class="unit">Fracionado</th>
            <th class="unit">Fechado</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="${6 + grisAdvCols + bandas.length + extras.length}">Nenhuma faixa gerada.</td></tr>`}</tbody>
      </table>
    </section>
  `;
};

const chunk = <T,>(items: T[], size: number) => {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, size + index));
  }
  return groups;
};

type PrintSecao = 'geral' | 'transferencia' | 'distribuicao';

const condicoesDaSecao = (proposta: PropostaComercial, secao: PrintSecao): PropostaCondicaoComercial[] => {
  const todas = proposta.condicoes.length ? proposta.condicoes : CONDICOES_FRETE_PADRAO;
  const tipo = secao === 'distribuicao' ? 'distribuicao' : secao === 'transferencia' ? 'frete' : undefined;
  const tipadas = tipo ? todas.filter((item) => item.tipo === tipo) : [];
  if (tipadas.length) return tipadas;
  const semTipo = todas.filter((item) => !item.tipo);
  return semTipo.length ? semTipo : todas;
};

const buildCondicoesTable = (
  proposta: PropostaComercial,
  secao: PrintSecao,
  columns = 3,
  items?: PropostaCondicaoComercial[],
) => {
  const lista = items ?? condicoesDaSecao(proposta, secao);
  const colIdx = Array.from({ length: columns }, (_, index) => index);
  const rows = chunk(lista, columns).map((grupo) => `
    <tr>
      ${colIdx.map((index) => {
        const item = grupo[index];
        if (!item) return '<td class="condicao"></td>';
        return `<td class="condicao"><span>${dash(item.rotulo)}</span><strong>${dash(item.valor)}</strong></td>`;
      }).join('')}
    </tr>
  `).join('');
  return `
    <section class="block">
      <h2>Generalidades e condições</h2>
      <table class="condicoes">
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
};

type HtmlOpcoes = {
  includeMeta: boolean;
  includeTabela: boolean;
  includeCondicoes: boolean;
  includeAssinatura: boolean;
  faixasPagina?: TabelaFreteFaixa[];
  condicoesPagina?: PropostaCondicaoComercial[];
};

const secoesDaProposta = (proposta: PropostaComercial): PrintSecao[] => {
  if (proposta.tipo !== 'transporte_rodoviario') return ['geral'];
  const transferencia = proposta.incluiTransferencia;
  const distribuicao = proposta.incluiDistribuicao;
  if (transferencia && distribuicao) return ['transferencia', 'distribuicao'];
  if (distribuicao) return ['distribuicao'];
  return ['transferencia'];
};

const buildAssinaturaHtml = (proposta: PropostaComercial, logoUrl: string) => `
  <div class="assinatura">
    <span class="sign-line"></span>
    <p class="sign-name">${dash(proposta.responsavel)}</p>
  </div>
  <div class="page-footer">
    <img class="logo-30" src="${escapeHtml(logoUrl)}" alt="Transcamila Luft Logistics" />
    <svg class="page-ornament" viewBox="0 0 400 140" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
      <path d="M 6 128 H 338 Q 386 128 386 80 V 6" fill="none" stroke="#1179b9" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </div>
`;

const buildHtml = (
  proposta: PropostaComercial,
  cliente: ClienteComercial | null | undefined,
  secao: PrintSecao,
  tabela: TabelaFrete | null,
  opcoes: HtmlOpcoes,
) => {
  const logoUrl = new URL(logoTranscamila, window.location.href).href;
  const isPortrait = false;
  const tituloSecao = secao === 'distribuicao'
    ? 'Distribuição'
    : secao === 'transferencia'
      ? 'Transferência'
      : '';
  const closingHtml = `
  ${opcoes.includeCondicoes ? buildCondicoesTable(proposta, secao, 3, opcoes.condicoesPagina) : ''}
  ${opcoes.includeAssinatura && proposta.observacoes.trim()
    ? `<section class="block"><h2>Observações</h2><div class="obs">${escapeHtml(proposta.observacoes.trim())}</div></section>`
    : ''}
  ${opcoes.includeAssinatura ? buildAssinaturaHtml(proposta, logoUrl) : ''}
`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Proposta comercial</title>
  <style>
    @page { size: A4 ${isPortrait ? 'portrait' : 'landscape'}; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #2d2d2d;
      font: 11px/1.35 "Segoe UI", Calibri, Arial, sans-serif;
    }
    body { padding: 10mm 10mm 12mm 10mm; }
    .brand {
      display: inline-block;
      margin: 0 0 10px;
    }
    .brand h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 400;
      color: #1179b9;
      line-height: 1.2;
    }
    .brand .company {
      margin: 4px 0 0;
      font-size: 12px;
      font-weight: 400;
      color: #333;
    }
    .brand-rule {
      display: block;
      height: 1px;
      margin-top: 6px;
      background: #2a3b66;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      column-gap: 18px;
      row-gap: 8px;
      margin: 0 0 12px;
    }
    .field {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .field span {
      display: block;
      font-size: 9.5px;
      color: #4a4a4a;
      margin-bottom: 2px;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .field strong {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #222;
      line-height: 1.3;
      border-bottom: 1px solid #e6e6e6;
      padding-bottom: 5px;
    }
    .block { margin: 0 0 12px; }
    h2 {
      margin: 0 0 8px;
      font-size: 12px;
      font-weight: 600;
      color: #1179b9;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      break-after: avoid;
      page-break-after: avoid;
    }
    .destinos {
      width: 100%;
      border-collapse: collapse;
    }
    .destinos thead { display: table-header-group; }
    .destinos tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .destinos th {
      text-align: left;
      font-size: ${isPortrait ? '8.5px' : '10px'};
      font-weight: 600;
      color: #1179b9;
      padding: 0 6px 8px 0;
      border-bottom: 1.5px solid #3a3a3a;
    }
    .destinos td {
      text-align: left;
      font-size: ${isPortrait ? '8.5px' : '10.5px'};
      color: #333;
      padding: 5px 6px 5px 0;
      border-bottom: 1px solid #ececec;
    }
    .destinos.faixas {
      width: 100%;
      margin: 0;
      table-layout: fixed;
    }
    .destinos.faixas col.col-km { width: 3.3%; }
    .destinos.faixas col.col-pct { width: 4.4%; }
    .destinos.faixas col.col-prazo { width: 4.2%; }
    .destinos.faixas th,
    .destinos.faixas td {
      text-align: right;
      font-size: ${isPortrait ? '7.5px' : '9px'};
      padding: ${isPortrait ? '3px 2px' : '4px 4px'};
      line-height: 1.25;
      border-left: 1px solid #e6e6e6;
    }
    .destinos.faixas th:first-child,
    .destinos.faixas td:first-child {
      border-left: 0;
    }
    .destinos.faixas th {
      white-space: normal;
      font-size: ${isPortrait ? '6.5px' : '8px'};
      vertical-align: middle;
      text-align: center;
      padding: ${isPortrait ? '4px 2px' : '5px 3px'};
    }
    .destinos.faixas thead tr:first-child th.grp:not([rowspan]) {
      font-size: ${isPortrait ? '7px' : '8.5px'};
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      border-bottom: 1px solid #e6e6e6;
    }
    .destinos.faixas thead th[rowspan] {
      border-bottom: 1.5px solid #3a3a3a;
    }
    .destinos.faixas thead tr:last-child th {
      border-bottom: 1.5px solid #3a3a3a;
    }
    .destinos.faixas thead th.unit-veiculo {
      color: #c0392b;
      font-weight: 700;
    }
    .destinos.faixas td {
      white-space: nowrap;
    }
    .destinos.faixas td.money {
      font-size: ${isPortrait ? '7px' : '9px'};
      letter-spacing: ${isPortrait ? '-0.03em' : '0'};
      font-variant-numeric: tabular-nums;
    }
    .destinos.faixas tbody td:nth-child(1),
    .destinos.faixas tbody td:nth-child(2) {
      text-align: center;
    }
    .armazenagem {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 8px;
    }
    .armazenagem th,
    .armazenagem td {
      border: 1px solid #1f2937;
      padding: 6px 10px;
      font-size: 11px;
    }
    .armazenagem thead th {
      background: #1d4ed8;
      color: #fff;
      text-align: center;
      font-weight: 700;
      text-transform: uppercase;
    }
    .armazenagem td:first-child {
      text-align: left;
      font-weight: 600;
    }
    .armazenagem td.money {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .armazenagem-hora-title {
      margin: 10px 0 4px;
      font-size: 12px;
      font-weight: 700;
      color: #b91c1c;
    }
    .armazenagem-expediente {
      margin: 6px 0 0;
      font-size: 11px;
    }
    .condicoes {
      width: 100%;
      border-collapse: collapse;
    }
    .condicoes tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .condicao {
      width: 33.33%;
      padding: 5px 12px 5px 0;
      border-bottom: 1px solid #f0f0f0;
      vertical-align: top;
    }
    .condicao span {
      display: block;
      font-size: 10px;
      color: #4a4a4a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .condicao strong {
      display: block;
      font-size: 11px;
      font-weight: 500;
      color: #222;
    }
    .obs {
      white-space: pre-wrap;
      color: #333;
      font-size: 12px;
    }
    .assinatura {
      margin-top: 12mm;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .sign-line {
      display: block;
      width: 62mm;
      height: 1px;
      background: #4a4a4a;
      margin-bottom: 6px;
    }
    .sign-name {
      margin: 0;
      font-size: 12px;
      color: #333;
    }
    .page-footer {
      margin-top: 10mm;
      height: 18mm;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
    }
    .logo-30 {
      height: ${isPortrait ? '32px' : '40px'};
      width: auto;
      flex-shrink: 0;
    }
    .page-ornament {
      width: 52%;
      height: 16mm;
      max-width: ${isPortrait ? '88mm' : '160mm'};
    }
  </style>
</head>
<body>
  <header class="brand">
    <h1>Proposta comercial${tituloSecao ? ` — ${tituloSecao}` : ''}</h1>
    <p class="company">Transcamila Cargas E Armazéns Gerais Ltda.</p>
    <span class="brand-rule"></span>
  </header>
  ${opcoes.includeMeta ? `<section class="meta">
    ${field('Número da proposta', dash(proposta.numeroIdentificacao))}
    ${field('Cliente', dash(cliente?.razaoSocial || proposta.clienteNome))}
    ${field('CNPJ', dash(cliente?.cnpj))}
    ${field('Serviço', dash(PROPOSTA_COMERCIAL_TIPO_LABEL[proposta.tipo]))}
    ${field('Emissão da proposta', formatDateBr(proposta.dataProposta || proposta.dataCriacao))}
    ${field('Validade da proposta', dash(proposta.validade))}
    ${field('Vigência do contrato', dash(proposta.vigencia))}
    ${field('Faturamento', dash(proposta.faturamento))}
    ${field('Status da proposta', dash(PROPOSTA_COMERCIAL_STATUS_LABEL[proposta.status]))}
  </section>` : ''}
  ${opcoes.includeTabela && secao === 'distribuicao' ? buildDistribuicaoTable(tabela, opcoes.faixasPagina) : ''}
  ${opcoes.includeTabela && (secao === 'transferencia' || secao === 'geral') ? buildDestinosTable(proposta) : ''}
  ${opcoes.includeTabela && secao === 'geral' ? buildArmazenagemTable(proposta) : ''}
  ${closingHtml}
</body>
</html>`;
};

const waitImages = (doc: Document) => {
  const images = Array.from(doc.images);
  return Promise.all(images.map((image) => (
    image.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        })
  )));
};

type RunningFooter = { left: string; right: string };

const footerDaProposta = (
  proposta: PropostaComercial,
  _cliente?: ClienteComercial | null,
): RunningFooter => {
  const numero = (proposta.numeroIdentificacao || '').trim() || '—';
  return {
    left: 'COMERCIAL',
    right: `PROPOSTA - ${numero}`,
  };
};

const drawRunningFooter = (pdf: jsPDF, footer: RunningFooter, pageIndex: number, pageCount: number) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const y = pageHeight - 6;
  const maxSide = pageWidth / 2 - 18;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(74, 74, 74);
  pdf.text(footer.left, 10, y, { maxWidth: maxSide });
  pdf.text(`Página ${pageIndex} de ${pageCount}`, pageWidth / 2, y, { align: 'center' });
  pdf.text(footer.right, pageWidth - 10, y, { align: 'right', maxWidth: maxSide });
};

const applyRunningFooters = (pdf: jsPDF, footer: RunningFooter) => {
  const pageCount = pdf.getNumberOfPages();
  for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
    pdf.setPage(pageIndex);
    drawRunningFooter(pdf, footer, pageIndex, pageCount);
  }
};

const stampCanvas = (
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  orientation: 'portrait' | 'landscape',
  startWithNewPage = false,
  fitOnePage = false,
) => {
  if (startWithNewPage) {
    pdf.addPage('a4', orientation);
  }
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL('image/png');
  const overflowMm = 4;

  if (fitOnePage || imgHeight <= pageHeight + overflowMm) {
    const scale = imgHeight > pageHeight ? pageHeight / imgHeight : 1;
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth * scale, imgHeight * scale);
    return;
  }

  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;
  while (heightLeft > overflowMm) {
    position -= pageHeight;
    pdf.addPage('a4', orientation);
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
};

const pageMetrics = (_secao?: PrintSecao) => (
  { orientation: 'landscape' as const, widthPx: A4_LANDSCAPE_PX, heightPx: A4_LANDSCAPE_HEIGHT_PX }
);

const maiorQuantidadeQueCabe = async (
  caberNaFolha: (height: number) => boolean,
  montar: (quantidade: number, comAssinatura: boolean) => Promise<{ contentHeight: number }>,
  max: number,
  comAssinatura: boolean,
) => {
  let lo = 0;
  let hi = max;
  let melhor = 0;
  while (lo <= hi) {
    const meio = Math.ceil((lo + hi) / 2);
    const pagina = await montar(meio, comAssinatura);
    if (caberNaFolha(pagina.contentHeight)) {
      melhor = meio;
      lo = meio + 1;
    } else {
      hi = meio - 1;
    }
  }
  return melhor;
};

const captureHtml = async (html: string, pageWidthPx: number) => {
  const { iframe, frameDocument, contentHeight } = await renderHtmlFrame(html, pageWidthPx);
  try {
    const canvas = await html2canvas(frameDocument.body, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: pageWidthPx,
      windowWidth: pageWidthPx,
      height: contentHeight,
      windowHeight: contentHeight,
    });
    return { canvas, contentHeight };
  } finally {
    iframe.remove();
  }
};

const stampToPdf = (
  pdf: jsPDF | null,
  canvas: HTMLCanvasElement,
  page: { orientation: 'portrait' | 'landscape' },
  fitOnePage: boolean,
): jsPDF => {
  if (!pdf) {
    const created = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: page.orientation,
      compress: true,
    });
    stampCanvas(created, canvas, page.orientation, false, fitOnePage);
    return created;
  }
  stampCanvas(pdf, canvas, page.orientation, true, fitOnePage);
  return pdf;
};

const appendDistribuicaoPaginada = async (
  pdf: jsPDF | null,
  proposta: PropostaComercial,
  cliente: ClienteComercial | null | undefined,
  tabela: TabelaFrete,
  includeAssinatura: boolean,
): Promise<jsPDF> => {
  const page = pageMetrics('distribuicao');
  const todas = tabela.faixas ?? [];
  if (!todas.length) {
    return appendSecaoPdf(pdf, proposta, cliente, 'distribuicao', tabela, includeAssinatura, true);
  }

  const render = (opcoes: HtmlOpcoes) => (
    captureHtml(buildHtml(proposta, cliente, 'distribuicao', tabela, opcoes), page.widthPx)
  );

  const caberNaFolha = (height: number) => height <= page.heightPx + 12;

  const encaixarFaixas = async (
    restantes: TabelaFreteFaixa[],
    includeMeta: boolean,
    includeFechamento: boolean,
  ) => {
    let take = Math.min(includeMeta ? 20 : 26, restantes.length);
    let ultimo = await render({
      includeMeta,
      includeTabela: true,
      includeCondicoes: includeFechamento,
      includeAssinatura: includeFechamento && includeAssinatura,
      faixasPagina: restantes.slice(0, take),
    });
    while (!caberNaFolha(ultimo.contentHeight) && take > 1) {
      take -= 1;
      ultimo = await render({
        includeMeta,
        includeTabela: true,
        includeCondicoes: includeFechamento,
        includeAssinatura: includeFechamento && includeAssinatura,
        faixasPagina: restantes.slice(0, take),
      });
    }
    return { take, ...ultimo };
  };

  let offset = 0;
  let primeira = true;
  while (offset < todas.length) {
    const restantes = todas.slice(offset);
    const pagina = await encaixarFaixas(restantes, primeira, false);
    const ultimaTabela = offset + pagina.take >= todas.length;

    if (ultimaTabela) {
      const comFechamento = await render({
        includeMeta: primeira,
        includeTabela: true,
        includeCondicoes: true,
        includeAssinatura,
        faixasPagina: restantes.slice(0, pagina.take),
      });
      if (caberNaFolha(comFechamento.contentHeight)) {
        pdf = stampToPdf(pdf, comFechamento.canvas, page, true);
      } else {
        const lista = condicoesDaSecao(proposta, 'distribuicao');
        const cabem = await maiorQuantidadeQueCabe(
          caberNaFolha,
          (quantidade, comAssinatura) => render({
            includeMeta: primeira,
            includeTabela: true,
            includeCondicoes: quantidade > 0,
            includeAssinatura: comAssinatura && includeAssinatura,
            faixasPagina: restantes.slice(0, pagina.take),
            condicoesPagina: lista.slice(0, quantidade),
          }),
          lista.length,
          false,
        );
        const ultima = await render({
          includeMeta: primeira,
          includeTabela: true,
          includeCondicoes: cabem > 0,
          includeAssinatura: false,
          faixasPagina: restantes.slice(0, pagina.take),
          condicoesPagina: lista.slice(0, cabem),
        });
        pdf = stampToPdf(pdf, ultima.canvas, page, true);
        let resto = cabem;
        while (resto < lista.length) {
          const restantesCond = lista.slice(resto);
          const take = Math.max(1, await maiorQuantidadeQueCabe(
            caberNaFolha,
            (quantidade, comAssinatura) => render({
              includeMeta: false,
              includeTabela: false,
              includeCondicoes: quantidade > 0,
              includeAssinatura: comAssinatura && includeAssinatura,
              condicoesPagina: restantesCond.slice(0, quantidade),
            }),
            restantesCond.length,
            includeAssinatura && restantesCond.length > 0,
          ));
          const bloco = await render({
            includeMeta: false,
            includeTabela: false,
            includeCondicoes: true,
            includeAssinatura: includeAssinatura && take >= restantesCond.length,
            condicoesPagina: restantesCond.slice(0, take),
          });
          if (!caberNaFolha(bloco.contentHeight) && includeAssinatura && take >= restantesCond.length) {
            const soCondicoes = await render({
              includeMeta: false,
              includeTabela: false,
              includeCondicoes: true,
              includeAssinatura: false,
              condicoesPagina: restantesCond.slice(0, take),
            });
            pdf = stampToPdf(pdf, soCondicoes.canvas, page, true);
            resto += take;
            const fechamento = await render({
              includeMeta: false,
              includeTabela: false,
              includeCondicoes: false,
              includeAssinatura: true,
            });
            pdf = stampToPdf(pdf, fechamento.canvas, page, true);
            break;
          }
          pdf = stampToPdf(pdf, bloco.canvas, page, true);
          resto += take;
        }
        if (resto >= lista.length && includeAssinatura && cabem >= lista.length) {
          const fechamento = await render({
            includeMeta: false,
            includeTabela: false,
            includeCondicoes: false,
            includeAssinatura: true,
          });
          pdf = stampToPdf(pdf, fechamento.canvas, page, true);
        }
      }
    } else {
      pdf = stampToPdf(pdf, pagina.canvas, page, true);
    }

    offset += pagina.take;
    primeira = false;
  }
  return pdf!;
};

const appendSecaoPdf = async (
  pdf: jsPDF | null,
  proposta: PropostaComercial,
  cliente: ClienteComercial | null | undefined,
  secao: PrintSecao,
  tabela: TabelaFrete | null,
  includeAssinatura: boolean,
  skipDistribuicaoPager = false,
): Promise<jsPDF> => {
  if (secao === 'distribuicao' && tabela && !skipDistribuicaoPager) {
    return appendDistribuicaoPaginada(pdf, proposta, cliente, tabela, includeAssinatura);
  }

  const page = pageMetrics(secao);
  const caberNaFolha = (height: number) => height <= page.heightPx + 24;
  const render = (opcoes: HtmlOpcoes) => (
    captureHtml(buildHtml(proposta, cliente, secao, tabela, opcoes), page.widthPx)
  );

  const completo = await render({
    includeMeta: true,
    includeTabela: true,
    includeCondicoes: true,
    includeAssinatura,
  });
  if (caberNaFolha(completo.contentHeight)) {
    return stampToPdf(pdf, completo.canvas, page, true);
  }

  const lista = condicoesDaSecao(proposta, secao);
  const cabemNaPrimeira = await maiorQuantidadeQueCabe(
    caberNaFolha,
    (quantidade, comAssinatura) => render({
      includeMeta: true,
      includeTabela: true,
      includeCondicoes: quantidade > 0,
      includeAssinatura: comAssinatura && includeAssinatura,
      condicoesPagina: lista.slice(0, quantidade),
    }),
    lista.length,
    false,
  );
  const primeira = await render({
    includeMeta: true,
    includeTabela: true,
    includeCondicoes: cabemNaPrimeira > 0,
    includeAssinatura: false,
    condicoesPagina: lista.slice(0, cabemNaPrimeira),
  });
  pdf = stampToPdf(pdf, primeira.canvas, page, true);
  let offset = cabemNaPrimeira;

  if (offset >= lista.length) {
    if (!includeAssinatura) return pdf;
    const fechamento = await render({
      includeMeta: false,
      includeTabela: false,
      includeCondicoes: false,
      includeAssinatura: true,
    });
    return stampToPdf(pdf, fechamento.canvas, page, true);
  }

  while (offset < lista.length) {
    const restantes = lista.slice(offset);
    const montar = (quantidade: number, comAssinatura: boolean) => render({
      includeMeta: false,
      includeTabela: false,
      includeCondicoes: quantidade > 0,
      includeAssinatura: comAssinatura && includeAssinatura,
      condicoesPagina: restantes.slice(0, quantidade),
    });
    const take = Math.max(1, await maiorQuantidadeQueCabe(
      caberNaFolha,
      montar,
      restantes.length,
      false,
    ));
    const ultima = take >= restantes.length;
    let pagina = await montar(take, ultima && includeAssinatura);
    if (!caberNaFolha(pagina.contentHeight) && ultima && includeAssinatura) {
      pagina = await montar(take, false);
      pdf = stampToPdf(pdf, pagina.canvas, page, true);
      offset += take;
      const fechamento = await render({
        includeMeta: false,
        includeTabela: false,
        includeCondicoes: false,
        includeAssinatura: true,
      });
      pdf = stampToPdf(pdf, fechamento.canvas, page, true);
      break;
    }
    pdf = stampToPdf(pdf, pagina.canvas, page, true);
    offset += take;
  }

  return pdf;
};

const renderHtmlFrame = async (html: string, pageWidthPx: number) => {
  document.getElementById('proposta-print-frame')?.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'proposta-print-frame';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', 'PDF da proposta comercial');
  iframe.style.cssText = [
    'position:fixed',
    'left:-12000px',
    'top:0',
    `width:${pageWidthPx}px`,
    'height:200px',
    'border:0',
    'opacity:1',
    'pointer-events:none',
    'background:#fff',
  ].join(';');
  document.body.appendChild(iframe);

  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error('Não foi possível preparar o PDF da proposta.');
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();
  await waitImages(frameDocument);
  const contentHeight = Math.max(
    frameDocument.body.scrollHeight,
    frameDocument.documentElement.scrollHeight,
    1,
  );
  iframe.style.height = `${contentHeight}px`;
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 50);
  });
  return { iframe, frameDocument, contentHeight };
};

const loadTabelaDistribuicao = async (proposta: PropostaComercial, cliente?: ClienteComercial | null) => {
  if (!proposta.incluiDistribuicao) return null;
  const clienteId = cliente?.id || proposta.clienteId;
  if (!clienteId) return null;
  const list = await apiService.getTabelasFrete({
    page: 1,
    pageSize: 1,
    tipo: 'distribuicao',
    cliente: clienteId,
  });
  const tabelaId = list.results[0]?.id;
  if (!tabelaId) return null;
  return apiService.getTabelaFrete(tabelaId);
};

const generateArmazenagemPdfBlob = async (
  proposta: PropostaComercial,
  cliente?: ClienteComercial | null,
): Promise<Blob> => {
  const page = { orientation: 'portrait' as const };
  const caberNaFolha = (height: number) => height <= A4_PORTRAIT_HEIGHT_PX + 12;
  const render = (opcoes: ArmazHtmlOpcoes) => (
    captureHtml(buildArmazenagemDocumentoHtml(proposta, cliente, opcoes), A4_PORTRAIT_PX)
  );

  const completo = await render({
    includeMeta: true,
    includeTabela: true,
    includeCondicoes: true,
    includeAssinatura: true,
  });
  if (caberNaFolha(completo.contentHeight)) {
    return stampToPdf(null, completo.canvas, page, true).output('blob');
  }

  const obs = observacoesArmazenagem(proposta);
  const cabemNaPrimeira = await maiorQuantidadeQueCabe(
    caberNaFolha,
    (quantidade, comAssinatura) => render({
      includeMeta: true,
      includeTabela: true,
      includeCondicoes: quantidade > 0,
      includeAssinatura: comAssinatura,
      obsPagina: obs.slice(0, quantidade),
    }),
    obs.length,
    false,
  );
  const primeira = await render({
    includeMeta: true,
    includeTabela: true,
    includeCondicoes: cabemNaPrimeira > 0,
    includeAssinatura: false,
    obsPagina: obs.slice(0, cabemNaPrimeira),
  });
  let pdf = stampToPdf(null, primeira.canvas, page, true);
  let offset = cabemNaPrimeira;

  if (offset >= obs.length) {
    const fechamento = await render({
      includeMeta: false,
      includeTabela: false,
      includeCondicoes: false,
      includeAssinatura: true,
    });
    return stampToPdf(pdf, fechamento.canvas, page, true).output('blob');
  }

  while (offset < obs.length) {
    const restantes = obs.slice(offset);
    let take = restantes.length;
    const montar = (quantidade: number, comAssinatura: boolean) => render({
      includeMeta: false,
      includeTabela: false,
      includeCondicoes: true,
      includeAssinatura: comAssinatura,
      obsPagina: restantes.slice(0, quantidade),
    });

    let pagina = await montar(take, take >= restantes.length);
    while (!caberNaFolha(pagina.contentHeight) && take > 1) {
      take -= 1;
      pagina = await montar(take, take >= restantes.length);
    }

    if (!caberNaFolha(pagina.contentHeight) && take >= restantes.length) {
      pagina = await montar(take, false);
      while (!caberNaFolha(pagina.contentHeight) && take > 1) {
        take -= 1;
        pagina = await montar(take, false);
      }
      pdf = stampToPdf(pdf, pagina.canvas, page, true);
      offset += take;
      if (offset >= obs.length) {
        const fechamento = await render({
          includeMeta: false,
          includeTabela: false,
          includeCondicoes: false,
          includeAssinatura: true,
        });
        pdf = stampToPdf(pdf, fechamento.canvas, page, true);
      }
      continue;
    }

    pdf = stampToPdf(pdf, pagina.canvas, page, true);
    offset += take;
  }

  return pdf.output('blob');
};

export async function generatePropostaComercialPdfBlob(
  proposta: PropostaComercial,
  cliente?: ClienteComercial | null,
): Promise<Blob> {
  if (proposta.tipo === 'armazenagem') {
    return generateArmazenagemPdfBlob(proposta, cliente);
  }
  const secoes = secoesDaProposta(proposta);
  const tabela = secoes.includes('distribuicao')
    ? await loadTabelaDistribuicao(proposta, cliente)
    : null;
  const ultima = secoes[secoes.length - 1];
  let pdf: jsPDF | null = null;

  for (const secao of secoes) {
    pdf = await appendSecaoPdf(
      pdf,
      proposta,
      cliente,
      secao,
      tabela,
      secao === ultima,
    );
  }

  applyRunningFooters(pdf!, footerDaProposta(proposta, cliente));
  return pdf!.output('blob');
}

export async function printPropostaComercial(
  proposta: PropostaComercial,
  cliente?: ClienteComercial | null,
) {
  try {
    const blob = await generatePropostaComercialPdfBlob(proposta, cliente);
    const url = URL.createObjectURL(blob);
    document.getElementById('proposta-pdf-print-frame')?.remove();
    const iframe = document.createElement('iframe');
    iframe.id = 'proposta-pdf-print-frame';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('title', 'Impressão da proposta comercial');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.addEventListener('load', () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => {
        iframe.remove();
        URL.revokeObjectURL(url);
      }, 60_000);
    });
  } catch {
    window.alert('Não foi possível gerar o PDF da proposta.');
  }
}
