import React, { useEffect, useMemo, useRef, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  getComercialErrorMessage,
  useClientesComercial,
  useComercialGeneralidadesProposta,
  useCreatePropostaComercial,
  useDeletePropostaComercial,
  usePropostasComerciais,
  useUpdatePropostaComercial,
} from '../../hooks/useComercialClientes';
import type {
  PropostaComercial,
  PropostaComercialOrdering,
  PropostaComercialPayload,
  PropostaComercialStatus,
  PropostaComercialTipo,
  PropostaCondicaoComercial,
} from '../../types/domain';
import {
  CONDICOES_FRETE_PADRAO,
  PROPOSTA_COMERCIAL_STATUS_LABEL,
  PROPOSTA_COMERCIAL_TIPO_LABEL,
} from '../../types/domain';
import { printPropostaComercial } from './printPropostaComercial';
import ComercialPropostaEmailModal from './ComercialPropostaEmailModal';
import PropostaTabelaDistribuicao from './PropostaTabelaDistribuicao';

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
  const trimmed = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!trimmed) return null;
  const amount = Number(trimmed);
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
  devolucaoContainer: string;
  observacoes: string;
  peso: string;
  tarifaFrete: string;
  pedagio: string;
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
  condicoes: PropostaCondicaoComercial[];
  linhas: LinhaForm[];
};

const emptyLinha = (): LinhaForm => ({
  origem: '',
  entrega: '',
  veiculo: '',
  devolucaoContainer: '',
  observacoes: '',
  peso: '',
  tarifaFrete: '',
  pedagio: '',
  adValorem: '',
  gris: '0,07%',
  icms: 'Conforme legislação',
  prazoDias: '',
});

const emptyForm = (condicoes?: PropostaCondicaoComercial[]): PropostaForm => ({
  tipo: 'transporte_rodoviario',
  status: 'rascunho',
  clienteId: '',
  clienteNome: '',
  titulo: '',
  subtitulo: '',
  revisao: '01',
  dataProposta: todayISO(),
  propostaReferente: '',
  responsavel: '',
  reajuste: 'Anual com base no índice INCT',
  att: '',
  validade: '30 dias',
  vigencia: '12 meses',
  faturamento: 'Semanal / 30 DDL',
  localEmissao: 'Maringá',
  valorEstimado: '',
  observacoes: '',
  incluiTransferencia: false,
  incluiDistribuicao: false,
  condicoes: (condicoes?.length ? condicoes : CONDICOES_FRETE_PADRAO).map((item) => ({ ...item })),
  linhas: [emptyLinha()],
});

const linhaTotal = (linha: LinhaForm) => {
  const tarifa = parseMoney(linha.tarifaFrete);
  const pedagio = parseMoney(linha.pedagio);
  if (tarifa == null && pedagio == null) return null;
  return (tarifa ?? 0) + (pedagio ?? 0);
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
  onChange: (value: PropostaComercialTipo) => void;
}> = ({ value, disabled, onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div className="proposta-servico-select" ref={rootRef}>
      <button
        type="button"
        className="proposta-servico-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => { if (!disabled) setOpen((current) => !current); }}
      >
        <i className={`bi ${iconForServico(value)}`} aria-hidden="true" />
        <span>{PROPOSTA_COMERCIAL_TIPO_LABEL[value]}</span>
        <i className="bi bi-chevron-down" aria-hidden="true" />
      </button>
      {open && (
        <ul className="proposta-servico-menu" role="listbox">
          {SERVICO_OPTIONS.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? 'is-selected' : ''}
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
      )}
    </div>
  );
};

