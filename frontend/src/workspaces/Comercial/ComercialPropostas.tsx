import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  getComercialErrorMessage,
  bumpPropostaDraftGen,
  useClientesComercial,
  useComercialGeneralidades,
  useComercialParametros,
  useCreatePropostaComercial,
  useDeletePropostaComercial,
  useDeletePropostaComercialDraft,
  usePropostaComercialDraft,
  usePropostasComerciais,
  useSavePropostaComercialDraft,
  useTabelaFreteDistribuicaoCliente,
  usePreviewDistribuicaoProposta,
  useUpdatePropostaComercial,
} from '../../hooks/useComercialClientes';
import type {
  PropostaComercial,
  PropostaComercialFormDraft,
  PropostaComercialOrdering,
  PropostaComercialPayload,
  PropostaComercialStatus,
  PropostaComercialTipo,
  PropostaCondicaoComercial,
  PropostaMargemVeiculo,
  PropostaOperacaoAba,
  PropostaTabelaDistribuicaoSnapshot,
  TabelaArmazenagem,
} from '../../types/domain';
import {
  cloneTabelaArmazenagem,
  CONDICOES_FRETE_PADRAO,
  PROPOSTA_COMERCIAL_STATUS_LABEL,
  PROPOSTA_COMERCIAL_TIPO_LABEL,
  marcarCondicoesTipo,
  propostaIncluiArmazenagem,
  propostasEnviaveisPorEmail,
  rotuloNumeroProposta,
  separarCondicoesProposta,
  tabelaArmazenagemProntaParaSalvar,
  tipoPropostaDasOperacoes,
} from '../../types/domain';
import { printPropostaComercial } from './printPropostaComercial';
import { isGrisAdvUnificado } from './formatTabelaFrete';
import ComercialPropostaEmailModal from './ComercialPropostaEmailModal';
import PropostaCondicoesEspeciais from './PropostaCondicoesEspeciais';
import PropostaGeneralidadesRevisao from './PropostaGeneralidadesRevisao';
import PropostaTabelaArmazenagem from './PropostaTabelaArmazenagem';
import PropostaTabelaDistribuicao from './PropostaTabelaDistribuicao';
import PropostaTrechosOperacao, { formatMoneyInput } from './PropostaTrechosOperacao';

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

type PropostaSortField = 'data_criacao' | 'vencimento';

function nextPropostaOrdering(
  field: PropostaSortField,
  current: PropostaComercialOrdering,
): PropostaComercialOrdering {
  const asc = `${field}_asc` as PropostaComercialOrdering;
  const desc = `${field}_desc` as PropostaComercialOrdering;
  return current === asc ? desc : asc;
}

function PropostaSortIcon({ field, ordering }: { field: PropostaSortField; ordering: PropostaComercialOrdering }) {
  const isActive = ordering.startsWith(field);
  const isAsc = ordering === `${field}_asc`;
  return (
    <span className="comercial-sort-icon" aria-hidden>
      <i className="bi bi-caret-up-fill" style={{ color: isActive && isAsc ? '#0f85c1' : '#c8d3e0' }} />
      <i className="bi bi-caret-down-fill" style={{ color: isActive && !isAsc ? '#0f85c1' : '#c8d3e0' }} />
    </span>
  );
}

const todayISO = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const formatDateBr = (value?: string | null) => {
  if (!value) return '—';
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const parseMoney = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw || raw === '-' || raw === '—') return null;
  const limpo = raw
    .replace(/R\$\s?/gi, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  if (!limpo) return null;
  const amount = Number(limpo);
  return Number.isNaN(amount) ? null : amount;
};

const moneyOrEmpty = (value: string) => {
  const amount = parseMoney(value);
  return amount == null ? null : amount.toFixed(2);
};

type LinhaForm = {
  origem: string;
  entrega: string;
  veiculo: string;
  veiculoKey?: string;
  modalidade?: string;
  km?: string;
  devolucaoContainer: string;
  observacoes: string;
  peso: string;
  tarifaFrete: string;
  pedagio: string;
  retiradaCtnt: string;
  desovaCtnt: string;
  adValorem: string;
  gris: string;
  icms: string;
  prazoDias: string;
};

type PropostaForm = {
  tipo: PropostaComercialTipo;
  status: PropostaComercialStatus;
  clienteId: string;
  clienteNome: string;
  titulo: string;
  subtitulo: string;
  revisao: string;
  dataProposta: string;
  propostaReferente: string;
  responsavel: string;
  reajuste: string;
  att: string;
  validade: string;
  vigencia: string;
  faturamento: string;
  localEmissao: string;
  valorEstimado: string;
  observacoes: string;
  incluiTransferencia: boolean;
  incluiDistribuicao: boolean;
  incluiArmazenagem: boolean;
  incluiOpPortuaria: boolean;
  margensVeiculo: PropostaMargemVeiculo[];
  condicoes: PropostaCondicaoComercial[];
  condicoesTransferencia: PropostaCondicaoComercial[];
  condicoesDistribuicao: PropostaCondicaoComercial[];
  tabelaArmazenagem: TabelaArmazenagem;
  linhas: LinhaForm[];
};

const MENSAGEM_DESTINOS_OBRIGATORIOS = 'Preencha origem, destino, veículo, km e prazo para Transferência / Logística Retroportuária.';
const MENSAGEM_TARIFAS_ARMAZENAGEM = 'Informe o valor de cada tarifa de armazenagem ou coloque um traço (-).';
const MENSAGEM_OPERACAO_OBRIGATORIA = 'Selecione o tipo de operação (Transferência, Distribuição ou Logística Retroportuária).';
const MENSAGEM_SERVICO_OBRIGATORIO = 'Selecione o tipo de serviço.';

type OperacaoTransporte = 'transferencia' | 'distribuicao' | 'portuaria';

type FlagsOperacao = Pick<
  PropostaForm,
  'incluiTransferencia' | 'incluiDistribuicao' | 'incluiArmazenagem' | 'incluiOpPortuaria'
>;

const flagsExclusivos = (
  tipo: PropostaComercialTipo,
  operacao: OperacaoTransporte | null,
): FlagsOperacao => {
  if (tipo === 'armazenagem') {
    return {
      incluiTransferencia: false,
      incluiDistribuicao: false,
      incluiOpPortuaria: false,
      incluiArmazenagem: true,
    };
  }
  return {
    incluiTransferencia: operacao === 'transferencia',
    incluiDistribuicao: operacao === 'distribuicao',
    incluiOpPortuaria: operacao === 'portuaria',
    incluiArmazenagem: false,
  };
};

/** Prioridade para propostas antigas com mais de um flag. */
const operacaoFromFlags = (flags: FlagsOperacao): OperacaoTransporte | null => {
  if (flags.incluiTransferencia) return 'transferencia';
  if (flags.incluiDistribuicao) return 'distribuicao';
  if (flags.incluiOpPortuaria) return 'portuaria';
  return null;
};

const normalizarFlagsExclusivos = (
  tipo: PropostaComercialTipo,
  flags: FlagsOperacao,
): FlagsOperacao => {
  if (tipo === 'armazenagem' || (
    !flags.incluiTransferencia
    && !flags.incluiDistribuicao
    && !flags.incluiOpPortuaria
    && flags.incluiArmazenagem
  )) {
    return flagsExclusivos('armazenagem', null);
  }
  return flagsExclusivos('transporte_rodoviario', operacaoFromFlags(flags));
};

const linhaDestinoVazia = (linha: LinhaForm) =>
  ![linha.origem, linha.entrega, linha.veiculo, linha.km ?? '', linha.tarifaFrete, linha.pedagio, linha.adValorem, linha.prazoDias]
    .some((valor) => valor.trim());

const linhaDestinoPreenchida = (linha: LinhaForm) =>
  Boolean(
    linha.origem.trim()
    && linha.entrega.trim()
    && linha.veiculo.trim()
    && (linha.km ?? '').trim()
    && linha.tarifaFrete.trim()
    && linha.prazoDias.trim(),
  );

const destinosProntosParaSalvar = (form: PropostaForm) => {
  if (!form.incluiTransferencia && !form.incluiOpPortuaria) return true;
  const relevantes = form.linhas.filter((linha) => !linhaDestinoVazia(linha));
  return relevantes.length > 0 && relevantes.every(linhaDestinoPreenchida);
};

const emptyLinha = (modalidade = 'transferencia'): LinhaForm => ({
  origem: '',
  entrega: '',
  veiculo: 'Truck',
  veiculoKey: 'de9000',
  modalidade,
  km: '',
  devolucaoContainer: '',
  observacoes: '',
  peso: '',
  tarifaFrete: '',
  pedagio: '',
  retiradaCtnt: '',
  desovaCtnt: '',
  adValorem: '',
  gris: '',
  icms: '',
  prazoDias: '',
});

