import React, { useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  resolveFaturamentoErrorMessage,
  useBulkDeleteProtocolos,
  useDownloadProtocolosBulkPdf,
  openPdfPreviewInNewTab,
  openPdfPreviewPlaceholder,
  useProtocoloClientes,
  useProtocolosEnvio,
} from '../../hooks/useFaturamentoProtocolos';
import type { ProtocoloEnvio, ProtocoloOrdering, ProtocoloQueryParams } from '../../types/domain';
import NovoProtocoloModal from './modals/NovoProtocoloModal';
import GerenciarClientesProtocoloModal from './modals/GerenciarClientesProtocoloModal';
import ImportarProtocolosModal from './modals/ImportarProtocolosModal';

const formatDateBr = (value: string) => {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

type SortField = 'protocolo' | 'data';

function nextOrdering(field: SortField, current: ProtocoloOrdering | undefined): ProtocoloOrdering {
  if (field === 'protocolo') {
    return current === 'protocolo_asc' ? 'protocolo_desc' : 'protocolo_asc';
  }
  return current === 'data_asc' ? 'data_desc' : 'data_asc';
}

function SortIcon({ field, ordering }: { field: SortField; ordering?: ProtocoloOrdering }) {
  const isActive = ordering?.startsWith(field);
  const isAsc = ordering === `${field}_asc`;
  return (
    <span style={{ marginLeft: 6, display: 'inline-flex', flexDirection: 'column', gap: 0, verticalAlign: 'middle', lineHeight: 1 }}>
      <i className="bi bi-caret-up-fill" style={{ fontSize: 11, display: 'block', color: isActive && isAsc ? '#0f85c1' : '#c8d3e0' }} />
      <i className="bi bi-caret-down-fill" style={{ fontSize: 11, display: 'block', color: isActive && !isAsc ? '#0f85c1' : '#c8d3e0' }} />
    </span>
  );
}

const FaturamentoProtocolos: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.roleId === '1';
  const [filters, setFilters] = useState<ProtocoloQueryParams>({ page: 1, pageSize: DEFAULT_PAGE_SIZE, ordering: 'data_desc' });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showNovo, setShowNovo] = useState(false);
  const [editingProtocolo, setEditingProtocolo] = useState<ProtocoloEnvio | null>(null);
  const [showClientes, setShowClientes] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const protocolosQuery = useProtocolosEnvio(filters);
  const { canShowEmpty } = useAsyncQueryState(protocolosQuery);
  const clientesQuery = useProtocoloClientes();
  const bulkDelete = useBulkDeleteProtocolos();
  const downloadBulk = useDownloadProtocolosBulkPdf();

  const protocolos = protocolosQuery.data?.results ?? [];
  const total = protocolosQuery.data?.count ?? 0;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = filters.page ?? 1;
  const clampedPage = Math.min(currentPage, totalPages);

  const allSelected = useMemo(
    () => protocolos.length > 0 && protocolos.every((item) => selectedIds.includes(Number(item.id))),
    [protocolos, selectedIds],
  );

  const toggleAll = () =>
    setSelectedIds(allSelected ? [] : protocolos.map((item) => Number(item.id)));

  const toggleOne = (id: number) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
    setSelectedIds([]);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setFilters((prev) => ({ ...prev, pageSize: newPageSize, page: 1 }));
    setSelectedIds([]);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Excluir ${selectedIds.length} protocolo(s)?`)) return;
    bulkDelete.mutate(selectedIds, { onSuccess: () => setSelectedIds([]) });
  };

  const handlePrintSelected = () => {
    if (selectedIds.length === 0 || downloadBulk.isPending) return;

    // Reserva aba em branco no clique (anti-bloqueio). Loading fica só no overlay do ERP.
    const previewWindow = openPdfPreviewPlaceholder();
    if (!previewWindow) {
      alert(
        'Não foi possível abrir outra aba. Permita pop-ups para este site e tente novamente.',
      );
      return;
    }

    downloadBulk.mutate(selectedIds, {
      onSuccess: (blob) => {
        openPdfPreviewInNewTab(blob, previewWindow);
      },
      onError: async (error: unknown) => {
        previewWindow.close();
        alert(await resolveFaturamentoErrorMessage(error));
      },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '4px', position: 'relative' }}>
      {downloadBulk.isPending && (
        <div className="protocolo-pdf-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="protocolo-pdf-overlay-card">
            <span className="async-query-spinner" aria-hidden="true" />
            <div className="protocolo-pdf-overlay-text">
              <strong>Gerando PDF...</strong>
              <span>
                {selectedIds.length === 1
                  ? 'Preparando o protocolo selecionado'
                  : `Preparando ${selectedIds.length} protocolos`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Envio de NF para Cliente</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {selectedIds.length > 0 && (
            <>
              <button
                type="button"
                className="reports-action-btn secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}
                onClick={handlePrintSelected}
                disabled={downloadBulk.isPending}
              >
                {downloadBulk.isPending ? (
                  <span className="async-query-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} aria-hidden="true" />
                ) : (
                  <i className="bi bi-eye" />
                )}
                <span>{downloadBulk.isPending ? 'Gerando...' : `Visualizar PDF (${selectedIds.length})`}</span>
              </button>
              <button
                type="button"
                className="reports-action-btn secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px', color: '#ef4444', borderColor: '#fca5a5' }}
                onClick={handleDeleteSelected}
                disabled={bulkDelete.isPending}
              >
                <i className="bi bi-trash" />
                <span>Excluir ({selectedIds.length})</span>
              </button>
            </>
          )}
          {isAdmin && (
            <>
              <button
                type="button"
                className="reports-action-btn secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}
                onClick={() => setShowClientes(true)}
              >
                <i className="bi bi-people" />
                <span>Gerenciar clientes</span>
              </button>
              <button
                type="button"
                className="reports-action-btn secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}
                onClick={() => setShowImport(true)}
              >
                <i className="bi bi-file-earmark-excel" />
                <span>Importar planilha</span>
              </button>
            </>
          )}
          <button
            type="button"
            className="reports-action-btn primary"
            style={{ backgroundColor: '#118CC4', borderColor: '#118CC4', display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}
            onClick={() => setShowNovo(true)}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>Novo protocolo</span>
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="reports-filters-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
        <div className="reports-filter-left" style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="reports-select-wrapper" style={{ minWidth: '180px' }}>
            <select
              value={filters.cliente ?? ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, cliente: e.target.value || undefined, page: 1 }))}
            >
              <option value="">Cliente: Todos</option>
              {(clientesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div className="reports-search-wrapper" style={{ minWidth: '140px' }}>
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input
              type="text"
              placeholder="Nº protocolo..."
              value={filters.protocoloId ?? ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, protocoloId: e.target.value, page: 1 }))}
            />
          </div>
          <div className="reports-search-wrapper" style={{ minWidth: '150px' }}>
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input
              type="text"
              placeholder="Nota fiscal..."
              value={filters.notaFiscal ?? ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, notaFiscal: e.target.value, page: 1 }))}
            />
          </div>
          <div className="reports-search-wrapper" style={{ minWidth: '150px' }}>
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input
              type="text"
              placeholder="Indexador..."
              value={filters.usuario ?? ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, usuario: e.target.value, page: 1 }))}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
            <span>Data:</span>
            <input
              type="date"
              value={filters.data ?? ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, data: e.target.value, page: 1 }))}
              style={{ height: '34px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#334155', fontSize: '12.5px' }}
            />
            {filters.data && (
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, data: undefined, page: 1 }))}
                style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}
              >
                Limpar
              </button>
            )}
          </div>
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{total}</strong> Protocolos</span>
        </div>
      </div>

      {/* Table */}
      <QueryDataPanel
        query={protocolosQuery}
        loadingMessage="Carregando protocolos..."
        refreshingMessage="Atualizando protocolos..."
        errorMessage="Não foi possível carregar os protocolos. Tente novamente."
      >
        <div className="erp-card reports-table-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Selecionar todos" />
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setFilters((prev) => ({ ...prev, page: 1, ordering: nextOrdering('protocolo', prev.ordering) }))}
                  >
                    Protocolo <SortIcon field="protocolo" ordering={filters.ordering} />
                  </th>
                  <th
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setFilters((prev) => ({ ...prev, page: 1, ordering: nextOrdering('data', prev.ordering) }))}
                  >
                    Data envio <SortIcon field="data" ordering={filters.ordering} />
                  </th>
                  <th>Cliente</th>
                  <th>Notas fiscais</th>
                  <th>Indexador</th>
                  <th style={{ width: 50 }} />
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && protocolos.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '32px' }}>
                      Nenhum protocolo encontrado.
                    </td>
                  </tr>
                ) : (
                  protocolos.map((protocolo) => {
                    const id = Number(protocolo.id);
                    return (
                      <tr key={protocolo.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(id)}
                            onChange={() => toggleOne(id)}
                            aria-label={`Selecionar protocolo ${protocolo.protocoloNumero}`}
                          />
                        </td>
                        <td><strong>{protocolo.protocoloNumero}</strong></td>
                        <td>{formatDateBr(protocolo.data)}</td>
                        <td>{protocolo.clienteNome}</td>
                        <td style={{ color: 'var(--text-secondary)', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={protocolo.notasFiscais.join(', ')}>
                          {protocolo.notasFiscais.join(', ')}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{protocolo.usuarioNome}</td>
                        <td>
                          <button
                            type="button"
                            className="btn-icon"
                            title="Editar protocolo"
                            onClick={() => setEditingProtocolo(protocolo)}
                          >
                            <i className="bi bi-pencil" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="erp-pagination-bar">
          <div className="erp-pagination-page-size">
            <label htmlFor="protocolos-page-size">Itens por página</label>
            <select
              id="protocolos-page-size"
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
            <span className="erp-pagination-meta">({total} registros)</span>
          </span>

          <button
            type="button"
            className="reports-action-btn secondary"
            title="Primeira página"
            aria-label="Primeira página"
            disabled={clampedPage <= 1}
            onClick={() => handlePageChange(1)}
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
            onClick={() => handlePageChange(clampedPage - 1)}
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
            onClick={() => handlePageChange(clampedPage + 1)}
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
            onClick={() => handlePageChange(totalPages)}
            style={{ height: '32px', width: '32px', padding: 0, fontSize: '12px', opacity: clampedPage >= totalPages ? 0.5 : 1, cursor: clampedPage >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5M12.75 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </QueryDataPanel>

      {showNovo && <NovoProtocoloModal onClose={() => setShowNovo(false)} />}
      {editingProtocolo && (
        <NovoProtocoloModal
          protocolo={editingProtocolo}
          onClose={() => setEditingProtocolo(null)}
        />
      )}
      {showClientes && isAdmin && <GerenciarClientesProtocoloModal onClose={() => setShowClientes(false)} />}
      {showImport && isAdmin && <ImportarProtocolosModal onClose={() => setShowImport(false)} />}
    </div>
  );
};

export default FaturamentoProtocolos;
