import React, { useMemo, useState } from 'react';
import { useAuditLogs, useAuditLogFacets } from '../../hooks/useAuditLogs';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';

const PAGE_SIZE = 10;

const formatTimestamp = (iso: string) => {
  const date = new Date(iso);
  return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

const AdminAuditLogsPanel: React.FC = () => {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: facets } = useAuditLogFacets();

  const queryParams = useMemo(() => ({
    page: currentPage,
    pageSize: PAGE_SIZE,
    search: search.trim() || undefined,
    action: actionFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [currentPage, search, actionFilter, dateFrom, dateTo]);

  const auditQuery = useAuditLogs(queryParams);
  const logsPage = auditQuery.data;
  const logs = logsPage?.results ?? [];
  const queryState = useAsyncQueryState(auditQuery);

  const totalItems = logsPage?.count ?? 0;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  const clampedPage = Math.min(currentPage, totalPages) || 1;

  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setActionFilter('');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Filters */}
      <div className="reports-filters-bar" style={{ flexShrink: 0 }}>
        <div className="reports-filter-left">
          <div className="reports-filter-icon-label">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
            </svg>
            <span>Filtrar</span>
          </div>

          <div className="reports-search-wrapper">
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por usuário, ação ou detalhes..."
              value={search}
              onChange={(e) => handleFilterChange(setSearch, e.target.value)}
            />
          </div>

          <div className="reports-select-wrapper">
            <select value={actionFilter} onChange={(e) => handleFilterChange(setActionFilter, e.target.value)}>
              <option value="">Ação: Todas</option>
              {(facets?.actions ?? []).map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="cashflow-date-filter">
            <label>
              <span>De</span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => handleFilterChange(setDateFrom, e.target.value)}
              />
            </label>
            <label>
              <span>Até</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => handleFilterChange(setDateTo, e.target.value)}
              />
            </label>
          </div>

          <button type="button" className="reports-action-btn secondary" onClick={handleClearFilters}>
            Limpar Filtros
          </button>
        </div>

        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{totalItems}</strong> Registros</span>
        </div>
      </div>

      {/* Table */}
      <QueryDataPanel
        query={auditQuery}
        loadingMessage="Carregando logs de auditoria..."
        refreshingMessage="Atualizando logs..."
        errorMessage="Não foi possível carregar os logs de auditoria. Tente novamente."
      >
        <div className="erp-card reports-table-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="erp-table reports-table">
              <thead>
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Data/Hora</th>
                  <th>Usuário</th>
                  <th>Ação</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {queryState.canShowEmpty && logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                      Nenhum log de auditoria encontrado com os filtros ativos.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <small style={{ color: 'var(--text-muted)' }}>{formatTimestamp(log.timestamp)}</small>
                      </td>
                      <td>{log.username || log.userId || '—'}</td>
                      <td><span style={{ fontWeight: 600 }}>{log.action}</span></td>
                      <td>{log.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="erp-pagination-bar">
          <span style={{ fontWeight: 500, marginRight: '4px' }}>
            Página <span className="erp-pagination-current">{clampedPage}</span> de <span className="erp-pagination-current">{totalPages}</span>
            <span className="erp-pagination-meta">({totalItems} registros)</span>
          </span>
          <button
            type="button"
            className="reports-action-btn secondary"
            disabled={clampedPage <= 1}
            onClick={() => setCurrentPage(clampedPage - 1)}
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
            onClick={() => setCurrentPage(clampedPage + 1)}
            style={{ height: '32px', padding: '0 12px', fontSize: '12px', gap: '6px', opacity: clampedPage >= totalPages ? 0.5 : 1, cursor: clampedPage >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            Próximo
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </QueryDataPanel>
    </div>
  );
};

export default AdminAuditLogsPanel;
