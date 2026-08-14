import axios from 'axios';
import type {
  User, Role, SystemLog, PagarRow, ReceberRow, AgingRow, ReportBatch,
  BillingRecord, CashAdjustment, BankAccount, BalanceHistoryEntry,
  MetaFaturamentoConfigPayload, MetaFaturamentoConfigResponse,
  CalendarSystemEventsResponse, CalendarPersonalEvent,
  IndicadorKpi, IndicadorFilialRow,
  CashflowQueryParams, CashflowResponse, CashflowDayDetailParams, CashflowDayDetailResponse,
  RHIndicadorQueryParams, RHIndicadorResponse, RHIndicadorCategoriaBucket, RHIndicadorPorCategoria,
  MetaFaturamentoQueryParams, MetaFaturamentoResponse,
  SgqSatisfacaoIndicadorQueryParams, SgqSatisfacaoIndicadorResponse,
  SendGerencialEmailParams, SendGerencialEmailResponse,
  ReportImportResult, ReportImportType,
  PaginatedResponse, ReportQueryParams, ReportFacets,
  BillingQueryParams, AdjustmentQueryParams, BalanceHistoryQueryParams,
  ReportBatchesResponse,
  PrAnalysisResponse,
  PagarDiffQueryParams,
  PagarDiffResponse,
  GoogleContactsResponse,
  AuditLogQueryParams,
  AuditLogFacets,
  UserQueryParams,
  Colaborador, LoteMovimentacaoRH, MovimentacaoColaborador, InconsistenciaColaborador, CargoMapping, ColaboradorPJ, ColaboradorPJHistorico, RHDashboardSummaryResponse, RHComparisonResponse, RHMovimentacaoOrdering,
  UnidadeMedida, Setor, ColaboradorCompras, Fornecedor, ItemEstoque, EntradaEstoque, SaidaEstoque,
  RegistrarCompraPayload, RegistrarSaidaPayload,
  ClienteProtocolo, ProtocoloEnvio, ProtocoloEnvioDraft,
  ProtocoloQueryParams, CreateProtocoloPayload, UpdateProtocoloPayload, ClienteProtocoloPayload,
  ProtocoloImportParams, ProtocoloImportResult,
  SgqPesquisa, SgqPesquisaImportPreview, SgqPesquisaImportResult, SgqPesquisaPayload, SgqPesquisaQueryParams, SgqPesquisaStats,
  CampanhaMarketing, CampanhaPayload, CampanhaQuadro, CampanhaComentario, CampanhaMembro, CampanhaMidia,
  GoogleDriveStatus, GoogleDriveBrowseResponse,
  UserDirectoryEntry,
  SgqLoteDraft, SgqLoteDraftRow,
} from '../types/domain';
import { filterActiveEnvironments, ACTIVE_ENVIRONMENTS } from '../constants/environments';

const activeEnvSet = new Set<string>(ACTIVE_ENVIRONMENTS);

// Vite proxies /api → http://localhost:8001 in dev (see vite.config.ts)
const api = axios.create();

const TOKEN_KEY = 'prothon_token';
const ENV_KEY = 'prothon_env';
const FILIAL_KEY = 'prothon_filial';

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const env = localStorage.getItem(ENV_KEY);
  const filial = localStorage.getItem(FILIAL_KEY);
  if (env && !config.headers['X-Prothon-Environment']) {
    config.headers['X-Prothon-Environment'] = encodeURIComponent(env);
  }
  // Percent-encode: proxies (Azure) podem corromper UTF-8 em headers (ex.: Ibiporã, Logística).
  if (filial && !config.headers['X-Prothon-Filial']) {
    config.headers['X-Prothon-Filial'] = encodeURIComponent(filial);
  }

  return config;
});

// Normalize backend user: int id → string, already has lastLogin from serializer
function normalizeUser(raw: any): User {
  return {
    id: String(raw.id),
    username: raw.username,
    name: raw.name,
    roleId: raw.roleId,
    status: raw.status,
    lastLogin: raw.lastLogin ?? null,
    environments: filterActiveEnvironments(raw.environments),
    filiais: Object.fromEntries(
      Object.entries(raw.filiais ?? {}).filter(([module]) => activeEnvSet.has(module)),
    ) as Record<string, string[]>,
    indicadores: Array.isArray(raw.indicadores) ? raw.indicadores : [],
    funcoes: raw.funcoes && typeof raw.funcoes === 'object' ? raw.funcoes : {},
    googleEmail: raw.googleEmail ?? null,
    googleLinkedAt: raw.googleLinkedAt ?? null,
    googlePicture: raw.googlePicture ?? null,
    mustChangePassword: Boolean(raw.mustChangePassword),
  };
}

function normalizeReportBatch(raw: any): ReportBatch {
  return {
    id: String(raw.id),
    label: raw.label,
    date: raw.date,
    updatedBy: raw.updatedBy,
    importedReports: raw.importedReports,
    isActive: Boolean(raw.isActive ?? raw.is_active),
  };
}

function parseReportAmount(raw: unknown): number | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  const text = String(raw).trim();
  if (!text) return undefined;
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizePagarRow(raw: any): PagarRow {
  return {
    id: raw.id != null ? String(raw.id) : undefined,
    filial: raw.filial,
    codForn: raw.codForn,
    fornecedor: raw.fornecedor,
    titulo: raw.titulo,
    tipo: raw.tipo,
    emissao: raw.emissao,
    vencimento: raw.vencimento,
    vencimentoReal: raw.vencimentoReal,
    valor: parseReportAmount(raw.valor) ?? 0,
    saldo: parseReportAmount(raw.saldo) ?? 0,
    historico: raw.historico ?? '',
  };
}

function normalizeReceberRow(raw: any): ReceberRow {
  return {
    id: raw.id != null ? String(raw.id) : undefined,
    filial: raw.filial,
    codCliente: raw.codCliente,
    cliente: raw.cliente,
    titulo: raw.titulo,
    natureza: raw.natureza,
    emissao: raw.emissao,
    vencimento: raw.vencimento,
    vencimentoReal: raw.vencimentoReal,
    valor: parseReportAmount(raw.valor) ?? 0,
    saldo: parseReportAmount(raw.saldo) ?? 0,
    historico: raw.historico ?? '',
  };
}

function normalizeAgingRow(raw: any): AgingRow {
  return {
    id: raw.id != null ? String(raw.id) : undefined,
    origem: raw.origem,
    codCliente: raw.codCliente,
    cliente: raw.cliente,
    loja: raw.loja,
    docto: raw.docto,
    serie: raw.serie,
    tipo: raw.tipo,
    emissao: raw.emissao,
    vencimento: raw.vencimento,
    regiao: raw.regiao,
    total: parseReportAmount(raw.total) ?? 0,
  };
}

function normalizeBillingRecord(raw: any): BillingRecord {
  return {
    id: Number(raw.id),
    date: raw.date,
    branch: raw.branch,
    value: Number(raw.value),
    notesCount: Number(raw.notesCount ?? raw.notes_count ?? 0),
    trend: raw.trend ?? 'none',
  };
}

function normalizeClienteProtocolo(raw: any): ClienteProtocolo {
  return {
    id: String(raw.id),
    nome: raw.nome,
    cnpj: raw.cnpj ?? null,
    requerExpedicao: Boolean(raw.requerExpedicao ?? raw.requer_expedicao),
    exigeFilial: Boolean(raw.exigeFilial ?? raw.exige_filial),
    filiais: Array.isArray(raw.filiais) ? raw.filiais.map((f: any) => ({ id: String(f.id), nome: f.nome })) : [],
    emailsEnvio: raw.emailsEnvio ?? raw.emails_envio ?? null,
    emailsCopia: raw.emailsCopia ?? raw.emails_copia ?? null,
    dataCriacao: raw.dataCriacao ?? raw.data_criacao,
  };
}

function normalizeProtocoloEnvio(raw: any): ProtocoloEnvio {
  return {
    id: String(raw.id),
    protocoloNumero: raw.protocoloNumero ?? raw.protocolo_numero ?? '',
    data: raw.data,
    clienteId: raw.clienteIdReadOnly != null ? String(raw.clienteIdReadOnly) : (raw.clienteId != null ? String(raw.clienteId) : undefined),
    clienteNome: raw.clienteNome ?? raw.cliente_nome ?? '',
    clienteCnpj: raw.clienteCnpj ?? raw.cliente_cnpj ?? null,
    notaFiscal: raw.notaFiscal ?? raw.nota_fiscal ?? '',
    notasFiscais: raw.notasFiscais ?? raw.notas_fiscais ?? [],
    notasFiliais: raw.notasFiliais ?? raw.notas_filiais ?? {},
    expedicao: raw.expedicao ?? null,
    expedicoes: Array.isArray(raw.expedicoes) ? raw.expedicoes : [],
    usuarioNome: raw.usuarioNome ?? raw.usuario_nome ?? '',
    dataCriacao: raw.dataCriacao ?? raw.data_criacao,
    dataAtualizacao: raw.dataAtualizacao ?? raw.data_atualizacao,
  };
}