const emptyForm = (
  condicoes?: PropostaCondicaoComercial[],
  padroes?: { validade?: string; vigencia?: string; faturamento?: string },
): PropostaForm => ({
  tipo: 'transporte_rodoviario',
  status: 'rascunho',
  clienteId: '',
  clienteNome: '',
  titulo: '',
  subtitulo: '',
  revisao: '',
  dataProposta: todayISO(),
  propostaReferente: '',
  responsavel: '',
  reajuste: 'Anual com base no índice INCT',
  att: '',
  validade: padroes?.validade || VALIDADE_PADRAO_FALLBACK,
  vigencia: padroes?.vigencia || VIGENCIA_PADRAO_FALLBACK,
  faturamento: padroes?.faturamento || FATURAMENTO_PADRAO_FALLBACK,
  localEmissao: 'Maringá',
  valorEstimado: '',
  observacoes: '',
  incluiTransferencia: false,
  incluiDistribuicao: false,
  incluiArmazenagem: false,
  incluiOpPortuaria: false,
  margensVeiculo: [],
  condicoes: (condicoes?.length ? condicoes : CONDICOES_FRETE_PADRAO).map((item) => ({ ...item })),
  condicoesTransferencia: [],
  condicoesDistribuicao: [],
  tabelaArmazenagem: cloneTabelaArmazenagem(),
  linhas: [emptyLinha()],
});

