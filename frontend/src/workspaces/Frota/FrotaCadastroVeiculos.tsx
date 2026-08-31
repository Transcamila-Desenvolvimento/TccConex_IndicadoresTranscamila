import React, { useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { branchesForModule } from '../../constants/filiais';
import { userHasFuncao } from '../../constants/funcoes';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  getFrotaErrorMessage,
  useCreateVeiculoFrota,
  useDeleteVeiculoFrota,
  useUpdateVeiculoFrota,
  useVeiculosFrota,
} from '../../hooks/useFrotaVeiculos';
import type {
  VeiculoCarroceria,
  VeiculoCategoria,
  VeiculoCombustivel,
  VeiculoFrota,
  VeiculoFrotaPayload,
  VeiculoStatus,
} from '../../types/domain';
import {
  VEICULO_CARROCERIA_LABEL,
  VEICULO_CARROCERIA_OPTIONS,
  VEICULO_CATEGORIA_LABEL,
  VEICULO_CATEGORIA_OPTIONS,
  VEICULO_COMBUSTIVEL_OPTIONS,
  VEICULO_STATUS_LABEL,
  VEICULO_STATUS_OPTIONS,
} from '../../types/domain';

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const FILIAIS_FROTA = branchesForModule('Frota');

type VeiculoForm = {
  placa: string;
  renavam: string;
  chassi: string;
  marca: string;
  modelo: string;
  anoFabricacao: string;
  anoModelo: string;
  cor: string;
  combustivel: VeiculoCombustivel;
  categoria: VeiculoCategoria;
  tipoCarroceria: VeiculoCarroceria;
  hodometro: string;
  status: VeiculoStatus;
  filial: string;
  observacoes: string;
};

const emptyForm: VeiculoForm = {
  placa: '',
  renavam: '',
  chassi: '',
  marca: '',
  modelo: '',
  anoFabricacao: '',
  anoModelo: '',
  cor: '',
  combustivel: 'diesel-s10',
  categoria: 'truck',
  tipoCarroceria: 'bau',
  hodometro: '0',
  status: 'ativo',
  filial: FILIAIS_FROTA[0] ?? '',
  observacoes: '',
};

const formatPlacaInput = (value: string) => {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7);
  if (cleaned.length <= 3) return cleaned;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
};

const formatDateTime = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
};

const parseOptionalYear = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const year = Number(trimmed);
  return Number.isInteger(year) ? year : null;
};

