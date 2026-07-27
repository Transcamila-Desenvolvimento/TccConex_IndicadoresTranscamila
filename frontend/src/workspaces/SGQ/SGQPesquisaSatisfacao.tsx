import React, { useState, useMemo, useEffect } from 'react';
import type { SgqAvaliacao, SgqPesquisa, SgqPesquisaPayload } from '../../types/domain';
import { SGQ_AVALIACAO_OPTIONS, SGQ_CLIENTE_OPTIONS, SGQ_CRITERIOS } from '../../types/domain';
import {
  useSgqPesquisas,
  useCreateSgqPesquisa,
  useUpdateSgqPesquisa,
  useDeleteSgqPesquisa,
} from '../../hooks/useSgqPesquisas';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import SGQPesquisaLoteModal from './SGQPesquisaLoteModal';

const PAGE_SIZE = 10;

/** Todos os ícones são círculos preenchidos ("-circle-fill"), mesmo peso e formato —
 * só o glifo interno e a cor mudam entre os níveis. */
const AVALIACAO_META: Record<SgqAvaliacao, { label: string; color: string; icon: string }> = {
  otimo: { label: 'Ótimo', color: '#16a34a', icon: 'bi bi-check-circle-fill' },
  bom: { label: 'Bom', color: '#0f85c1', icon: 'bi bi-check-circle-fill' },
  regular: { label: 'Regular', color: '#d97706', icon: 'bi bi-exclamation-circle-fill' },
  ruim: { label: 'Ruim', color: '#dc2626', icon: 'bi bi-x-circle-fill' },
};

