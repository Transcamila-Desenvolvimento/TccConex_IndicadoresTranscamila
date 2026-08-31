import React, { useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { branchesForModule } from '../../constants/filiais';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  getFrotaErrorMessage,
  useCondutoresFrota,
  useCreateCondutorFrota,
  useDeleteCondutorFrota,
  useUpdateCondutorFrota,
} from '../../hooks/useFrotaVeiculos';
import type { CondutorFrota, CondutorFrotaPayload, VeiculoStatus } from '../../types/domain';
import {
  VEICULO_STATUS_LABEL,
  VEICULO_STATUS_OPTIONS,
} from '../../types/domain';

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const FILIAIS_FROTA = branchesForModule('Frota');

type CondutorForm = {
  nome: string;
  cpf: string;
  filial: string;
  status: VeiculoStatus;
};

const emptyForm: CondutorForm = {
  nome: '',
  cpf: '',
  filial: FILIAIS_FROTA[0] ?? '',
  status: 'ativo',
};

const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

const formatDateTime = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
};

const FrotaCadastroCondutores: React.FC = () => {
  const { user } = useAuth();
  const canManage = userHasFuncao(user, 'Frota', 'gerenciar-condutores');
  const condutoresQuery = useCondutoresFrota();
  const { canShowEmpty } = useAsyncQueryState(condutoresQuery);
  const createCondutor = useCreateCondutorFrota();
  const updateCondutor = useUpdateCondutorFrota();
  const deleteCondutor = useDeleteCondutorFrota();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFilial, setFilterFilial] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CondutorForm>(emptyForm);

  const condutores = condutoresQuery.data ?? [];
  const opcoesFilial = useMemo(
    () => [...new Set(condutores.map((c) => c.filial).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [condutores],
  );
  const filteredCondutores = useMemo(() => {
    const term = search.trim().toLowerCase();
    return condutores.filter((condutor) => {
      if (filterStatus && condutor.status !== filterStatus) return false;
      if (filterFilial && condutor.filial !== filterFilial) return false;
      if (!term) return true;
      const haystack = [condutor.nome, condutor.cpf, condutor.filial].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [condutores, search, filterStatus, filterFilial]);

  const totalPages = Math.max(1, Math.ceil(filteredCondutores.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pagedCondutores = filteredCondutores.slice(
    (clampedPage - 1) * pageSize,
    clampedPage * pageSize,
  );
  const editingCondutor = useMemo(
    () => condutores.find((c) => c.id === editingId) ?? null,
    [condutores, editingId],
  );

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const startEdit = (condutor: CondutorFrota) => {
    setEditingId(condutor.id);
    setForm({
      nome: condutor.nome,
      cpf: condutor.cpf || '',
      filial: condutor.filial,
      status: condutor.status,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      alert('Informe o nome do condutor.');
      return;
    }
    if (!form.filial) {
      alert('Informe a filial.');
      return;
    }
    const payload: CondutorFrotaPayload = {
      nome: form.nome.trim(),
      cpf: form.cpf.trim(),
      filial: form.filial,
      status: form.status,
    };
    const callbacks = {
      onSuccess: () => closeModal(),
      onError: (err: unknown) => alert(getFrotaErrorMessage(err)),
    };
    editingId
      ? updateCondutor.mutate({ id: editingId, payload }, callbacks)
      : createCondutor.mutate(payload, callbacks);
  };

  const handleDelete = (condutor: CondutorFrota) => {
    if (!window.confirm(`Excluir o condutor ${condutor.nome}?`)) return;
    deleteCondutor.mutate(condutor.id, {
      onSuccess: () => { if (editingId === condutor.id) closeModal(); },
      onError: (err) => alert(getFrotaErrorMessage(err)),
    });
  };

  const isPending = createCondutor.isPending || updateCondutor.isPending;

  return (
    <div className="fat-list-compact" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 4px 4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Condutores</h1>
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
            <span>Novo condutor</span>
          </button>
        )}
      </header>

      <div className="reports-filters-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
        <div className="reports-filter-left" style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="reports-search-wrapper" style={{ minWidth: '240px' }}>
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input
              type="text"
              placeholder="Nome, CPF..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="reports-select-wrapper" style={{ minWidth: '140px' }}>
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
              <option value="">Status: Todos</option>
              {VEICULO_STATUS_OPTIONS.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="reports-select-wrapper" style={{ minWidth: '180px' }}>
            <select value={filterFilial} onChange={(e) => { setFilterFilial(e.target.value); setPage(1); }}>
              <option value="">Filial: Todas</option>
              {opcoesFilial.map((filial) => (
                <option key={filial} value={filial}>{filial}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{filteredCondutores.length}</strong> Condutores</span>
        </div>
      </div>

      <QueryDataPanel
        query={condutoresQuery}
        loadingMessage="Carregando condutores..."
        refreshingMessage="Atualizando condutores..."
        errorMessage="Não foi possível carregar os condutores. Tente novamente."
      >
        <div className="erp-card reports-table-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Filial</th>
                  <th>Status</th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && filteredCondutores.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                      Nenhum condutor cadastrado.
                    </td>
                  </tr>
                ) : (
                  pagedCondutores.map((condutor) => (
                    <tr key={condutor.id}>
                      <td><strong>{condutor.nome || '—'}</strong></td>
                      <td>{condutor.cpf || '—'}</td>
                      <td>{condutor.filial || '—'}</td>
                      <td>
                        <span className={`status-badge ${condutor.status === 'ativo' ? 'success' : 'inativo'}`}>
                          {VEICULO_STATUS_LABEL[condutor.status] || condutor.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button type="button" className="btn-icon" title="Editar condutor" onClick={() => startEdit(condutor)}>
                            <i className="bi bi-pencil" />
                          </button>
                          {canManage && (
                            <button type="button" className="btn-icon" title="Excluir condutor" onClick={() => handleDelete(condutor)}>
                              <i className="bi bi-trash" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-pagination-bar">
          <div className="erp-pagination-page-size">
            <label htmlFor="condutores-page-size">Itens por página</label>
            <select
              id="condutores-page-size"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <span style={{ fontWeight: 500, marginRight: '4px' }}>
            Página <span className="erp-pagination-current">{clampedPage}</span> de{' '}
            <span className="erp-pagination-current">{totalPages}</span>
            <span className="erp-pagination-meta">({filteredCondutores.length} registros)</span>
          </span>

          <button
            type="button"
            className="reports-action-btn secondary"
            title="Primeira página"
            aria-label="Primeira página"
            disabled={clampedPage <= 1}
            onClick={() => setPage(1)}
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
            onClick={() => setPage(clampedPage - 1)}
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
            onClick={() => setPage(clampedPage + 1)}
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
            onClick={() => setPage(totalPages)}
            style={{ height: '32px', width: '32px', padding: 0, fontSize: '12px', opacity: clampedPage >= totalPages ? 0.5 : 1, cursor: clampedPage >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5M12.75 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </QueryDataPanel>

      {isModalOpen && (
        <div
          className="search-backdrop"
          style={{ display: 'flex', alignItems: 'center', padding: '24px 16px' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="modal-card" style={{ width: 'min(640px, 100%)' }} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>{editingId ? 'Editar condutor' : 'Novo condutor'}</h3>
              <button type="button" className="btn-icon" onClick={closeModal} aria-label="Fechar">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <form className="modal-body" onSubmit={handleSubmit}>
              <div className="form-grid two-cols">
                <label>
                  Nome
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    onBlur={() => setForm((prev) => ({ ...prev, nome: prev.nome.trim().toLocaleUpperCase('pt-BR') }))}
                    disabled={!canManage}
                  />
                </label>
                <label>
                  CPF
                  <input
                    type="text"
                    className="form-input"
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: formatCpf(e.target.value) })}
                    disabled={!canManage}
                    placeholder="Opcional"
                  />
                </label>
              </div>

              <div className="form-grid two-cols" style={{ marginTop: '14px' }}>
                <label>
                  Filial
                  <select
                    className="form-input"
                    value={form.filial}
                    required
                    disabled={!canManage}
                    onChange={(e) => setForm({ ...form, filial: e.target.value })}
                  >
                    {FILIAIS_FROTA.map((filial) => (
                      <option key={filial} value={filial}>{filial}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select
                    className="form-input"
                    value={form.status}
                    disabled={!canManage}
                    onChange={(e) => setForm({ ...form, status: e.target.value as VeiculoStatus })}
                  >
                    {VEICULO_STATUS_OPTIONS.map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>

              {editingId && (
                <div className="form-grid two-cols" style={{ marginTop: '14px' }}>
                  <label>
                    Data de cadastro
                    <input type="text" className="form-input" value={formatDateTime(editingCondutor?.dataCriacao)} disabled />
                  </label>
                </div>
              )}

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="reports-action-btn secondary" onClick={closeModal}>Cancelar</button>
                {canManage && (
                  <button type="submit" className="reports-action-btn primary" disabled={isPending}>
                    {isPending ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar condutor'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FrotaCadastroCondutores;