const VALIDADE_OPTIONS = ['5 dias', '7 dias', '15 dias', '30 dias', '45 dias', '60 dias'];
const VIGENCIA_OPTIONS = ['3 meses', '6 meses', '12 meses', '24 meses', '36 meses', 'Indeterminada'];
const FATURAMENTO_OPTIONS = [
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
  const [emailProposta, setEmailProposta] = useState<PropostaComercial | null>(null);
  const [abaOperacao, setAbaOperacao] = useState<'transferencia' | 'distribuicao'>('transferencia');

  const propostasQuery = usePropostasComerciais({
    page,
    pageSize,
    search: search.trim() || undefined,
    tipo: filterTipo === 'todos' ? undefined : filterTipo,
    status: filterStatus === 'todos' ? undefined : filterStatus,
    ordering,
  });
  const { canShowEmpty } = useAsyncQueryState(propostasQuery);
  const clientesQuery = useClientesComercial({ page: 1, pageSize: 100 });
  const generalidadesProposta = useComercialGeneralidadesProposta(
    isModalOpen && !editingId ? (form.clienteId || null) : null,
    form.tipo,
    form.incluiTransferencia,
    form.incluiDistribuicao,
  );
  const createProposta = useCreatePropostaComercial();
  const updateProposta = useUpdatePropostaComercial();
  const deleteProposta = useDeletePropostaComercial();

  const propostas = propostasQuery.data?.results ?? [];
  const totalCount = propostasQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const clientes = clientesQuery.data?.results ?? [];
  const selectedPropostas = useMemo(
    () => propostas.filter((item) => selectedIds.includes(item.id)),
    [propostas, selectedIds],
  );
  const isAllSelected = propostas.length > 0 && propostas.every((item) => selectedIds.includes(item.id));
  const catalogoAplicadoRef = useRef('');

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
    if (!isModalOpen || editingId) {
      catalogoAplicadoRef.current = '';
      return;
    }
    if (!form.clienteId || generalidadesProposta.tipos.length === 0 || !generalidadesProposta.isSuccess) {
      return;
    }
    const chave = `${form.clienteId}:${generalidadesProposta.tipos.join(',')}`;
    if (catalogoAplicadoRef.current === chave) return;
    catalogoAplicadoRef.current = chave;
    const condicoes = generalidadesProposta.items.length
      ? generalidadesProposta.items.map((item) => ({ ...item }))
      : CONDICOES_FRETE_PADRAO.map((item) => ({ ...item }));
    setForm((current) => ({ ...current, condicoes }));
  }, [
    editingId,
    form.clienteId,
    generalidadesProposta.isSuccess,
    generalidadesProposta.items,
    generalidadesProposta.tipos,
    isModalOpen,
  ]);

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    setSelectedIds([]);
  };

  const handleSort = (field: PropostaSortField) => {
    setOrdering((current) => nextPropostaOrdering(field, current));
    goToPage(1);
  };

  const subtotalGeral = form.linhas.reduce((acc, linha) => acc + (linhaTotal(linha) ?? 0), 0);

  const nomeUsuarioLogado = (user?.name || user?.username || '').trim();
  const responsavelDoCliente = (clienteId: string) =>
    (clientes.find((item) => item.id === clienteId)?.responsavel || '').trim();

  const openNew = () => {
    setEditingId(null);
    setAbaOperacao('transferencia');
    setForm({ ...emptyForm(), responsavel: nomeUsuarioLogado });
    setIsModalOpen(true);
  };

  const startEdit = (proposta: PropostaComercial) => {
    setEditingId(proposta.id);
    setForm({
      tipo: proposta.tipo,
      status: proposta.status,
      clienteId: proposta.clienteId ?? '',
      clienteNome: clientes.find((item) => item.id === proposta.clienteId)?.razaoSocial || proposta.clienteNome,
      titulo: proposta.titulo,
      subtitulo: proposta.subtitulo,
      revisao: proposta.revisao || '01',
      dataProposta: proposta.dataProposta ?? todayISO(),
      propostaReferente: proposta.propostaReferente,
      responsavel: proposta.responsavel || nomeUsuarioLogado,
      reajuste: proposta.reajuste || 'Anual com base no índice INCT',
      att: responsavelDoCliente(proposta.clienteId ?? '') || proposta.att,
      validade: proposta.validade || '30 dias',
      vigencia: proposta.vigencia || '12 meses',
      faturamento: proposta.faturamento || 'Semanal / 30 DDL',
      localEmissao: proposta.localEmissao,
      valorEstimado: proposta.valorEstimado ?? '',
      observacoes: proposta.observacoes,
      incluiTransferencia: proposta.incluiTransferencia,
      incluiDistribuicao: proposta.incluiDistribuicao,
      condicoes: (proposta.condicoes.length ? proposta.condicoes : CONDICOES_FRETE_PADRAO).map((item) => ({ ...item })),
      linhas: proposta.linhas.length
        ? proposta.linhas.map((linha) => ({
            origem: linha.origem,
            entrega: linha.entrega,
            veiculo: linha.veiculo ?? '',
            devolucaoContainer: linha.devolucaoContainer,
            observacoes: linha.observacoes,
            peso: linha.peso,
            tarifaFrete: linha.tarifaFrete ?? '',
            pedagio: linha.pedagio ?? '',
            adValorem: linha.adValorem,
            gris: linha.gris,
            icms: linha.icms || 'Conforme legislação',
            prazoDias: linha.prazoDias,
          }))
        : [emptyLinha()],
    });
    setAbaOperacao(proposta.incluiTransferencia || !proposta.incluiDistribuicao ? 'transferencia' : 'distribuicao');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const updateLinha = (index: number, patch: Partial<LinhaForm>) => {
    setForm((current) => ({
      ...current,
      linhas: current.linhas.map((linha, i) => (i === index ? { ...linha, ...patch } : linha)),
    }));
  };

  const toggleModalidade = (campo: 'incluiTransferencia' | 'incluiDistribuicao', checked: boolean) => {
    setForm((current) => {
      const next = {
        ...current,
        [campo]: checked,
        linhas: campo === 'incluiTransferencia' && checked && current.linhas.length === 0
          ? [emptyLinha()]
          : current.linhas,
      };
      return next;
    });
    if (checked) {
      setAbaOperacao(campo === 'incluiTransferencia' ? 'transferencia' : 'distribuicao');
      return;
    }
    setAbaOperacao((atual) => {
      if (campo === 'incluiTransferencia' && atual === 'transferencia') return 'distribuicao';
      if (campo === 'incluiDistribuicao' && atual === 'distribuicao') return 'transferencia';
      return atual;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clienteId) {
      alert('Selecione o cliente.');
      return;
    }
    const isRodoviario = form.tipo === 'transporte_rodoviario';
    const titulo = form.titulo.trim()
      || `${PROPOSTA_COMERCIAL_TIPO_LABEL[form.tipo]}${form.clienteNome.trim() ? ` — ${form.clienteNome.trim()}` : ''}`;
    const payload: PropostaComercialPayload = {
      tipo: form.tipo,
      status: form.status,
      clienteId: form.clienteId,
      clienteNome: form.clienteNome.trim(),
      titulo,
      subtitulo: form.subtitulo.trim(),
      revisao: form.revisao.trim() || '01',
      dataProposta: form.dataProposta || null,
      propostaReferente: form.propostaReferente.trim(),
      responsavel: form.responsavel.trim(),
      reajuste: form.reajuste.trim(),
      att: form.att.trim(),
      validade: form.validade.trim(),
      vigencia: form.vigencia.trim(),
      faturamento: form.faturamento.trim(),
      localEmissao: form.localEmissao.trim(),
      valorEstimado: isRodoviario
        ? (subtotalGeral ? subtotalGeral.toFixed(2) : moneyOrEmpty(form.valorEstimado))
        : moneyOrEmpty(form.valorEstimado),
      observacoes: form.observacoes.trim(),
      incluiTransferencia: isRodoviario && form.incluiTransferencia,
      incluiDistribuicao: isRodoviario && form.incluiDistribuicao,
      condicoes: form.condicoes,
      linhas: isRodoviario && form.incluiTransferencia
        ? form.linhas.map((linha, ordem) => ({
            ordem,
            origem: linha.origem.trim(),
            entrega: linha.entrega.trim(),
            veiculo: linha.veiculo.trim(),
            devolucaoContainer: linha.devolucaoContainer.trim(),
            observacoes: linha.observacoes.trim(),
            peso: linha.peso.trim(),
            tarifaFrete: moneyOrEmpty(linha.tarifaFrete),
            pedagio: moneyOrEmpty(linha.pedagio),
            adValorem: linha.adValorem.trim(),
            gris: linha.gris.trim(),
            icms: linha.icms.trim() || 'Conforme legislação',
            prazoDias: linha.prazoDias.trim(),
          }))
        : [],
    };
    const callbacks = {
      onSuccess: () => closeModal(),
      onError: (err: unknown) => alert(getComercialErrorMessage(err)),
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
    tipo: form.tipo,
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
    condicoes: form.condicoes,
    linhas: form.linhas.map((linha, ordem) => ({
      ordem,
      origem: linha.origem,
      entrega: linha.entrega,
      veiculo: linha.veiculo,
      devolucaoContainer: linha.devolucaoContainer,
      observacoes: linha.observacoes,
      peso: linha.peso,
      tarifaFrete: moneyOrEmpty(linha.tarifaFrete),
      pedagio: moneyOrEmpty(linha.pedagio),
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
    void printPropostaComercial(proposta, clienteDaProposta(proposta));
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
    const proposta = selectedPropostas[0];
    if (!proposta) return;
    setIsActionsMenuOpen(false);
    setEmailProposta(proposta);
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

  const isPending = createProposta.isPending || updateProposta.isPending;
  const canSave = canManage && Boolean(form.clienteId) && !isPending;

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
              disabled={selectedIds.length === 0 || (selectedIds.length > 1 && !canManage)}
              onClick={() => setIsActionsMenuOpen((open) => !open)}
            >
              <span>Ações{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}</span>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`reports-dropdown-menu ${isActionsMenuOpen ? 'show' : ''}`}>
              {selectedPropostas.length === 1 && (
                <>
                  <span className="reports-dropdown-item" onClick={handlePrintSelected}>
                    <span className="reports-dropdown-item-left">
                      <i className="bi bi-printer" />
                      Imprimir
                    </span>
                  </span>
                  <span className="reports-dropdown-item" onClick={handleEmailSelected}>
                    <span className="reports-dropdown-item-left">
                      <i className="bi bi-envelope" />
                      Enviar e-mail
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
        loadingMessage="Carregando propostas..."
        refreshingMessage="Atualizando propostas..."
        errorMessage="Não foi possível carregar as propostas. Tente novamente."
      >
        <div className="erp-card reports-table-card comercial-propostas-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table comercial-browse-table comercial-propostas-table">
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
                      <td>{proposta.numeroIdentificacao || '—'}</td>
                      <td>{formatDateBr(proposta.dataCriacao)}</td>
                      <td>{clienteDaProposta(proposta)?.razaoSocial || proposta.clienteNome || '—'}</td>
                      <td>
                        <span className="proposta-servico-cell">
                          <i className={`bi ${iconForServico(proposta.tipo)}`} aria-hidden="true" />
                          {PROPOSTA_COMERCIAL_TIPO_LABEL[proposta.tipo]}
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

      {isModalOpen && (
        <div
          className="search-backdrop proposta-include-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="proposta-include-modal" role="dialog" aria-modal="true" aria-labelledby="proposta-include-title">
            <form className="proposta-include-form" onSubmit={handleSubmit}>
              <header className="proposta-include-header">
                <button type="button" className="proposta-include-close" onClick={closeModal} aria-label="Fechar">
                  <i className="bi bi-x-lg" />
                </button>
                <h3 id="proposta-include-title">
                  {editingId ? 'Editar proposta' : 'Nova proposta'}
                </h3>
                <button
                  type="button"
                  className="proposta-include-print"
                  title="Imprimir proposta"
                  onClick={() => {
                    const salvo = editingId ? propostas.find((item) => item.id === editingId) : null;
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
                {canManage && (
                  <button type="submit" className="proposta-include-save" disabled={!canSave}>
                    <i className="bi bi-check2" />
                    <span>{isPending ? 'Salvando...' : 'Salvar'}</span>
                  </button>
                )}
              </header>

              <div className="proposta-include-body">
                <div className={`proposta-include-grid${editingId ? ' proposta-include-grid--topo' : ''}`}>
                  {editingId ? (
                    <IncludeField label="Número da proposta">
                      <input
                        className="proposta-include-input"
                        value={numeroProposta}
                        readOnly
                        disabled
                      />
                    </IncludeField>
                  ) : null}
                  <IncludeField label="Cliente" required>
                    <select
                      className="proposta-include-input proposta-include-select"
                      value={form.clienteId}
                      disabled={!canManage}
                      onChange={(e) => {
                        const clienteId = e.target.value;
                        const cliente = clientes.find((item) => item.id === clienteId);
                        setForm({
                          ...form,
                          clienteId,
                          clienteNome: cliente?.razaoSocial ?? '',
                          att: (cliente?.responsavel || '').trim(),
                        });
                      }}
                    >
                      <option value="">Nenhum cliente selecionado</option>
                      {clientes.map((cliente) => (
                        <option key={cliente.id} value={cliente.id}>{cliente.razaoSocial}</option>
                      ))}
                    </select>
                  </IncludeField>

                  <div className="proposta-include-field">
                    <span className="proposta-include-label">Serviço*</span>
                    <ServicoSelect
                      value={form.tipo}
                      disabled={!canManage}
                      onChange={(tipo) => setForm({
                        ...form,
                        tipo,
                        incluiTransferencia: tipo === 'transporte_rodoviario' ? form.incluiTransferencia : false,
                        incluiDistribuicao: tipo === 'transporte_rodoviario' ? form.incluiDistribuicao : false,
                        linhas: tipo === 'transporte_rodoviario' && form.linhas.length === 0
                          ? [emptyLinha()]
                          : form.linhas,
                      })}
                    />
                  </div>
                </div>

                {form.tipo === 'transporte_rodoviario' ? (
                  <div className="proposta-modalidades">
                    <span className="proposta-include-label">Tipo de operação</span>
                    <div className="proposta-modalidades-options">
                      <label>
                        <input
                          type="checkbox"
                          checked={form.incluiTransferencia}
                          disabled={!canManage}
                          onChange={(e) => toggleModalidade('incluiTransferencia', e.target.checked)}
                        />
                        Transferência
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={form.incluiDistribuicao}
                          disabled={!canManage}
                          onChange={(e) => toggleModalidade('incluiDistribuicao', e.target.checked)}
                        />
                        Distribuição
                      </label>
                    </div>
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
                      disabled={!canManage}
                      onChange={(e) => setForm({ ...form, validade: e.target.value })}
                    >
                      {optionsWithCurrent(VALIDADE_OPTIONS, form.validade).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </IncludeField>
                  <IncludeField label="Vigência do contrato">
                    <select
                      className="proposta-include-input proposta-include-select"
                      value={form.vigencia}
                      disabled={!canManage}
                      onChange={(e) => setForm({ ...form, vigencia: e.target.value })}
                    >
                      {optionsWithCurrent(VIGENCIA_OPTIONS, form.vigencia).map((option) => (
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
                      disabled={!canManage}
                      onChange={(e) => setForm({ ...form, faturamento: e.target.value })}
                    >
                      {optionsWithCurrent(FATURAMENTO_OPTIONS, form.faturamento).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </IncludeField>
                  <IncludeField label="Situação">
                    <select
                      className="proposta-include-input proposta-include-select"
                      value={form.status}
                      disabled={!canManage}
                      onChange={(e) => setForm({ ...form, status: e.target.value as PropostaComercialStatus })}
                    >
                      <option value="rascunho">Rascunho</option>
                      <option value="enviada">Enviada</option>
                      <option value="aprovada">Aceita</option>
                      <option value="recusada">Recusada</option>
                    </select>
                  </IncludeField>
                </div>

                {form.tipo === 'transporte_rodoviario' && (form.incluiTransferencia || form.incluiDistribuicao) && (
                  <section className="proposta-destinos">
                    <div className="reports-tabs-bar proposta-operacao-tabs">
                      {form.incluiTransferencia ? (
                        <button
                          type="button"
                          className={`reports-tab-btn${abaOperacao === 'transferencia' ? ' active' : ''}`}
                          onClick={() => setAbaOperacao('transferencia')}
                        >
                          Transferência
                        </button>
                      ) : null}
                      {form.incluiDistribuicao ? (
                        <button
                          type="button"
                          className={`reports-tab-btn${abaOperacao === 'distribuicao' ? ' active' : ''}`}
                          onClick={() => setAbaOperacao('distribuicao')}
                        >
                          Distribuição
                        </button>
                      ) : null}
                    </div>

                    {form.incluiTransferencia && abaOperacao === 'transferencia' ? (
                      <>
                    <div className="proposta-destinos-head">
                      <h4>Destinos</h4>
                      {canManage && (
                        <button
                          type="button"
                          className="reports-action-btn primary"
                          onClick={() => setForm({ ...form, linhas: [...form.linhas, emptyLinha()] })}
                        >
                          Adicionar
                        </button>
                      )}
                    </div>
                    <div className="proposta-destinos-wrap">
                      <table className="data-table proposta-destinos-table">
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
                            <th>Prazo entrega</th>
                            {canManage ? <th /> : null}
                          </tr>
                        </thead>
                        <tbody>
                          {form.linhas.map((linha, index) => (
                            <tr key={index}>
                              <td>
                                <input className="proposta-destinos-input" value={linha.origem} disabled={!canManage} placeholder="Cidade - UF" onChange={(e) => updateLinha(index, { origem: e.target.value })} />
                              </td>
                              <td>
                                <input className="proposta-destinos-input" value={linha.entrega} disabled={!canManage} placeholder="Cidade - UF" onChange={(e) => updateLinha(index, { entrega: e.target.value })} />
                              </td>
                              <td>
                                <input className="proposta-destinos-input" value={linha.veiculo} disabled={!canManage} placeholder="Carreta" onChange={(e) => updateLinha(index, { veiculo: e.target.value })} />
                              </td>
                              <td>
                                <input className="proposta-destinos-input" value={linha.tarifaFrete} disabled={!canManage} placeholder="R$ 0,00" onChange={(e) => updateLinha(index, { tarifaFrete: e.target.value })} />
                              </td>
                              <td>
                                <input className="proposta-destinos-input" value={linha.pedagio} disabled={!canManage} placeholder="R$ 0,00" onChange={(e) => updateLinha(index, { pedagio: e.target.value })} />
                              </td>
                              <td>
                                <input className="proposta-destinos-input" value={linha.gris} disabled={!canManage} placeholder="0,07%" onChange={(e) => updateLinha(index, { gris: e.target.value })} />
                              </td>
                              <td>
                                <input className="proposta-destinos-input" value={linha.adValorem} disabled={!canManage} placeholder="0,00%" onChange={(e) => updateLinha(index, { adValorem: e.target.value })} />
                              </td>
                              <td>
                                <input className="proposta-destinos-input" value={linha.icms} disabled={!canManage} onChange={(e) => updateLinha(index, { icms: e.target.value })} />
                              </td>
                              <td>
                                <input className="proposta-destinos-input" value={linha.prazoDias} disabled={!canManage} placeholder="3 dias úteis" onChange={(e) => updateLinha(index, { prazoDias: e.target.value })} />
                              </td>
                              {canManage ? (
                                <td>
                                  <button
                                    type="button"
                                    className="btn-icon"
                                    title="Remover destino"
                                    disabled={form.linhas.length <= 1}
                                    onClick={() => setForm({ ...form, linhas: form.linhas.filter((_, i) => i !== index) })}
                                  >
                                    <i className="bi bi-trash" />
                                  </button>
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                      </>
                    ) : null}

                    {form.incluiDistribuicao && abaOperacao === 'distribuicao' ? (
                      <PropostaTabelaDistribuicao clienteId={form.clienteId || null} />
                    ) : null}
                  </section>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {emailProposta ? (
        <ComercialPropostaEmailModal
          proposta={emailProposta}
          cliente={clienteDaProposta(emailProposta)}
          clienteEmail={clienteDaProposta(emailProposta)?.email || emailProposta.clienteEmail}
          onClose={() => setEmailProposta(null)}
        />
      ) : null}
    </div>
  );
};

export default ComercialPropostas;