function formatDateBr(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function AvaliacaoBadge({ value }: { value: SgqAvaliacao }) {
  const meta = AVALIACAO_META[value];
  if (!meta) return <span>—</span>;
  return (
    <span className="sgq-avaliacao-badge" style={{ color: meta.color }}>
      <i className={meta.icon} />
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
            {selected && <i className="bi bi-check-lg" style={{ fontSize: '10px' }} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

type FormState = {
  data: string;
  cliente: string;
  motorista: string;
  cte: string;
  notaFiscal: string;
  prazoEntrega: SgqAvaliacao | '';
  condicoesMercadoria: SgqAvaliacao | '';
  condicoesVeiculo: SgqAvaliacao | '';
  apresentacaoMotorista: SgqAvaliacao | '';
  atendimentoDispensado: SgqAvaliacao | '';
  analise: string;
  tratativaJustificativa: string;
};

const EMPTY_FORM: FormState = {
  data: '',
  cliente: 'OUTROS',
  motorista: '',
  cte: '',
  notaFiscal: '',
  prazoEntrega: '',
  condicoesMercadoria: '',
  condicoesVeiculo: '',
  apresentacaoMotorista: '',
  atendimentoDispensado: '',
  analise: '',
  tratativaJustificativa: '',
};

const SGQPesquisaSatisfacao: React.FC = () => {
  // Filtros e paginação (server-side)
  const [search, setSearch] = useState('');
  const [filterCliente, setFilterCliente] = useState('');
  const [filterAvaliacao, setFilterAvaliacao] = useState('');
  const [filterDataInicio, setFilterDataInicio] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filterParams = useMemo(() => ({
    search: search.trim() || undefined,
    cliente: filterCliente || undefined,
    avaliacao: filterAvaliacao || undefined,
    dataInicio: filterDataInicio || undefined,
    dataFim: filterDataFim || undefined,
  }), [search, filterCliente, filterAvaliacao, filterDataInicio, filterDataFim]);

  const listParams = useMemo(() => ({
    ...filterParams,
    page: currentPage,
    pageSize: PAGE_SIZE,
  }), [filterParams, currentPage]);

  const listQuery = useSgqPesquisas(listParams);
  const listState = useAsyncQueryState(listQuery);
  const rows = listQuery.data?.results ?? [];
  const totalItems = listQuery.data?.count ?? 0;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;

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

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const resetFilters = () => {
    setSearch('');
    setFilterCliente('');
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

  const openCreateModal = () => {
    setEditingPesquisa(null);
    setForm({ ...EMPTY_FORM, data: new Date().toISOString().split('T')[0] });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (pesquisa: SgqPesquisa) => {
    setEditingPesquisa(pesquisa);
    setForm({
      data: pesquisa.data,
      cliente: pesquisa.cliente,
      motorista: pesquisa.motorista,
      cte: pesquisa.cte,
      notaFiscal: pesquisa.notaFiscal,
      prazoEntrega: pesquisa.prazoEntrega,
      condicoesMercadoria: pesquisa.condicoesMercadoria,
      condicoesVeiculo: pesquisa.condicoesVeiculo,
      apresentacaoMotorista: pesquisa.apresentacaoMotorista,
      atendimentoDispensado: pesquisa.atendimentoDispensado,
      analise: pesquisa.analise,
      tratativaJustificativa: pesquisa.tratativaJustificativa,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const faltantes = SGQ_CRITERIOS.filter((criterio) => !form[criterio.key]);
    if (faltantes.length > 0) {
      setFormError(`Avalie todos os critérios: ${faltantes.map((c) => c.label).join(', ')}.`);
      return;
    }
    setFormError('');

    const payload: SgqPesquisaPayload = {
      data: form.data,
      cliente: form.cliente as SgqPesquisaPayload['cliente'],
      motorista: form.motorista.trim(),
      cte: form.cte.trim(),
      notaFiscal: form.notaFiscal.trim(),
      prazoEntrega: form.prazoEntrega as SgqAvaliacao,
      condicoesMercadoria: form.condicoesMercadoria as SgqAvaliacao,
      condicoesVeiculo: form.condicoesVeiculo as SgqAvaliacao,
      apresentacaoMotorista: form.apresentacaoMotorista as SgqAvaliacao,
      atendimentoDispensado: form.atendimentoDispensado as SgqAvaliacao,
      analise: form.analise.trim(),
      tratativaJustificativa: form.tratativaJustificativa.trim(),
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
    if (selectedRows.length !== 1) return;
    openEditModal(selectedRows[0]);
  };

  const handleBulkDelete = async () => {
    setIsActionsOpen(false);
    if (selectedRows.length === 0) return;
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
      {/* Header */}
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }}></div>
          <h1 className="view-page-title">Pesquisa de Satisfação</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              {selectedRows.length === 1 && (
                <span className="reports-dropdown-item" onClick={handleEditSelected}>
                  <span className="reports-dropdown-item-left">
                    <i className="bi bi-pencil" />
                    Editar
                  </span>
                </span>
              )}
              <span className="reports-dropdown-item is-danger" onClick={handleBulkDelete}>
                <span className="reports-dropdown-item-left">
                  <i className="bi bi-trash" />
                  Excluir
                </span>
              </span>
            </div>
          </div>

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
              <span>Incluir</span>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`reports-dropdown-menu ${isIncluirOpen ? 'show' : ''}`}>
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
            </div>
          </div>
        </div>
      </header>

      {/* Filtros */}
      <div className="reports-filters-bar" style={{ marginBottom: '16px' }}>
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
            <select value={filterCliente} onChange={(e) => { setFilterCliente(e.target.value); setCurrentPage(1); setSelectedIds([]); }}>
              <option value="">Cliente: Todos</option>
              {SGQ_CLIENTE_OPTIONS.map((cliente) => (
                <option key={cliente} value={cliente}>{cliente}</option>
              ))}
            </select>
          </div>

          <div className="reports-select-wrapper">
            <select value={filterAvaliacao} onChange={(e) => { setFilterAvaliacao(e.target.value); setCurrentPage(1); setSelectedIds([]); }}>
              <option value="">Avaliação: Todas</option>
              {SGQ_AVALIACAO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <input
            type="date"
            title="Data inicial"
            value={filterDataInicio}
            onChange={(e) => { setFilterDataInicio(e.target.value); setCurrentPage(1); setSelectedIds([]); }}
            style={{ height: '36px', padding: '0 12px', background: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155', outline: 'none', boxSizing: 'border-box', width: '140px' }}
          />
          <input
            type="date"
            title="Data final"
            value={filterDataFim}
            onChange={(e) => { setFilterDataFim(e.target.value); setCurrentPage(1); setSelectedIds([]); }}
            style={{ height: '36px', padding: '0 12px', background: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155', outline: 'none', boxSizing: 'border-box', width: '140px' }}
          />

          <button type="button" className="reports-action-btn secondary" onClick={resetFilters}>
            Limpar Filtros
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
            <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
              <table className="erp-table reports-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th className="checkbox-cell" style={{ width: '3%' }}>
                    <input type="checkbox" checked={isAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} style={{ borderRadius: '4px' }} />
                  </th>
                  <th style={{ width: '10%' }}>Data</th>
                  <th style={{ width: '9%' }}>Cliente</th>
                  <th style={{ width: '22%' }}>Motorista</th>
                  <th style={{ width: '8%' }}>CT-e</th>
                  <th style={{ width: '8%' }}>NF</th>
                  {SGQ_CRITERIOS.map((criterio) => (
                    <th key={criterio.key} title={criterio.label} style={{ width: '8%', textAlign: 'center' }}>
                      {criterio.shortLabel}
                    </th>
                  ))}
                </tr>
              </thead>
                <tbody>
                  {listState.canShowEmpty && rows.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '20px' }}>
                        Nenhuma pesquisa encontrada.
                      </td>
                    </tr>
                  ) : (
                    rows.map((pesquisa) => (
                      <tr key={pesquisa.id}>
                        <td className="checkbox-cell">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(pesquisa.id)}
                            onChange={(e) => handleSelectRow(pesquisa.id, e.target.checked)}
                            style={{ borderRadius: '4px' }}
                          />
                        </td>
                        <td style={{ fontWeight: 500 }}>{formatDateBr(pesquisa.data)}</td>
                        <td>{pesquisa.cliente}</td>
                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pesquisa.motorista}>
                          {pesquisa.motorista}
                        </td>
                        <td>{pesquisa.cte}</td>
                        <td>{pesquisa.notaFiscal}</td>
                        {SGQ_CRITERIOS.map((criterio) => (
                          <td key={criterio.key} style={{ textAlign: 'center' }}>
                            <AvaliacaoBadge value={pesquisa[criterio.key]} />
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginação */}
          <div className="erp-pagination-bar">
            <span style={{ fontWeight: 500, marginRight: '4px' }}>
              {totalItems} registro(s) — Página <span className="erp-pagination-current">{Math.min(currentPage, totalPages)}</span> de <span className="erp-pagination-current">{totalPages}</span>
            </span>
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={currentPage <= 1}
              onClick={() => goToPage(Math.max(1, currentPage - 1))}
              style={{ height: '28px', padding: '0 10px', fontSize: '11px', gap: '4px', opacity: currentPage <= 1 ? 0.5 : 1, cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Anterior
            </button>
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={currentPage >= totalPages}
              onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
              style={{ height: '28px', padding: '0 10px', fontSize: '11px', gap: '4px', opacity: currentPage >= totalPages ? 0.5 : 1, cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}
            >
              Próximo
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </QueryDataPanel>

      {/* MODAL: NOVA/EDITAR PESQUISA */}
      {isModalOpen && (
        <div
          className="search-backdrop"
          style={{ display: 'flex', alignItems: 'center', padding: '24px 16px' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
        >
          <div className="modal-card" style={{ width: 'min(640px, 100%)' }}>
            <div className="modal-header">
              <h3>{editingPesquisa ? 'Editar Pesquisa de Satisfação' : 'Nova Pesquisa de Satisfação'}</h3>
              <button type="button" className="btn-icon" onClick={() => setIsModalOpen(false)} aria-label="Fechar">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <form className="modal-body" onSubmit={handleSubmit}>
              <div className="form-grid two-cols">
                <label>
                  Data
                  <input type="date" className="form-input" required value={form.data} onChange={(e) => setField('data', e.target.value)} />
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

              <label style={{ display: 'block', marginTop: '14px' }}>
                Motorista
                <input type="text" className="form-input" required placeholder="Nome do motorista" value={form.motorista} onChange={(e) => setField('motorista', e.target.value)} autoComplete="off" />
              </label>

              <div className="form-grid two-cols" style={{ marginTop: '14px' }}>
                <label>
                  CT-e
                  <input type="text" className="form-input" required placeholder="Nº do CT-e" value={form.cte} onChange={(e) => setField('cte', e.target.value)} autoComplete="off" />
                </label>
                <label>
                  Nota Fiscal
                  <input type="text" className="form-input" required placeholder="Nº da NF" value={form.notaFiscal} onChange={(e) => setField('notaFiscal', e.target.value)} autoComplete="off" />
                </label>
              </div>

              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '20px', marginBottom: '10px' }}>
                Avaliações
              </div>
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

              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '20px', marginBottom: '10px' }}>
                Análise e tratativa
              </div>
              <label style={{ display: 'block', marginBottom: '12px' }}>
                Análise (opcional)
                <textarea className="form-input" rows={2} placeholder="Digite a análise..." value={form.analise} onChange={(e) => setField('analise', e.target.value)} />
              </label>
              <label style={{ display: 'block' }}>
                Tratativa e Justificativa (opcional)
                <textarea className="form-input" rows={2} placeholder="Digite a tratativa e justificativa..." value={form.tratativaJustificativa} onChange={(e) => setField('tratativaJustificativa', e.target.value)} />
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

      {isLoteModalOpen && (
        <SGQPesquisaLoteModal onClose={() => setIsLoteModalOpen(false)} />
      )}
    </div>
  );
};

export default SGQPesquisaSatisfacao;