const FrotaCadastroVeiculos: React.FC = () => {
  const { user } = useAuth();
  const canManage = userHasFuncao(user, 'Frota', 'gerenciar-veiculos');
  const veiculosQuery = useVeiculosFrota();
  const { canShowEmpty } = useAsyncQueryState(veiculosQuery);
  const createVeiculo = useCreateVeiculoFrota();
  const updateVeiculo = useUpdateVeiculoFrota();
  const deleteVeiculo = useDeleteVeiculoFrota();

  const [search, setSearch] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFilial, setFilterFilial] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VeiculoForm>(emptyForm);

  const veiculos = veiculosQuery.data ?? [];
  const opcoesFilial = useMemo(
    () => [...new Set(veiculos.map((v) => v.filial).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [veiculos],
  );
  const filteredVeiculos = useMemo(() => {
    const term = search.trim().toLowerCase();
    return veiculos.filter((veiculo) => {
      if (filterCategoria && veiculo.categoria !== filterCategoria) return false;
      if (filterStatus && veiculo.status !== filterStatus) return false;
      if (filterFilial && veiculo.filial !== filterFilial) return false;
      if (!term) return true;
      const haystack = [
        veiculo.placa,
        veiculo.marca,
        veiculo.modelo,
        veiculo.chassi,
        veiculo.renavam,
        veiculo.cor,
        veiculo.filial,
      ].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [veiculos, search, filterCategoria, filterStatus, filterFilial]);

  const totalPages = Math.max(1, Math.ceil(filteredVeiculos.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pagedVeiculos = filteredVeiculos.slice(
    (clampedPage - 1) * pageSize,
    clampedPage * pageSize,
  );
  const editingVeiculo = useMemo(
    () => veiculos.find((v) => v.id === editingId) ?? null,
    [veiculos, editingId],
  );

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const startEdit = (veiculo: VeiculoFrota) => {
    setEditingId(veiculo.id);
    setForm({
      placa: veiculo.placa,
      renavam: veiculo.renavam || '',
      chassi: veiculo.chassi || '',
      marca: veiculo.marca || '',
      modelo: veiculo.modelo || '',
      anoFabricacao: veiculo.anoFabricacao ? String(veiculo.anoFabricacao) : '',
      anoModelo: veiculo.anoModelo ? String(veiculo.anoModelo) : '',
      cor: veiculo.cor || '',
      combustivel: veiculo.combustivel,
      categoria: veiculo.categoria,
      tipoCarroceria: veiculo.tipoCarroceria,
      hodometro: String(veiculo.hodometro ?? 0),
      status: veiculo.status,
      filial: veiculo.filial,
      observacoes: veiculo.observacoes || '',
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
    if (!form.placa.replace(/[^A-Za-z0-9]/g, '')) {
      alert('Informe a placa do veículo.');
      return;
    }
    if (!form.marca.trim() || !form.modelo.trim()) {
      alert('Informe marca e modelo.');
      return;
    }
    if (!form.filial) {
      alert('Informe a filial.');
      return;
    }
    const payload: VeiculoFrotaPayload = {
      placa: form.placa,
      renavam: form.renavam.trim(),
      chassi: form.chassi.trim(),
      marca: form.marca.trim(),
      modelo: form.modelo.trim(),
      anoFabricacao: parseOptionalYear(form.anoFabricacao),
      anoModelo: parseOptionalYear(form.anoModelo),
      cor: form.cor.trim(),
      combustivel: form.combustivel,
      categoria: form.categoria,
      tipoCarroceria: form.tipoCarroceria,
      hodometro: Number(form.hodometro) || 0,
      status: form.status,
      filial: form.filial,
      observacoes: form.observacoes.trim(),
    };
    const callbacks = {
      onSuccess: () => closeModal(),
      onError: (err: unknown) => alert(getFrotaErrorMessage(err)),
    };
    editingId
      ? updateVeiculo.mutate({ id: editingId, payload }, callbacks)
      : createVeiculo.mutate(payload, callbacks);
  };

  const handleDelete = (veiculo: VeiculoFrota) => {
    if (!window.confirm(`Excluir o veículo ${veiculo.placa}?`)) return;
    deleteVeiculo.mutate(veiculo.id, {
      onSuccess: () => { if (editingId === veiculo.id) closeModal(); },
      onError: (err) => alert(getFrotaErrorMessage(err)),
    });
  };

  const isPending = createVeiculo.isPending || updateVeiculo.isPending;

  return (
    <div className="fat-list-compact" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 4px 4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Veículos frota</h1>
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
            <span>Novo veículo</span>
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
              placeholder="Placa, marca, modelo..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="reports-select-wrapper" style={{ minWidth: '160px' }}>
            <select value={filterCategoria} onChange={(e) => { setFilterCategoria(e.target.value); setPage(1); }}>
              <option value="">Tipo de veículo: Todos</option>
              {VEICULO_CATEGORIA_OPTIONS.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
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
          <span className="reports-records-count"><strong>{filteredVeiculos.length}</strong> Veículos</span>
        </div>
      </div>

      <QueryDataPanel
        query={veiculosQuery}
        loadingMessage="Carregando veículos..."
        refreshingMessage="Atualizando veículos..."
        errorMessage="Não foi possível carregar os veículos. Tente novamente."
      >
        <div className="erp-card reports-table-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Ano</th>
                  <th>Tipo</th>
                  <th>Carroceria</th>
                  <th>Filial</th>
                  <th>Status</th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && filteredVeiculos.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                      Nenhum veículo cadastrado.
                    </td>
                  </tr>
                ) : (
                  pagedVeiculos.map((veiculo) => (
                    <tr key={veiculo.id}>
                      <td><strong>{veiculo.placa || '—'}</strong></td>
                      <td>{veiculo.marca || '—'}</td>
                      <td>{veiculo.modelo || '—'}</td>
                      <td>{veiculo.anoModelo || veiculo.anoFabricacao || '—'}</td>
                      <td>{VEICULO_CATEGORIA_LABEL[veiculo.categoria] || veiculo.categoria}</td>
                      <td>{VEICULO_CARROCERIA_LABEL[veiculo.tipoCarroceria] || veiculo.tipoCarroceria || '—'}</td>
                      <td>{veiculo.filial || '—'}</td>
                      <td>
                        <span className={`status-badge ${veiculo.status === 'ativo' ? 'success' : 'inativo'}`}>
                          {VEICULO_STATUS_LABEL[veiculo.status] || veiculo.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button type="button" className="btn-icon" title="Editar veículo" onClick={() => startEdit(veiculo)}>
                            <i className="bi bi-pencil" />
                          </button>
                          {canManage && (
                            <button type="button" className="btn-icon" title="Excluir veículo" onClick={() => handleDelete(veiculo)}>
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
            <label htmlFor="veiculos-page-size">Itens por página</label>
            <select
              id="veiculos-page-size"
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
            <span className="erp-pagination-meta">({filteredVeiculos.length} registros)</span>
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
          <div className="modal-card" style={{ width: 'min(820px, 100%)' }} role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>{editingId ? 'Editar veículo' : 'Novo veículo'}</h3>
              <button type="button" className="btn-icon" onClick={closeModal} aria-label="Fechar">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <form className="modal-body" onSubmit={handleSubmit}>
              <div className="form-grid three-cols">
                <label>
                  Placa
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={form.placa}
                    onChange={(e) => setForm({ ...form, placa: formatPlacaInput(e.target.value) })}
                    disabled={!canManage}
                    placeholder="ABC-1D23"
                  />
                </label>
                <label>
                  RENAVAM
                  <input
                    type="text"
                    className="form-input"
                    value={form.renavam}
                    onChange={(e) => setForm({ ...form, renavam: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                    disabled={!canManage}
                  />
                </label>
                <label>
                  Chassi
                  <input
                    type="text"
                    className="form-input"
                    value={form.chassi}
                    onChange={(e) => setForm({ ...form, chassi: e.target.value.toUpperCase() })}
                    disabled={!canManage}
                  />
                </label>
              </div>

              <div className="form-grid two-cols" style={{ marginTop: '14px' }}>
                <label>
                  Marca
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={form.marca}
                    onChange={(e) => setForm({ ...form, marca: e.target.value })}
                    onBlur={() => setForm((prev) => ({ ...prev, marca: prev.marca.trim().toLocaleUpperCase('pt-BR') }))}
                    disabled={!canManage}
                  />
                </label>
                <label>
                  Modelo
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={form.modelo}
                    onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                    onBlur={() => setForm((prev) => ({ ...prev, modelo: prev.modelo.trim().toLocaleUpperCase('pt-BR') }))}
                    disabled={!canManage}
                  />
                </label>
              </div>

              <div className="form-grid three-cols" style={{ marginTop: '14px' }}>
                <label>
                  Ano fabricação
                  <input
                    type="number"
                    className="form-input"
                    min={1950}
                    max={2100}
                    value={form.anoFabricacao}
                    onChange={(e) => setForm({ ...form, anoFabricacao: e.target.value })}
                    disabled={!canManage}
                  />
                </label>
                <label>
                  Ano modelo
                  <input
                    type="number"
                    className="form-input"
                    min={1950}
                    max={2100}
                    value={form.anoModelo}
                    onChange={(e) => setForm({ ...form, anoModelo: e.target.value })}
                    disabled={!canManage}
                  />
                </label>
                <label>
                  Cor
                  <input
                    type="text"
                    className="form-input"
                    value={form.cor}
                    onChange={(e) => setForm({ ...form, cor: e.target.value })}
                    disabled={!canManage}
                  />
                </label>
              </div>

              <div className="form-grid three-cols" style={{ marginTop: '14px' }}>
                <label>
                  Tipo de veículo
                  <select
                    className="form-input"
                    value={form.categoria}
                    disabled={!canManage}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value as VeiculoCategoria })}
                  >
                    {VEICULO_CATEGORIA_OPTIONS.map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Tipo de combustível
                  <select
                    className="form-input"
                    value={form.combustivel}
                    disabled={!canManage}
                    onChange={(e) => setForm({ ...form, combustivel: e.target.value as VeiculoCombustivel })}
                  >
                    {VEICULO_COMBUSTIVEL_OPTIONS.map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Tipo de carroceria
                  <select
                    className="form-input"
                    value={form.tipoCarroceria}
                    disabled={!canManage}
                    onChange={(e) => setForm({ ...form, tipoCarroceria: e.target.value as VeiculoCarroceria })}
                  >
                    {VEICULO_CARROCERIA_OPTIONS.map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-grid three-cols" style={{ marginTop: '14px' }}>
                <label>
                  Hodômetro (km)
                  <input
                    type="number"
                    className="form-input"
                    min={0}
                    value={form.hodometro}
                    onChange={(e) => setForm({ ...form, hodometro: e.target.value })}
                    disabled={!canManage}
                  />
                </label>
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

              <label style={{ display: 'block', marginTop: '14px' }}>
                Observações
                <textarea
                  className="form-input"
                  rows={3}
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  disabled={!canManage}
                />
              </label>

              {editingId && (
                <div className="form-grid two-cols" style={{ marginTop: '14px' }}>
                  <label>
                    Data de cadastro
                    <input type="text" className="form-input" value={formatDateTime(editingVeiculo?.dataCriacao)} disabled />
                  </label>
                  <label>
                    Data de atualização
                    <input type="text" className="form-input" value={formatDateTime(editingVeiculo?.dataAtualizacao)} disabled />
                  </label>
                </div>
              )}

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="reports-action-btn secondary" onClick={closeModal}>Cancelar</button>
                {canManage && (
                  <button type="submit" className="reports-action-btn primary" disabled={isPending}>
                    {isPending ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar veículo'}
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

export default FrotaCadastroVeiculos;
