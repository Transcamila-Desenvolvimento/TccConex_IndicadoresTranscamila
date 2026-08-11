import React, { useState, useMemo, useEffect } from 'react';
import type { SgqAvaliacao, SgqPesquisa, SgqPesquisaPayload, SgqPesquisaQueryParams } from '../../types/domain';
import { SGQ_AVALIACAO_OPTIONS, SGQ_CLIENTE_OPTIONS, SGQ_CRITERIOS } from '../../types/domain';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import {
  useSgqPesquisas,
  useSgqMotoristas,
  useSgqLancadores,
  useSgqLoteDraft,
  useCreateSgqPesquisa,
  useUpdateSgqPesquisa,
  useDeleteSgqPesquisa,
} from '../../hooks/useSgqPesquisas';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import SGQPesquisaLoteModal from './SGQPesquisaLoteModal';
import SGQPesquisaImportModal from './SGQPesquisaImportModal';
import { clearLegacySgqLoteDrafts } from './sgqLoteDraft';

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100];

type SgqSortField = 'data_inclusao' | 'data_entrega';
type SgqOrdering = NonNullable<SgqPesquisaQueryParams['ordering']>;

function nextSgqOrdering(field: SgqSortField, current: SgqOrdering | undefined): SgqOrdering {
  const asc = `${field}_asc` as SgqOrdering;
  const desc = `${field}_desc` as SgqOrdering;
  return current === asc ? desc : asc;
}

function SgqSortIcon({ field, ordering }: { field: SgqSortField; ordering?: SgqOrdering }) {
  const normalized = ordering === 'data_asc' || ordering === 'data_desc'
    ? (ordering.replace('data_', 'data_entrega_') as SgqOrdering)
    : ordering;
  const isActive = normalized?.startsWith(field);
  const isAsc = normalized === `${field}_asc`;
  return (
    <span style={{ marginLeft: 6, display: 'inline-flex', flexDirection: 'column', gap: 0, verticalAlign: 'middle', lineHeight: 1 }}>
      <i className="bi bi-caret-up-fill" style={{ fontSize: 11, display: 'block', color: isActive && isAsc ? '#0f85c1' : '#c8d3e0' }} />
      <i className="bi bi-caret-down-fill" style={{ fontSize: 11, display: 'block', color: isActive && !isAsc ? '#0f85c1' : '#c8d3e0' }} />
    </span>
  );
}

/**
 * Escala chapada estilo NPS (vermelho → laranja → lima → verde), em tons pastéis.
 * O círculo sólido fica no CSS; aqui só o glifo branco e a cor do fundo.
 */
const AVALIACAO_META: Record<SgqAvaliacao, { label: string; color: string; icon: string; badgeClass: string }> = {
  ruim: { label: 'Ruim', color: '#ef7a6e', icon: 'bi bi-x-lg', badgeClass: 'is-ruim' },
  regular: { label: 'Regular', color: '#f0b24a', icon: 'bi bi-exclamation-lg', badgeClass: 'is-regular' },
  bom: { label: 'Bom', color: '#a8d45a', icon: 'bi bi-check-lg', badgeClass: 'is-bom' },
  otimo: { label: 'Ótimo', color: '#5cbf7a', icon: 'bi bi-check-lg', badgeClass: 'is-otimo' },
};