async function readBlobErrorMessage(
  blob: Blob,
  fallback = 'Não foi possível concluir a operação.',
): Promise<string> {
  try {
    const text = await blob.text();
    try {
      const json = JSON.parse(text) as { detail?: string; error?: string };
      if (typeof json.detail === 'string' && json.detail) return json.detail;
      if (typeof json.error === 'string' && json.error) return json.error;
    } catch {
      if (text.trim()) return text.trim().slice(0, 240);
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Garante que a resposta blob é PDF; se for JSON de erro, propaga a mensagem. */
async function assertPdfBlob(data: Blob, headers?: Record<string, unknown>): Promise<Blob> {
  const contentType = String(
    (headers?.['content-type'] as string | undefined)
      ?? (headers?.['Content-Type'] as string | undefined)
      ?? data.type
      ?? '',
  ).toLowerCase();

  if (contentType.includes('application/json') || contentType.includes('text/html') || data.size < 5) {
    throw new Error(await readBlobErrorMessage(data, 'Não foi possível gerar o PDF do protocolo.'));
  }

  const head = await data.slice(0, 4).text();
  if (head !== '%PDF') {
    throw new Error(await readBlobErrorMessage(data, 'Não foi possível gerar o PDF do protocolo.'));
  }

  return data.type === 'application/pdf' ? data : new Blob([data], { type: 'application/pdf' });
}

/** Garante que a resposta blob é planilha .xlsx (ZIP/PK); se for JSON de erro, propaga a mensagem. */
async function assertSpreadsheetBlob(data: Blob, headers?: Record<string, unknown>): Promise<Blob> {
  const contentType = String(
    (headers?.['content-type'] as string | undefined)
      ?? (headers?.['Content-Type'] as string | undefined)
      ?? data.type
      ?? '',
  ).toLowerCase();
  const fallback = 'Não foi possível baixar a planilha de referência.';

  if (contentType.includes('application/json') || contentType.includes('text/html') || data.size < 4) {
    throw new Error(await readBlobErrorMessage(data, fallback));
  }

  const headBytes = new Uint8Array(await data.slice(0, 2).arrayBuffer());
  // .xlsx é um ZIP: assinatura PK
  if (headBytes[0] !== 0x50 || headBytes[1] !== 0x4b) {
    throw new Error(await readBlobErrorMessage(data, fallback));
  }

  const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return data.type === mime ? data : new Blob([data], { type: mime });
}

function normalizeCashAdjustment(raw: any): CashAdjustment {
  return {
    id: Number(raw.id),
    date: raw.date,
    type: raw.type,
    value: Number(raw.value),
    observation: raw.observation ?? '',
    user: raw.user ?? '',
  };
}

function normalizeBankAccount(raw: any): BankAccount {
  return {
    id: Number(raw.id),
    bank: raw.bank,
    agency: raw.agency,
    number: raw.number,
    type: raw.type,
    balance: Number(raw.balance),
    creditLimit: Number(raw.creditLimit ?? raw.credit_limit ?? 0),
    lastUpdated: raw.lastUpdated ?? raw.last_updated ?? '',
  };
}

function normalizeBalanceHistoryEntry(raw: any): BalanceHistoryEntry {
  return {
    id: Number(raw.id),
    accountId: Number(raw.accountId ?? raw.account_id ?? raw.account),
    date: raw.date,
    bank: raw.bank,
    number: raw.number,
    type: raw.type,
    value: Number(raw.value),
  };
}

function normalizeIndicadorKpi(raw: any): IndicadorKpi {
  return {
    label: raw.label,
    value: raw.value,
    change: raw.change,
    up: Boolean(raw.up),
  };
}

function normalizeIndicadorFilial(raw: any): IndicadorFilialRow {
  return {
    filial: raw.filial,
    receita: raw.receita,
    fretes: Number(raw.fretes),
    toneladas: raw.toneladas,
    meta: raw.meta,
  };
}

function normalizeCashflowDayDetail(raw: any): CashflowDayDetailResponse {
  return {
    date: raw.date ?? '',
    dateIso: raw.dateIso ?? '',
    summary: {
      saldoAnterior: Number(raw.summary?.saldoAnterior ?? 0),
      entradas: Number(raw.summary?.entradas ?? 0),
      saidas: Number(raw.summary?.saidas ?? 0),
      ajustes: Number(raw.summary?.ajustes ?? 0),
      saldoPrevisto: Number(raw.summary?.saldoPrevisto ?? 0),
    },
    pagar: (raw.pagar ?? []).map((row: any) => ({
      filial: row.filial,
      fornecedor: row.fornecedor,
      titulo: row.titulo,
      tipo: row.tipo,
      saldo: Number(row.saldo ?? 0),
      historico: row.historico ?? '',
    })),
    receber: (raw.receber ?? []).map((row: any) => ({
      filial: row.filial,
      cliente: row.cliente,
      titulo: row.titulo,
      natureza: row.natureza,
      saldo: Number(row.saldo ?? 0),
      historico: row.historico ?? '',
    })),
  };
}

function buildCashflowDayDetailParams(params: CashflowDayDetailParams) {
  const query: Record<string, string> = { date: params.date };
  if (params.position) query.position = params.position;
  if (params.filial && params.filial !== 'Todas') query.filial = params.filial;
  if (params.accounts !== undefined) query.accounts = params.accounts;
  if (params.includeLimit === false) query.includeLimit = 'false';
  return query;
}

function normalizeCashflowResponse(raw: any): CashflowResponse {
  return {
    meta: {
      updatedAt: raw.meta?.updatedAt ?? '',
      updatedBy: raw.meta?.updatedBy ?? '',
      batchLabel: raw.meta?.batchLabel ?? '—',
      batchReferenceDate: raw.meta?.batchReferenceDate ?? '',
      positionId: raw.meta?.positionId ?? undefined,
      periodStart: raw.meta?.periodStart ?? '',
      periodEnd: raw.meta?.periodEnd ?? '',
      minPeriodDate: raw.meta?.minPeriodDate ?? undefined,
      minGerencialDate: raw.meta?.minGerencialDate ?? undefined,
      defaultPeriodStart: raw.meta?.defaultPeriodStart ?? undefined,
      defaultPeriodEnd: raw.meta?.defaultPeriodEnd ?? undefined,
    },
    summary: {
      saldoPrevisto: Number(raw.summary?.saldoPrevisto ?? 0),
      entradas: Number(raw.summary?.entradas ?? 0),
      saidas: Number(raw.summary?.saidas ?? 0),
      ajustes: Number(raw.summary?.ajustes ?? 0),
      caixaPositivoAte: raw.summary?.caixaPositivoAte ?? '',
    },
    daily: (raw.daily ?? []).map((point: any) => ({
      date: point.date,
      dateIso: point.dateIso,
      saldoInicial: Number(point.saldoInicial ?? 0),
      entradas: Number(point.entradas ?? 0),
      saidas: Number(point.saidas ?? 0),
      ajustes: Number(point.ajustes ?? 0),
      saldoProjetado: Number(point.saldoProjetado ?? 0),
    })),
    managerial: (raw.managerial ?? []).map((row: any) => ({
      filial: row.filial,
      entradas: Number(row.entradas ?? 0),
      saidas: Number(row.saidas ?? 0),
      saldo: Number(row.saldo ?? 0),
    })),
    gerencial: {
      referenceDate: raw.gerencial?.referenceDate ?? '',
      groups: (raw.gerencial?.groups ?? []).map((group: any) => ({
        title: group.title ?? '',
        items: (group.items ?? []).map((item: any) => ({
          label: item.label ?? '',
          value: Number(item.value ?? 0),
        })),
      })),
      highlights: (raw.gerencial?.highlights ?? []).map((item: any) => ({
        title: item.title ?? '',
        value: Number(item.value ?? 0),
        subtitle: item.subtitle ?? '',
        variant: item.variant ?? 'neutral',
      })),
      schedule: (raw.gerencial?.schedule ?? []).map((bucket: any) => ({
        label: bucket.label ?? '',
        value: Number(bucket.value ?? 0),
      })),
      scheduleTotal: Number(raw.gerencial?.scheduleTotal ?? 0),
      aging: {
        buckets: raw.gerencial?.aging?.buckets ?? [],
        rows: (raw.gerencial?.aging?.rows ?? []).map((row: any) => ({
          category: row.category ?? '',
          variant: row.variant === 'atraso' ? 'atraso' : 'receber',
          buckets: (row.buckets ?? []).map((v: unknown) => Number(v ?? 0)),
          total: Number(row.total ?? 0),
        })),
      },
    },
    facets: {
      filiais: raw.facets?.filiais ?? [],
      positions: (raw.facets?.positions ?? []).map((item: any) => ({
        id: String(item.id ?? ''),
        code: item.code ?? item.label ?? '',
        referenceDate: item.referenceDate ?? '',
        referenceDateIso: item.referenceDateIso ?? '',
      })),
      bankAccounts: (raw.facets?.bankAccounts ?? []).map((item: any) => ({
        id: Number(item.id ?? 0),
        bank: item.bank ?? '',
        agency: item.agency ?? '',
        number: item.number ?? '',
        type: item.type ?? '',
        balance: Number(item.balance ?? 0),
        creditLimit: Number(item.creditLimit ?? 0),
        label: item.label ?? `${item.bank ?? ''} (CC: ${item.number ?? ''})`,
      })),
    },
  };
}

function normalizeRHIndicadorStatusBucket(raw: any) {
  return {
    count: Number(raw?.count ?? 0),
    payroll: Number(raw?.payroll ?? 0),
  };
}

function normalizeRHIndicadorCategoriaBucket(raw: any): RHIndicadorCategoriaBucket {
  return {
    count: Number(raw?.count ?? 0),
    payroll: Number(raw?.payroll ?? 0),
    percentual: Number(raw?.percentual ?? 0),
    ativos: normalizeRHIndicadorStatusBucket(raw?.ativos),
    afastados: normalizeRHIndicadorStatusBucket(raw?.afastados),
    ferias: normalizeRHIndicadorStatusBucket(raw?.ferias),
  };
}

function normalizeRHIndicadorPorCategoria(raw: any): RHIndicadorPorCategoria {
  return {
    administrativo: normalizeRHIndicadorCategoriaBucket(raw?.administrativo),
    operacional: normalizeRHIndicadorCategoriaBucket(raw?.operacional),
    motorista: normalizeRHIndicadorCategoriaBucket(raw?.motorista),
    naoMapeado: normalizeRHIndicadorCategoriaBucket(raw?.naoMapeado),
  };
}

function normalizeRHIndicadorResponse(raw: any): RHIndicadorResponse {
  return {
    meta: {
      filiaisDisponiveis: raw?.meta?.filiaisDisponiveis ?? [],
      lotesDisponiveis: (raw?.meta?.lotesDisponiveis ?? []).map((lote: any) => ({
        mes: Number(lote?.mes ?? 0),
        ano: Number(lote?.ano ?? 0),
        label: lote?.label ?? '',
      })),
      periodoInicio: raw?.meta?.periodoInicio ?? null,
      periodoFim: raw?.meta?.periodoFim ?? null,
    },
    summary: {
      totalColaboradores: Number(raw?.summary?.totalColaboradores ?? 0),
      payrollTotal: Number(raw?.summary?.payrollTotal ?? 0),
      salarioMedio: Number(raw?.summary?.salarioMedio ?? 0),
      feriasAtual: Number(raw?.summary?.feriasAtual ?? 0),
      admitidosPeriodo: Number(raw?.summary?.admitidosPeriodo ?? 0),
      desligadosPeriodo: Number(raw?.summary?.desligadosPeriodo ?? 0),
      turnoverPercentual: Number(raw?.summary?.turnoverPercentual ?? 0),
      variacaoHeadcountPercentual: raw?.summary?.variacaoHeadcountPercentual != null
        ? Number(raw.summary.variacaoHeadcountPercentual)
        : null,
      variacaoPayrollPercentual: raw?.summary?.variacaoPayrollPercentual != null
        ? Number(raw.summary.variacaoPayrollPercentual)
        : null,
      porCategoriaAtual: normalizeRHIndicadorPorCategoria(raw?.summary?.porCategoriaAtual),
    },
    series: (raw?.series ?? []).map((ponto: any) => ({
      mes: Number(ponto?.mes ?? 0),
      ano: Number(ponto?.ano ?? 0),
      label: ponto?.label ?? '',
      headcount: Number(ponto?.headcount ?? 0),
      payroll: Number(ponto?.payroll ?? 0),
      admitidos: Number(ponto?.admitidos ?? 0),
      desligados: Number(ponto?.desligados ?? 0),
      porCategoria: normalizeRHIndicadorPorCategoria(ponto?.porCategoria),
    })),
  };
}

function buildRHIndicadorQueryParams(params: RHIndicadorQueryParams = {}) {
  const query: Record<string, string> = {};
  if (params.start) query.start = params.start;
  if (params.end) query.end = params.end;
  if (params.filial && params.filial !== 'Todas') query.filial = params.filial;
  if (params.categoria && params.categoria !== 'Todas') query.categoria = params.categoria;
  if (params.situacaoGrupo) query.situacaoGrupo = params.situacaoGrupo;
  return query;
}

function buildSgqSatisfacaoIndicadorQueryParams(params: SgqSatisfacaoIndicadorQueryParams = {}) {
  const query: Record<string, string> = {};
  if (params.filial) query.filial = params.filial;
  if (params.motorista) query.motorista = params.motorista;
  if (params.dataInicio) query.dataInicio = params.dataInicio;
  if (params.dataFim) query.dataFim = params.dataFim;
  if (params.cliente) query.cliente = params.cliente;
  if (params.avaliacao) query.avaliacao = params.avaliacao;
  return query;
}

function buildCashflowQueryParams(params: CashflowQueryParams = {}) {
  const query: Record<string, string> = {};
  if (params.position) query.position = params.position;
  if (params.start) query.start = params.start;
  if (params.end) query.end = params.end;
  if (params.filial && params.filial !== 'Todas') query.filial = params.filial;
  if (params.gerencialDate) query.gerencialDate = params.gerencialDate;
  if (params.accounts !== undefined) query.accounts = params.accounts;
  if (params.includeLimit === false) query.includeLimit = 'false';
  return query;
}

function listFromResponse<T>(data: unknown, normalizer: (raw: any) => T): T[] {
  const list = Array.isArray(data) ? data : ((data as { results?: unknown[] })?.results ?? []);
  return list.map(normalizer);
}

function buildReportQueryParams(params: ReportQueryParams = {}) {
  const query: Record<string, string | number> = {};
  if (params.page) query.page = params.page;
  if (params.pageSize) query.page_size = params.pageSize;
  if (params.search) query.search = params.search;
  if (params.filial) query.filial = params.filial;
  if (params.party) query.party = params.party;
  if (params.tipo) query.tipo = params.tipo;
  return query;
}

function buildBillingQueryParams(params: BillingQueryParams = {}) {
  const query: Record<string, string | number | boolean> = {};
  if (params.page) query.page = params.page;
  if (params.pageSize) query.page_size = params.pageSize;
  if (params.search) query.search = params.search;
  if (params.branch) query.branch = params.branch;
  if (params.startDate) query.start_date = params.startDate;
  if (params.endDate) query.end_date = params.endDate;
  if (params.export) query.export = true;
  return query;
}

function buildAdjustmentQueryParams(params: AdjustmentQueryParams = {}) {
  const query: Record<string, string | number> = {};
  if (params.page) query.page = params.page;
  if (params.pageSize) query.page_size = params.pageSize;
  if (params.search) query.search = params.search;
  if (params.date) query.date = params.date;
  if (params.type) query.type = params.type;
  return query;
}

function buildUserQueryParams(params: UserQueryParams = {}) {
  const query: Record<string, string | number> = {};
  if (params.page) query.page = params.page;
  if (params.pageSize) query.page_size = params.pageSize;
  if (params.search) query.search = params.search;
  if (params.roleId) query.roleId = params.roleId;
  if (params.status) query.status = params.status;
  return query;
}

function buildAuditLogQueryParams(params: AuditLogQueryParams = {}) {
  const query: Record<string, string | number> = {};
  if (params.page) query.page = params.page;
  if (params.pageSize) query.page_size = params.pageSize;
  if (params.search) query.search = params.search;
  if (params.action) query.action = params.action;
  if (params.dateFrom) query.dateFrom = params.dateFrom;
  if (params.dateTo) query.dateTo = params.dateTo;
  return query;
}

function buildBalanceHistoryQueryParams(params: BalanceHistoryQueryParams = {}) {
  const query: Record<string, string | number> = {};
  if (params.page) query.page = params.page;
  if (params.pageSize) query.page_size = params.pageSize;
  if (params.search) query.search = params.search;
  if (params.bank) query.bank = params.bank;
  if (params.type) query.type = params.type;
  if (params.accountId) query.account_id = params.accountId;
  return query;
}

function buildProtocoloQueryParams(params: ProtocoloQueryParams = {}) {
  const query: Record<string, string | number> = {};
  if (params.page) query.page = params.page;
  if (params.pageSize) query.page_size = params.pageSize;
  if (params.cliente) query.cliente = params.cliente;
  if (params.data) query.data = params.data;
  if (params.protocoloId) query.protocoloId = params.protocoloId;
  if (params.notaFiscal) query.notaFiscal = params.notaFiscal;
  if (params.usuario) query.usuario = params.usuario;
  if (params.ordering) query.ordering = params.ordering;
  return query;
}

function buildSgqPesquisaQueryParams(params: SgqPesquisaQueryParams = {}) {
  const query: Record<string, string | number> = {};
  if (params.page) query.page = params.page;
  if (params.pageSize) query.page_size = params.pageSize;
  if (params.search) query.search = params.search;
  if (params.cliente) query.cliente = params.cliente;
  if (params.motorista) query.motorista = params.motorista;
  if (params.criadoPor) query.criadoPor = params.criadoPor;
  if (params.avaliacao) query.avaliacao = params.avaliacao;
  if (params.dataInicio) query.dataInicio = params.dataInicio;
  if (params.dataFim) query.dataFim = params.dataFim;
  if (params.ordering) query.ordering = params.ordering;
  return query;
}

function paginatedFromResponse<T>(data: unknown, normalizer: (raw: any) => T): PaginatedResponse<T> {
  if (Array.isArray(data)) {
    const results = data.map(normalizer);
    return { results, count: results.length, next: null, previous: null };
  }
  const body = data as { results?: unknown[]; count?: number; next?: string | null; previous?: string | null };
  return {
    results: (body.results ?? []).map(normalizer),
    count: Number(body.count ?? 0),
    next: body.next ?? null,
    previous: body.previous ?? null,
  };
}

const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

function normalizeImportResult(raw: any, type: ReportImportType, fileName = ''): ReportImportResult {
  const issues = Array.isArray(raw?.issues) ? raw.issues : [];
  if (issues.length === 0 && raw?.detail) {
    issues.push({ severity: 'error', message: String(raw.detail) });
  }
  return {
    type,
    fileName: raw?.fileName ?? fileName,
    success: raw?.success === true,
    rowCount: Number(raw?.rowCount ?? 0),
    skippedRows: Number(raw?.skippedRows ?? 0),
    issues,
    data: [],
  };
}

export const apiService = {
  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  clearToken: (): void => localStorage.removeItem(TOKEN_KEY),

  async pollCeleryTask<T>(taskId: string, maxAttempts = 180, intervalMs = 1000): Promise<T> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { data } = await api.get(`/api/financeiro/tasks/${taskId}/`);
      if (data.status === 'SUCCESS') {
        return data.result as T;
      }
      if (data.status === 'FAILURE') {
        throw new Error(data.error ?? 'Falha ao processar a tarefa.');
      }
      await sleep(intervalMs);
    }
    throw new Error('Tempo esgotado aguardando processamento do arquivo.');
  },

  async login(username: string, password: string): Promise<User | null> {
    try {
      const { data } = await api.post('/api/auth/login/', { username, password });
      apiService.setToken(data.token);
      return normalizeUser(data.user);
    } catch (err) {
      if (axios.isAxiosError(err) && !err.response) {
        throw new Error('SERVER_OFFLINE');
      }
      return null;
    }
  },

  async getProfile(): Promise<User | null> {
    if (!apiService.getToken()) return null;
    try {
      const { data } = await api.get('/api/auth/profile/');
      return normalizeUser(data);
    } catch {
      apiService.clearToken();
      return null;
    }
  },

  async getUsers(params: UserQueryParams = {}): Promise<PaginatedResponse<User>> {
    const { data } = await api.get('/api/auth/users/', { params: buildUserQueryParams(params) });
    const rawResults = Array.isArray(data) ? data : (data.results ?? []);
    return {
      results: rawResults.map(normalizeUser),
      count: Array.isArray(data) ? rawResults.length : (data.count ?? rawResults.length),
      next: Array.isArray(data) ? null : (data.next ?? null),
      previous: Array.isArray(data) ? null : (data.previous ?? null),
    };
  },

  async createUser(userData: any): Promise<User> {
    const { data } = await api.post('/api/auth/users/', userData);
    return normalizeUser(data);
  },

  async updateUser(id: string, userData: any): Promise<User> {
    const { data } = await api.patch(`/api/auth/users/${id}/`, userData);
    return normalizeUser(data);
  },

  async deleteUser(id: string): Promise<void> {
    await api.delete(`/api/auth/users/${id}/`);
  },

  async toggleUserStatus(id: string): Promise<string> {
    const { data } = await api.post(`/api/auth/users/${id}/toggle_status/`);
    return data.status as string;
  },

  async forcePasswordChange(id: string): Promise<void> {
    await api.post(`/api/auth/users/${id}/force-password-change/`);
  },

  async changePassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<User> {
    const { data } = await api.post('/api/auth/profile/change-password/', payload);
    return normalizeUser(data);
  },

  async getRoles(): Promise<Role[]> {
    const { data } = await api.get('/api/auth/roles/');
    const list = Array.isArray(data) ? data : (data.results ?? []);
    return list.map((raw: any) => ({
      id: String(raw.id),
      name: raw.name,
      description: raw.description ?? '',
      permissions: raw.permissions ?? [],
    }));
  },

  async getAuditLogs(params: AuditLogQueryParams = {}): Promise<PaginatedResponse<SystemLog>> {
    const { data } = await api.get('/api/audit/logs/', { params: buildAuditLogQueryParams(params) });
    const rawResults = Array.isArray(data) ? data : (data.results ?? []);
    const results: SystemLog[] = rawResults.map((raw: any) => ({
      id: String(raw.id),
      userId: raw.userId ?? '',
      username: raw.username ?? '',
      action: raw.action,
      details: raw.details ?? '',
      timestamp: raw.timestamp,
    }));
    return {
      results,
      count: Array.isArray(data) ? results.length : (data.count ?? results.length),
      next: Array.isArray(data) ? null : (data.next ?? null),
      previous: Array.isArray(data) ? null : (data.previous ?? null),
    };
  },

  async getAuditLogFacets(): Promise<AuditLogFacets> {
    const { data } = await api.get('/api/audit/logs/facets/');
    return { actions: data.actions ?? [] };
  },

  // ─── Financeiro — Relatórios (Django API + SQLite/PostgreSQL) ────────────────

  async getReportBatches(): Promise<ReportBatchesResponse> {
    const { data } = await api.get('/api/financeiro/batches/');
    const list = Array.isArray(data) ? data : (data.results ?? []);
    return {
      maxBatches: Number((data as { maxBatches?: number }).maxBatches ?? list.length),
      results: list.map(normalizeReportBatch),
    };
  },

  async prepareReportImport(): Promise<ReportBatch> {
    const { data } = await api.post('/api/financeiro/batches/prepare_import/');
    return normalizeReportBatch(data);
  },

  async getPagarReport(params: ReportQueryParams = {}): Promise<PaginatedResponse<PagarRow>> {
    const { data } = await api.get('/api/financeiro/reports/pagar/', { params: buildReportQueryParams(params) });
    return paginatedFromResponse(data, normalizePagarRow);
  },

  async getReceberReport(params: ReportQueryParams = {}): Promise<PaginatedResponse<ReceberRow>> {
    const { data } = await api.get('/api/financeiro/reports/receber/', { params: buildReportQueryParams(params) });
    return paginatedFromResponse(data, normalizeReceberRow);
  },

  async getAgingReport(params: ReportQueryParams = {}): Promise<PaginatedResponse<AgingRow>> {
    const { data } = await api.get('/api/financeiro/reports/aging/', { params: buildReportQueryParams(params) });
    return paginatedFromResponse(data, normalizeAgingRow);
  },

  async getReportFacets(reportType: 'pagar' | 'receber' | 'aging'): Promise<ReportFacets> {
    const { data } = await api.get(`/api/financeiro/reports/${reportType}/facets/`);
    return {
      filiais: data.filiais ?? [],
      parties: data.parties ?? [],
      tipos: data.tipos ?? [],
    };
  },

  async getPrAnalysis(): Promise<PrAnalysisResponse> {
    const { data } = await api.get('/api/financeiro/reports/analise-prs/');
    return data;
  },

  async getPagarDiffAnalysis(params: PagarDiffQueryParams = {}): Promise<PagarDiffResponse> {
    const { data } = await api.get('/api/financeiro/reports/pagar/diff/', { params });
    return data;
  },

  async prAction(payload: { ids: number[]; action: 'ignore' | 'restore' }): Promise<{ message: string; updated: number }> {
    const { data } = await api.post('/api/financeiro/reports/pr-action/', payload);
    return data;
  },

  async importReport(batchId: string, type: ReportImportType, file: File): Promise<ReportImportResult> {
    const form = new FormData();
    form.append('type', type);
    form.append('file', file);
    try {
      const response = await api.post(`/api/financeiro/batches/${batchId}/import_report/`, form, {
        timeout: 120000,
        validateStatus: (s) => s === 200 || s === 202 || s === 400 || s === 500,
      });
      const { data, status: httpStatus } = response;
      if (httpStatus === 202 && data.taskId) {
        const result = await this.pollCeleryTask<Record<string, unknown>>(data.taskId);
        return normalizeImportResult(result, type, file.name);
      }
      return normalizeImportResult(data, type, file.name);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        return normalizeImportResult(err.response.data, type, file.name);
      }
      if (axios.isAxiosError(err) && !err.response) {
        return normalizeImportResult(
          { detail: err.message?.includes('Tempo esgotado')
            ? err.message
            : 'Servidor indisponível ou tempo esgotado. Verifique se o backend está rodando.' },
          type,
          file.name,
        );
      }
      throw err;
    }
  },

  async finalizeReportBatch(batchId: string): Promise<ReportBatch> {
    const { data } = await api.post(`/api/financeiro/batches/${batchId}/finalize/`);
    return normalizeReportBatch(data);
  },

  // ─── Financeiro — Faturamento, Ajustes, Saldos (Django API) ─────────────────

  async getBillingRecords(params: BillingQueryParams = {}): Promise<PaginatedResponse<BillingRecord>> {
    const { data } = await api.get('/api/financeiro/billing/', {
      params: buildBillingQueryParams(params),
    });
    return paginatedFromResponse(data, normalizeBillingRecord);
  },

  async importBillingXml(file: File): Promise<{
    success: boolean;
    rowCount: number;
    totalValue: number;
    totalNotes: number;
    dates: string[];
    detail?: string;
  }> {
    const form = new FormData();
    form.append('file', file);
    const response = await api.post('/api/financeiro/billing/import_xml/', form, {
      timeout: 120000,
      validateStatus: (s) => s === 200 || s === 202 || s === 400,
    });
    const { data, status: httpStatus } = response;
    if (httpStatus === 202 && data.taskId) {
      return this.pollCeleryTask(data.taskId);
    }
    return data;
  },

  async createBillingRecord(payload: Omit<BillingRecord, 'id' | 'trend'>): Promise<BillingRecord> {
    const { data } = await api.post('/api/financeiro/billing/', payload);
    return normalizeBillingRecord(data);
  },

  async updateBillingRecord(id: number, payload: Partial<Omit<BillingRecord, 'id'>>): Promise<BillingRecord> {
    const { data } = await api.patch(`/api/financeiro/billing/${id}/`, payload);
    return normalizeBillingRecord(data);
  },

  async deleteBillingRecord(id: number): Promise<void> {
    await api.delete(`/api/financeiro/billing/${id}/`);
  },

  async getMetasFaturamento(ano: number): Promise<MetaFaturamentoConfigResponse> {
    const { data } = await api.get('/api/logistica/metas-faturamento/', { params: { ano } });
    return data as MetaFaturamentoConfigResponse;
  },

  async saveMetasFaturamento(payload: MetaFaturamentoConfigPayload): Promise<MetaFaturamentoConfigResponse> {
    const { data } = await api.put('/api/logistica/metas-faturamento/', payload);
    return data as MetaFaturamentoConfigResponse;
  },

  async getCashAdjustments(params: AdjustmentQueryParams = {}): Promise<PaginatedResponse<CashAdjustment>> {
    const { data } = await api.get('/api/financeiro/adjustments/', { params: buildAdjustmentQueryParams(params) });
    return paginatedFromResponse(data, normalizeCashAdjustment);
  },

  async createCashAdjustment(payload: Omit<CashAdjustment, 'id'>): Promise<CashAdjustment> {
    const { data } = await api.post('/api/financeiro/adjustments/', payload);
    return normalizeCashAdjustment(data);
  },

  async updateCashAdjustment(id: number, payload: Partial<Omit<CashAdjustment, 'id'>>): Promise<CashAdjustment> {
    const { data } = await api.patch(`/api/financeiro/adjustments/${id}/`, payload);
    return normalizeCashAdjustment(data);
  },

  async deleteCashAdjustment(id: number): Promise<void> {
    await api.delete(`/api/financeiro/adjustments/${id}/`);
  },

  // ── Calendário Financeiro ────────────────────────────────────────────────

  async getCalendarSystemEvents(start: string, end: string): Promise<CalendarSystemEventsResponse> {
    const { data } = await api.get('/api/financeiro/calendario/sistema/', { params: { start, end } });
    return {
      batchLabel: data.batchLabel ?? null,
      events: data.events ?? {},
    };
  },

  async getCalendarPersonalEvents(start: string, end: string): Promise<CalendarPersonalEvent[]> {
    const { data } = await api.get('/api/financeiro/calendario/eventos/', { params: { start, end } });
    return (Array.isArray(data) ? data : data.results ?? []) as CalendarPersonalEvent[];
  },

  async createCalendarPersonalEvent(payload: Omit<CalendarPersonalEvent, 'id'>): Promise<CalendarPersonalEvent> {
    const { data } = await api.post('/api/financeiro/calendario/eventos/', payload);
    return data as CalendarPersonalEvent;
  },

  async updateCalendarPersonalEvent(id: number, payload: Partial<Omit<CalendarPersonalEvent, 'id'>>): Promise<CalendarPersonalEvent> {
    const { data } = await api.patch(`/api/financeiro/calendario/eventos/${id}/`, payload);
    return data as CalendarPersonalEvent;
  },

  async deleteCalendarPersonalEvent(id: number): Promise<void> {
    await api.delete(`/api/financeiro/calendario/eventos/${id}/`);
  },

  async getBankAccounts(): Promise<BankAccount[]> {
    const { data } = await api.get('/api/financeiro/bank-accounts/');
    return listFromResponse(data, normalizeBankAccount);
  },

  async getBalanceHistory(params: BalanceHistoryQueryParams = {}): Promise<PaginatedResponse<BalanceHistoryEntry>> {
    const { data } = await api.get('/api/financeiro/balance-history/', { params: buildBalanceHistoryQueryParams(params) });
    return paginatedFromResponse(data, normalizeBalanceHistoryEntry);
  },

  async createBankAccount(payload: Omit<BankAccount, 'id'>): Promise<BankAccount> {
    const { data } = await api.post('/api/financeiro/bank-accounts/', payload);
    return normalizeBankAccount(data);
  },

  async updateBankAccount(id: number, payload: Partial<Omit<BankAccount, 'id'>>): Promise<BankAccount> {
    const { data } = await api.patch(`/api/financeiro/bank-accounts/${id}/`, payload);
    return normalizeBankAccount(data);
  },

  async deleteBankAccount(id: number): Promise<void> {
    await api.delete(`/api/financeiro/bank-accounts/${id}/`);
  },

  async createBalanceHistoryEntry(payload: Omit<BalanceHistoryEntry, 'id'>): Promise<BalanceHistoryEntry> {
    const { data } = await api.post('/api/financeiro/balance-history/', payload);
    return normalizeBalanceHistoryEntry(data);
  },

  async updateBalanceHistoryEntry(id: number, payload: Partial<Omit<BalanceHistoryEntry, 'id'>>): Promise<BalanceHistoryEntry> {
    const { data } = await api.patch(`/api/financeiro/balance-history/${id}/`, payload);
    return normalizeBalanceHistoryEntry(data);
  },

  async deleteBalanceHistoryEntry(id: number): Promise<void> {
    await api.delete(`/api/financeiro/balance-history/${id}/`);
  },

  async syncBankData(accounts: BankAccount[], history: BalanceHistoryEntry[]): Promise<{
    accounts: BankAccount[];
    history: BalanceHistoryEntry[];
  }> {
    const { data } = await api.post('/api/financeiro/bank-data/sync/', { accounts, history });
    return {
      accounts: (data.accounts ?? []).map(normalizeBankAccount),
      history: (data.history ?? []).map(normalizeBalanceHistoryEntry),
    };
  },

  // ─── Indicadores ───────────────────────────────────────────────────────────

  async getIndicadorKpis(): Promise<IndicadorKpi[]> {
    const { data } = await api.get('/api/indicadores/kpis/');
    return listFromResponse(data, normalizeIndicadorKpi);
  },

  async getIndicadorFiliais(): Promise<IndicadorFilialRow[]> {
    const { data } = await api.get('/api/indicadores/filiais/');
    return listFromResponse(data, normalizeIndicadorFilial);
  },

  async getIndicadorCashflow(params: CashflowQueryParams = {}): Promise<CashflowResponse> {
    const { data } = await api.get('/api/indicadores/fluxo-caixa/', {
      params: buildCashflowQueryParams(params),
    });
    return normalizeCashflowResponse(data);
  },

  async getIndicadorCashflowDayDetail(params: CashflowDayDetailParams): Promise<CashflowDayDetailResponse> {
    const { data } = await api.get('/api/indicadores/fluxo-caixa/dia/', {
      params: buildCashflowDayDetailParams(params),
    });
    return normalizeCashflowDayDetail(data);
  },

  async getIndicadorRHMovimentacao(params: RHIndicadorQueryParams = {}): Promise<RHIndicadorResponse> {
    const { data } = await api.get('/api/indicadores/rh/movimentacao/', {
      params: buildRHIndicadorQueryParams(params),
    });
    return normalizeRHIndicadorResponse(data);
  },

  async exportarIndicadorRHMovimentacao(referencia: string): Promise<Blob> {
    const response = await api.get('/api/indicadores/rh/movimentacao/exportar/', {
      params: { referencia },
      responseType: 'arraybuffer',
    });
    const contentType = String(response.headers['content-type'] ?? '');
    if (contentType.includes('application/json')) {
      const text = new TextDecoder().decode(response.data as ArrayBuffer);
      const parsed = JSON.parse(text) as { detail?: string };
      throw new Error(parsed.detail ?? 'Não foi possível exportar os dados brutos do indicador.');
    }
    return new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  },

  async getIndicadorSgqSatisfacao(
    params: SgqSatisfacaoIndicadorQueryParams = {},
  ): Promise<SgqSatisfacaoIndicadorResponse> {
    const { data } = await api.get('/api/indicadores/sgq/satisfacao/', {
      params: buildSgqSatisfacaoIndicadorQueryParams(params),
    });
    return data as SgqSatisfacaoIndicadorResponse;
  },

  async getIndicadorMetaFaturamento(
    params: MetaFaturamentoQueryParams = {},
  ): Promise<MetaFaturamentoResponse> {
    const query: Record<string, number> = {};
    if (params.ano != null) query.ano = params.ano;
    if (params.mes != null) query.mes = params.mes;
    const { data } = await api.get('/api/indicadores/logistica/meta-faturamento/', { params: query });
    return data as MetaFaturamentoResponse;
  },

  async sendGerencialEmail(payload: SendGerencialEmailParams): Promise<SendGerencialEmailResponse> {
    const { data } = await api.post('/api/indicadores/fluxo-caixa/enviar-gerencial/', payload);
    return data;
  },

  // Endpoint leve para polling (sistema multiusuário): informa se algum outro
  // usuário alterou dados do Financeiro que afetam o Fluxo de Caixa desde a
  // última consulta. Só quando o número muda o frontend recarrega os dados
  // pesados do fluxo de caixa — evita polling caro/desnecessário.
  async getCashflowActivityVersion(): Promise<number> {
    const { data } = await api.get<{ version: number }>('/api/indicadores/fluxo-caixa/atividade/');
    return data.version;
  },

  // Mesmo padrão do Fluxo de Caixa: polling leve para o indicador de Satisfação
  // refletir lançamentos feitos no SGQ por outro usuário sem refresh manual.
  async getSgqSatisfacaoActivityVersion(): Promise<number> {
    const { data } = await api.get<{ version: number }>('/api/indicadores/sgq/satisfacao/atividade/');
    return data.version;
  },

  // ─── Google OAuth / Contatos ───────────────────────────────────────────────

  async getGoogleLinkUrl(): Promise<string> {
    const { data } = await api.get('/api/auth/profile/google/link/');
    return data.authUrl;
  },

  async completeGoogleLink(code: string, state: string): Promise<User> {
    const { data } = await api.post('/api/auth/profile/google/callback/', { code, state });
    return normalizeUser(data);
  },

  async unlinkGoogleAccount(): Promise<User> {
    const { data } = await api.post('/api/auth/profile/google/unlink/');
    return normalizeUser(data);
  },

  async getGoogleContacts(): Promise<GoogleContactsResponse> {
    const { data } = await api.get('/api/auth/google/contacts/');
    return {
      contacts: (data.contacts ?? []).map((item: { name: string; email: string; photo?: string | null }) => ({
        name: item.name,
        email: item.email,
        photo: item.photo ?? null,
      })),
    };
  },

  // ─── Filesystem (export modal — Django API) ─────────────────────────────────

  async fsGetHomeDir(): Promise<string> {
    const { data } = await api.get('/api/fs/homedir');
    return data.homeDir;
  },

  async fsListDirectory(path: string): Promise<{ currentPath: string; parentPath: string | null; subdirs: string[] }> {
    const { data } = await api.get('/api/fs/list', { params: { path } });
    if (!data.success) {
      throw new Error(data.error ?? 'Erro ao listar diretório.');
    }
    return {
      currentPath: data.currentPath,
      parentPath: data.parentPath,
      subdirs: data.subdirs ?? [],
    };
  },

  async fsWriteFile(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
    const { data } = await api.post('/api/fs/write', { filePath, content });
    return data;
  },

  // ─── Recursos Humanos (RH) ──────────────────────────────────────────────────

  async getLotesRH(): Promise<LoteMovimentacaoRH[]> {
    const { data } = await api.get('/api/rh/lotes/');
    return data;
  },

  async prepareLoteRH(mes: number, ano: number): Promise<LoteMovimentacaoRH> {
    const { data } = await api.post('/api/rh/lotes/prepare_import/', { mes, ano });
    return data;
  },

  async importarArquivoRH(mes: number, ano: number, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('mes', String(mes));
    formData.append('ano', String(ano));
    formData.append('arquivo', file);
    const { data } = await api.post('/api/rh/lotes/importar_arquivo/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async importarLoteRH(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('arquivo', file);
    const { data } = await api.post('/api/rh/lotes/importar_lote/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async exportarModeloRH(): Promise<Blob> {
    const { data } = await api.get('/api/rh/lotes/exportar_modelo/', { responseType: 'blob' });
    return data;
  },

  async exportarRelatorioMovimentacoesRH(loteId?: string): Promise<Blob> {
    const { data } = await api.get('/api/rh/movimentacoes/exportar_relatorio/', {
      params: loteId ? { loteId } : undefined,
      responseType: 'blob',
    });
    return data;
  },

  async enviarEmailRH(loteId: string, to: string[], cc: string[] = []): Promise<{ success: boolean; message: string }> {
    const { data } = await api.post(`/api/rh/lotes/${loteId}/enviar_email/`, { to, cc });
    return data;
  },

  async getMovimentacoesRH(params: { loteId?: string; filial?: string; categoria?: string; situacao?: string; search?: string; page?: number; pageSize?: number; ordering?: RHMovimentacaoOrdering }): Promise<PaginatedResponse<MovimentacaoColaborador>> {
    const { data } = await api.get('/api/rh/movimentacoes/', {
      params: {
        loteId: params.loteId,
        filial: params.filial,
        categoria: params.categoria,
        situacao: params.situacao,
        search: params.search,
        page: params.page,
        page_size: params.pageSize,
        ordering: params.ordering,
      },
    });
    return paginatedFromResponse(data, (raw) => raw as MovimentacaoColaborador);
  },

  async getRHDashboardSummary(params: {
    mes?: number;
    ano?: number;
    loteId?: string;
    pageSize?: number;
    novosPage?: number;
    desligadosPage?: number;
    alteracoesPage?: number;
    novosSearch?: string;
    desligadosSearch?: string;
    alteracoesSearch?: string;
  }): Promise<RHDashboardSummaryResponse> {
    const { data } = await api.get('/api/rh/movimentacoes/dashboard_summary/', { params });
    return data;
  },

  async buscarCompararRH(term: string): Promise<{ results: Array<{ cpf: string; nome: string; cargo: string; filial: string }> }> {
    const { data } = await api.get('/api/rh/movimentacoes/buscar_comparar/', { params: { term } });
    return data;
  },

  async getComparacaoDadosRH(cpfs: string[]): Promise<RHComparisonResponse> {
    const params = new URLSearchParams();
    cpfs.forEach((cpf) => params.append('cpfs[]', cpf));
    const { data } = await api.get('/api/rh/movimentacoes/dados_comparacao/', { params });
    return data;
  },

  async getPjsRH(params: { search?: string } = {}): Promise<ColaboradorPJ[]> {
    const { data } = await api.get('/api/rh/pjs/', { params });
    return data;
  },

  async createPjRH(pj: Omit<ColaboradorPJ, 'id' | 'dataCriacao'>): Promise<ColaboradorPJ> {
    const { data } = await api.post('/api/rh/pjs/', pj);
    return data;
  },

  async updatePjRH(id: string, pj: Partial<ColaboradorPJ>): Promise<ColaboradorPJ> {
    const { data } = await api.patch(`/api/rh/pjs/${id}/`, pj);
    return data;
  },

  async deletePjRH(id: string): Promise<void> {
    await api.delete(`/api/rh/pjs/${id}/`);
  },

  async getPjHistoricoRH(pjId: string): Promise<ColaboradorPJHistorico[]> {
    const { data } = await api.get(`/api/rh/pjs/${pjId}/historico/`);
    return data;
  },

  async createPjHistoricoRH(
    pjId: string,
    payload: { ano: number; mes: number; salario: number; cargo?: string; filial?: string },
  ): Promise<ColaboradorPJHistorico> {
    const { data } = await api.post(`/api/rh/pjs/${pjId}/historico/`, payload);
    return data;
  },

  async updatePjHistoricoRH(
    pjId: string,
    historicoId: string,
    payload: Partial<{ ano: number; mes: number; salario: number; cargo?: string; filial?: string }>,
  ): Promise<ColaboradorPJHistorico> {
    const { data } = await api.patch(`/api/rh/pjs/${pjId}/historico/${historicoId}/`, payload);
    return data;
  },

  async deletePjHistoricoRH(pjId: string, historicoId: string): Promise<void> {
    await api.delete(`/api/rh/pjs/${pjId}/historico/${historicoId}/`);
  },

  async getCargosRH(params: { status?: 'pendente' | 'definido'; search?: string } = {}): Promise<CargoMapping[]> {
    const { data } = await api.get('/api/rh/cargos/', { params });
    return data;
  },

  async updateCargoRH(id: string, categoria?: string): Promise<CargoMapping> {
    const { data } = await api.patch(`/api/rh/cargos/${id}/`, { categoria });
    return data;
  },

  async deleteCargoMappingRH(id: string): Promise<void> {
    await api.delete(`/api/rh/cargos/${id}/`);
  },

  async getColaboradoresRH(params: { search?: string; desconsiderados?: boolean } = {}): Promise<Colaborador[]> {
    const { data } = await api.get('/api/rh/colaboradores/', {
      params: {
        search: params.search,
        desconsiderados: params.desconsiderados ? 'true' : 'false',
      },
    });
    return data;
  },

  async toggleDesconsiderarRH(id: string): Promise<{ success: boolean; desconsiderado: boolean }> {
    const { data } = await api.post(`/api/rh/colaboradores/${id}/toggle_desconsiderar/`);
    return data;
  },

  async getHistoricoSalarialRH(params: { search?: string } = {}): Promise<InconsistenciaColaborador[]> {
    const { data } = await api.get('/api/rh/historico-salarial/', { params });
    return data;
  },

  async importarHistoricoSalarialRH(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('arquivo', file);
    const { data } = await api.post('/api/rh/historico-salarial/importar_historico/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async salvarJustificativaAlteracao(id: string, justificativa: string): Promise<any> {
    const { data } = await api.post(`/api/rh/alteracoes/${id}/salvar_justificativa/`, { justificativa });
    return data;
  },

  // --- COMPRAS (Controle de Estoque) ---

  async getUnidadesMedida(): Promise<UnidadeMedida[]> {
    const { data } = await api.get('/api/compras/unidades/');
    return data;
  },

  async createUnidadeMedida(nome: string): Promise<UnidadeMedida> {
    const { data } = await api.post('/api/compras/unidades/', { nome });
    return data;
  },

  async updateUnidadeMedida(id: string, nome: string): Promise<UnidadeMedida> {
    const { data } = await api.patch(`/api/compras/unidades/${id}/`, { nome });
    return data;
  },

  async deleteUnidadeMedida(id: string): Promise<void> {
    await api.delete(`/api/compras/unidades/${id}/`);
  },

  async getSetoresCompras(): Promise<Setor[]> {
    const { data } = await api.get('/api/compras/setores/');
    return data;
  },

  async createSetorCompras(nome: string): Promise<Setor> {
    const { data } = await api.post('/api/compras/setores/', { nome });
    return data;
  },

  async updateSetorCompras(id: string, nome: string): Promise<Setor> {
    const { data } = await api.patch(`/api/compras/setores/${id}/`, { nome });
    return data;
  },

  async deleteSetorCompras(id: string): Promise<void> {
    await api.delete(`/api/compras/setores/${id}/`);
  },

  async getColaboradoresCompras(setorId?: string): Promise<ColaboradorCompras[]> {
    const { data } = await api.get('/api/compras/colaboradores/', {
      params: setorId ? { setorId } : undefined,
    });
    return data;
  },

  async createColaboradorCompras(payload: { nome: string; setorId: string }): Promise<ColaboradorCompras> {
    const { data } = await api.post('/api/compras/colaboradores/', payload);
    return data;
  },

  async updateColaboradorCompras(
    id: string,
    payload: { nome: string; setorId?: string },
  ): Promise<ColaboradorCompras> {
    const { data } = await api.patch(`/api/compras/colaboradores/${id}/`, payload);
    return data;
  },

  async deleteColaboradorCompras(id: string): Promise<void> {
    await api.delete(`/api/compras/colaboradores/${id}/`);
  },

  async getFornecedores(): Promise<Fornecedor[]> {
    const { data } = await api.get('/api/compras/fornecedores/');
    return data;
  },

  async createFornecedor(nome: string): Promise<Fornecedor> {
    const { data } = await api.post('/api/compras/fornecedores/', { nome });
    return data;
  },

  async updateFornecedor(id: string, nome: string): Promise<Fornecedor> {
    const { data } = await api.patch(`/api/compras/fornecedores/${id}/`, { nome });
    return data;
  },

  async deleteFornecedor(id: string): Promise<void> {
    await api.delete(`/api/compras/fornecedores/${id}/`);
  },

  async getItensEstoque(): Promise<ItemEstoque[]> {
    const { data } = await api.get('/api/compras/itens/');
    return data;
  },

  async createItemEstoque(item: { nome: string; unidade: string; qtdAtual: number; qtdMinima: number }): Promise<ItemEstoque> {
    const { data } = await api.post('/api/compras/itens/', item);
    return data;
  },

  async updateItemEstoque(id: string, item: Partial<{ nome: string; unidade: string; qtdAtual: number; qtdMinima: number }>): Promise<ItemEstoque> {
    const { data } = await api.patch(`/api/compras/itens/${id}/`, item);
    return data;
  },

  async deleteItemEstoque(id: string): Promise<void> {
    await api.delete(`/api/compras/itens/${id}/`);
  },

  async getEntradasEstoque(): Promise<EntradaEstoque[]> {
    const { data } = await api.get('/api/compras/entradas/');
    return data;
  },

  async registrarCompra(payload: RegistrarCompraPayload): Promise<EntradaEstoque[]> {
    const { data } = await api.post('/api/compras/entradas/registrar_compra/', payload);
    return data;
  },

  async getSaidasEstoque(): Promise<SaidaEstoque[]> {
    const { data } = await api.get('/api/compras/saidas/');
    return data;
  },

  async registrarSaida(payload: RegistrarSaidaPayload): Promise<SaidaEstoque[]> {
    const { data } = await api.post('/api/compras/saidas/registrar_saida/', payload);
    return data;
  },

  // ─── Faturamento — Protocolos de envio de NF ────────────────────────────────

  async getProtocoloClientes(): Promise<ClienteProtocolo[]> {
    const { data } = await api.get('/api/faturamento/protocolo-clientes/');
    return Array.isArray(data) ? data.map(normalizeClienteProtocolo) : data.results?.map(normalizeClienteProtocolo) ?? [];
  },

  async createProtocoloCliente(payload: ClienteProtocoloPayload): Promise<ClienteProtocolo> {
    const { data } = await api.post('/api/faturamento/protocolo-clientes/', payload);
    return normalizeClienteProtocolo(data);
  },

  async updateProtocoloCliente(id: string, payload: Partial<ClienteProtocoloPayload>): Promise<ClienteProtocolo> {
    const { data } = await api.patch(`/api/faturamento/protocolo-clientes/${id}/`, payload);
    return normalizeClienteProtocolo(data);
  },

  async deleteProtocoloCliente(id: string): Promise<void> {
    await api.delete(`/api/faturamento/protocolo-clientes/${id}/`);
  },

  async getFiliais(clienteId: string): Promise<{ id: string; nome: string }[]> {
    const { data } = await api.get(`/api/faturamento/protocolo-clientes/${clienteId}/filiais/`);
    return (Array.isArray(data) ? data : data.results ?? []).map((f: any) => ({ id: String(f.id), nome: f.nome }));
  },

  async createFilial(clienteId: string, nome: string): Promise<{ id: string; nome: string }> {
    const { data } = await api.post(`/api/faturamento/protocolo-clientes/${clienteId}/filiais/`, { nome });
    return { id: String(data.id), nome: data.nome };
  },

  async deleteFilial(clienteId: string, filialId: string): Promise<void> {
    await api.delete(`/api/faturamento/protocolo-clientes/${clienteId}/filiais/${filialId}/`);
  },

  async getProtocolosEnvio(params: ProtocoloQueryParams = {}): Promise<PaginatedResponse<ProtocoloEnvio>> {
    const { data } = await api.get('/api/faturamento/protocolos/', { params: buildProtocoloQueryParams(params) });
    return paginatedFromResponse(data, normalizeProtocoloEnvio);
  },

  async getProtocoloEnvioDraft(): Promise<ProtocoloEnvioDraft> {
    const { data } = await api.get('/api/faturamento/protocolos/draft/');
    return data as ProtocoloEnvioDraft;
  },

  async saveProtocoloEnvioDraft(payload: Omit<ProtocoloEnvioDraft, 'version' | 'updatedAt' | 'hasDraft'>): Promise<ProtocoloEnvioDraft> {
    const { data } = await api.put('/api/faturamento/protocolos/draft/', payload);
    return data as ProtocoloEnvioDraft;
  },

  async deleteProtocoloEnvioDraft(): Promise<void> {
    await api.delete('/api/faturamento/protocolos/draft/');
  },

  async createProtocoloEnvio(payload: CreateProtocoloPayload): Promise<ProtocoloEnvio> {
    const { data } = await api.post('/api/faturamento/protocolos/', payload);
    return normalizeProtocoloEnvio(data);
  },

  async updateProtocoloEnvio(id: string, payload: UpdateProtocoloPayload): Promise<ProtocoloEnvio> {
    const { data } = await api.patch(`/api/faturamento/protocolos/${id}/`, payload);
    return normalizeProtocoloEnvio(data);
  },

  async deleteProtocoloEnvio(id: string): Promise<void> {
    await api.delete(`/api/faturamento/protocolos/${id}/`);
  },

  async bulkDeleteProtocolos(ids: number[]): Promise<{ deleted: number }> {
    const { data } = await api.post('/api/faturamento/protocolos/bulk_delete/', { ids });
    return data;
  },

  async downloadProtocoloPdf(id: string): Promise<Blob> {
    const { data, headers } = await api.get(`/api/faturamento/protocolos/${id}/print_pdf/`, {
      responseType: 'blob',
    });
    return assertPdfBlob(data, headers);
  },

  async downloadProtocolosBulkPdf(ids: number[]): Promise<Blob> {
    const { data, headers } = await api.get('/api/faturamento/protocolos/bulk_print/', {
      params: { ids: ids.join(',') },
      responseType: 'blob',
    });
    return assertPdfBlob(data, headers);
  },

  async downloadProtocolosBulkLabels(ids: number[]): Promise<Blob> {
    const { data, headers, status } = await api.get('/api/faturamento/protocolos/bulk_print_labels/', {
      params: { ids: ids.join(',') },
      responseType: 'blob',
      validateStatus: () => true,
    });
    if (status === 404) {
      throw new Error(
        'Recurso de etiquetas não encontrado no servidor. Reinicie o backend (porta 8001) ou aguarde o deploy.',
      );
    }
    if (status < 200 || status >= 300) {
      throw new Error(await readBlobErrorMessage(data, 'Não foi possível gerar as etiquetas dos protocolos.'));
    }
    return assertPdfBlob(data, headers);
  },

  async downloadProtocolosBulkExcel(ids: number[]): Promise<Blob> {
    const { data, headers, status } = await api.get('/api/faturamento/protocolos/bulk_export_excel/', {
      params: { ids: ids.join(',') },
      responseType: 'blob',
      validateStatus: () => true,
    });
    if (status < 200 || status >= 300) {
      throw new Error(await readBlobErrorMessage(data, 'Não foi possível gerar a planilha dos protocolos.'));
    }
    return assertSpreadsheetBlob(data, headers);
  },

  async importProtocolosSpreadsheet(params: ProtocoloImportParams): Promise<ProtocoloImportResult> {
    const form = new FormData();
    form.append('file', params.file);
    form.append('clienteId', params.clienteId);
    if (params.dryRun) form.append('dryRun', 'true');
    const { data } = await api.post('/api/faturamento/protocolos/import_spreadsheet/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
      validateStatus: (s) => s === 200 || s === 400,
    });
    return data as ProtocoloImportResult;
  },

  async exportarModeloProtocolos(): Promise<Blob> {
    const { data, headers, status } = await api.get('/api/faturamento/protocolos/exportar_modelo/', {
      responseType: 'blob',
      validateStatus: () => true,
    });
    if (status < 200 || status >= 300) {
      throw new Error(await readBlobErrorMessage(data, 'Não foi possível baixar a planilha de referência.'));
    }
    return assertSpreadsheetBlob(data, headers);
  },

  // ─── SGQ — Pesquisa de Satisfação (Django API) ──────────────────────────────

  async getSgqPesquisas(params: SgqPesquisaQueryParams = {}): Promise<PaginatedResponse<SgqPesquisa>> {
    const { data } = await api.get('/api/sgq/pesquisas-satisfacao/', {
      params: buildSgqPesquisaQueryParams(params),
    });
    return paginatedFromResponse(data, (raw) => raw as SgqPesquisa);
  },

  async getSgqPesquisaStats(params: SgqPesquisaQueryParams = {}): Promise<SgqPesquisaStats> {
    const { data } = await api.get('/api/sgq/pesquisas-satisfacao/stats/', {
      params: buildSgqPesquisaQueryParams(params),
    });
    return data as SgqPesquisaStats;
  },

  async createSgqPesquisa(payload: SgqPesquisaPayload): Promise<SgqPesquisa> {
    const { data } = await api.post('/api/sgq/pesquisas-satisfacao/', payload);
    return data as SgqPesquisa;
  },

  async bulkCreateSgqPesquisas(payloads: SgqPesquisaPayload[]): Promise<SgqPesquisa[]> {
    const { data } = await api.post('/api/sgq/pesquisas-satisfacao/bulk_create/', payloads);
    return data as SgqPesquisa[];
  },

  async updateSgqPesquisa(id: string, payload: Partial<SgqPesquisaPayload>): Promise<SgqPesquisa> {
    const { data } = await api.patch(`/api/sgq/pesquisas-satisfacao/${id}/`, payload);
    return data as SgqPesquisa;
  },

  async deleteSgqPesquisa(id: string): Promise<void> {
    await api.delete(`/api/sgq/pesquisas-satisfacao/${id}/`);
  },

  /** Nomes de motoristas já usados na filial — alimenta a sugestão do formulário
   * (evita o mesmo motorista sendo digitado de formas diferentes) sem exigir
   * um cadastro formal deles. */
  async getSgqMotoristas(): Promise<string[]> {
    const { data } = await api.get('/api/sgq/pesquisas-satisfacao/motoristas/');
    return data as string[];
  },

  async getSgqLancadores(): Promise<string[]> {
    const { data } = await api.get('/api/sgq/pesquisas-satisfacao/lancadores/');
    return data as string[];
  },

  async getSgqLoteDraft(): Promise<SgqLoteDraft> {
    const { data } = await api.get('/api/sgq/pesquisas-satisfacao/lote-draft/');
    return data as SgqLoteDraft;
  },

  async saveSgqLoteDraft(rows: SgqLoteDraftRow[]): Promise<SgqLoteDraft> {
    const { data } = await api.put('/api/sgq/pesquisas-satisfacao/lote-draft/', { rows });
    return data as SgqLoteDraft;
  },

  async deleteSgqLoteDraft(): Promise<void> {
    await api.delete('/api/sgq/pesquisas-satisfacao/lote-draft/');
  },

  async exportSgqPesquisaImportTemplate(): Promise<Blob> {
    const { data, headers } = await api.get('/api/sgq/pesquisas-satisfacao/exportar-modelo/', {
      responseType: 'blob',
    });
    if (data instanceof Blob && data.type.includes('json')) {
      throw new Error(await readBlobErrorMessage(data, 'Não foi possível baixar o modelo.'));
    }
    return assertSpreadsheetBlob(data, headers);
  },

  async previewSgqPesquisasSpreadsheet(file: File): Promise<SgqPesquisaImportPreview> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/api/sgq/pesquisas-satisfacao/import-preview/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data as SgqPesquisaImportPreview;
  },

  async importSgqPesquisasSpreadsheet(file: File): Promise<SgqPesquisaImportResult> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/api/sgq/pesquisas-satisfacao/import-spreadsheet/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data as SgqPesquisaImportResult;
  },

  async getUserDirectory(module = 'Marketing'): Promise<UserDirectoryEntry[]> {
    const { data } = await api.get('/api/auth/users/directory/', { params: { module } });
    return (data ?? []).map((item: Record<string, unknown>) => ({
      id: String(item.id),
      name: String(item.name ?? ''),
      googlePicture: (item.googlePicture as string) || null,
      googleEmail: (item.googleEmail as string) || null,
    }));
  },

  // ─── Marketing — Campanhas ───────────────────────────────────────────────

  async getCampanhas(params: { start?: string; end?: string; status?: string; search?: string } = {}): Promise<CampanhaMarketing[]> {
    const { data } = await api.get('/api/marketing/campanhas/', { params });
    return Array.isArray(data) ? data as CampanhaMarketing[] : (data.results ?? []) as CampanhaMarketing[];
  },

  async getCampanha(id: string): Promise<CampanhaMarketing> {
    const { data } = await api.get(`/api/marketing/campanhas/${id}/`);
    return data as CampanhaMarketing;
  },

  async getCampanhaQuadro(): Promise<CampanhaQuadro> {
    const { data } = await api.get('/api/marketing/campanhas/quadro/');
    return data as CampanhaQuadro;
  },

  async createCampanha(payload: CampanhaPayload): Promise<CampanhaMarketing> {
    const { data } = await api.post('/api/marketing/campanhas/', payload);
    return data as CampanhaMarketing;
  },

  async updateCampanha(id: string, payload: Partial<CampanhaPayload>): Promise<CampanhaMarketing> {
    const { data } = await api.patch(`/api/marketing/campanhas/${id}/`, payload);
    return data as CampanhaMarketing;
  },

  async deleteCampanha(id: string): Promise<void> {
    await api.delete(`/api/marketing/campanhas/${id}/`);
  },

  async moveCampanhaStatus(id: string, payload: { status: string; ordemKanban?: number }): Promise<CampanhaMarketing> {
    const { data } = await api.post(`/api/marketing/campanhas/${id}/mover-status/`, payload);
    return data as CampanhaMarketing;
  },

  async getCampanhaComentarios(id: string): Promise<CampanhaComentario[]> {
    const { data } = await api.get(`/api/marketing/campanhas/${id}/comentarios/`);
    return data as CampanhaComentario[];
  },

  async createCampanhaComentario(id: string, payload: { texto: string; mencoes?: string[] }): Promise<CampanhaComentario> {
    const { data } = await api.post(`/api/marketing/campanhas/${id}/comentarios/`, {
      texto: payload.texto,
      mencoes: (payload.mencoes ?? []).map((item) => Number(item)),
    });
    return data as CampanhaComentario;
  },

  async addCampanhaMembro(campanhaId: string, userId: string): Promise<CampanhaMembro> {
    const { data } = await api.post(`/api/marketing/campanhas/${campanhaId}/membros/`, { userId });
    return data as CampanhaMembro;
  },

  async removeCampanhaMembro(campanhaId: string, userId: string): Promise<void> {
    await api.post(`/api/marketing/campanhas/${campanhaId}/membros/remover/`, { userId });
  },

  async atribuirCampanhaAMim(campanhaId: string): Promise<CampanhaMarketing> {
    const { data } = await api.post(`/api/marketing/campanhas/${campanhaId}/atribuir-me/`);
    return data as CampanhaMarketing;
  },

  async participarCampanha(campanhaId: string): Promise<CampanhaMembro> {
    const { data } = await api.post(`/api/marketing/campanhas/${campanhaId}/participar/`);
    return data as CampanhaMembro;
  },

  async getGoogleDriveStatus(): Promise<GoogleDriveStatus> {
    const { data } = await api.get('/api/marketing/drive/status/');
    return data as GoogleDriveStatus;
  },

  async browseGoogleDrive(params: {
    folderId?: string;
    pageToken?: string;
    pageSize?: number;
    driveId?: string;
  } = {}): Promise<GoogleDriveBrowseResponse> {
    const { data } = await api.get('/api/marketing/drive/browse/', { params });
    return data as GoogleDriveBrowseResponse;
  },

  async fetchGoogleDriveThumbnail(fileId: string): Promise<string> {
    const { data } = await api.get('/api/marketing/drive/thumbnail/', {
      params: { fileId },
      responseType: 'blob',
    });
    return URL.createObjectURL(data as Blob);
  },

  async fetchGoogleDrivePreview(fileId: string): Promise<string> {
    const { data } = await api.get('/api/marketing/drive/preview/', {
      params: { fileId },
      responseType: 'blob',
    });
    return URL.createObjectURL(data as Blob);
  },

  async addCampanhaMidia(campanhaId: string, driveFileId: string): Promise<CampanhaMidia> {
    const { data } = await api.post(`/api/marketing/campanhas/${campanhaId}/midias/`, { driveFileId });
    return data as CampanhaMidia;
  },

  async removeCampanhaMidia(campanhaId: string, driveFileId: string): Promise<void> {
    await api.post(`/api/marketing/campanhas/${campanhaId}/midias/remover/`, { driveFileId });
  },

};

