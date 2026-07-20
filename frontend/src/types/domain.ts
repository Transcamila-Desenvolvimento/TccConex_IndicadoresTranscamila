/** Tipos de domínio compartilhados entre frontend e API Django. */

export interface User {
  id: string;
  username: string;
  name: string;
  roleId: string;
  status: string;
  lastLogin: string | null;
  environments: string[];
  filiais: Record<string, string[]>;
  /** Indicadores liberados no ambiente Indicadores; lista vazia = todos. */
  indicadores: string[];
  /** Funções extras liberadas por ambiente (ex.: {"Faturamento": ["excluir-protocolos"]}). */
  funcoes: Record<string, string[]>;
  googleEmail: string | null;
  googleLinkedAt: string | null;
  mustChangePassword: boolean;
}

export interface GoogleContact {
  name: string;
  email: string;
  photo: string | null;
}

export interface GoogleContactsResponse {
  contacts: GoogleContact[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

export interface SystemLog {
  id: string;
  timestamp: string;
  userId: string;
  username?: string;
  action: string;
  details: string;
}

export interface AuditLogQueryParams extends ListQueryParams {
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface UserQueryParams extends ListQueryParams {
  roleId?: string;
  status?: string;
}

export interface AuditLogFacets {
  actions: string[];
}

export interface PagarRow {
  id?: string;
  selected?: boolean;
  filial: string;
  codForn: string;
  fornecedor: string;
  titulo: string;
  tipo: string;
  emissao: string;
  vencimento: string;
  vencimentoReal: string;
  valor: number;
  saldo: number;
  historico: string;
}

export interface ReceberRow {
  id?: string;
  selected?: boolean;
  filial: string;
  codCliente: string;
  cliente: string;
  titulo: string;
  natureza: string;
  emissao: string;
  vencimento: string;
  vencimentoReal: string;
  valor: number;
  saldo: number;
  historico: string;
}

export interface AgingRow {
  id?: string;
  selected?: boolean;
  origem: string;
  codCliente: string;
  cliente: string;
  loja: string;
  docto: string;
  serie: string;
  tipo: string;
  emissao: string;
  vencimento: string;
  regiao: string;
  total: number;
}

export interface ReportBatch {
  id: string;
  label: string;
  date: string;
  updatedBy: string;
  importedReports: { pagar: boolean; receber: boolean; aging: boolean };
  isActive: boolean;
}

export interface ReportBatchesResponse {
  results: ReportBatch[];
  maxBatches: number;
}

export type ReportImportType = 'pagar' | 'receber' | 'aging';

export interface ImportIssue {
  row?: number;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ReportImportResult {
  type: ReportImportType;
  fileName: string;
  success: boolean;
  rowCount: number;
  skippedRows: number;
  issues: ImportIssue[];
  data: unknown[];
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface ReportQueryParams extends ListQueryParams {
  filial?: string;
  party?: string;
  tipo?: string;
}

export interface ReportFacets {
  filiais: string[];
  parties: string[];
  tipos: string[];
}

export interface BillingQueryParams extends ListQueryParams {
  branch?: string;
  startDate?: string;
  endDate?: string;
  /** Quando true, pede ao backend todos os registros sem paginação (uso em exportação). */
  export?: boolean;
}

export interface AdjustmentQueryParams extends ListQueryParams {
  date?: string;
  type?: string;
}

export interface BalanceHistoryQueryParams extends ListQueryParams {
  bank?: string;
  type?: string;
  accountId?: number;
}

export interface BillingRecord {
  id: number;
  date: string;
  branch: string;
  value: number;
  notesCount: number;
  trend?: 'up' | 'down' | 'equal' | 'none';
}

export interface CashAdjustment {
  id: number;
  date: string;
  type: string;
  value: number;
  observation: string;
  user: string;
}

export interface BankAccount {
  id: number;
  bank: string;
  agency: string;
  number: string;
  type: string;
  balance: number;
  creditLimit: number;
  lastUpdated: string;
}

export interface BalanceHistoryEntry {
  id: number;
  accountId: number;
  date: string;
  bank: string;
  number: string;
  type: string;
  value: number;
}

export interface IndicadorKpi {
  label: string;
  value: string;
  change: string;
  up: boolean;
}

export interface IndicadorFilialRow {
  filial: string;
  receita: string;
  fretes: number;
  toneladas: string;
  meta: string;
}

export interface CashflowQueryParams {
  position?: string;
  start?: string;
  end?: string;
  filial?: string;
  gerencialDate?: string;
  accounts?: string;
  includeLimit?: boolean;
}

export interface CashflowBankAccountOption {
  id: number;
  bank: string;
  agency: string;
  number: string;
  type: string;
  balance: number;
  creditLimit: number;
  label: string;
}

export interface CashflowPositionOption {
  id: string;
  code: string;
  referenceDate: string;
  referenceDateIso: string;
}

export interface CashflowMeta {
  updatedAt: string;
  updatedBy: string;
  positionId?: string;
  batchLabel: string;
  batchReferenceDate: string;
  periodStart: string;
  periodEnd: string;
  minPeriodDate?: string;
  maxPeriodDate?: string;
  minGerencialDate?: string;
  defaultPeriodStart?: string;
  defaultPeriodEnd?: string;
}

export interface CashflowSummary {
  saldoPrevisto: number;
  entradas: number;
  saidas: number;
  ajustes: number;
  caixaPositivoAte: string;
}

export interface CashflowDailyPoint {
  date: string;
  dateIso: string;
  saldoInicial: number;
  entradas: number;
  saidas: number;
  ajustes: number;
  saldoProjetado: number;
}

export interface CashflowManagerialRow {
  filial: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

export interface CashflowGerencialItem {
  label: string;
  value: number;
}

export interface CashflowGerencialGroup {
  title: string;
  items: CashflowGerencialItem[];
}

export interface CashflowGerencialHighlight {
  title: string;
  value: number;
  subtitle: string;
  variant: 'positive' | 'negative' | 'neutral';
}

export interface CashflowScheduleBucket {
  label: string;
  value: number;
}

export interface CashflowAgingRow {
  category: string;
  variant: 'receber' | 'atraso';
  buckets: number[];
  total: number;
}

export interface CashflowGerencialPanel {
  referenceDate: string;
  groups: CashflowGerencialGroup[];
  highlights: CashflowGerencialHighlight[];
  schedule: CashflowScheduleBucket[];
  scheduleTotal: number;
  aging: {
    buckets: string[];
    rows: CashflowAgingRow[];
  };
}

export interface CashflowResponse {
  meta: CashflowMeta;
  summary: CashflowSummary;
  daily: CashflowDailyPoint[];
  managerial: CashflowManagerialRow[];
  gerencial: CashflowGerencialPanel;
  facets: {
    filiais: string[];
    positions: CashflowPositionOption[];
    bankAccounts: CashflowBankAccountOption[];
  };
}

export interface CashflowDayDetailParams {
  date: string;
  position?: string;
  filial?: string;
  accounts?: string;
  includeLimit?: boolean;
}

export interface CashflowDayDetailSummary {
  saldoAnterior: number;
  entradas: number;
  saidas: number;
  ajustes: number;
  saldoPrevisto: number;
}

export interface CashflowDayPagarRow {
  filial: string;
  fornecedor: string;
  titulo: string;
  tipo: string;
  saldo: number;
  historico: string;
}

export interface CashflowDayReceberRow {
  filial: string;
  cliente: string;
  titulo: string;
  natureza: string;
  saldo: number;
  historico: string;
}

export interface CashflowDayDetailResponse {
  date: string;
  dateIso: string;
  summary: CashflowDayDetailSummary;
  pagar: CashflowDayPagarRow[];
  receber: CashflowDayReceberRow[];
}

export interface SendGerencialEmailParams {
  gerencialDate: string;
  to: string[];
  cc?: string[];
}

export interface SendGerencialEmailResponse {
  message: string;
  snapshot: {
    referenceDate: string;
    batchLabel: string;
    posicaoGerencial: number;
    sentAt: string;
  };
}

export interface PrMatchRow {
  id: number;
  filial: string;
  fornecedor: string;
  titulo: string;
  tipo: string;
  vencimentoReal: string;
  saldo: number;
}

export interface PrDuplicateRow extends PrMatchRow {
  matches: PrMatchRow[];
}

export interface PrAnalysisResponse {
  batchId: number;
  batchLabel: string;
  totalPrs: number;
  totalDuplicates: number;
  duplicates: PrDuplicateRow[];
  ignored: PrMatchRow[];
}

export interface PagarDiffBatchRef {
  id: number;
  label: string;
  referenceDate: string;
  referenceDateLabel: string;
}

export interface PagarDiffTituloRef {
  id: number;
  filial: string;
  codForn: string;
  fornecedor: string;
  titulo: string;
  tipo: string;
  vencimentoReal: string;
  saldo: number;
}

export interface PagarDiffReprogramado {
  titulo: PagarDiffTituloRef;
  dataAnterior: string;
  dataNova: string;
  saldo: number;
  tipoReprogramacao: 'reprogramado_de' | 'reprogramado_para';
}

export interface PagarDiffDay {
  date: string;
  dateLabel: string;
  totalCurrent: number;
  totalPrevious: number;
  diff: number;
  novosTitulos: PagarDiffTituloRef[];
  novasNfs: PagarDiffTituloRef[];
  titulosBaixados: PagarDiffTituloRef[];
  reprogramados: PagarDiffReprogramado[];
}

export interface PagarDiffResponse {
  currentBatch: PagarDiffBatchRef;
  previousBatch: PagarDiffBatchRef | null;
  dateStart: string | null;
  dateEnd: string | null;
  totalCurrent: number;
  totalPrevious: number;
  totalDiff: number;
  summary: {
    novosTitulos: number;
    novasNfs: number;
    titulosBaixados: number;
  };
  days: PagarDiffDay[];
}

export interface PagarDiffQueryParams {
  batchId?: string;
  start?: string;
  end?: string;
}

// --- RECURSOS HUMANOS (RH) TYPES ---

export interface Colaborador {
  id: string;
  cpf: string;
  matricula: string;
  nomeCompleto: string;
  empresa?: string;
  filial?: string;
  departamento?: string;
  cargo?: string;
  situacao?: string;
  dataAdmissao?: string;
  dataDemissao?: string;
  telefone?: string;
  nomeLider?: string;
  dataNascimento?: string;
  escolaridade?: string;
  sexo?: string;
  regime: 'CLT' | 'PJ';
  categoria?: 'ADMINISTRATIVO' | 'OPERACIONAL' | 'MOTORISTA';
  dataAtualizacao: string;
  desconsiderado: boolean;
}

export interface LoteMovimentacaoRH {
  id: string;
  mes: number;
  ano: number;
  dataImportacao: string;
  updatedBy: string;
  arquivoUrl: string | null;
}

export interface MovimentacaoColaborador {
  id: string;
  loteId: string;
  filial: string;
  nome: string;
  situacao: string;
  ufEstado: string;
  funcao: string;
  dataAdmissao: string;
  dataNascimento: string;
  cpf: string;
  pisPasep?: string;
  rg?: string;
  salario: number;
  categoria: string;
  idadeStr: string;
  tempoEmpresaStr: string;
}

export interface InconsistenciaColaborador {
  id: string;
  loteId: string;
  cpf: string;
  nome: string;
  tipo: 'salario' | 'cargo' | 'outros';
  tipoDisplay: string;
  valorAnterior: string;
  valorAtual: string;
  justificativa: string;
  dataCriacao: string;
}

export interface CargoMapping {
  id: string;
  cargo: string;
  categoria?: 'ADMINISTRATIVO' | 'OPERACIONAL' | 'MOTORISTA';
  categoriaDisplay: string;
  dataCriacao: string;
  ultimaAtualizacao: string;
}

export interface ColaboradorPJ {
  id: string;
  nome: string;
  cpf: string;
  salario: number;
  filial: string;
  cargo: string;
  dataAdmissao?: string;
  dataNascimento?: string;
  ativo: boolean;
  dataCriacao: string;
}

export interface RHDashboardSummaryResponse {
  lote: LoteMovimentacaoRH | null;
  lotesDisponiveis: LoteMovimentacaoRH[];
  resumoFiliais: Array<{
    filial: string;
    total: number;
    payroll: number;
    mediaIdade: number;
    mediaTempo: number;
    novos: number;
    desligados: number;
  }>;
  novos: MovimentacaoColaborador[];
  desligados: MovimentacaoColaborador[];
  alteracoes: InconsistenciaColaborador[];
  totais: {
    totalColaboradores: number;
    admitidos: number;
    desligados: number;
    alteracoes: number;
    payroll: number;
    mediaIdade: number;
    mediaTempo: number;
  };
}

export interface RHComparisonData {
  nome: string;
  labels: string[];
  valores: number[];
}

export interface RHComparisonResponse {
  [cpf: string]: RHComparisonData;
}

// --- COMPRAS (Controle de Estoque) TYPES ---

export interface UnidadeMedida {
  id: string;
  nome: string;
}

export interface Setor {
  id: string;
  nome: string;
}

export interface ColaboradorCompras {
  id: string;
  nome: string;
}

export interface Fornecedor {
  id: string;
  nome: string;
}

export interface ItemEstoque {
  id: string;
  nome: string;
  unidade: string;
  qtdAtual: number;
  qtdMinima: number;
}

export interface EntradaEstoque {
  id: string;
  itemId: string | null;
  itemNome: string;
  data: string;
  quantidade: number;
  valorUnitario: number;
  fornecedorId: string | null;
  fornecedorNome: string;
}

export interface SaidaEstoque {
  id: string;
  itemId: string | null;
  itemNome: string;
  data: string;
  quantidade: number;
  setorId: string | null;
  setorNome: string;
  colaboradorId: string | null;
  colaboradorNome: string;
}

export interface RegistrarCompraPayload {
  data: string;
  fornecedorId: string;
  linhas: Array<{ itemId: string; quantidade: number; valorUnitario: number }>;
}

export interface RegistrarSaidaPayload {
  data: string;
  setorId: string;
  colaboradorId: string;
  linhas: Array<{ itemId: string; quantidade: number }>;
}

// --- FATURAMENTO (Protocolos de envio de NF) TYPES ---

export const PROTOCOLO_EXPEDICAO_OPTIONS = [
  'Transcamila Ibiporã',
  'Transcamila Barueri',
  'Transcamila Paranaguá',
  'Transcamila Rondonópolis',
] as const;

export type ProtocoloExpedicao = (typeof PROTOCOLO_EXPEDICAO_OPTIONS)[number];

/** Quantidade máxima de expedições que podem ser combinadas em um único protocolo. */
export const MAX_EXPEDICOES_POR_PROTOCOLO = 2;

export interface FilialClienteProtocolo {
  id: string;
  nome: string;
}

export interface ClienteProtocolo {
  id: string;
  nome: string;
  cnpj: string | null;
  requerExpedicao: boolean;
  exigeFilial: boolean;
  filiais: FilialClienteProtocolo[];
  emailsEnvio: string | null;
  emailsCopia: string | null;
  dataCriacao?: string;
}

export interface ProtocoloEnvio {
  id: string;
  protocoloNumero: string;
  data: string;
  clienteId?: string;
  clienteNome: string;
  clienteCnpj: string | null;
  notaFiscal: string;
  notasFiscais: string[];
  notasFiliais: Record<string, string>;
  /** Valor final combinado (ex.: "Transcamila Barueri/Ibiporã"), usado para exibição. */
  expedicao: string | null;
  /** Expedições selecionadas individualmente (até MAX_EXPEDICOES_POR_PROTOCOLO), para edição. */
  expedicoes: ProtocoloExpedicao[];
  usuarioNome: string;
  dataCriacao?: string;
  dataAtualizacao?: string;
}

export type ProtocoloOrdering = 'protocolo_asc' | 'protocolo_desc' | 'data_asc' | 'data_desc';

export interface ProtocoloQueryParams extends ListQueryParams {
  cliente?: string;
  data?: string;
  protocoloId?: string;
  notaFiscal?: string;
  usuario?: string;
  ordering?: ProtocoloOrdering;
}

export interface CreateProtocoloPayload {
  data: string;
  clienteId: string;
  notaFiscal: string;
  notasFiliais?: Record<string, string>;
  /** Até MAX_EXPEDICOES_POR_PROTOCOLO expedições selecionadas. */
  expedicoes?: ProtocoloExpedicao[];
}

export interface UpdateProtocoloPayload {
  data?: string;
  clienteId?: string;
  notaFiscal?: string;
  notasFiliais?: Record<string, string>;
  /** Até MAX_EXPEDICOES_POR_PROTOCOLO expedições selecionadas. */
  expedicoes?: ProtocoloExpedicao[];
}

export interface ClienteProtocoloPayload {
  nome: string;
  cnpj?: string | null;
  requerExpedicao?: boolean;
  exigeFilial?: boolean;
  emailsEnvio?: string | null;
  emailsCopia?: string | null;
  /** Usado apenas na criação: nomes de filiais a cadastrar junto com o cliente. */
  filiaisIniciais?: string[];
}

export interface ProtocoloImportIssue {
  label: string;
  message: string;
}

export interface ProtocoloImportResult {
  success: boolean;
  dryRun: boolean;
  fileName: string;
  clienteId: number;
  clienteNome: string;
  sheetName?: string;
  groupingMode?: 'grouped' | 'row_by_row';
  created: number;
  ignored: number;
  warnings: ProtocoloImportIssue[];
  errors: ProtocoloImportIssue[];
  detail?: string;
}

export interface ProtocoloImportParams {
  file: File;
  clienteId: string;
  dryRun?: boolean;
  skipDuplicatas?: boolean;
}