function formatDateBr(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function AvaliacaoBadge({ value }: { value: SgqAvaliacao | '' }) {
  if (!value) return <span>—</span>;
  const meta = AVALIACAO_META[value];
  if (!meta) return <span>—</span>;
  return (
    <span className={`sgq-avaliacao-badge ${meta.badgeClass}`}>
      <i className={meta.icon} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/**
 * Seletor de avaliação em segmentos (chips), no mesmo padrão visual usado para
 * selecionar expedição no Faturamento — mais alinhado à seriedade do ERP do
 * que um controle de estrelas.
 */
function AvaliacaoChips({ value, onChange }: { value: SgqAvaliacao | ''; onChange: (v: SgqAvaliacao) => void }) {
  return (
    <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
      {SGQ_AVALIACAO_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        const color = AVALIACAO_META[opt.value].color;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              flex: '1 1 0',
              minWidth: 0,
              padding: '7px 6px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              border: `1px solid ${selected ? color : '#cbd5e1'}`,
              background: selected ? color : '#ffffff',
              color: selected ? '#ffffff' : '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {selected && <i className={AVALIACAO_META[opt.value].icon} style={{ fontSize: '11px' }} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

type FormState = {
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
};

const EMPTY_FORM: FormState = {
  dataEntrega: '',
  cliente: 'OUTROS',
  motorista: '',
  cte: '',
  notaFiscal: '',
  clienteRecusouAssinar: false,
  prazoEntrega: '',
  condicoesMercadoria: '',
  condicoesVeiculo: '',
  apresentacaoMotorista: '',
  atendimentoDispensado: '',
  analise: '',
};

const SGQPesquisaSatisfacao: React.FC = () => {
  const { user, selectedFilial } = useAuth();
  const canCreatePesquisas = userHasFuncao(user, 'SGQ', 'criar-pesquisas');
  const canImportPesquisas = userHasFuncao(user, 'SGQ', 'importar-pesquisas');
  const canEditPesquisas = userHasFuncao(user, 'SGQ', 'editar-pesquisas');
  const canDeletePesquisas = userHasFuncao(user, 'SGQ', 'excluir-pesquisas');
  const canMutatePesquisas = canEditPesquisas || canDeletePesquisas;

  // Filtros e paginação (server-side)
  const [search, setSearch] = useState('');
  const [filterCliente, setFilterCliente] = useState('');
  const [filterMotorista, setFilterMotorista] = useState('');
  const [filterCriadoPor, setFilterCriadoPor] = useState('');
  const [filterAvaliacao, setFilterAvaliacao] = useState('');
  const [filterDataInicio, setFilterDataInicio] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [ordering, setOrdering] = useState<SgqOrdering>('data_entrega_desc');

  const filterParams = useMemo(() => ({
    search: search.trim() || undefined,
    cliente: filterCliente || undefined,
    motorista: filterMotorista.trim() || undefined,
    criadoPor: filterCriadoPor || undefined,
    avaliacao: filterAvaliacao || undefined,
    dataInicio: filterDataInicio || undefined,
    dataFim: filterDataFim || undefined,
  }), [search, filterCliente, filterMotorista, filterCriadoPor, filterAvaliacao, filterDataInicio, filterDataFim]);

  const listParams = useMemo(() => ({
    ...filterParams,
    page: currentPage,
    pageSize,
    ordering,
  }), [filterParams, currentPage, pageSize, ordering]);

  const listQuery = useSgqPesquisas(selectedFilial, listParams);
  const motoristasQuery = useSgqMotoristas(selectedFilial);
  const lancadoresQuery = useSgqLancadores(selectedFilial);
  const motoristasSugeridos = motoristasQuery.data ?? [];
  const lancadoresSugeridos = lancadoresQuery.data ?? [];
  const listState = useAsyncQueryState(listQuery);
  const rows = listQuery.data?.results ?? [];
  const totalItems = listQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const clampedPage = Math.min(currentPage, totalPages);

  const createPesquisa = useCreateSgqPesquisa();
  const updatePesquisa = useUpdateSgqPesquisa();
  const deletePesquisa = useDeleteSgqPesquisa();
  const isSaving = createPesquisa.isPending || updatePesquisa.isPending;

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPesquisa, setEditingPesquisa] = useState<SgqPesquisa | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  // Dropdown "Incluir" (Formulário / Inclusão em Tabela)
  const [isIncluirOpen, setIsIncluirOpen] = useState(false);
  const [isLoteModalOpen, setIsLoteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const loteDraftQuery = useSgqLoteDraft(selectedFilial);
  const hasLoteDraft = Boolean(loteDraftQuery.data?.hasDraft);

  useEffect(() => {
    clearLegacySgqLoteDrafts();
  }, []);

  // Seleção de linhas (caixas de seleção) e dropdown "Ações" (Editar / Excluir)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const selectedRows = useMemo(() => rows.filter((r) => selectedIds.includes(r.id)), [rows, selectedIds]);
  const isAllSelected = rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.reports-dropdown-wrapper')) {
        setIsIncluirOpen(false);
        setIsActionsOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleSelectAll = (checked: boolean) => setSelectedIds(checked ? rows.map((r) => r.id) : []);
  const handleSelectRow = (id: string, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));

  const handleSort = (field: SgqSortField) => {
    setOrdering((prev) => nextSgqOrdering(field, prev));
    setCurrentPage(1);
    setSelectedIds([]);
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const resetFilters = () => {
    setSearch('');
    setFilterCliente('');
    setFilterMotorista('');
    setFilterCriadoPor('');
    setFilterAvaliacao('');
    setFilterDataInicio('');
    setFilterDataFim('');
    setCurrentPage(1);
    setSelectedIds([]);
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
    setSelectedIds([]);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
    setSelectedIds([]);
  };

  const openCreateModal = () => {
    if (!canCreatePesquisas) return;
    setEditingPesquisa(null);
    const hoje = new Date().toISOString().split('T')[0];
    setForm({ ...EMPTY_FORM, dataEntrega: hoje });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (pesquisa: SgqPesquisa) => {
    if (!canEditPesquisas) return;
    setEditingPesquisa(pesquisa);
    setForm({
      dataEntrega: pesquisa.dataEntrega,
      cliente: pesquisa.cliente,
      motorista: pesquisa.motorista,
      cte: pesquisa.cte,
      notaFiscal: pesquisa.notaFiscal,
      clienteRecusouAssinar: pesquisa.clienteRecusouAssinar,
      prazoEntrega: pesquisa.prazoEntrega,
      condicoesMercadoria: pesquisa.condicoesMercadoria,
      condicoesVeiculo: pesquisa.condicoesVeiculo,
      apresentacaoMotorista: pesquisa.apresentacaoMotorista,
      atendimentoDispensado: pesquisa.atendimentoDispensado,
      analise: pesquisa.analise,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.clienteRecusouAssinar) {
      const faltantes = SGQ_CRITERIOS.filter((criterio) => !form[criterio.key]);
      if (faltantes.length > 0) {
        setFormError(`Avalie todos os critérios: ${faltantes.map((c) => c.label).join(', ')}.`);
        return;
      }
    }
    setFormError('');

    const payload: SgqPesquisaPayload = {
      dataEntrega: form.dataEntrega,
      cliente: form.cliente as SgqPesquisaPayload['cliente'],
      motorista: form.motorista.trim(),
      cte: form.cte.trim(),
      notaFiscal: form.notaFiscal.trim(),
      clienteRecusouAssinar: form.clienteRecusouAssinar,
      prazoEntrega: form.clienteRecusouAssinar ? '' : (form.prazoEntrega as SgqAvaliacao),
      condicoesMercadoria: form.clienteRecusouAssinar ? '' : (form.condicoesMercadoria as SgqAvaliacao),
      condicoesVeiculo: form.clienteRecusouAssinar ? '' : (form.condicoesVeiculo as SgqAvaliacao),
      apresentacaoMotorista: form.clienteRecusouAssinar ? '' : (form.apresentacaoMotorista as SgqAvaliacao),
      atendimentoDispensado: form.clienteRecusouAssinar ? '' : (form.atendimentoDispensado as SgqAvaliacao),
      analise: form.analise.trim(),
    };

    if (editingPesquisa) {
      updatePesquisa.mutate(
        { id: editingPesquisa.id, payload },
        {
          onSuccess: () => setIsModalOpen(false),
          onError: () => setFormError('Erro ao atualizar a pesquisa. Tente novamente.'),
        },
      );
    } else {
      createPesquisa.mutate(payload, {
        onSuccess: () => {
          setIsModalOpen(false);
          setCurrentPage(1);
        },
        onError: () => setFormError('Erro ao registrar a pesquisa. Tente novamente.'),
      });
    }
  };

  const handleEditSelected = () => {
    setIsActionsOpen(false);
    if (!canEditPesquisas || selectedRows.length !== 1) return;
    openEditModal(selectedRows[0]);
  };

  const handleBulkDelete = async () => {
    setIsActionsOpen(false);
    if (!canDeletePesquisas || selectedRows.length === 0) return;
    const confirmMessage = selectedRows.length > 1
      ? `Deseja realmente excluir as ${selectedRows.length} pesquisas selecionadas?`
      : `Excluir a pesquisa do CT-e ${selectedRows[0].cte} (${selectedRows[0].cliente})?`;
    if (!window.confirm(confirmMessage)) return;
    try {
      await Promise.all(selectedRows.map((r) => deletePesquisa.mutateAsync(r.id)));
      setSelectedIds([]);
    } catch {
      alert('Erro ao excluir uma ou mais pesquisas. Tente novamente.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '4px' }}>
      {/* Sugestões de motorista (autocomplete nativo) — compartilhada pelo formulário
          e pela inclusão em tabela, para reduzir o mesmo motorista sendo digitado
          de formas diferentes, sem exigir um cadastro formal deles. */}
      <datalist id="sgq-motoristas-sugestoes">
        {motoristasSugeridos.map((nome) => (
          <option key={nome} value={nome} />
        ))}
      </datalist>

      {/* Header */}
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }}></div>
          <h1 className="view-page-title">Pesquisa de Satisfação</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {canMutatePesquisas && (
            <div className="reports-dropdown-wrapper">
              <button
                type="button"
                className="reports-action-btn secondary"
                disabled={selectedIds.length === 0}
                onClick={() => { setIsIncluirOpen(false); setIsActionsOpen((open) => !open); }}
              >
                <span>Ações{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}</span>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className={`reports-dropdown-menu ${isActionsOpen ? 'show' : ''}`}>
                {canEditPesquisas && selectedRows.length === 1 && (
                  <span className="reports-dropdown-item" onClick={handleEditSelected}>
                    <span className="reports-dropdown-item-left">
                      <i className="bi bi-pencil" />
                      Editar
                    </span>
                  </span>
                )}
                {canDeletePesquisas && (
                  <span className="reports-dropdown-item is-danger" onClick={handleBulkDelete}>
                    <span className="reports-dropdown-item-left">
                      <i className="bi bi-trash" />
                      Excluir
                    </span>
                  </span>
                )}
              </div>
            </div>
          )}

          {canCreatePesquisas && hasLoteDraft ? (
            <button
              type="button"
              className="reports-action-btn primary"
              style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
              onClick={() => {
                setIsActionsOpen(false);
                setIsIncluirOpen(false);
                setIsLoteModalOpen(true);
              }}
              title="Continuar rascunho da inclusão em tabela"
            >
              <i className="bi bi-journal-text" aria-hidden="true" />
              <span>Rascunho</span>
            </button>
          ) : (canCreatePesquisas || canImportPesquisas) && (
            <div className="reports-dropdown-wrapper">
              <button
                type="button"
                className="reports-action-btn primary"
                style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
                onClick={() => { setIsActionsOpen(false); setIsIncluirOpen((open) => !open); }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"></path>
                </svg>
                <span>{canCreatePesquisas ? 'Incluir' : 'Importar'}</span>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className={`reports-dropdown-menu ${isIncluirOpen ? 'show' : ''}`}>
                {canCreatePesquisas && (
                  <>
                    <span
                      className="reports-dropdown-item"
                      onClick={() => { setIsIncluirOpen(false); openCreateModal(); }}
                    >
                      <span className="reports-dropdown-item-left">
                        <i className="bi bi-file-earmark-text" />
                        Formulário
                      </span>
                    </span>
                    <span
                      className="reports-dropdown-item"
                      onClick={() => { setIsIncluirOpen(false); setIsLoteModalOpen(true); }}
                    >
                      <span className="reports-dropdown-item-left">
                        <i className="bi bi-table" />
                        Inclusão em Tabela
                      </span>
                    </span>
                  </>
                )}
                {canImportPesquisas && (
                  <span
                    className="reports-dropdown-item"
                    onClick={() => { setIsIncluirOpen(false); setIsImportModalOpen(true); }}
                  >
                    <span className="reports-dropdown-item-left">
                      <i className="bi bi-file-earmark-arrow-up" />
                      Importar planilha
                    </span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Filtros */}
      <div className="reports-filters-bar sgq-filters-bar" style={{ marginBottom: '16px' }}>
        <div className="reports-filter-left">
          <div className="reports-filter-icon-label">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"></path>
            </svg>
            <span>Filtrar</span>
          </div>

          <div className="reports-search-wrapper">
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z"></path>
            </svg>
            <input
              type="text"
              placeholder="Motorista, CT-e ou NF..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); setSelectedIds([]); }}
            />
          </div>

          <div className="reports-select-wrapper">
            <select value={filterMotorista} onChange={(e) => { setFilterMotorista(e.target.value); setCurrentPage(1); setSelectedIds([]); }}>
              <option value="">Motorista</option>
              {motoristasSugeridos.map((nome) => (
                <option key={nome} value={nome}>{nome}</option>
              ))}
            </select>
          </div>

          <div className="reports-select-wrapper">
            <select value={filterCliente} onChange={(e) => { setFilterCliente(e.target.value); setCurrentPage(1); setSelectedIds([]); }}>
              <option value="">Cliente</option>
              {SGQ_CLIENTE_OPTIONS.map((cliente) => (
                <option key={cliente} value={cliente}>{cliente}</option>
              ))}
            </select>
          </div>

          <div className="reports-select-wrapper">
            <select value={filterCriadoPor} onChange={(e) => { setFilterCriadoPor(e.target.value); setCurrentPage(1); setSelectedIds([]); }}>
              <option value="">Lançado por</option>
              {lancadoresSugeridos.map((nome) => (
                <option key={nome} value={nome}>{nome}</option>
              ))}
            </select>
          </div>

          <div className="reports-select-wrapper">
            <select value={filterAvaliacao} onChange={(e) => { setFilterAvaliacao(e.target.value); setCurrentPage(1); setSelectedIds([]); }}>
              <option value="">Avaliação</option>
              {SGQ_AVALIACAO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <input
            type="date"
            className="sgq-filter-date"
            title="Data inicial"
            value={filterDataInicio}
            onChange={(e) => { setFilterDataInicio(e.target.value); setCurrentPage(1); setSelectedIds([]); }}
          />
          <input
            type="date"
            className="sgq-filter-date"
            title="Data final"
            value={filterDataFim}
            onChange={(e) => { setFilterDataFim(e.target.value); setCurrentPage(1); setSelectedIds([]); }}
          />

          <button type="button" className="reports-action-btn secondary" onClick={resetFilters}>
            Limpar
          </button>
        </div>

        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{totalItems}</strong> Registros</span>
        </div>
      </div>

      <QueryDataPanel
        query={listQuery}
        loadingMessage="Carregando pesquisas de satisfação..."
        refreshingMessage="Atualizando pesquisas..."
        errorMessage="Não foi possível carregar as pesquisas. Tente novamente."
      >
          <div className="erp-card reports-table-card" style={{ padding: '8px', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="table-container sgq-pesquisas-table-container" style={{ flex: 1, overflowY: 'auto' }}>
              <table className="erp-table reports-table sgq-pesquisas-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {canMutatePesquisas && (
                    <th className="checkbox-cell" style={{ width: '3%' }}>
                      <input type="checkbox" checked={isAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} style={{ borderRadius: '4px' }} />
                    </th>
                  )}
                  <th
                    style={{ width: '8%', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('data_inclusao')}
                    title="Classificar por data de inclusão"
                  >
                    Data Inclusão <SgqSortIcon field="data_inclusao" ordering={ordering} />
                  </th>
                  <th
                    style={{ width: '8%', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('data_entrega')}
                    title="Classificar por data de entrega"
                  >
                    Data Entrega <SgqSortIcon field="data_entrega" ordering={ordering} />
                  </th>
                  <th style={{ width: '7%' }}>Cliente</th>
                  <th style={{ width: '11%' }}>Motorista</th>
                  <th style={{ width: '6%' }}>CT-e</th>
                  <th style={{ width: '6%' }}>NF</th>
                  {SGQ_CRITERIOS.map((criterio) => (
                    <th key={criterio.key} title={criterio.label} className="sgq-col-avaliacao">
                      {criterio.shortLabel}
                    </th>
                  ))}
                  <th style={{ width: '10%' }}>Lançado por</th>
                </tr>
              </thead>
                <tbody>
                  {listState.canShowEmpty && rows.length === 0 ? (
                    <tr>
                      <td colSpan={canMutatePesquisas ? 13 : 12} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '20px' }}>
                        Nenhuma pesquisa encontrada.
                      </td>
                    </tr>
                  ) : (
                    rows.map((pesquisa) => (
                      <tr key={pesquisa.id}>
                        {canMutatePesquisas && (
                          <td className="checkbox-cell">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(pesquisa.id)}
                              onChange={(e) => handleSelectRow(pesquisa.id, e.target.checked)}
                              style={{ borderRadius: '4px' }}
                            />
                          </td>
                        )}
                        <td style={{ fontWeight: 500 }}>{pesquisa.dataInclusao ? formatDateBr(pesquisa.dataInclusao) : '—'}</td>
                        <td style={{ fontWeight: 500 }}>{formatDateBr(pesquisa.dataEntrega)}</td>
                        <td>{pesquisa.cliente}</td>
                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pesquisa.motorista}>
                          {pesquisa.motorista}
                        </td>
                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pesquisa.cte}>
                          {pesquisa.cte}
                        </td>
                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pesquisa.notaFiscal}>
                          {pesquisa.notaFiscal}
                        </td>
                        {(pesquisa.clienteRecusouAssinar || SGQ_CRITERIOS.every((c) => !pesquisa[c.key])) ? (
                          <td
                            colSpan={SGQ_CRITERIOS.length}
                            style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '12.5px' }}
                          >
                            Não avaliou
                          </td>
                        ) : (
                          SGQ_CRITERIOS.map((criterio) => (
                            <td key={criterio.key} className="sgq-col-avaliacao">
                              <AvaliacaoBadge value={pesquisa[criterio.key]} />
                            </td>
                          ))
                        )}
                        <td title={pesquisa.criadoPor || undefined}>
                          {pesquisa.criadoPor ? (
                            <span className="sgq-lancado-por-badge">{pesquisa.criadoPor}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginação */}
          <div className="erp-pagination-bar">
            <div className="erp-pagination-page-size">
              <label htmlFor="sgq-pesquisas-page-size">Itens por página</label>
              <select
                id="sgq-pesquisas-page-size"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <span style={{ fontWeight: 500, marginRight: '4px' }}>
              Página <span className="erp-pagination-current">{clampedPage}</span> de{' '}
              <span className="erp-pagination-current">{totalPages}</span>
              <span className="erp-pagination-meta">({totalItems} registros)</span>
            </span>

            <button
              type="button"
              className="reports-action-btn secondary"
              title="Primeira página"
              aria-label="Primeira página"
              disabled={clampedPage <= 1}
              onClick={() => goToPage(1)}
              style={{ height: '32px', width: '32px', padding: 0, fontSize: '12px', opacity: clampedPage <= 1 ? 0.5 : 1, cursor: clampedPage <= 1 ? 'not-allowed' : 'pointer' }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 4.5l-7.5 7.5 7.5 7.5M11.25 4.5l-7.5 7.5 7.5 7.5" />
              </svg>
            </button>
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={clampedPage <= 1}
              onClick={() => goToPage(clampedPage - 1)}
              style={{ height: '32px', padding: '0 12px', fontSize: '12px', gap: '6px', opacity: clampedPage <= 1 ? 0.5 : 1, cursor: clampedPage <= 1 ? 'not-allowed' : 'pointer' }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Anterior
            </button>
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={clampedPage >= totalPages}
              onClick={() => goToPage(clampedPage + 1)}
              style={{ height: '32px', padding: '0 12px', fontSize: '12px', gap: '6px', opacity: clampedPage >= totalPages ? 0.5 : 1, cursor: clampedPage >= totalPages ? 'not-allowed' : 'pointer' }}
            >
              Próximo
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
            <button
              type="button"
              className="reports-action-btn secondary"
              title="Última página"
              aria-label="Última página"
              disabled={clampedPage >= totalPages}
              onClick={() => goToPage(totalPages)}
              style={{ height: '32px', width: '32px', padding: 0, fontSize: '12px', opacity: clampedPage >= totalPages ? 0.5 : 1, cursor: clampedPage >= totalPages ? 'not-allowed' : 'pointer' }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5M12.75 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </QueryDataPanel>

      {/* MODAL: NOVA/EDITAR PESQUISA */}
      {isModalOpen && ((editingPesquisa && canEditPesquisas) || (!editingPesquisa && canCreatePesquisas)) && (
        <div
          className="search-backdrop"
          style={{ display: 'flex', alignItems: 'center', padding: '24px 16px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div className="modal-card" style={{ width: 'min(820px, 100%)' }}>
            <div className="modal-header">
              <h3>{editingPesquisa ? 'Editar Pesquisa de Satisfação' : 'Nova Pesquisa de Satisfação'}</h3>
              <button type="button" className="btn-icon" onClick={() => setIsModalOpen(false)} aria-label="Fechar">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <form className="modal-body" onSubmit={handleSubmit}>
              <div className="form-grid three-cols">
                <label>
                  Data Entrega
                  <input type="date" className="form-input" required value={form.dataEntrega} onChange={(e) => setField('dataEntrega', e.target.value)} />
                </label>
                <label>
                  Motorista
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="Nome do motorista"
                    value={form.motorista}
                    onChange={(e) => setField('motorista', e.target.value)}
                    autoComplete="off"
                    list="sgq-motoristas-sugestoes"
                  />
                </label>
                <label>
                  CT-e
                  <input type="text" className="form-input" required placeholder="Nº do CT-e" value={form.cte} onChange={(e) => setField('cte', e.target.value)} autoComplete="off" />
                </label>
              </div>

              <div className="form-grid three-cols" style={{ marginTop: '14px' }}>
                <label>
                  Nota Fiscal
                  <input type="text" className="form-input" required placeholder="Nº da NF" value={form.notaFiscal} onChange={(e) => setField('notaFiscal', e.target.value)} autoComplete="off" />
                </label>
                <label>
                  Cliente
                  <select className="form-input" required value={form.cliente} onChange={(e) => setField('cliente', e.target.value)}>
                    {SGQ_CLIENTE_OPTIONS.map((cliente) => (
                      <option key={cliente} value={cliente}>{cliente}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '16px',
                  padding: '10px 14px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.clienteRecusouAssinar}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setForm((prev) => ({
                      ...prev,
                      clienteRecusouAssinar: checked,
                      ...(checked
                        ? {
                            prazoEntrega: '',
                            condicoesMercadoria: '',
                            condicoesVeiculo: '',
                            apresentacaoMotorista: '',
                            atendimentoDispensado: '',
                          }
                        : {}),
                    }));
                  }}
                  style={{ width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0, accentColor: '#118CC4' }}
                />
                Cliente se recusou a avaliar
              </label>

              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '20px', marginBottom: '10px' }}>
                Avaliações
              </div>
              {form.clienteRecusouAssinar ? (
                <div style={{ padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#64748b', fontSize: '13px' }}>
                  Avaliações ficam em branco — conta como “Não avaliou” no indicador.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  {SGQ_CRITERIOS.map((criterio) => (
                    <div key={criterio.key}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        {criterio.label} <span style={{ color: '#dc2626' }}>*</span>
                      </div>
                      <AvaliacaoChips value={form[criterio.key]} onChange={(v) => setField(criterio.key, v)} />
                    </div>
                  ))}
                </div>
              )}

              <label style={{ display: 'block', marginTop: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                  Análise, Tratativa e Justificativa
                </div>
                <textarea className="form-input" rows={3} placeholder="Digite a análise, tratativa e justificativa..." value={form.analise} onChange={(e) => setField('analise', e.target.value)} />
              </label>

              {formError && (
                <div style={{ marginTop: '14px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '13px' }}>
                  {formError}
                </div>
              )}

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="reports-action-btn secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="reports-action-btn primary" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : (editingPesquisa ? 'Salvar Alterações' : 'Registrar Pesquisa')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoteModalOpen && canCreatePesquisas && (
        <SGQPesquisaLoteModal
          onClose={() => {
            setIsLoteModalOpen(false);
            void loteDraftQuery.refetch();
          }}
        />
      )}

      {isImportModalOpen && canImportPesquisas && (
        <SGQPesquisaImportModal onClose={() => setIsImportModalOpen(false)} />
      )}
    </div>
  );
};

export default SGQPesquisaSatisfacao;
