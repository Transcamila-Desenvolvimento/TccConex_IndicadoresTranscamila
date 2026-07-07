import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { CashAdjustment } from '../../types/domain';
import {
  useCashAdjustments,
  useCreateCashAdjustment,
  useUpdateCashAdjustment,
  useDeleteCashAdjustment,
} from '../../hooks/useFinanceiroAdjustments';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';

type QuickSuggestionId = 'repom' | 'pamcard' | 'icms';

function formatDateBr(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

const QUICK_SUGGESTIONS: {
  id: QuickSuggestionId;
  label: string;
  type: 'Entrada' | 'Saída';
  build: (isoDate: string) => string;
}[] = [
  {
    id: 'repom',
    label: 'REPOM',
    type: 'Saída',
    build: (isoDate) => `TRANSAÇÃO REPOM - ${formatDateBr(isoDate)}`,
  },
  {
    id: 'pamcard',
    label: 'PAMCARD',
    type: 'Saída',
    build: (isoDate) => `TRANSAÇÃO PAMCARD - ${formatDateBr(isoDate)}`,
  },
  {
    id: 'icms',
    label: 'ICMS',
    type: 'Saída',
    build: (isoDate) => `Pagamento ICMS - ${formatDateBr(isoDate)}`,
  },
];

const WandIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 4.5l3 3M9.5 10.5L3 17v4h4l6.5-6.5M14.5 5.5l4 4M10.5 9.5l1 1" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 2l4 4-2 2-4-4 2-2z" />
  </svg>
);