const formatDraftTime = (iso: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formFromDraft = (
  draftForm: PropostaComercialFormDraft['form'],
  fallback: PropostaForm,
): PropostaForm => {
  const linhasFonte = draftForm.linhas?.length ? draftForm.linhas : fallback.linhas;
  const linhas = linhasFonte.map((linha) => ({
    origem: linha.origem ?? '',
    entrega: linha.entrega ?? '',
    veiculo: linha.veiculo ?? '',
    veiculoKey: linha.veiculoKey ?? '',
    modalidade: linha.modalidade ?? 'transferencia',
    km: linha.km ?? '',
    devolucaoContainer: linha.devolucaoContainer ?? '',
    observacoes: linha.observacoes ?? '',
    peso: linha.peso ?? '',
    tarifaFrete: linha.tarifaFrete?.trim() ? formatMoneyInput(linha.tarifaFrete) : '',
    pedagio: linha.pedagio?.trim() ? formatMoneyInput(linha.pedagio) : '',
    retiradaCtnt: linha.retiradaCtnt?.trim() ? formatMoneyInput(linha.retiradaCtnt) : '',
    desovaCtnt: linha.desovaCtnt?.trim() ? formatMoneyInput(linha.desovaCtnt) : '',
    adValorem: linha.adValorem ?? '',
    gris: linha.gris ?? '',
    icms: linha.icms ?? '',
    prazoDias: linha.prazoDias ?? '',
  }));
  return {
    ...fallback,
    tipo: draftForm.tipo === 'armazenagem' ? 'armazenagem' : 'transporte_rodoviario',
    status: draftForm.status || fallback.status,
    clienteId: draftForm.clienteId || '',
    clienteNome: draftForm.clienteNome || '',
    titulo: draftForm.titulo || '',
    subtitulo: draftForm.subtitulo || '',
    revisao: (!draftForm.revisao || draftForm.revisao === '01') ? '' : draftForm.revisao,
    dataProposta: draftForm.dataProposta || fallback.dataProposta,
    propostaReferente: draftForm.propostaReferente || '',
    responsavel: draftForm.responsavel || fallback.responsavel,
    reajuste: draftForm.reajuste || fallback.reajuste,
    att: draftForm.att || '',
    validade: draftForm.validade || fallback.validade,
    vigencia: draftForm.vigencia || fallback.vigencia,
    faturamento: draftForm.faturamento || fallback.faturamento,
    localEmissao: draftForm.localEmissao || fallback.localEmissao,
    valorEstimado: draftForm.valorEstimado || '',
    observacoes: draftForm.observacoes || '',
    ...normalizarFlagsExclusivos(
      draftForm.tipo === 'armazenagem' ? 'armazenagem' : 'transporte_rodoviario',
      {
        incluiTransferencia: Boolean(draftForm.incluiTransferencia),
        incluiDistribuicao: Boolean(draftForm.incluiDistribuicao),
        incluiArmazenagem: Boolean(draftForm.incluiArmazenagem) || draftForm.tipo === 'armazenagem',
        incluiOpPortuaria: Boolean(draftForm.incluiOpPortuaria),
      },
    ),
    margensVeiculo: Array.isArray(draftForm.margensVeiculo) ? draftForm.margensVeiculo : [],
    condicoes: (draftForm.condicoes?.length ? draftForm.condicoes : fallback.condicoes).map((item) => ({ ...item })),
    condicoesTransferencia: (draftForm.condicoesTransferencia ?? []).map((item) => ({ ...item })),
    condicoesDistribuicao: (draftForm.condicoesDistribuicao ?? []).map((item) => ({ ...item })),
    tabelaArmazenagem: cloneTabelaArmazenagem(draftForm.tabelaArmazenagem),
    linhas: linhas.length ? linhas : [emptyLinha()],
  };
};

const condicoesDoFormulario = (form: PropostaForm): PropostaCondicaoComercial[] => {
  const items: PropostaCondicaoComercial[] = [];
  if (form.incluiDistribuicao) {
    items.push(...marcarCondicoesTipo(
      form.condicoesDistribuicao.filter((item) => item.rotulo.trim() || item.valor.trim()),
      'distribuicao',
    ));
  }
  if (form.incluiTransferencia) {
    items.push(...marcarCondicoesTipo(
      form.condicoesTransferencia.filter((item) => item.rotulo.trim() || item.valor.trim()),
      'frete',
    ));
  }
  if (form.incluiOpPortuaria) {
    items.push(...marcarCondicoesTipo(
      form.condicoesTransferencia.filter((item) => item.rotulo.trim() || item.valor.trim()),
      'op_portuaria',
    ));
  }
  if (form.incluiArmazenagem) {
    items.push(...marcarCondicoesTipo(
      form.condicoes.filter((item) => item.rotulo.trim() || item.valor.trim()),
      'armazenagem',
    ));
  }
  return items;
};

const primeiraAbaOperacao = (form: Pick<PropostaForm, 'incluiTransferencia' | 'incluiDistribuicao' | 'incluiArmazenagem' | 'incluiOpPortuaria'>): PropostaOperacaoAba => {
  if (form.incluiTransferencia) return 'transferencia';
  if (form.incluiDistribuicao) return 'distribuicao';
  if (form.incluiOpPortuaria) return 'portuaria';
  if (form.incluiArmazenagem) return 'armazenagem';
  return 'transferencia';
};

const abaDoDraft = (aba?: string): PropostaOperacaoAba => (
  aba === 'distribuicao' || aba === 'armazenagem' || aba === 'portuaria' ? aba : 'transferencia'
);

const linhaTotal = (linha: LinhaForm) => {
  const tarifa = parseMoney(linha.tarifaFrete);
  const pedagio = parseMoney(linha.pedagio);
  const retirada = parseMoney(linha.retiradaCtnt);
  const desova = parseMoney(linha.desovaCtnt);
  if (tarifa == null && pedagio == null && retirada == null && desova == null) return null;
  return (tarifa ?? 0) + (pedagio ?? 0) + (retirada ?? 0) + (desova ?? 0);
};

const SERVICO_OPTIONS: Array<{ value: PropostaComercialTipo; icon: string }> = [
  { value: 'transporte_rodoviario', icon: 'bi-truck' },
  { value: 'armazenagem', icon: 'bi-buildings' },
];

const iconForServico = (tipo: PropostaComercialTipo) => (
  SERVICO_OPTIONS.find((option) => option.value === tipo)?.icon ?? 'bi-truck'
);

const ServicoSelect: React.FC<{
  value: PropostaComercialTipo;
  disabled?: boolean;
  onChange: (tipo: PropostaComercialTipo) => void;
}> = ({ value, disabled, onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="proposta-servico-select" ref={rootRef}>
      <button
        type="button"
        className="proposta-servico-trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((atual) => !atual)}
      >
        <i className={`bi ${iconForServico(value)}`} aria-hidden="true" />
        <span>{PROPOSTA_COMERCIAL_TIPO_LABEL[value]}</span>
        <i className="bi bi-chevron-down" aria-hidden="true" />
      </button>
      {open ? (
        <ul className="proposta-servico-menu" role="listbox">
          {SERVICO_OPTIONS.map((option) => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                className={option.value === value ? 'is-selected' : undefined}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <i className={`bi ${option.icon}`} aria-hidden="true" />
                <span>{PROPOSTA_COMERCIAL_TIPO_LABEL[option.value]}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

const VALIDADE_OPTIONS_FALLBACK = ['5 dias', '7 dias', '15 dias', '30 dias', '45 dias', '60 dias'];
const VIGENCIA_OPTIONS_FALLBACK = ['3 meses', '6 meses', '12 meses', '24 meses', '36 meses', 'Indeterminada'];
const FATURAMENTO_OPTIONS_FALLBACK = [
  'Semanal',
  'Quinzenal',
  'Mensal',
  'Semanal / 15 DDL',
  'Semanal / 30 DDL',
  'Quinzenal / 30 DDL',
  'Mensal / 30 DDL',
  '15 DDL',
  '30 DDL',
  '45 DDL',
];
const VALIDADE_PADRAO_FALLBACK = '30 dias';
const VIGENCIA_PADRAO_FALLBACK = '12 meses';
const FATURAMENTO_PADRAO_FALLBACK = 'Semanal / 30 DDL';

const optionsWithCurrent = (options: string[], current: string) => (
  current && !options.includes(current) ? [current, ...options] : options
);

const STATUS_BADGE_CLASS: Record<PropostaComercialStatus, string> = {
  rascunho: 'is-rascunho',
  enviada: 'is-enviada',
  aprovada: 'is-aprovada',
  recusada: 'is-recusada',
};

const IncludeField: React.FC<{
  label: string;
  required?: boolean;
  counter?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, required, counter, className, children }) => (
  <label className={`proposta-include-field${className ? ` ${className}` : ''}`}>
    <span className="proposta-include-label">
      {label}{required ? '*' : ''}
    </span>
    {children}
    {counter ? <span className="proposta-include-counter">{counter}</span> : null}
  </label>
);

const ComercialPropostas: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = userHasFuncao(user, 'Comercial', 'gerenciar-propostas');
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<'todos' | PropostaComercialTipo>('todos');
  const [filterStatus, setFilterStatus] = useState<'todos' | PropostaComercialStatus>('todos');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [ordering, setOrdering] = useState<PropostaComercialOrdering>('data_criacao_desc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PropostaForm>(emptyForm);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [emailPropostas, setEmailPropostas] = useState<PropostaComercial[]>([]);
  const [abaOperacao, setAbaOperacao] = useState<PropostaOperacaoAba>('transferencia');
  const [snapshotDistribuicao, setSnapshotDistribuicao] = useState<PropostaTabelaDistribuicaoSnapshot | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(true);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [draftUnavailable, setDraftUnavailable] = useState(false);
  const skipNextDraftSave = useRef(true);
  const suppressDraftSave = useRef(false);

  const propostasQuery = usePropostasComerciais({
    page,
    pageSize,
    search: search.trim() || undefined,
    tipo: filterTipo === 'todos' ? undefined : filterTipo,
    status: filterStatus === 'todos' ? undefined : filterStatus,
    ordering,
  });
  const { canShowEmpty } = useAsyncQueryState(propostasQuery);
  const clientesQuery = useClientesComercial({ page: 1, pageSize: 100, ativos: true });
  const parametrosQuery = useComercialParametros();
  const validadeOptions = parametrosQuery.data?.validades?.length
    ? parametrosQuery.data.validades
    : VALIDADE_OPTIONS_FALLBACK;
  const vigenciaOptions = parametrosQuery.data?.vigencias?.length
    ? parametrosQuery.data.vigencias
    : VIGENCIA_OPTIONS_FALLBACK;
  const faturamentoOptions = parametrosQuery.data?.prazosFaturamento?.length
    ? parametrosQuery.data.prazosFaturamento
    : FATURAMENTO_OPTIONS_FALLBACK;
  const validadePadrao = parametrosQuery.data?.validadePadrao || VALIDADE_PADRAO_FALLBACK;
  const vigenciaPadrao = parametrosQuery.data?.vigenciaPadrao || VIGENCIA_PADRAO_FALLBACK;
  const faturamentoPadrao = parametrosQuery.data?.faturamentoPadrao || FATURAMENTO_PADRAO_FALLBACK;
  const formPadroes = { validade: validadePadrao, vigencia: vigenciaPadrao, faturamento: faturamentoPadrao };
  const generalidadesTransferencia = useComercialGeneralidades(
    isModalOpen && form.clienteId && form.incluiTransferencia
      ? form.clienteId
      : null,
    'frete',
  );
  const generalidadesOpPortuaria = useComercialGeneralidades(
    isModalOpen && form.clienteId && form.incluiOpPortuaria
      ? form.clienteId
      : null,
    'op_portuaria',
  );
  const generalidadesDistribuicao = useComercialGeneralidades(
    isModalOpen && form.clienteId && form.incluiDistribuicao ? form.clienteId : null,
    'distribuicao',
  );
  const generalidadesArmazenagem = useComercialGeneralidades(
    isModalOpen && !editingId && form.incluiArmazenagem ? (form.clienteId || null) : null,
    'armazenagem',
  );
  const tabelaDistribuicaoCliente = useTabelaFreteDistribuicaoCliente(
    isModalOpen ? (form.clienteId || null) : null,
    isModalOpen && Boolean(form.clienteId),
  );
  const createProposta = useCreatePropostaComercial();
  const updateProposta = useUpdatePropostaComercial();
  const previewDistribuicao = usePreviewDistribuicaoProposta();
  const deleteProposta = useDeletePropostaComercial();
  const draftQuery = usePropostaComercialDraft(canManage);
  const saveDraft = useSavePropostaComercialDraft();
  const deleteDraft = useDeletePropostaComercialDraft();
  const hasFormDraft = Boolean(draftQuery.data?.hasDraft);

  const propostas = propostasQuery.data?.results ?? [];
  const totalCount = propostasQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const clientes = clientesQuery.data?.results ?? [];
  const temTabelaFrete = (tabelaDistribuicaoCliente.listQuery.data?.results.length ?? 0) > 0;
  const tabelaFretePronta = !form.clienteId || tabelaDistribuicaoCliente.listQuery.isFetched;
  const podeUsarTabelaFrete = Boolean(form.clienteId) && tabelaFretePronta && temTabelaFrete;
  const MENSAGEM_TABELA_FRETE = form.clienteId
    ? 'Vincule uma tabela de frete vigente a este cliente para criar proposta de Transferência, Distribuição ou Logística Retroportuária.'
    : 'Selecione o cliente e vincule uma tabela de frete para habilitar as operações de transporte.';
  const selectedPropostas = useMemo(
    () => propostas.filter((item) => selectedIds.includes(item.id)),
    [propostas, selectedIds],
  );
  const isAllSelected = propostas.length > 0 && propostas.every((item) => selectedIds.includes(item.id));
  const catalogoTransferenciaRef = useRef('');
  const catalogoDistribuicaoRef = useRef('');
  const catalogoArmazenagemRef = useRef('');
  const nomeUsuarioLogado = (user?.name || user?.username || '').trim();
  const responsavelDoCliente = (clienteId: string) =>
    (clientes.find((item) => item.id === clienteId)?.responsavel || '').trim();

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.reports-dropdown-wrapper')) {
        setIsActionsMenuOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    if (!isModalOpen) {
      catalogoTransferenciaRef.current = '';
      catalogoDistribuicaoRef.current = '';
      catalogoArmazenagemRef.current = '';
      return;
    }
    if (form.incluiArmazenagem && !editingId && form.clienteId && generalidadesArmazenagem.isSuccess) {
      const chave = `${form.clienteId}:armazenagem`;
      if (catalogoArmazenagemRef.current !== chave) {
        catalogoArmazenagemRef.current = chave;
        const condicoes = (generalidadesArmazenagem.data?.items.length
          ? generalidadesArmazenagem.data.items
          : CONDICOES_FRETE_PADRAO).map((item) => ({ ...item, tipo: 'armazenagem' as const }));
        setForm((current) => (
          current.condicoes.length > 0 ? current : { ...current, condicoes }
        ));
      }
    }
    if (!form.clienteId) return;
    if (form.incluiTransferencia && generalidadesTransferencia.isSuccess) {
      const chave = `${editingId ?? 'novo'}:${form.clienteId}:frete`;
      if (catalogoTransferenciaRef.current !== chave) {
        catalogoTransferenciaRef.current = chave;
        const items = (generalidadesTransferencia.data?.items ?? []).map((item) => ({ ...item, tipo: 'frete' as const }));
        setForm((current) => (
          current.condicoesTransferencia.length > 0
            ? current
            : { ...current, condicoesTransferencia: items }
        ));
      }
    }
    if (form.incluiOpPortuaria && generalidadesOpPortuaria.isSuccess) {
      const chave = `${editingId ?? 'novo'}:${form.clienteId}:op_portuaria`;
      if (catalogoTransferenciaRef.current !== chave) {
        catalogoTransferenciaRef.current = chave;
        const items = (generalidadesOpPortuaria.data?.items ?? []).map((item) => ({ ...item, tipo: 'op_portuaria' as const }));
        setForm((current) => (
          current.condicoesTransferencia.length > 0
            ? current
            : { ...current, condicoesTransferencia: items }
        ));
      }
    }
    if (form.incluiDistribuicao && generalidadesDistribuicao.isSuccess) {
      const chave = `${editingId ?? 'novo'}:${form.clienteId}:distribuicao`;
      if (catalogoDistribuicaoRef.current !== chave) {
        catalogoDistribuicaoRef.current = chave;
        const items = (generalidadesDistribuicao.data?.items ?? []).map((item) => ({ ...item, tipo: 'distribuicao' as const }));
        setForm((current) => (
          current.condicoesDistribuicao.length > 0
            ? current
            : { ...current, condicoesDistribuicao: items }
        ));
      }
    }
  }, [
    editingId,
    form.clienteId,
    form.incluiArmazenagem,
    form.incluiDistribuicao,
    form.incluiOpPortuaria,
    form.incluiTransferencia,
    generalidadesArmazenagem.data?.items,
    generalidadesArmazenagem.isSuccess,
    generalidadesDistribuicao.data?.items,
    generalidadesDistribuicao.isSuccess,
    generalidadesOpPortuaria.data?.items,
    generalidadesOpPortuaria.isSuccess,
    generalidadesTransferencia.data?.items,
    generalidadesTransferencia.isSuccess,
    isModalOpen,
  ]);

  useEffect(() => {
    if (!isModalOpen || editingId || draftHydrated || draftQuery.isLoading) return;
    if (draftQuery.isError) {
      setDraftUnavailable(true);
      setDraftHydrated(true);
      skipNextDraftSave.current = true;
      return;
    }
    const draft = draftQuery.data;
    if (draft?.hasDraft) {
      const restaurado = formFromDraft(draft.form, { ...emptyForm(undefined, formPadroes), responsavel: nomeUsuarioLogado });
      setForm(restaurado);
      setAbaOperacao(abaDoDraft(draft.abaOperacao));
      setDraftUpdatedAt(draft.updatedAt);
      setRestoredDraft(true);
      setDraftUnavailable(false);
      if (restaurado.clienteId) {
        if (restaurado.condicoes.length) {
          catalogoArmazenagemRef.current = `${restaurado.clienteId}:armazenagem`;
        }
        if (restaurado.condicoesTransferencia.length) {
          catalogoTransferenciaRef.current = `novo:${restaurado.clienteId}:frete`;
        }
        if (restaurado.condicoesDistribuicao.length) {
          catalogoDistribuicaoRef.current = `novo:${restaurado.clienteId}:distribuicao`;
        }
      }
    }
    setDraftHydrated(true);
    skipNextDraftSave.current = true;
  }, [draftHydrated, draftQuery.data, draftQuery.isError, draftQuery.isLoading, editingId, isModalOpen, nomeUsuarioLogado]);

  useEffect(() => {
    if (!isModalOpen || editingId || !draftHydrated || draftUnavailable || !canManage) return;
    if (suppressDraftSave.current || createProposta.isPending || deleteDraft.isPending) return;
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      if (suppressDraftSave.current) return;
      saveDraft.mutate(
        { abaOperacao, form },
        {
          onSuccess: (result) => {
            if (suppressDraftSave.current) return;
            setDraftUpdatedAt(result.hasDraft ? result.updatedAt : null);
            if (!result.hasDraft) setRestoredDraft(false);
            setDraftUnavailable(false);
          },
          onError: () => {
            if (!suppressDraftSave.current) setDraftUnavailable(true);
          },
        },
      );
    }, 500);
    return () => window.clearTimeout(timer);
  }, [abaOperacao, canManage, createProposta.isPending, deleteDraft.isPending, draftHydrated, draftUnavailable, editingId, form, isModalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    setSelectedIds([]);
  };

  const handleSort = (field: PropostaSortField) => {
    setOrdering((current) => nextPropostaOrdering(field, current));
    goToPage(1);
  };

  const subtotalGeral = form.linhas.reduce((acc, linha) => acc + (linhaTotal(linha) ?? 0), 0);

  const openNew = () => {
    setEditingId(null);
    setAbaOperacao('transferencia');
    setForm({ ...emptyForm(undefined, formPadroes), responsavel: nomeUsuarioLogado });
    setDraftHydrated(false);
    setRestoredDraft(false);
    setDraftUpdatedAt(null);
    setDraftUnavailable(false);
    skipNextDraftSave.current = true;
    suppressDraftSave.current = false;
    setIsModalOpen(true);
  };

  const startEdit = (proposta: PropostaComercial) => {
    setEditingId(proposta.id);
    const tipo: PropostaComercialTipo = proposta.tipo === 'armazenagem' ? 'armazenagem' : 'transporte_rodoviario';
    const flags = normalizarFlagsExclusivos(tipo, {
      incluiTransferencia: proposta.incluiTransferencia,
      incluiDistribuicao: proposta.incluiDistribuicao,
      incluiArmazenagem: propostaIncluiArmazenagem(proposta),
      incluiOpPortuaria: Boolean(proposta.incluiOpPortuaria),
    });
    setForm({
      tipo,
      status: proposta.status,
      clienteId: proposta.clienteId ?? '',
      clienteNome: clientes.find((item) => item.id === proposta.clienteId)?.razaoSocial || proposta.clienteNome,
      titulo: proposta.titulo,
      subtitulo: proposta.subtitulo,
      revisao: proposta.revisao || '',
      dataProposta: proposta.dataProposta ?? todayISO(),
      propostaReferente: proposta.propostaReferente,
      responsavel: proposta.responsavel || nomeUsuarioLogado,
      reajuste: proposta.reajuste || 'Anual com base no índice INCT',
      att: responsavelDoCliente(proposta.clienteId ?? '') || proposta.att,
      validade: proposta.validade || validadePadrao,
      vigencia: proposta.vigencia || vigenciaPadrao,
      faturamento: proposta.faturamento || faturamentoPadrao,
      localEmissao: proposta.localEmissao,
      valorEstimado: proposta.valorEstimado ?? '',
      observacoes: proposta.observacoes,
      ...flags,
      margensVeiculo: proposta.margensVeiculo ?? [],
      condicoes: separarCondicoesProposta(
        proposta.condicoes,
        'armazenagem',
        [],
        Boolean(flags.incluiArmazenagem),
      ),
      condicoesTransferencia: separarCondicoesProposta(
        proposta.condicoes,
        flags.incluiOpPortuaria ? 'op_portuaria' : 'frete',
        [],
        Boolean(flags.incluiTransferencia || flags.incluiOpPortuaria),
      ),
      condicoesDistribuicao: separarCondicoesProposta(
        proposta.condicoes,
        'distribuicao',
        [],
        Boolean(flags.incluiDistribuicao),
      ),
      tabelaArmazenagem: cloneTabelaArmazenagem(proposta.tabelaArmazenagem),
      linhas: proposta.linhas.length
        ? proposta.linhas.map((linha) => ({
            origem: linha.origem,
            entrega: linha.entrega,
            veiculo: linha.veiculo ?? '',
            veiculoKey: linha.veiculoKey ?? '',
            modalidade: linha.modalidade ?? 'transferencia',
            km: linha.km ?? '',
            devolucaoContainer: linha.devolucaoContainer,
            observacoes: linha.observacoes,
            peso: linha.peso,
            tarifaFrete: linha.tarifaFrete?.trim() ? formatMoneyInput(linha.tarifaFrete) : '',
            pedagio: linha.pedagio?.trim() ? formatMoneyInput(linha.pedagio) : '',
            retiradaCtnt: linha.retiradaCtnt?.trim() ? formatMoneyInput(linha.retiradaCtnt) : '',
            desovaCtnt: linha.desovaCtnt?.trim() ? formatMoneyInput(linha.desovaCtnt) : '',
            adValorem: linha.adValorem,
            gris: linha.gris,
            icms: linha.icms,
            prazoDias: linha.prazoDias,
          }))
        : [emptyLinha(flags.incluiOpPortuaria ? 'op_portuaria' : 'transferencia')],
    });
    setAbaOperacao(primeiraAbaOperacao(flags));
    setDraftHydrated(true);
    setRestoredDraft(false);
    setDraftUpdatedAt(null);
    setDraftUnavailable(false);
    skipNextDraftSave.current = true;
    suppressDraftSave.current = true;
    setSnapshotDistribuicao(proposta.tabelaDistribuicao ?? null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setSnapshotDistribuicao(null);
    setForm(emptyForm(undefined, formPadroes));
    setDraftHydrated(true);
    setRestoredDraft(false);
    setDraftUpdatedAt(null);
    setDraftUnavailable(false);
  };

  const updateLinha = (index: number, patch: Partial<LinhaForm>) => {
    setForm((current) => ({
      ...current,
      linhas: current.linhas.map((linha, i) => (i === index ? { ...linha, ...patch } : linha)),
    }));
  };

  const setTipoServico = (tipo: PropostaComercialTipo) => {
    if (tipo === 'armazenagem') {
      const flags = flagsExclusivos('armazenagem', null);
      setForm((current) => ({
        ...current,
        tipo: 'armazenagem',
        ...flags,
        linhas: [emptyLinha()],
        tabelaArmazenagem: cloneTabelaArmazenagem(current.tabelaArmazenagem),
      }));
      catalogoArmazenagemRef.current = '';
      setAbaOperacao('armazenagem');
      return;
    }
    setForm((current) => ({
      ...current,
      tipo: 'transporte_rodoviario',
      ...flagsExclusivos('transporte_rodoviario', null),
      linhas: [emptyLinha('transferencia')],
    }));
    catalogoTransferenciaRef.current = '';
    catalogoDistribuicaoRef.current = '';
    setAbaOperacao('transferencia');
  };

  const setOperacaoTransporte = (operacao: OperacaoTransporte) => {
    if (!podeUsarTabelaFrete) return;
    const flags = flagsExclusivos('transporte_rodoviario', operacao);
    setForm((current) => {
      let linhas = current.linhas;
      if (operacao === 'transferencia') {
        const transf = linhas.filter((linha) => (linha.modalidade || 'transferencia') !== 'op_portuaria');
        linhas = transf.length ? transf.map((linha) => ({ ...linha, modalidade: 'transferencia' })) : [emptyLinha('transferencia')];
      } else if (operacao === 'portuaria') {
        const port = linhas.filter((linha) => linha.modalidade === 'op_portuaria');
        linhas = port.length ? port : [emptyLinha('op_portuaria')];
      } else {
        linhas = [emptyLinha('transferencia')];
      }
      return {
        ...current,
        tipo: 'transporte_rodoviario',
        ...flags,
        linhas,
      };
    });
    if (operacao === 'transferencia') catalogoTransferenciaRef.current = '';
    if (operacao === 'distribuicao') catalogoDistribuicaoRef.current = '';
    setAbaOperacao(
      operacao === 'transferencia'
        ? 'transferencia'
        : operacao === 'distribuicao'
          ? 'distribuicao'
          : 'portuaria',
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clienteId) {
      alert('Selecione o cliente.');
      return;
    }
    if (form.tipo === 'transporte_rodoviario'
      && !form.incluiTransferencia
      && !form.incluiDistribuicao
      && !form.incluiOpPortuaria) {
      alert(MENSAGEM_OPERACAO_OBRIGATORIA);
      return;
    }
    if (form.tipo === 'armazenagem' && !form.incluiArmazenagem) {
      alert(MENSAGEM_SERVICO_OBRIGATORIO);
      return;
    }
    const flags = normalizarFlagsExclusivos(form.tipo, form);
    const tipo = tipoPropostaDasOperacoes(flags);
    if (
      (flags.incluiTransferencia || flags.incluiDistribuicao || flags.incluiOpPortuaria)
      && !podeUsarTabelaFrete
    ) {
      alert(MENSAGEM_TABELA_FRETE);
      return;
    }
    if (!destinosProntosParaSalvar({ ...form, ...flags })) {
      alert(MENSAGEM_DESTINOS_OBRIGATORIOS);
      return;
    }
    if (flags.incluiArmazenagem && !tabelaArmazenagemProntaParaSalvar(form.tabelaArmazenagem)) {
      alert(MENSAGEM_TARIFAS_ARMAZENAGEM);
      return;
    }
    const titulo = form.titulo.trim()
      || `${PROPOSTA_COMERCIAL_TIPO_LABEL[tipo]}${form.clienteNome.trim() ? ` — ${form.clienteNome.trim()}` : ''}`;
    const payload: PropostaComercialPayload = {
      tipo,
      status: form.status,
      clienteId: form.clienteId,
      clienteNome: form.clienteNome.trim(),
      titulo,
      subtitulo: form.subtitulo.trim(),
      revisao: form.revisao.trim(),
      dataProposta: form.dataProposta || null,
      propostaReferente: form.propostaReferente.trim(),
      responsavel: form.responsavel.trim(),
      reajuste: form.reajuste.trim(),
      att: form.att.trim(),
      validade: form.validade.trim(),
      vigencia: form.vigencia.trim(),
      faturamento: form.faturamento.trim(),
      localEmissao: form.localEmissao.trim(),
      valorEstimado: (flags.incluiTransferencia || flags.incluiOpPortuaria)
        ? (subtotalGeral ? subtotalGeral.toFixed(2) : moneyOrEmpty(form.valorEstimado))
        : moneyOrEmpty(form.valorEstimado),
      observacoes: form.observacoes.trim(),
      incluiTransferencia: flags.incluiTransferencia,
      incluiDistribuicao: flags.incluiDistribuicao,
      incluiArmazenagem: flags.incluiArmazenagem,
      incluiOpPortuaria: flags.incluiOpPortuaria,
      margensVeiculo: form.margensVeiculo,
      condicoes: condicoesDoFormulario({ ...form, ...flags }),
      tabelaArmazenagem: flags.incluiArmazenagem ? cloneTabelaArmazenagem(form.tabelaArmazenagem) : undefined,
      linhas: (flags.incluiTransferencia || flags.incluiOpPortuaria)
        ? form.linhas.filter((linha) => !linhaDestinoVazia(linha)).map((linha, ordem) => ({
            ordem,
            origem: linha.origem.trim(),
            entrega: linha.entrega.trim(),
            veiculo: linha.veiculo.trim(),
            veiculoKey: linha.veiculoKey || '',
            modalidade: flags.incluiOpPortuaria ? 'op_portuaria' : (linha.modalidade || 'transferencia'),
            km: (linha.km || '').trim(),
            devolucaoContainer: linha.devolucaoContainer.trim(),
            observacoes: linha.observacoes.trim(),
            peso: linha.peso.trim(),
            tarifaFrete: moneyOrEmpty(linha.tarifaFrete),
            pedagio: moneyOrEmpty(linha.pedagio),
            retiradaCtnt: moneyOrEmpty(linha.retiradaCtnt),
            desovaCtnt: moneyOrEmpty(linha.desovaCtnt),
            adValorem: linha.adValorem.trim(),
            gris: linha.gris.trim(),
            icms: linha.icms.trim(),
            prazoDias: linha.prazoDias.trim(),
          }))
        : [],
    };
    if (!editingId) {
      suppressDraftSave.current = true;
      skipNextDraftSave.current = true;
      bumpPropostaDraftGen(queryClient);
    }
    const callbacks = {
      onSuccess: () => {
        if (editingId) {
          closeModal();
          return;
        }
        deleteDraft.mutate(undefined, { onSettled: () => closeModal() });
      },
      onError: (err: unknown) => {
        if (!editingId) suppressDraftSave.current = false;
        alert(getComercialErrorMessage(err));
      },
    };
    editingId
      ? updateProposta.mutate({ id: editingId, payload }, callbacks)
      : createProposta.mutate(payload, callbacks);
  };

  const clienteDaProposta = (proposta: PropostaComercial) =>
    clientes.find((cliente) => cliente.id === proposta.clienteId) ?? null;

  const numeroProposta = editingId
    ? (propostas.find((item) => item.id === editingId)?.numeroIdentificacao ?? '')
    : '';

  const snapshotDoFormulario = (): PropostaComercial => ({
    id: editingId ?? 'rascunho',
    numeroIdentificacao: numeroProposta,
    tipo: tipoPropostaDasOperacoes(form),
    status: form.status,
    clienteId: form.clienteId || null,
    clienteNome: form.clienteNome,
    titulo: form.titulo,
    subtitulo: form.subtitulo,
    revisao: form.revisao,
    dataProposta: form.dataProposta || todayISO(),
    propostaReferente: form.propostaReferente,
    responsavel: form.responsavel,
    reajuste: form.reajuste,
    att: form.att,
    validade: form.validade,
    vigencia: form.vigencia,
    faturamento: form.faturamento,
    localEmissao: form.localEmissao,
    valorEstimado: form.valorEstimado || null,
    observacoes: form.observacoes,
    incluiTransferencia: form.incluiTransferencia,
    incluiDistribuicao: form.incluiDistribuicao,
    incluiArmazenagem: form.incluiArmazenagem,
    incluiOpPortuaria: form.incluiOpPortuaria,
    margensVeiculo: form.margensVeiculo,
    tabelaDistribuicao: snapshotDistribuicao,
    historicoRevisoes: editingId
      ? (propostas.find((item) => item.id === editingId)?.historicoRevisoes ?? [])
      : [],
    modoEnvio: editingId
      ? (propostas.find((item) => item.id === editingId)?.modoEnvio ?? '')
      : '',
    condicoes: condicoesDoFormulario(form),
    tabelaArmazenagem: cloneTabelaArmazenagem(form.tabelaArmazenagem),
    linhas: form.linhas.map((linha, ordem) => ({
      ordem,
      origem: linha.origem,
      entrega: linha.entrega,
      veiculo: linha.veiculo,
      veiculoKey: linha.veiculoKey || '',
      modalidade: linha.modalidade || 'transferencia',
      km: linha.km || '',
      devolucaoContainer: linha.devolucaoContainer,
      observacoes: linha.observacoes,
      peso: linha.peso,
      tarifaFrete: moneyOrEmpty(linha.tarifaFrete),
      pedagio: moneyOrEmpty(linha.pedagio),
      retiradaCtnt: moneyOrEmpty(linha.retiradaCtnt),
      desovaCtnt: moneyOrEmpty(linha.desovaCtnt),
      adValorem: linha.adValorem,
      gris: linha.gris,
      icms: linha.icms,
      prazoDias: linha.prazoDias,
      totalEstimado: linhaTotal(linha)?.toFixed(2) ?? null,
    })),
    dataCriacao: todayISO(),
    dataVencimento: null,
  });

  const handlePrint = (proposta: PropostaComercial) => {
    void printPropostaComercial(proposta, clienteDaProposta(proposta), { cargo: user?.cargo });
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? propostas.map((item) => item.id) : []);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((item) => item !== id)));
  };

  const handleEditSelected = () => {
    const proposta = selectedPropostas[0];
    if (!proposta) return;
    setIsActionsMenuOpen(false);
    startEdit(proposta);
  };

  const handlePrintSelected = () => {
    const proposta = selectedPropostas[0];
    if (!proposta) return;
    setIsActionsMenuOpen(false);
    handlePrint(proposta);
  };

  const handleEmailSelected = () => {
    const envio = propostasEnviaveisPorEmail(selectedPropostas);
    setIsActionsMenuOpen(false);
    if (!envio.ok) {
      alert(envio.motivo);
      return;
    }
    setEmailPropostas(selectedPropostas);
  };

  const discardDraft = () => {
    if (!window.confirm('Descartar o rascunho desta proposta? Os dados salvos na sua conta serão apagados.')) return;
    suppressDraftSave.current = true;
    skipNextDraftSave.current = true;
    deleteDraft.mutate(undefined, {
      onSuccess: () => closeModal(),
      onError: (err) => {
        suppressDraftSave.current = false;
        alert(getComercialErrorMessage(err) || 'Não foi possível descartar o rascunho.');
      },
    });
  };

  const handleDeleteSelected = async () => {
    if (!canManage || selectedPropostas.length === 0) return;
    setIsActionsMenuOpen(false);
    const label = selectedPropostas.length === 1
      ? `Excluir a proposta ${selectedPropostas[0].numeroIdentificacao || selectedPropostas[0].titulo}?`
      : `Excluir ${selectedPropostas.length} propostas?`;
    if (!window.confirm(label)) return;
    try {
      await Promise.all(selectedPropostas.map((item) => deleteProposta.mutateAsync(item.id)));
      if (editingId && selectedIds.includes(editingId)) closeModal();
      setSelectedIds([]);
    } catch (err) {
      alert(getComercialErrorMessage(err));
    }
  };

  const isPending = createProposta.isPending || updateProposta.isPending || deleteDraft.isPending;
  const formIsLoading = Boolean(
    isModalOpen && (
      (!editingId && (!draftHydrated || draftQuery.isFetching))
      || saveDraft.isPending
      || isPending
      || generalidadesTransferencia.isFetching
      || generalidadesOpPortuaria.isFetching
      || generalidadesDistribuicao.isFetching
      || generalidadesArmazenagem.isFetching
      || tabelaDistribuicaoCliente.listQuery.isFetching
      || tabelaDistribuicaoCliente.detalheQuery.isFetching
    ),
  );
  const destinosOk = destinosProntosParaSalvar(form);
  const armazenagemOk = !form.incluiArmazenagem || tabelaArmazenagemProntaParaSalvar(form.tabelaArmazenagem);
  const temOperacao = form.incluiTransferencia || form.incluiDistribuicao || form.incluiArmazenagem || form.incluiOpPortuaria;
  const operacaoFreteOk = !(
    form.incluiTransferencia || form.incluiDistribuicao || form.incluiOpPortuaria
  ) || podeUsarTabelaFrete;
  /** Em rascunho ou após enviada: edita tudo. Situação Enviada só pelo e-mail. */
  const jaEnviada = Boolean(editingId) && form.status !== 'rascunho';
  const canEdit = canManage;
  const canEditSituacao = canManage && form.status !== 'rascunho';
  const canSave = canManage
    && (canEdit || canEditSituacao)
    && Boolean(form.clienteId)
    && temOperacao
    && operacaoFreteOk
    && destinosOk
    && armazenagemOk
    && !isPending;

  return (
    <div className="fat-list-compact" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 4px 4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Propostas comerciais</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="reports-dropdown-wrapper">
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={selectedIds.length === 0}
              onClick={() => setIsActionsMenuOpen((open) => !open)}
            >
              <span>Ações{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}</span>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`reports-dropdown-menu ${isActionsMenuOpen ? 'show' : ''}`}>
              {selectedPropostas.length <= 2 && (
                <>
                  {selectedPropostas.length === 1 && (
                    <>
                  <span className="reports-dropdown-item" onClick={handlePrintSelected}>
                    <span className="reports-dropdown-item-left">
                      <i className="bi bi-printer" />
                      Imprimir
                    </span>
                  </span>
                  <span className="reports-dropdown-item" onClick={handleEditSelected}>
                    <span className="reports-dropdown-item-left">
                      <i className="bi bi-pencil" />
                      Editar
                    </span>
                  </span>
                    </>
                  )}
                  <span className="reports-dropdown-item" onClick={handleEmailSelected}>
                    <span className="reports-dropdown-item-left">
                      <i className="bi bi-envelope" />
                      Enviar e-mail
                    </span>
                  </span>
                </>
              )}
              {canManage && selectedPropostas.length > 0 && (
                <span className="reports-dropdown-item is-danger" onClick={() => { void handleDeleteSelected(); }}>
                  <span className="reports-dropdown-item-left">
                    <i className="bi bi-trash" />
                    Excluir
                  </span>
                </span>
              )}
            </div>
          </div>
          {canManage && (
            hasFormDraft ? (
              <button
                type="button"
                className="reports-action-btn primary"
                style={{ backgroundColor: '#118CC4', borderColor: '#118CC4', display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}
                onClick={openNew}
                title="Continuar rascunho da proposta"
              >
                <i className="bi bi-journal-text" aria-hidden="true" />
                <span>Rascunho</span>
              </button>
            ) : (
              <button
                type="button"
                className="reports-action-btn primary"
                style={{ backgroundColor: '#118CC4', borderColor: '#118CC4', display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}
                onClick={openNew}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Nova proposta</span>
              </button>
            )
          )}
        </div>
      </header>

      <div className="reports-filters-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
        <div className="reports-filter-left" style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="reports-search-wrapper" style={{ minWidth: '240px' }}>
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input
              type="text"
              placeholder="Número, título ou cliente..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); goToPage(1); }}
            />
          </div>
          <div className="reports-select-wrapper" style={{ minWidth: '160px' }}>
            <select value={filterTipo} onChange={(e) => { setFilterTipo(e.target.value as 'todos' | PropostaComercialTipo); goToPage(1); }}>
              <option value="todos">Serviço: Todos</option>
              <option value="transporte_rodoviario">Transporte rodoviário</option>
              <option value="armazenagem">Armazenagem</option>
            </select>
          </div>
          <div className="reports-select-wrapper" style={{ minWidth: '160px' }}>
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value as 'todos' | PropostaComercialStatus); goToPage(1); }}>
              <option value="todos">Status: Todos</option>
              <option value="rascunho">Rascunho</option>
              <option value="enviada">Enviada</option>
              <option value="aprovada">Aceita</option>
              <option value="recusada">Recusada</option>
            </select>
          </div>
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{totalCount}</strong> Propostas</span>
        </div>
      </div>

      <QueryDataPanel
        query={propostasQuery}
        refreshVariant="overlay"
        loadingMessage="Carregando propostas..."
        refreshingMessage="Atualizando propostas..."
        errorMessage="Não foi possível carregar as propostas. Tente novamente."
      >
        <div className="erp-card reports-table-card comercial-propostas-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="erp-table reports-table comercial-browse-table comercial-propostas-table">
              <colgroup>
                <col className="col-check" />
                <col className="col-num" />
                <col className="col-date" />
                <col className="col-cliente" />
                <col className="col-servico" />
                <col className="col-validade" />
                <col className="col-vigencia" />
                <col className="col-status" />
                <col className="col-venc" />
              </colgroup>
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input type="checkbox" checked={isAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} style={{ borderRadius: '4px' }} />
                  </th>
                  <th>Nº</th>
                  <th
                    className="is-sortable"
                    onClick={() => handleSort('data_criacao')}
                    title="Classificar por data de criação"
                  >
                    Data de criação <PropostaSortIcon field="data_criacao" ordering={ordering} />
                  </th>
                  <th>Cliente</th>
                  <th>Serviço</th>
                  <th>Validade da proposta</th>
                  <th>Vigência do contrato</th>
                  <th>Situação</th>
                  <th
                    className="is-sortable"
                    onClick={() => handleSort('vencimento')}
                    title="Classificar por vencimento"
                  >
                    Vencimento <PropostaSortIcon field="vencimento" ordering={ordering} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && propostas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="comercial-browse-empty">
                      Não há registros a serem exibidos.
                    </td>
                  </tr>
                ) : (
                  propostas.map((proposta) => (
                    <tr key={proposta.id}>
                      <td className="checkbox-cell">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(proposta.id)}
                          onChange={(e) => handleSelectRow(proposta.id, e.target.checked)}
                          style={{ borderRadius: '4px' }}
                        />
                      </td>
                      <td>{rotuloNumeroProposta(proposta.numeroIdentificacao, proposta.revisao)}</td>
                      <td>{formatDateBr(proposta.dataCriacao)}</td>
                      <td>{clienteDaProposta(proposta)?.razaoSocial || proposta.clienteNome || '—'}</td>
                      <td>
                        <span className="proposta-servico-cell">
                          <i className={`bi ${iconForServico(proposta.tipo)}`} aria-hidden="true" />
                          <span>
                            {PROPOSTA_COMERCIAL_TIPO_LABEL[proposta.tipo]}
                            {proposta.tipo === 'transporte_rodoviario' ? (
                              <span className="proposta-servico-operacao">
                                {proposta.incluiTransferencia
                                  ? ' · Transferência'
                                  : proposta.incluiDistribuicao
                                    ? ' · Distribuição'
                                    : proposta.incluiOpPortuaria
                                      ? ' · Logística Retroportuária'
                                      : ''}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </td>
                      <td>{proposta.validade || '—'}</td>
                      <td>{proposta.vigencia || '—'}</td>
                      <td>
                        <span className={`proposta-status-badge ${STATUS_BADGE_CLASS[proposta.status]}`}>
                          {PROPOSTA_COMERCIAL_STATUS_LABEL[proposta.status]}
                        </span>
                      </td>
                      <td>{formatDateBr(proposta.dataVencimento)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-pagination-bar">
          <div className="erp-pagination-page-size">
            <label htmlFor="comercial-propostas-page-size">Itens por página</label>
            <select id="comercial-propostas-page-size" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); goToPage(1); }}>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <span style={{ fontWeight: 500, marginRight: '4px' }}>
            Página <span className="erp-pagination-current">{clampedPage}</span> de{' '}
            <span className="erp-pagination-current">{totalPages}</span>
            <span className="erp-pagination-meta">({totalCount} registros)</span>
          </span>
          <button type="button" className="reports-action-btn secondary" disabled={clampedPage <= 1} onClick={() => goToPage(1)} style={{ height: '32px', width: '32px', padding: 0, opacity: clampedPage <= 1 ? 0.5 : 1 }}>«</button>
          <button type="button" className="reports-action-btn secondary" disabled={clampedPage <= 1} onClick={() => goToPage(clampedPage - 1)} style={{ height: '32px', padding: '0 12px', opacity: clampedPage <= 1 ? 0.5 : 1 }}>Anterior</button>
          <button type="button" className="reports-action-btn secondary" disabled={clampedPage >= totalPages} onClick={() => goToPage(clampedPage + 1)} style={{ height: '32px', padding: '0 12px', opacity: clampedPage >= totalPages ? 0.5 : 1 }}>Próximo</button>
          <button type="button" className="reports-action-btn secondary" disabled={clampedPage >= totalPages} onClick={() => goToPage(totalPages)} style={{ height: '32px', width: '32px', padding: 0, opacity: clampedPage >= totalPages ? 0.5 : 1 }}>»</button>
        </div>
      </QueryDataPanel>

      {isModalOpen && !editingId && !draftHydrated ? (
        <div className="search-backdrop proposta-include-backdrop">
          <div className="proposta-include-modal" role="status" aria-live="polite" style={{ minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {formIsLoading ? (
              <div className="proposta-include-progress" role="progressbar" aria-label="Carregando">
                <span className="proposta-include-progress-bar" />
              </div>
            ) : null}
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Carregando rascunho...</p>
          </div>
        </div>
      ) : null}

      {isModalOpen && (editingId || draftHydrated) && (
        <div
          className="search-backdrop proposta-include-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="proposta-include-modal" role="dialog" aria-modal="true" aria-labelledby="proposta-include-title">
            {formIsLoading ? (
              <div className="proposta-include-progress" role="progressbar" aria-label="Carregando">
                <span className="proposta-include-progress-bar" />
              </div>
            ) : null}
            <form className="proposta-include-form" onSubmit={handleSubmit}>
              <header className="proposta-include-header">
                <button type="button" className="proposta-include-close" onClick={closeModal} aria-label="Fechar">
                  <i className="bi bi-x-lg" />
                </button>
                <div className="proposta-include-header-copy">
                  <h3 id="proposta-include-title">
                    {editingId ? 'Editar proposta' : 'Nova proposta'}
                  </h3>
                  {editingId && jaEnviada ? (
                    <p className="proposta-include-draft-hint">
                      Já enviada: ao salvar mudanças, a revisão sobe (01, 02…). Depois use{' '}
                      <strong>Enviar e-mail</strong> de novo.
                    </p>
                  ) : null}
                  {!editingId && draftUnavailable ? (
                    <p className="proposta-include-draft-hint is-warn">
                      Rascunho indisponível no servidor — você pode preencher normalmente, mas nada será salvo automaticamente.
                    </p>
                  ) : null}
                  {!editingId && !draftUnavailable && (restoredDraft || draftUpdatedAt) ? (
                    <p className="proposta-include-draft-hint">
                      Rascunho na sua conta
                      {draftUpdatedAt ? ` · ${formatDraftTime(draftUpdatedAt)}` : ''}
                      {saveDraft.isPending ? ' · salvando…' : ''}
                    </p>
                  ) : null}
                </div>
                {editingId ? (
                  <button
                    type="button"
                    className="proposta-include-print"
                    title="Imprimir proposta"
                    onClick={() => {
                      const salvo = propostas.find((item) => item.id === editingId);
                      const snapshot = snapshotDoFormulario();
                      handlePrint({
                        ...snapshot,
                        numeroIdentificacao: snapshot.numeroIdentificacao || salvo?.numeroIdentificacao || '',
                        titulo: snapshot.titulo || salvo?.titulo || '',
                        dataCriacao: salvo?.dataCriacao ?? snapshot.dataCriacao,
                        dataVencimento: salvo?.dataVencimento ?? snapshot.dataVencimento,
                      });
                    }}
                  >
                    <i className="bi bi-printer" />
                    <span>Imprimir</span>
                  </button>
                ) : null}
                {!editingId && (restoredDraft || draftUpdatedAt) ? (
                  <button
                    type="button"
                    className="proposta-include-discard"
                    onClick={discardDraft}
                    disabled={isPending}
                    title="Apaga o rascunho da sua conta"
                  >
                    <i className="bi bi-trash3" aria-hidden="true" />
                    <span>{deleteDraft.isPending ? 'Descartando...' : 'Descartar rascunho'}</span>
                  </button>
                ) : null}
                {canManage && (
                  <button
                    type="submit"
                    className="proposta-include-save"
                    disabled={!canSave}
                    title={
                      !temOperacao
                        ? MENSAGEM_OPERACAO_OBRIGATORIA
                        : !operacaoFreteOk
                          ? MENSAGEM_TABELA_FRETE
                          : !destinosOk
                            ? MENSAGEM_DESTINOS_OBRIGATORIOS
                            : !armazenagemOk
                              ? MENSAGEM_TARIFAS_ARMAZENAGEM
                              : undefined
                    }
                  >
                    <i className="bi bi-check2" />
                    <span>{isPending && !deleteDraft.isPending ? 'Salvando...' : 'Salvar'}</span>
                  </button>
                )}
              </header>

              <div className="proposta-include-body">
                <div className={`proposta-include-grid${editingId ? ' proposta-include-grid--topo' : ''}`}>
                  {editingId ? (
                    <IncludeField label="Número da proposta">
                      <input
                        className="proposta-include-input"
                        value={numeroProposta ? rotuloNumeroProposta(numeroProposta, form.revisao) : ''}
                        readOnly
                        disabled
                      />
                    </IncludeField>
                  ) : null}
                  <IncludeField label="Cliente" required>
                    <select
                      className="proposta-include-input proposta-include-select"
                      value={form.clienteId}
                      disabled={!canEdit}
                      onChange={(e) => {
                        const clienteId = e.target.value;
                        const cliente = clientes.find((item) => item.id === clienteId);
                        const keepDistribuicao = Boolean(clienteId) && form.incluiDistribuicao;
                        setForm({
                          ...form,
                          clienteId,
                          clienteNome: cliente?.razaoSocial ?? '',
                          att: (cliente?.responsavel || '').trim(),
                          incluiTransferencia: clienteId ? form.incluiTransferencia : false,
                          incluiDistribuicao: keepDistribuicao,
                          incluiOpPortuaria: clienteId ? form.incluiOpPortuaria : false,
                          incluiArmazenagem: clienteId ? form.incluiArmazenagem : false,
                          condicoesTransferencia: [],
                          condicoesDistribuicao: [],
                        });
                        setSnapshotDistribuicao(null);
                        catalogoTransferenciaRef.current = '';
                        catalogoDistribuicaoRef.current = '';
                        catalogoArmazenagemRef.current = '';
                        if (!clienteId || (form.incluiDistribuicao && !keepDistribuicao)) {
                          setAbaOperacao(primeiraAbaOperacao({
                            incluiTransferencia: clienteId ? form.incluiTransferencia : false,
                            incluiDistribuicao: false,
                            incluiArmazenagem: clienteId ? form.incluiArmazenagem : false,
                            incluiOpPortuaria: clienteId ? form.incluiOpPortuaria : false,
                          }));
                        }
                      }}
                    >
                      <option value="">Nenhum cliente selecionado</option>
                      {clientes.map((cliente) => (
                        <option key={cliente.id} value={cliente.id}>{cliente.razaoSocial}</option>
                      ))}
                    </select>
                  </IncludeField>
                  <IncludeField label="Tipo de serviço" required>
                    <ServicoSelect
                      value={form.tipo}
                      disabled={!canEdit}
                      onChange={setTipoServico}
                    />
                  </IncludeField>
                </div>

                {form.tipo === 'transporte_rodoviario' ? (
                  <div className="proposta-modalidades">
                    <span className="proposta-include-label">Tipo de operação</span>
                    <div className="proposta-modalidades-options">
                      <label className={!canEdit || (!form.incluiTransferencia && !podeUsarTabelaFrete) ? 'is-disabled' : undefined}>
                        <input
                          type="radio"
                          name="proposta-operacao"
                          checked={form.incluiTransferencia}
                          disabled={!canEdit || (!form.incluiTransferencia && !podeUsarTabelaFrete)}
                          title={podeUsarTabelaFrete ? undefined : MENSAGEM_TABELA_FRETE}
                          onChange={() => setOperacaoTransporte('transferencia')}
                        />
                        Transferência
                      </label>
                      <label className={!canEdit || (!form.incluiDistribuicao && !podeUsarTabelaFrete) ? 'is-disabled' : undefined}>
                        <input
                          type="radio"
                          name="proposta-operacao"
                          checked={form.incluiDistribuicao}
                          disabled={!canEdit || (!form.incluiDistribuicao && !podeUsarTabelaFrete)}
                          title={podeUsarTabelaFrete ? undefined : MENSAGEM_TABELA_FRETE}
                          onChange={() => setOperacaoTransporte('distribuicao')}
                        />
                        Distribuição
                      </label>
                      <label className={!canEdit || (!form.incluiOpPortuaria && !podeUsarTabelaFrete) ? 'is-disabled' : undefined}>
                        <input
                          type="radio"
                          name="proposta-operacao"
                          checked={form.incluiOpPortuaria}
                          disabled={!canEdit || (!form.incluiOpPortuaria && !podeUsarTabelaFrete)}
                          title={podeUsarTabelaFrete ? undefined : MENSAGEM_TABELA_FRETE}
                          onChange={() => setOperacaoTransporte('portuaria')}
                        />
                        Logística Retroportuária
                      </label>
                    </div>
                    {!podeUsarTabelaFrete ? (
                      <p className="proposta-modalidades-hint">{MENSAGEM_TABELA_FRETE}</p>
                    ) : null}
                    {(form.incluiTransferencia || form.incluiDistribuicao || form.incluiOpPortuaria) ? (
                      <PropostaCondicoesEspeciais
                        margensVeiculo={form.margensVeiculo}
                        veiculosTarifa={tabelaDistribuicaoCliente.tabela?.config?.veiculosTarifa}
                        canEdit={canEdit}
                        onChange={(margens) => {
                          setForm((current) => ({ ...current, margensVeiculo: margens }));
                          if (form.incluiDistribuicao && form.clienteId) {
                            previewDistribuicao.mutate(
                              { clienteId: form.clienteId, margensVeiculo: margens },
                              { onSuccess: (snap) => setSnapshotDistribuicao(snap as PropostaTabelaDistribuicaoSnapshot) },
                            );
                          }
                        }}
                      />
                    ) : null}
                  </div>
                ) : null}

                <div className="proposta-include-grid">
                  <IncludeField label="Responsável">
                    <input
                      className="proposta-include-input"
                      value={form.responsavel}
                      readOnly
                      disabled
                      title="Preenchido com o usuário que está lançando a proposta"
                    />
                  </IncludeField>
                  <IncludeField label="Responsável do cliente">
                    <input
                      className="proposta-include-input"
                      value={form.att}
                      readOnly
                      disabled
                      title="Cadastrado no cliente. Altere em Cadastros → Clientes."
                      placeholder="Cadastre o responsável no cliente"
                    />
                  </IncludeField>
                  <IncludeField label="Validade da proposta">
                    <select
                      className="proposta-include-input proposta-include-select"
                      value={form.validade}
                      disabled={!canEdit}
                      onChange={(e) => setForm({ ...form, validade: e.target.value })}
                    >
                      {optionsWithCurrent(validadeOptions, form.validade).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </IncludeField>
                  <IncludeField label="Vigência do contrato">
                    <select
                      className="proposta-include-input proposta-include-select"
                      value={form.vigencia}
                      disabled={!canEdit}
                      onChange={(e) => setForm({ ...form, vigencia: e.target.value })}
                    >
                      {optionsWithCurrent(vigenciaOptions, form.vigencia).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </IncludeField>
                </div>

                <div className="proposta-include-grid">
                  <IncludeField label="Faturamento">
                    <select
                      className="proposta-include-input proposta-include-select"
                      value={form.faturamento}
                      disabled={!canEdit}
                      onChange={(e) => setForm({ ...form, faturamento: e.target.value })}
                    >
                      {optionsWithCurrent(faturamentoOptions, form.faturamento).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </IncludeField>
                  <IncludeField label="Situação">
                    <select
                      className="proposta-include-input proposta-include-select"
                      value={form.status}
                      disabled={!canEditSituacao}
                      title={
                        form.status === 'rascunho'
                          ? 'A situação passa a Enviada automaticamente ao enviar o e-mail ao cliente.'
                          : undefined
                      }
                      onChange={(e) => setForm({ ...form, status: e.target.value as PropostaComercialStatus })}
                    >
                      {form.status === 'rascunho' ? (
                        <option value="rascunho">Rascunho</option>
                      ) : (
                        <>
                          <option value="enviada">Enviada</option>
                          <option value="aprovada">Aceita</option>
                          <option value="recusada">Recusada</option>
                        </>
                      )}
                    </select>
                  </IncludeField>
                </div>

                {(form.incluiTransferencia || form.incluiDistribuicao || form.incluiArmazenagem || form.incluiOpPortuaria) && (
                  <section className="proposta-destinos">
                    {form.incluiTransferencia ? (
                      <>
                        <PropostaTrechosOperacao
                          titulo="Trechos — Transferência"
                          linhas={form.linhas.filter((linha) => (linha.modalidade || 'transferencia') !== 'op_portuaria')}
                          canEdit={canEdit}
                          clienteId={form.clienteId}
                          margensVeiculo={form.margensVeiculo}
                          grisAdvUnificado={
                            isGrisAdvUnificado(tabelaDistribuicaoCliente.tabela?.config)
                            || Boolean(snapshotDistribuicao?.grisAdvUnificado)
                          }
                          onChange={(linhas) => setForm((current) => ({
                            ...current,
                            linhas: linhas.map((linha) => ({ ...linha, modalidade: 'transferencia' })),
                          }))}
                        />
                        <PropostaGeneralidadesRevisao
                          titulo="Generalidades — Transferência"
                          items={form.condicoesTransferencia}
                          canEdit={canEdit}
                          emptyHint={form.clienteId ? 'Nenhuma generalidade de transferência para revisar.' : 'Selecione o cliente para revisar as generalidades de transferência.'}
                          onChange={(items) => setForm((current) => ({ ...current, condicoesTransferencia: items }))}
                        />
                      </>
                    ) : null}

                    {form.incluiDistribuicao ? (
                      <>
                        <PropostaTabelaDistribuicao
                          clienteId={form.clienteId || null}
                          snapshot={snapshotDistribuicao}
                        />
                        <PropostaGeneralidadesRevisao
                          titulo="Generalidades — Distribuição"
                          items={form.condicoesDistribuicao}
                          canEdit={canEdit}
                          emptyHint={form.clienteId ? 'Nenhuma generalidade de distribuição para revisar.' : 'Selecione o cliente para revisar as generalidades de distribuição.'}
                          onChange={(items) => setForm((current) => ({ ...current, condicoesDistribuicao: items }))}
                        />
                      </>
                    ) : null}

                    {form.incluiOpPortuaria ? (
                      <>
                        <PropostaTrechosOperacao
                          titulo="Trechos — Logística Retroportuária"
                          portuaria
                          linhas={form.linhas.filter((linha) => linha.modalidade === 'op_portuaria')}
                          canEdit={canEdit}
                          clienteId={form.clienteId}
                          margensVeiculo={form.margensVeiculo}
                          grisAdvUnificado={
                            isGrisAdvUnificado(tabelaDistribuicaoCliente.tabela?.config)
                            || Boolean(snapshotDistribuicao?.grisAdvUnificado)
                          }
                          onChange={(linhas) => setForm((current) => ({
                            ...current,
                            linhas: linhas.map((linha) => ({ ...linha, modalidade: 'op_portuaria' })),
                          }))}
                        />
                        <PropostaGeneralidadesRevisao
                          titulo="Generalidades — Logística Retroportuária"
                          items={form.condicoesTransferencia}
                          canEdit={canEdit}
                          emptyHint="As mesmas generalidades de transferência se aplicam à operação portuária, salvo o que for ajustado aqui."
                          onChange={(items) => setForm((current) => ({ ...current, condicoesTransferencia: items }))}
                        />
                      </>
                    ) : null}

                    {form.incluiArmazenagem ? (
                      <>
                        <PropostaTabelaArmazenagem
                          tabela={form.tabelaArmazenagem}
                          canEdit={canEdit}
                          onChange={(tabela) => setForm((current) => ({ ...current, tabelaArmazenagem: tabela }))}
                        />
                        <PropostaGeneralidadesRevisao
                          titulo="Generalidades — Armazenagem"
                          items={form.condicoes}
                          canEdit={canEdit}
                          emptyHint={form.clienteId ? 'Nenhuma generalidade de armazenagem para revisar.' : 'Selecione o cliente para revisar as generalidades de armazenagem.'}
                          onChange={(items) => setForm((current) => ({ ...current, condicoes: items }))}
                        />
                      </>
                    ) : null}
                  </section>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {emailPropostas.length > 0 ? (
        <ComercialPropostaEmailModal
          propostas={emailPropostas}
          clienteFor={clienteDaProposta}
          onClose={() => setEmailPropostas([])}
        />
      ) : null}
    </div>
  );
};

export default ComercialPropostas;
