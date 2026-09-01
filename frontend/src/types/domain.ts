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
  /** Abas de menu liberadas por ambiente (exceto Indicadores). Vazio no módulo = todas. */
  abas: Record<string, string[]>;
  googleEmail: string | null;
  googleLinkedAt: string | null;
  googlePicture: string | null;
  mustChangePassword: boolean;
}

export interface UserDirectoryEntry {
  id: string;
  name: string;
  googlePicture: string | null;
  googleEmail: string | null;
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

export interface MetaFaturamentoConfigMes {
  id: number | null;
  mes: number;
  nomeMes: string;
  valor: number;
}

export interface MetaFaturamentoConfigResponse {
  ano: number;
  meses: MetaFaturamentoConfigMes[];
  total: number;
  anosDisponiveis: number[];
}

export interface MetaFaturamentoConfigPayload {
  ano: number;
  meses: { mes: number; valor: number }[];
}

export interface CashAdjustment {
  id: number;
  date: string;
  type: string;
  value: number;
  observation: string;
  user: string;
}

/** Título individual dentro de um evento do calendário financeiro. */
export interface CalendarSystemTitulo {
  doc: string;
  filial: string;
  vencimento: string;
  valor: number;
}

/** Evento agregado (a pagar/receber) do calendário financeiro. */
export interface CalendarSystemEvent {
  type: 'pagar' | 'receber';
  date: string;
  title: string;
  fullTitle: string;
  amount: number;
  count: number;
  titulos: CalendarSystemTitulo[];
}

export interface CalendarSystemEventsResponse {
  batchLabel: string | null;
  events: Record<string, CalendarSystemEvent[]>;
}

/** Evento pessoal do calendário financeiro. */
export interface CalendarPersonalEvent {
  id: number;
  date: string;
  title: string;
  description: string;
  color: string;
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

/** Grupo de situação no indicador de RH: vazio = todos. */
export type RHIndicadorSituacaoGrupo = '' | 'AFASTADOS' | 'FERIAS' | 'SITUACAO_NORMAL';

export interface RHIndicadorQueryParams {
  start?: string;
  end?: string;
  filial?: string;
  categoria?: string;
  situacaoGrupo?: RHIndicadorSituacaoGrupo;
}

export interface RHIndicadorStatusBucket {
  count: number;
  payroll: number;
}

export interface RHIndicadorCategoriaBucket {
  count: number;
  payroll: number;
  percentual: number;
  ativos: RHIndicadorStatusBucket;
  afastados: RHIndicadorStatusBucket;
  ferias: RHIndicadorStatusBucket;
}

export interface RHIndicadorPorCategoria {
  administrativo: RHIndicadorCategoriaBucket;
  operacional: RHIndicadorCategoriaBucket;
  motorista: RHIndicadorCategoriaBucket;
  naoMapeado: RHIndicadorCategoriaBucket;
}

export interface RHIndicadorSeriePonto {
  mes: number;
  ano: number;
  label: string;
  headcount: number;
  payroll: number;
  admitidos: number;
  desligados: number;
  porCategoria: RHIndicadorPorCategoria;
}

export interface RHIndicadorLoteOption {
  mes: number;
  ano: number;
  label: string;
}

export interface RHIndicadorSummary {
  totalColaboradores: number;
  payrollTotal: number;
  salarioMedio: number;
  feriasAtual: number;
  admitidosPeriodo: number;
  desligadosPeriodo: number;
  turnoverPercentual: number;
  variacaoHeadcountPercentual: number | null;
  variacaoPayrollPercentual: number | null;
  porCategoriaAtual: RHIndicadorPorCategoria;
}

export interface RHIndicadorResponse {
  meta: {
    filiaisDisponiveis: string[];
    lotesDisponiveis: RHIndicadorLoteOption[];
    periodoInicio: string | null;
    periodoFim: string | null;
  };
  summary: RHIndicadorSummary;
  series: RHIndicadorSeriePonto[];
}

export interface MetaFaturamentoQueryParams {
  ano?: number;
  mes?: number;
}

export interface FrotaCustosIndicadorQueryParams {
  loteId?: number | null;
  filial?: string;
}

export interface FrotaCustosIndicadorLoteOption {
  id: number;
  label: string;
  periodoInicio: string | null;
  periodoFim: string | null;
  isActive: boolean;
}

export interface FrotaCustosIndicadorVeiculo {
  veiculoId: number;
  placa: string;
  placaExibicao: string;
  marca: string;
  modelo: string;
  filial: string;
  custoManutencao: number;
  custoAbastecimento: number;
  custoTotal: number;
  litragem: number;
  km: number | null;
  kmPorLitro: number | null;
  custoPorKm: number | null;
  percentualTotal: number;
}

export interface FrotaCustosManutencaoTipo {
  item: string;
  label: string;
  valor: number;
  quantidade: number;
  percentual: number;
}

export interface FrotaCustosIndicadorResponse {
  meta: {
    loteId: number | null;
    loteLabel: string;
    periodoInicio: string | null;
    periodoFim: string | null;
    filial: string | null;
    lotes: FrotaCustosIndicadorLoteOption[];
    filiaisDisponiveis: string[];
  };
  summary: {
    custoTotal: number;
    custoManutencao: number;
    custoAbastecimento: number;
    veiculosCount: number;
    mediaKmPorLitro: number | null;
    kmTotal: number | null;
    custoPorKm: number | null;
    litragemTotal: number;
  };
  veiculos: FrotaCustosIndicadorVeiculo[];
  manutencaoPorTipo: FrotaCustosManutencaoTipo[];
}

export interface MetaFaturamentoFilialBucket {
  filial: string;
  valor: number;
  percentual: number;
  isArmazem: boolean;
}

export interface MetaFaturamentoSerieMensal {
  mes: number;
  ano: number;
  label: string;
  nomeMes: string;
  meta: number;
  metaAcumulada: number;
  realizado: number;
  realizadoAcumulado: number;
  realizadoAnoAnterior: number;
  realizadoAnoAnteriorAcumulado: number;
  diasUteis: number;
  diasUteisDecorridos: number;
  metaDia: number;
  metaAteDia: number;
  realizadoAteDia: number;
  gapMetaMes: number;
  gapMetaAteDia: number;
  percentualVsMeta: number | null;
  percentualVsMetaAcumulada: number | null;
  variacaoAnoAnterior: number | null;
  metaSuperada: boolean;
  porFilial: MetaFaturamentoFilialBucket[];
  totalFretes: number;
  armazem: number;
}

export interface MetaFaturamentoSerieDiaria {
  data: string;
  dia: number;
  diaUtilAcumulado: number;
  isDiaUtil: boolean;
  ibipora: number;
  rondonopolis: number;
  barueri: number;
  paranagua: number;
  totalFretes: number;
  armazem: number;
  receitaDia: number;
  acumuladoMes: number;
  acumuladoMesAnoAnterior: number;
  /** META 01/jan até o dia (meses anteriores + meta/dia × dias úteis no mês). */
  metaAnoAteDia: number;
  realizadoAno: number;
  realizadoAnoAnteriorAcumulado: number;
  gapMetaAnoAteDia: number;
  percentualVsMetaAnoAteDia: number | null;
  observacao: string;
  acumuladoAno: number;
  metaAteDia: number;
  gapMetaAteDia: number;
  realizadoAnoAnterior: number;
  porFilial: MetaFaturamentoFilialBucket[];
}

export interface MetaFaturamentoDiarioTotais {
  ibipora: number;
  rondonopolis: number;
  barueri: number;
  paranagua: number;
  totalFretes: number;
  armazem: number;
  receitaDia: number;
  acumuladoMes: number;
  acumuladoMesAnoAnterior: number;
  metaAnoAteDia: number;
  realizadoAno: number;
  realizadoAnoAnteriorAcumulado: number;
  gapMetaAnoAteDia: number;
  percentualVsMetaAnoAteDia: number | null;
  observacao: string;
}

export interface MetaFaturamentoDiarioParticipacao {
  ibipora: number;
  rondonopolis: number;
  barueri: number;
  paranagua: number;
  totalFretes: number;
  armazem: number;
  variacaoMesAnoAnterior: number | null;
  variacaoAnoAnterior: number | null;
}

export interface MetaFaturamentoSerieDiariaPayload {
  dias: MetaFaturamentoSerieDiaria[];
  totais: MetaFaturamentoDiarioTotais | null;
  participacao: MetaFaturamentoDiarioParticipacao | null;
  metaMesesAnteriores: number;
  metaDia: number;
  diasUteis: number;
}

export interface MetaFaturamentoSummary {
  metaMes: number;
  realizadoMes: number;
  gapMetaMes: number;
  percentualVsMetaMes: number | null;
  metaSuperadaMes: boolean;
  diasUteis: number;
  diasUteisDecorridos: number;
  metaDia: number;
  metaAteDia: number;
  realizadoAteDia: number;
  gapMetaAteDia: number;
  metaAcumulada: number;
  realizadoAcumulado: number;
  gapMetaAcumulada: number;
  percentualVsMetaAcumulada: number | null;
  metaAno: number;
  percentualMetaAno: number;
  realizadoAnoAnterior: number;
  realizadoAnoAnteriorAcumulado: number;
  variacaoAnoAnterior: number | null;
  variacaoAnoAnteriorAcumulada: number | null;
  totalFretes: number;
  armazem: number;
  porFilial: MetaFaturamentoFilialBucket[];
}

export interface MetaFaturamentoResponse {
  meta: {
    ano: number;
    mes: number | null;
    mesReferencia: number;
    nomeMesReferencia: string;
    filiais: string[];
    anosDisponiveis: number[];
    temMetasCadastradas: boolean;
  };
  summary: MetaFaturamentoSummary;
  seriesMensal: MetaFaturamentoSerieMensal[];
  serieDiaria: MetaFaturamentoSerieDiariaPayload;
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
  dataDemissao?: string;
  dataNascimento?: string;
  ativo: boolean;
  dataCriacao: string;
}

export interface ColaboradorPJHistorico {
  id: string;
  pjId: string;
  ano: number;
  mes: number;
  salario: number;
  cargo?: string;
  filial?: string;
  dataCriacao: string;
}

export interface RHPaginatedSection<T> {
  results: T[];
  count: number;
}

export type RHMovimentacaoOrdering =
  | 'idade_asc' | 'idade_desc'
  | 'tempoEmpresa_asc' | 'tempoEmpresa_desc'
  | 'admissao_asc' | 'admissao_desc'
  | 'salario_asc' | 'salario_desc';

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
  novos: RHPaginatedSection<MovimentacaoColaborador>;
  desligados: RHPaginatedSection<MovimentacaoColaborador>;
  alteracoes: RHPaginatedSection<InconsistenciaColaborador>;
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
  colaboradoresCount?: number;
}

export interface ColaboradorCompras {
  id: string;
  nome: string;
  setorId: string;
  setorNome: string;
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

/** Quantidade máxima de notas fiscais por protocolo (paridade com o backend). */
export const MAX_NFS_POR_PROTOCOLO = 78;

export interface FilialClienteProtocolo {
  id: string;
  nome: string;
}

export interface ClienteProtocolo {
  id: string;
  codigo: string;
  loja: string;
  tipoPessoa: 'F' | 'J';
  nome: string;
  razaoSocial: string;
  nomeFantasia: string;
  nomeInterno: string;
  municipio: string;
  cnpj: string | null;
  padraoProtocolo: boolean;
  emitirProtocoloCanhotos: boolean;
  considerarPesquisaSatisfacao: boolean;
  requerExpedicao: boolean;
  exigeFilial: boolean;
  filiais: FilialClienteProtocolo[];
  emailsEnvio: string | null;
  emailsCopia: string | null;
  dataCriacao?: string;
  dataAtualizacao?: string;
}

export interface CnpjConsultaResult {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  municipio?: string;
}

export interface ProtocoloNotaDraft {
  nf: string;
  filial?: string;
}

/** Rascunho de novo protocolo — persistido por usuário na API. */
export interface ProtocoloEnvioDraft {
  version: number;
  updatedAt: string | null;
  hasDraft: boolean;
  data: string;
  clienteId: string;
  expedicoes: ProtocoloExpedicao[];
  notas: ProtocoloNotaDraft[];
  nfInput: string;
  filialInput: string;
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
  nome?: string;
  codigo?: string;
  loja?: string;
  tipoPessoa?: 'F' | 'J';
  razaoSocial?: string;
  nomeFantasia?: string;
  nomeInterno?: string;
  municipio?: string;
  cnpj?: string | null;
  padraoProtocolo?: boolean;
  emitirProtocoloCanhotos?: boolean;
  considerarPesquisaSatisfacao?: boolean;
  requerExpedicao?: boolean;
  exigeFilial?: boolean;
  emailsEnvio?: string | null;
  emailsCopia?: string | null;
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
}

// --- SGQ (Pesquisa de Satisfação) TYPES ---

export const SGQ_AVALIACAO_OPTIONS = [
  { value: 'otimo', label: 'Ótimo' },
  { value: 'bom', label: 'Bom' },
  { value: 'regular', label: 'Regular' },
  { value: 'ruim', label: 'Ruim' },
] as const;

export type SgqAvaliacao = (typeof SGQ_AVALIACAO_OPTIONS)[number]['value'];

export const SGQ_CLIENTE_FALLBACK = ['OUTROS'] as const;

export interface SgqClienteOption {
  value: string;
  label: string;
}

/** Critérios avaliados na pesquisa (chave camelCase da API → rótulo).
 * `shortLabel` é usado em colunas estreitas de tabela/grade (o rótulo completo fica no `title`). */
export const SGQ_CRITERIOS = [
  { key: 'prazoEntrega', label: 'Prazo de Entrega', shortLabel: 'Prazo', escopo: 'prazo_entrega' },
  { key: 'condicoesMercadoria', label: 'Condições da Mercadoria', shortLabel: 'Mercadoria', escopo: 'condicoes_mercadoria' },
  { key: 'condicoesVeiculo', label: 'Condições do Veículo', shortLabel: 'Veículo', escopo: 'condicoes_veiculo' },
  { key: 'apresentacaoMotorista', label: 'Apresentação do Motorista', shortLabel: 'Apresentação', escopo: 'apresentacao_motorista' },
  { key: 'atendimentoDispensado', label: 'Atendimento Dispensado', shortLabel: 'Atendimento', escopo: 'atendimento_dispensado' },
] as const;

export type SgqCriterioKey = (typeof SGQ_CRITERIOS)[number]['key'];
export type SgqEscopoAnalise = string;

export type SgqEscopoAnaliseGrupo = {
  escopo: string;
  label: string;
  opcoes: { value: string; label: string }[];
};

export const SGQ_ESCOPO_ANALISE_CATALOG: SgqEscopoAnaliseGrupo[] = [
  {
    escopo: 'prazo_entrega',
    label: 'Prazo de Entrega',
    opcoes: [
      { value: 'entregas_dentro_prazo_contratual', label: 'Entregas dentro do prazo contratual' },
      { value: 'cliente_recusou_informar_motivos', label: 'Cliente se recusou a informar os motivos' },
      { value: 'entregas_fora_prazo_contratual', label: 'Entregas fora do prazo contratual' },
      { value: 'motorista_recusou_ajudar_descarga', label: 'Motorista se recusou a ajudar na descarga' },
    ],
  },
  {
    escopo: 'condicoes_mercadoria',
    label: 'Condições da Mercadoria',
    opcoes: [
      { value: 'motorista_recusou_ajudar_descarga', label: 'Motorista se recusou a ajudar na descarga' },
      { value: 'embalagens_sujas', label: 'Embalagens sujas' },
      { value: 'embalagens_molhadas', label: 'Embalagens molhadas' },
      { value: 'embalagens_amassadas_ou_rasgadas', label: 'Embalagens amassadas ou rasgadas' },
      { value: 'produtos_tombaram_dos_pallets', label: 'Produtos tombaram dos pallets' },
      { value: 'pallets_mal_estrechados', label: 'Pallets mal estrechados' },
      { value: 'pallets_ma_qualidade_quebrados', label: 'Pallets de má qualidade — quebrados' },
      { value: 'pallets_tombaram', label: 'Pallets tombaram' },
      { value: 'produtos_com_vazamento', label: 'Produtos com vazamento' },
      { value: 'produtos_faltando', label: 'Produtos faltando' },
      { value: 'produtos_remontados_ou_empilhados', label: 'Produtos remontados ou empilhados' },
      { value: 'produtos_divergencia_lotes', label: 'Produtos com divergência de lotes' },
      { value: 'produtos_mal_acondicionados_veiculo', label: 'Produtos mal acondicionados no veículo' },
      { value: 'cliente_marcou_tudo_ruim', label: 'Cliente marcou tudo ruim devido aos problemas' },
    ],
  },
  {
    escopo: 'condicoes_veiculo',
    label: 'Condições do Veículo',
    opcoes: [
      { value: 'cliente_marcou_tudo_ruim', label: 'Cliente marcou tudo ruim devido aos problemas' },
      { value: 'dificuldade_abrir_carroceria', label: 'Dificuldade para abrir a carroceria' },
      { value: 'irritado_demora_abrir_bau', label: 'Estava irritado com a demora em abrir o baú' },
      { value: 'motorista_recusou_ajudar_descarga', label: 'Motorista se recusou a ajudar na descarga' },
      { value: 'problemas_carroceria', label: 'Problemas na carroceria' },
      { value: 'problemas_assoalho', label: 'Problemas no assoalho' },
      { value: 'problemas_fueiro_carreta', label: 'Problemas no fueiro da carreta' },
      { value: 'reclamacao_sider', label: 'Reclamação por sider' },
      { value: 'reclamacao_bau', label: 'Reclamação por baú' },
      { value: 'reclamacao_veiculo_bitrem', label: 'Reclamação por enviar veículo bitrem' },
      { value: 'reclamacao_veiculo_graneleiro', label: 'Reclamação por enviar veículo graneleiro' },
      { value: 'rua_apertada_dificuldade_manobrar', label: 'Rua apertada e dificuldade em manobrar o veículo' },
      { value: 'veiculo_sujo', label: 'Veículo sujo' },
    ],
  },
  {
    escopo: 'apresentacao_motorista',
    label: 'Apresentação do Motorista',
    opcoes: [
      { value: 'cliente_marcou_tudo_ruim', label: 'Cliente marcou tudo ruim devido aos problemas' },
      { value: 'motorista_chegou_horario_almoco', label: 'Motorista chegou perto do horário de almoço e não teve permissão para almoçar' },
      { value: 'motorista_precisou_falar_supervisor', label: 'Motorista precisou falar com supervisor para liberar' },
      { value: 'motorista_recusou_ajudar_descarga', label: 'Motorista se recusou a ajudar na descarga' },
      { value: 'outros', label: 'Outros' },
    ],
  },
  {
    escopo: 'atendimento_dispensado',
    label: 'Atendimento Dispensado',
    opcoes: [
      { value: 'cliente_marcou_tudo_ruim_pallets', label: 'Cliente marcou tudo ruim devido aos problemas nos pallets' },
      { value: 'motorista_recusou_ajudar_descarga', label: 'Motorista se recusou a ajudar na descarga' },
      { value: 'outros', label: 'Outros' },
    ],
  },
];

export type SgqEscopoAnaliseMap = Record<string, string[]>;

export interface SgqEscopoAnaliseOpcaoCadastro {
  id: string;
  escopoId: string;
  chave: string;
  label: string;
  ordem: number;
  ativo: boolean;
}

export interface SgqEscopoAnaliseCadastro {
  id: string;
  chave: string;
  label: string;
  ordem: number;
  ativo: boolean;
  opcoes: SgqEscopoAnaliseOpcaoCadastro[];
}

export function catalogFromSgqEscopos(items: SgqEscopoAnaliseCadastro[]): SgqEscopoAnaliseGrupo[] {
  return items
    .filter((item) => item.ativo)
    .map((item) => ({
      escopo: item.chave,
      label: item.label,
      opcoes: item.opcoes
        .filter((opcao) => opcao.ativo)
        .map((opcao) => ({ value: opcao.chave, label: opcao.label })),
    }))
    .filter((grupo) => grupo.opcoes.length > 0);
}

export function hasSgqEscopoOpcoes(map: SgqEscopoAnaliseMap | undefined | null): boolean {
  if (!map || typeof map !== 'object') return false;
  return Object.values(map).some((opcoes) => Array.isArray(opcoes) && opcoes.length > 0);
}

export function toggleSgqEscopoOpcao(
  map: SgqEscopoAnaliseMap,
  escopo: SgqEscopoAnalise,
  opcao: string,
): SgqEscopoAnaliseMap {
  const current = map[escopo] ?? [];
  const next = current.includes(opcao) ? current.filter((item) => item !== opcao) : [...current, opcao];
  const copy: SgqEscopoAnaliseMap = { ...map };
  if (next.length === 0) delete copy[escopo];
  else copy[escopo] = next;
  return copy;
}

export interface SgqPesquisaImportIssue {
  row: number;
  message: string;
}

export interface SgqPesquisaImportPreviewRow {
  row: number;
  valid: boolean;
  message?: string;
  dataEnvio: string;
  motorista: string;
  cte: string;
  dataEntrega: string;
  notaFiscal: string;
  cliente: string;
  prazoEntrega: string;
  condicoesMercadoria: string;
  condicoesVeiculo: string;
  apresentacaoMotorista: string;
  atendimentoDispensado: string;
  analise: string;
  escopoAnalise?: string | SgqEscopoAnaliseMap;
  clienteRecusouAssinar?: boolean;
}

export interface SgqPesquisaImportPreviewStats {
  processedRows: number;
  validRows: number;
  invalidRows: number;
  skippedEmptyRows: number;
  validRate: number;
  readyToImport: boolean;
  uniqueMotoristas: number;
  rowsWithAnalise: number;
  rowsClienteRecusou: number;
  duplicateRowCount: number;
  duplicateGroupCount: number;
  byCliente: { cliente: string; count: number }[];
  deliveryDateRange: { min: string; max: string };
  inclusionDateRange: { min: string; max: string };
  avaliacaoCounts: { label: string; count: number }[];
  errorSummary: { message: string; count: number }[];
  duplicateGroups: {
    cte: string;
    notaFiscal: string;
    dataEntrega: string;
    rows: number[];
    count: number;
  }[];
}

export interface SgqPesquisaImportPreview {
  success: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  skipped: number;
  rows: SgqPesquisaImportPreviewRow[];
  errors: SgqPesquisaImportIssue[];
  stats: SgqPesquisaImportPreviewStats;
  detail?: string;
}

export interface SgqPesquisaImportResult {
  success: boolean;
  dryRun: boolean;
  created: number;
  skipped: number;
  errors: SgqPesquisaImportIssue[];
  detail?: string;
  criadoPor?: string;
}

export interface SgqPesquisa {
  id: string;
  /** Filial da sessão em que a pesquisa foi lançada — atribuída pelo backend, não pelo cliente. */
  filial: string;
  motorista: string;
  cte: string;
  /** Data em que a pesquisa foi lançada no sistema — atribuída pelo backend. */
  dataInclusao: string | null;
  dataEntrega: string;
  notaFiscal: string;
  cliente: string;
  clienteLabel?: string;
  /** Quando true, os critérios abaixo ficam vazios — o cliente se recusou a avaliar a pesquisa. */
  clienteRecusouAssinar: boolean;
  prazoEntrega: SgqAvaliacao | '';
  condicoesMercadoria: SgqAvaliacao | '';
  condicoesVeiculo: SgqAvaliacao | '';
  apresentacaoMotorista: SgqAvaliacao | '';
  atendimentoDispensado: SgqAvaliacao | '';
  /** Campo único de observação — "Análise, Tratativa e Justificativa". */
  analise: string;
  /** Critério(s) e opções da análise — obrigatório quando `analise` tem texto. */
  escopoAnalise: SgqEscopoAnaliseMap;
  criadoPor: string;
}

export type SgqPesquisaPayload = Omit<SgqPesquisa, 'id' | 'criadoPor' | 'filial' | 'dataInclusao'>;

export interface SgqPesquisaQueryParams extends ListQueryParams {
  cliente?: string;
  motorista?: string;
  criadoPor?: string;
  avaliacao?: string;
  dataInicio?: string;
  dataFim?: string;
  ordering?:
    | 'data_asc'
    | 'data_desc'
    | 'data_entrega_asc'
    | 'data_entrega_desc'
    | 'data_inclusao_asc'
    | 'data_inclusao_desc';
}

export interface SgqCriterioStats {
  campo: string;
  label: string;
  otimo: number;
  bom: number;
  regular: number;
  ruim: number;
  /** Score médio na escala 1 (Ruim) a 4 (Ótimo). */
  score: number;
}

export interface SgqPesquisaStats {
  totalPesquisas: number;
  totalAvaliacoes: number;
  contagem: Record<SgqAvaliacao, number>;
  percentual: Record<SgqAvaliacao, number>;
  pontosAtencao: number;
  metaOtimo: number;
  criterios: SgqCriterioStats[];
}

export interface SendSgqResumoEmailParams {
  to: string[];
  cc?: string[];
  ano: number;
}

export interface SgqResumoAnosResponse {
  anos: number[];
  anoPadrao: number;
}

export interface SendSgqResumoEmailResponse {
  success: boolean;
  message: string;
}

export interface SgqSatisfacaoIndicadorQueryParams {
  filial?: string;
  motorista?: string;
  dataInicio?: string;
  dataFim?: string;
  cliente?: string;
  cte?: string;
  avaliacao?: string;
  page?: number;
  pageSize?: number;
}

export interface SgqSatisfacaoDetalhe {
  id: string;
  filial: string;
  dataEntrega: string | null;
  cliente: string;
  motorista: string;
  cte: string;
  notaFiscal: string;
  clienteRecusouAssinar: boolean;
  prazoEntrega: SgqAvaliacao | '';
  condicoesMercadoria: SgqAvaliacao | '';
  condicoesVeiculo: SgqAvaliacao | '';
  apresentacaoMotorista: SgqAvaliacao | '';
  atendimentoDispensado: SgqAvaliacao | '';
  analise: string;
  escopoAnaliseTexto: string;
}

export interface SgqSatisfacaoPorFilial {
  filial: string;
  totalPesquisas: number;
  totalAvaliacoes: number;
  percentualOtimo: number;
  pontosAtencao: number;
  scoreMedio: number | null;
  contagem: Record<SgqAvaliacao, number>;
}

export interface SgqSatisfacaoSerieMensal {
  mes: string;
  label: string;
  totalPesquisas: number;
  percentualOtimo: number;
  scoreMedio: number;
  contagem: Record<SgqAvaliacao, number>;
}

export interface SgqSatisfacaoRecorrenciaItem {
  chave: string;
  label: string;
  total: number;
}

export interface SgqSatisfacaoRecorrenciaEscopo {
  escopo: string;
  label: string;
  total: number;
  itens: SgqSatisfacaoRecorrenciaItem[];
}

/** Resposta do indicador de Satisfação dos Clientes (ambiente Indicadores). */
export interface SgqSatisfacaoIndicadorResponse extends SgqPesquisaStats {
  meta: {
    filiaisDisponiveis: string[];
    motoristasDisponiveis: string[];
    clientesDisponiveis: string[];
    anosDisponiveis: number[];
    filial: string | null;
  };
  scoreMedio: number | null;
  totalRecusas: number;
  porFilial: SgqSatisfacaoPorFilial[];
  serieMensal: SgqSatisfacaoSerieMensal[];
  recorrenciasEscopo: SgqSatisfacaoRecorrenciaEscopo[];
}

/** Erros de validação por linha, retornados pelo endpoint de inclusão em lote. */
export type SgqPesquisaBulkFieldErrors = Partial<Record<keyof SgqPesquisaPayload, string[]>>;
export type SgqPesquisaBulkErrors = Record<number, SgqPesquisaBulkFieldErrors>;

/** Linha do rascunho de inclusão em tabela (pode estar incompleta). */
export type SgqLoteDraftRow = {
  dataEntrega: string;
  cliente: string;
  motorista: string;
  cte: string;
  notaFiscal: string;
  clienteRecusouAssinar: boolean;
  prazoEntrega: SgqAvaliacao | '';
  condicoesMercadoria: SgqAvaliacao | '';
  condicoesVeiculo: SgqAvaliacao | '';
  apresentacaoMotorista: SgqAvaliacao | '';
  atendimentoDispensado: SgqAvaliacao | '';
  analise: string;
  escopoAnalise: SgqEscopoAnaliseMap;
};

/** Rascunho server-side — isolado por usuário autenticado + filial da sessão. */
export interface SgqLoteDraft {
  version: number;
  updatedAt: string | null;
  filial: string;
  hasDraft: boolean;
  rows: SgqLoteDraftRow[];
}

/** Rascunho do formulário de lançamento (uma pesquisa) — isolado do lote. */
export interface SgqFormDraft {
  version: number;
  updatedAt: string | null;
  filial: string;
  hasDraft: boolean;
  form: SgqLoteDraftRow;
}

// --- Marketing — Campanhas ---

export type CampanhaStatus = 'planejamento' | 'producao' | 'veiculacao' | 'concluida' | 'cancelada';
export type CampanhaCanal = 'evento' | 'transcamila_news' | 'instagram' | 'outro' | 'email';

export interface CampanhaMarketing {
  id: string;
  titulo: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  status: CampanhaStatus;
  canais: CampanhaCanal[];
  responsavel: string;
  responsavelUserId?: string | null;
  responsavelUser: UserDirectoryEntry | null;
  cor: string;
  ordemKanban: number;
  criadoPor: string;
  criadoPorUser: UserDirectoryEntry | null;
  dataCriacao: string;
  dataAtualizacao: string;
  comentariosCount: number;
  membrosCount: number;
  midiasCount: number;
  comentarios?: CampanhaComentario[];
  membros?: CampanhaMembro[];
  midias?: CampanhaMidia[];
}

export interface CampanhaComentario {
  id: string;
  texto: string;
  autor: UserDirectoryEntry | null;
  autorNome: string;
  mencoes: UserDirectoryEntry[];
  dataCriacao: string;
}

export interface CampanhaMembro {
  id: string;
  user: UserDirectoryEntry;
  adicionadoPor: UserDirectoryEntry | null;
  dataCriacao: string;
}

export type CampanhaMidiaKind = 'image' | 'video' | 'pdf' | 'folder' | 'other';

export interface CampanhaMidia {
  id: number;
  driveFileId: string;
  name: string;
  kind: CampanhaMidiaKind;
  mimeType: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  adicionadoPor: UserDirectoryEntry | null;
  dataCriacao: string;
}

export interface GoogleDriveStatus {
  googleLinked: boolean;
  hasDriveScope: boolean;
  needsGoogleLink: boolean;
}

export interface GoogleDriveItem {
  id: string;
  name: string;
  mimeType: string;
  kind: CampanhaMidiaKind;
  modifiedTime: string | null;
  size: number | null;
  webViewLink: string | null;
  thumbnailUrl: string | null;
  attachable: boolean;
  virtual?: boolean;
  driveId?: string | null;
}

export interface GoogleDriveBrowseResponse {
  folderId: string;
  driveId?: string | null;
  items: GoogleDriveItem[];
  nextPageToken: string | null;
}

export interface GoogleDriveBreadcrumb {
  id: string;
  name: string;
  driveId?: string | null;
}

export interface GoogleDriveDefaultFolder {
  folderId: string;
  driveId: string | null;
  breadcrumbs: GoogleDriveBreadcrumb[];
}

export type CampanhaPayload = {
  titulo: string;
  descricao?: string;
  dataInicio: string;
  dataFim: string;
  status?: CampanhaStatus;
  canais?: CampanhaCanal[];
  responsavel?: string;
  responsavelUserId?: string | null;
  cor?: string;
  ordemKanban?: number;
};

export type CampanhaQuadro = Record<Exclude<CampanhaStatus, 'cancelada'>, CampanhaMarketing[]>;

export const CAMPANHA_STATUS_LABEL: Record<CampanhaStatus, string> = {
  planejamento: 'Planejamento',
  producao: 'Produção',
  veiculacao: 'Aguardando',
  concluida: 'Publicado',
  cancelada: 'Cancelado',
};

export const CAMPANHA_CANAL_LABEL: Record<CampanhaCanal, string> = {
  evento: 'Evento',
  transcamila_news: 'Transcamila News',
  instagram: 'Instagram',
  outro: 'Outro',
  email: 'E-mail marketing',
};

export const CAMPANHA_CANAL_OPTIONS = Object.entries(CAMPANHA_CANAL_LABEL) as [CampanhaCanal, string][];

export function normalizeCampanhaCanais(value: unknown): CampanhaCanal[] {
  const allowed = new Set<CampanhaCanal>(CAMPANHA_CANAL_OPTIONS.map(([key]) => key));
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set<CampanhaCanal>();
  const result: CampanhaCanal[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const canal = item as CampanhaCanal;
    if (!allowed.has(canal) || seen.has(canal)) continue;
    seen.add(canal);
    result.push(canal);
  }
  return result;
}

export const CAMPANHA_KANBAN_COLUMNS: { key: Exclude<CampanhaStatus, 'cancelada'>; label: string; hint: string }[] = [
  { key: 'planejamento', label: 'Planejamento', hint: 'Pauta e ideias de post' },
  { key: 'producao', label: 'Produção', hint: 'Arte, texto e vídeo' },
  { key: 'veiculacao', label: 'Aguardando', hint: 'Pronto — aguardando publicação' },
  { key: 'concluida', label: 'Publicado', hint: 'Já foi ao ar' },
];

export const CAMPANHA_COR_OPTIONS: { key: string; label: string; hex: string }[] = [
  { key: 'azul', label: 'Azul', hex: '#118CC4' },
  { key: 'azul-escuro', label: 'Azul escuro', hex: '#0D709D' },
  { key: 'verde', label: 'Verde', hex: '#16a34a' },
  { key: 'ambar', label: 'Âmbar', hex: '#d97706' },
  { key: 'roxo', label: 'Roxo', hex: '#7c3aed' },
  { key: 'grafite', label: 'Grafite', hex: '#475569' },
];

export const campanhaCorHex = (key: string) =>
  CAMPANHA_COR_OPTIONS.find((c) => c.key === key)?.hex ?? '#118CC4';

export type VeiculoCategoria =
  | 'tanque'
  | 'teste'
  | 'toco'
  | 'trafic'
  | 'truck'
  | 'van'
  | 'van-01-eixos'
  | 'vuc';

export type VeiculoCombustivel =
  | 'arla-32'
  | 'diesel-bs-500'
  | 'diesel-bs-500-itapevi'
  | 'diesel-s10'
  | 'eletrica'
  | 'etanol'
  | 'flex'
  | 'gasolina';

export type VeiculoCarroceria =
  | 'bau'
  | 'bitrem'
  | 'carreta'
  | 'carroceria-fechada'
  | 'cavalo-mecanico'
  | 'dolly'
  | 'empilhadeira-eletrica'
  | 'empilhadeira-glp';

export type VeiculoStatus = 'ativo' | 'inativo';

export interface VeiculoFrota {
  id: string;
  placa: string;
  renavam: string;
  chassi: string;
  marca: string;
  modelo: string;
  anoFabricacao: number | null;
  anoModelo: number | null;
  cor: string;
  combustivel: VeiculoCombustivel;
  categoria: VeiculoCategoria;
  tipoCarroceria: VeiculoCarroceria;
  hodometro: number;
  status: VeiculoStatus;
  filial: string;
  observacoes: string;
  dataCriacao?: string;
  dataAtualizacao?: string;
}

export interface VeiculoFrotaPayload {
  placa: string;
  renavam?: string;
  chassi?: string;
  marca: string;
  modelo: string;
  anoFabricacao?: number | null;
  anoModelo?: number | null;
  cor?: string;
  combustivel: VeiculoCombustivel;
  categoria: VeiculoCategoria;
  tipoCarroceria: VeiculoCarroceria;
  hodometro?: number;
  status: VeiculoStatus;
  filial: string;
  observacoes?: string;
}

export const VEICULO_CATEGORIA_LABEL: Record<VeiculoCategoria, string> = {
  tanque: 'Tanque',
  teste: 'Teste',
  toco: 'Toco',
  trafic: 'Trafic',
  truck: 'Truck',
  van: 'Van',
  'van-01-eixos': 'Van 01 eixos',
  vuc: 'VUC',
};

export const VEICULO_COMBUSTIVEL_LABEL: Record<VeiculoCombustivel, string> = {
  'arla-32': 'Arla 32',
  'diesel-bs-500': 'Diesel BS 500',
  'diesel-bs-500-itapevi': 'Diesel BS 500 Itapevi',
  'diesel-s10': 'Diesel S-10',
  eletrica: 'Elétrica',
  etanol: 'Etanol',
  flex: 'Flex',
  gasolina: 'Gasolina',
};

export const VEICULO_CARROCERIA_LABEL: Record<VeiculoCarroceria, string> = {
  bau: 'Baú',
  bitrem: 'Bitrem',
  carreta: 'Carreta',
  'carroceria-fechada': 'Carroceria fechada',
  'cavalo-mecanico': 'Cavalo mecânico',
  dolly: 'Dolly',
  'empilhadeira-eletrica': 'Empilhadeira elétrica',
  'empilhadeira-glp': 'Empilhadeira GLP',
};

export const VEICULO_STATUS_LABEL: Record<VeiculoStatus, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
};

export const VEICULO_CATEGORIA_OPTIONS = Object.entries(VEICULO_CATEGORIA_LABEL) as [VeiculoCategoria, string][];
export const VEICULO_COMBUSTIVEL_OPTIONS = Object.entries(VEICULO_COMBUSTIVEL_LABEL) as [VeiculoCombustivel, string][];
export const VEICULO_CARROCERIA_OPTIONS = Object.entries(VEICULO_CARROCERIA_LABEL) as [VeiculoCarroceria, string][];
export const VEICULO_STATUS_OPTIONS = Object.entries(VEICULO_STATUS_LABEL) as [VeiculoStatus, string][];

export interface CondutorFrota {
  id: string;
  nome: string;
  cpf: string;
  filial: string;
  status: 'ativo' | 'inativo';
  dataCriacao?: string;
}

export interface CondutorFrotaPayload {
  nome: string;
  cpf?: string;
  filial: string;
  status?: 'ativo' | 'inativo';
}

export type CustoFrotaReportType = 'manutencao' | 'abastecimento';

export interface CustoFrotaLote {
  id: string;
  label: string;
  date: string;
  periodoInicio: string;
  periodoFim: string;
  updatedBy: string;
  importedReports: { manutencao: boolean; abastecimento: boolean };
  isActive: boolean;
}

export interface CustoFrotaLotesResponse {
  results: CustoFrotaLote[];
  maxBatches: number;
}

export interface CustoFrotaImportResult {
  type: CustoFrotaReportType;
  fileName: string;
  success: boolean;
  rowCount: number;
  skippedRows: number;
  issues: ImportIssue[];
  loteId?: string | null;
  loteLabel?: string | null;
  reusedLote?: boolean;
  periodoInicio?: string | null;
  periodoFim?: string | null;
}

export interface CustoManutencaoRow {
  id: string;
  placa: string;
  grupo: string;
  item: string;
  valorMaterial: number;
  valorServicos: number;
  valorTotal: number;
}

export interface CustoAbastecimentoRow {
  id: string;
  placa: string;
  transacao: string;
  data: string;
  hora: string;
  estabelecimento: string;
  cidade: string;
  motorista: string;
  hodometro: number | null;
  kmTrecho: number | null;
  litragem: number | null;
  combustivel: string;
  valorTotal: number;
  numeroNfe: string;
}