const FinanceiroAdjustments: React.FC = () => {
  const { user } = useAuth();
  const createAdjustment = useCreateCashAdjustment();
  const updateAdjustment = useUpdateCashAdjustment();
  const deleteAdjustment = useDeleteCashAdjustment();

  useEffect(() => {
    const el = document.querySelector('.content') as HTMLElement | null;
    if (!el) return;
    const prev = el.style.overflowY;
    el.style.overflowY = 'hidden';
    return () => { el.style.overflowY = prev; };
  }, []);

  // Data State — filtros e paginação server-side
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterType, setFilterType] = useState('Todos');

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const queryParams = useMemo(() => ({
    page: currentPage,
    pageSize,
    search: search.trim() || undefined,
    date: filterDate || undefined,
    type: filterType !== 'Todos' ? filterType : undefined,
  }), [currentPage, search, filterDate, filterType]);

  const adjustmentsQuery = useCashAdjustments(queryParams);
  const adjustmentsPage = adjustmentsQuery.data;
  const listQueryState = useAsyncQueryState(adjustmentsQuery);
  const paginatedList = adjustmentsPage?.results ?? [];
  const totalItems = adjustmentsPage?.count ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const clampedPage = Math.min(currentPage, totalPages) || 1;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdj, setEditingAdj] = useState<CashAdjustment | null>(null);
  const [adjDate, setAdjDate] = useState('');
  const [adjType, setAdjType] = useState('Entrada');
  const [adjValue, setAdjValue] = useState('');
  const [adjObservation, setAdjObservation] = useState('');
  const [activeSuggestion, setActiveSuggestion] = useState<QuickSuggestionId | null>(null);

  const applyQuickSuggestion = (id: QuickSuggestionId) => {
    const suggestion = QUICK_SUGGESTIONS.find((item) => item.id === id);
    if (!suggestion || !adjDate) return;
    setActiveSuggestion(id);
    setAdjType(suggestion.type);
    setAdjObservation(suggestion.build(adjDate));
  };

  useEffect(() => {
    if (!activeSuggestion || !adjDate) return;
    const suggestion = QUICK_SUGGESTIONS.find((item) => item.id === activeSuggestion);
    if (!suggestion) return;
    setAdjObservation(suggestion.build(adjDate));
  }, [adjDate, activeSuggestion]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterDate, filterType]);

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setFilterDate('');
    setFilterType('Todos');
    setCurrentPage(1);
  };

  const handleOpenModal = () => {
    setEditingAdj(null);
    setAdjDate(new Date().toISOString().split('T')[0]);
    setAdjType('Entrada');
    setAdjValue('');
    setAdjObservation('');
    setActiveSuggestion(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (adj: CashAdjustment) => {
    setEditingAdj(adj);
    setAdjDate(adj.date);
    setAdjType(adj.type);
    setAdjValue(adj.value.toString());
    setAdjObservation(adj.observation);
    setActiveSuggestion(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const username = user?.username || 'system';

    if (editingAdj) {
      updateAdjustment.mutate(
        {
          id: editingAdj.id,
          payload: {
            date: adjDate,
            type: adjType,
            value: parseFloat(adjValue) || 0,
            observation: adjObservation.trim(),
            user: username,
          },
        },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            setEditingAdj(null);
            alert('Ajuste de caixa atualizado com sucesso!');
          },
          onError: () => alert('Erro ao atualizar ajuste. Verifique se o backend está rodando.'),
        }
      );
    } else {
      createAdjustment.mutate(
        {
          date: adjDate,
          type: adjType,
          value: parseFloat(adjValue) || 0,
          observation: adjObservation.trim(),
          user: username,
        },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            setCurrentPage(1);
            alert('Ajuste de caixa registrado com sucesso!');
          },
          onError: () => alert('Erro ao registrar ajuste. Verifique se o backend está rodando.'),
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Deseja realmente excluir este lançamento de ajuste?')) {
      deleteAdjustment.mutate(id, {
        onSuccess: () => alert('Ajuste de caixa removido!'),
        onError: () => alert('Erro ao excluir ajuste. Verifique se o backend está rodando.'),
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '4px' }}>
      {/* Header */}
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }}></div>
          <h1 className="view-page-title">Ajustes de Caixa</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            type="button"
            className="reports-action-btn primary" 
            id="btn-adjustments-new" 
            style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
            onClick={handleOpenModal}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"></path>
            </svg>
            <span>Novo Ajuste</span>
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="reports-filters-bar" style={{ marginBottom: '20px' }}>
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
              placeholder="Buscar observação..." 
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <input 
            type="date" 
            value={filterDate}
            onChange={(e) => {
              setFilterDate(e.target.value);
              setCurrentPage(1);
            }}
            style={{ 
              height: '36px', 
              padding: '0 12px', 
              background: '#ffffff', 
              border: '1px solid #cbd5e1', 
              borderRadius: '0', 
              fontSize: '13px', 
              color: '#334155', 
              outline: 'none', 
              boxSizing: 'border-box', 
              width: '145px' 
            }}
          />

          <div className="reports-select-wrapper">
            <select 
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="Todos">Tipo: Todos</option>
              <option value="Entrada">Entrada</option>
              <option value="Saída">Saída</option>
            </select>
          </div>
          
          <button type="button" className="reports-action-btn secondary" onClick={handleClearFilters}>
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* Adjustments Table */}
      <QueryDataPanel
        query={adjustmentsQuery}
        loadingMessage="Carregando ajustes de caixa..."
        refreshingMessage="Atualizando ajustes..."
        errorMessage="Não foi possível carregar os ajustes. Tente novamente."
      >
      <div className="erp-card reports-table-card" style={{ padding: '8px', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
          <table className="erp-table reports-table" id="adjustments-table">
            <thead>
              <tr>
                <th style={{ width: '12%', borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 }}>DATA</th>
                <th style={{ width: '12%', borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 }}>TIPO</th>
                <th style={{ width: '16%', borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 }}>VALOR</th>
                <th style={{ width: '36%', borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 }}>OBSERVAÇÃO</th>
                <th style={{ width: '10%', borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 }}>USUÁRIO</th>
                <th style={{ width: '14%', borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500, textAlign: 'center' }}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {listQueryState.canShowEmpty && paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '20px' }}>
                    Nenhum ajuste encontrado.
                  </td>
                </tr>
              ) : (
                paginatedList.map((a) => {
                  const parts = a.date.split('-');
                  const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : a.date;

                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 500 }}>{formattedDate}</td>
                      <td>
                        {a.type === 'Entrada' ? (
                          <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, color: '#16a34a', border: '1.5px solid #16a34a', backgroundColor: '#ffffff' }}>
                            &uarr; Entrada
                          </span>
                        ) : (
                          <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, color: '#dc2626', border: '1.5px solid #dc2626', backgroundColor: '#ffffff' }}>
                            &darr; Saída
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>
                        {a.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td>
                        <div style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.observation}>
                          {a.observation}
                        </div>
                      </td>
                      <td>{a.user}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button 
                            type="button" 
                            onClick={() => handleOpenEditModal(a)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: 'transparent',
                              color: '#64748b',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#eff6ff';
                              e.currentTarget.style.color = '#118CC4';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#64748b';
                            }}
                          >
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                            <span>Editar</span>
                          </button>

                          <button 
                            type="button" 
                            onClick={() => handleDelete(a.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: 'transparent',
                              color: '#64748b',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#fef2f2';
                              e.currentTarget.style.color = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#64748b';
                            }}
                          >
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                            <span>Excluir</span>
                          </button>
                        </div>
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
      <div id="adjustments-pagination" className="erp-pagination-bar">
        <span style={{ fontWeight: 500, marginRight: '4px' }}>
          Página <span id="adj-page-num" className="erp-pagination-current">{clampedPage}</span> de <span id="adj-page-total" className="erp-pagination-current">{totalPages}</span>
        </span>
        <button 
          type="button" 
          className="reports-action-btn secondary" 
          disabled={currentPage <= 1}
          onClick={handlePrevPage}
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
          onClick={handleNextPage}
          style={{ height: '28px', padding: '0 10px', fontSize: '11px', gap: '4px', opacity: currentPage >= totalPages ? 0.5 : 1, cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}
        >
          Próximo
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
      </QueryDataPanel>

      {/* MODAL: NOVO AJUSTE DE CAIXA */}
      {isModalOpen && (
        <div className="search-backdrop" id="adjustments-add-modal" style={{ display: 'flex' }} onClick={(e) => {
          if (e.target === e.currentTarget) setIsModalOpen(false);
        }}>
          <div className="search-modal-card" style={{ width: '500px' }}>
            <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>{editingAdj ? 'Editar Ajuste de Caixa' : 'Novo Ajuste de Caixa'}</h3>
              <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={() => setIsModalOpen(false)}>Fechar (X)</span>
            </div>
            
            <form id="adjustments-add-form" style={{ padding: '20px 24px 24px 24px' }} onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '14px' }}>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="adj-date">Data do Ajuste</label>
                  <input 
                    type="date" 
                    id="adj-date" 
                    required 
                    value={adjDate}
                    onChange={(e) => setAdjDate(e.target.value)}
                    style={{ background: '#f8fafc' }} 
                  />
                </div>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="adj-type">Tipo</label>
                  <select
                    id="adj-type"
                    required
                    value={adjType}
                    onChange={(e) => setAdjType(e.target.value)}
                  >
                    <option value="Entrada">Entrada</option>
                    <option value="Saída">Saída</option>
                  </select>
                </div>
              </div>

              <div className="login-group" style={{ marginBottom: '14px' }}>
                <label htmlFor="adj-value">Valor do Ajuste (R$)</label>
                <input 
                  type="number" 
                  id="adj-value" 
                  placeholder="Ex: 500.00" 
                  step="0.01" 
                  required 
                  value={adjValue}
                  onChange={(e) => setAdjValue(e.target.value)}
                  autoComplete="off" 
                />
              </div>

              <div className="login-group" style={{ marginBottom: '14px' }}>
                <label>Sugestões Rápidas</label>
                <div className="adjustment-suggestions-row">
                  {QUICK_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      className={`adjustment-suggestion-chip${activeSuggestion === suggestion.id ? ' active' : ''}`}
                      onClick={() => applyQuickSuggestion(suggestion.id)}
                    >
                      <WandIcon />
                      <span>{suggestion.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="login-group" style={{ marginBottom: 0 }}>
                <label htmlFor="adj-observation">Observação</label>
                <textarea
                  id="adj-observation"
                  placeholder="Ex: Transação PAMCARD, Repasse (opcional)"
                  rows={3}
                  value={adjObservation}
                  onChange={(e) => {
                    setAdjObservation(e.target.value);
                    setActiveSuggestion(null);
                  }}
                  autoComplete="off"
                />
              </div>

              <button type="submit" className="btn-login" id="btn-adjustments-submit" style={{ marginTop: '20px', backgroundColor: '#118CC4' }}>Salvar Ajuste</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceiroAdjustments;
