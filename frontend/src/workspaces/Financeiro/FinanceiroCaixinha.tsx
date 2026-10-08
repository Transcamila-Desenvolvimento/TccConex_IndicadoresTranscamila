import React, { useEffect, useMemo, useState } from 'react';
import type { CaixinhaLancamento, CaixinhaOrdering } from '../../types/domain';
import {
  useCaixinhaDescricoes,
  useCaixinhaExtrato,
  useCaixinhaLancamentos,
  useCaixinhaResumo,
  useCreateCaixinhaDescricao,
  useCreateCaixinhaLancamento,
  useDeleteCaixinhaDescricao,
  useDeleteCaixinhaLancamento,
  useUpdateCaixinhaDescricao,
  useUpdateCaixinhaLancamento,
} from '../../hooks/useFinanceiroCaixinha';
import { downloadCaixinhaExtratoPdf } from './caixinhaExtratoPdf';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateBr(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (!data || typeof data !== 'object') return fallback;
  const candidates = [data.detail, data.non_field_errors, data.description, data.value, data.type];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (Array.isArray(candidate) && typeof candidate[0] === 'string') return candidate[0];
  }
  return fallback;
}

const FinanceiroCaixinha: React.FC = () => {
  const createLancamento = useCreateCaixinhaLancamento();
  const updateLancamento = useUpdateCaixinhaLancamento();
  const deleteLancamento = useDeleteCaixinhaLancamento();
  const extratoMutation = useCaixinhaExtrato();
  const descricoesQuery = useCaixinhaDescricoes();
  const createDescricao = useCreateCaixinhaDescricao();
  const updateDescricao = useUpdateCaixinhaDescricao();
  const deleteDescricao = useDeleteCaixinhaDescricao();
  const saving = createLancamento.isPending || updateLancamento.isPending;
  const savingDescricao = createDescricao.isPending || updateDescricao.isPending;
  const descricoes = descricoesQuery.data ?? [];
  const descricoesState = useAsyncQueryState(descricoesQuery);

  useEffect(() => {
    const el = document.querySelector('.content') as HTMLElement | null;
    if (!el) return;
    const prev = el.style.overflowY;
    el.style.overflowY = 'hidden';
    return () => { el.style.overflowY = prev; };
  }, []);

  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterType, setFilterType] = useState('Todos');
  const [dateOrdering, setDateOrdering] = useState<CaixinhaOrdering>('date_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const queryParams = useMemo(() => ({
    page: currentPage,
    pageSize,
    search: search.trim() || undefined,
    date: filterDate || undefined,
    type: filterType !== 'Todos' ? filterType : undefined,
    ordering: dateOrdering,
  }), [currentPage, search, filterDate, filterType, dateOrdering]);

  const listQuery = useCaixinhaLancamentos(queryParams);
  const resumoQuery = useCaixinhaResumo();
  const listState = useAsyncQueryState(listQuery);
  const rows = listQuery.data?.results ?? [];
  const totalItems = listQuery.data?.count ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const clampedPage = Math.min(currentPage, totalPages) || 1;
  const resumo = resumoQuery.data;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isExtratoOpen, setIsExtratoOpen] = useState(false);
  const [isDescricoesOpen, setIsDescricoesOpen] = useState(false);
  const [extratoStart, setExtratoStart] = useState('');
  const [extratoEnd, setExtratoEnd] = useState('');
  const [editing, setEditing] = useState<CaixinhaLancamento | null>(null);
  const [movDate, setMovDate] = useState('');
  const [movType, setMovType] = useState<'Entrada' | 'Saída'>('Entrada');
  const [movValue, setMovValue] = useState('');
  const [movDescription, setMovDescription] = useState('');
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [editingDescricaoId, setEditingDescricaoId] = useState<number | null>(null);
  const [descricaoTipo, setDescricaoTipo] = useState<'Entrada' | 'Saída'>('Entrada');
  const [descricaoTexto, setDescricaoTexto] = useState('');

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterDate, filterType]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.reports-dropdown-wrapper')) setIsActionsOpen(false);
      if (!target.closest('.caixinha-descricao-field')) setSugestoesAbertas(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const presetsDoTipo = descricoes.filter((item) => item.type === movType);
  const textoDescricao = movDescription.trim().toLocaleLowerCase('pt-BR');
  const sugestoes = presetsDoTipo.filter((item) => {
    const padrao = item.description.toLocaleLowerCase('pt-BR');
    if (!textoDescricao) return true;
    if (padrao === textoDescricao) return false;
    return padrao.includes(textoDescricao);
  });

  const handleClearFilters = () => {
    setSearch('');
    setFilterDate('');
    setFilterType('Todos');
    setCurrentPage(1);
  };

  const resetDescricaoForm = () => {
    setEditingDescricaoId(null);
    setDescricaoTipo('Entrada');
    setDescricaoTexto('');
  };

  const handleOpenDescricoes = () => {
    resetDescricaoForm();
    setIsDescricoesOpen(true);
  };

  const handleSubmitDescricao = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { type: descricaoTipo, description: descricaoTexto.trim() };
    if (!payload.description) {
      alert('Informe a descrição.');
      return;
    }
    if (editingDescricaoId != null) {
      updateDescricao.mutate(
        { id: editingDescricaoId, payload },
        {
          onSuccess: () => resetDescricaoForm(),
          onError: (error) => alert(apiErrorMessage(error, 'Não foi possível atualizar a descrição.')),
        },
      );
      return;
    }
    createDescricao.mutate(payload, {
      onSuccess: () => resetDescricaoForm(),
      onError: (error) => alert(apiErrorMessage(error, 'Não foi possível cadastrar a descrição.')),
    });
  };

  const handleEditDescricao = (item: { id: number; type: string; description: string }) => {
    setEditingDescricaoId(item.id);
    setDescricaoTipo(item.type === 'Saída' ? 'Saída' : 'Entrada');
    setDescricaoTexto(item.description);
  };

  const handleDeleteDescricao = (id: number) => {
    if (!window.confirm('Deseja excluir esta descrição padrão?')) return;
    deleteDescricao.mutate(id, {
      onSuccess: () => {
        if (editingDescricaoId === id) resetDescricaoForm();
      },
      onError: (error) => alert(apiErrorMessage(error, 'Não foi possível excluir a descrição.')),
    });
  };

  const handleOpenExtrato = () => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const toIso = (value: Date) => {
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${value.getFullYear()}-${month}-${day}`;
    };
    setExtratoStart(toIso(monthStart));
    setExtratoEnd(toIso(today));
    setIsExtratoOpen(true);
  };

  const handleGerarExtrato = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extratoStart || !extratoEnd) {
      alert('Informe a data inicial e a data final.');
      return;
    }
    if (extratoStart > extratoEnd) {
      alert('A data inicial não pode ser maior que a data final.');
      return;
    }
    extratoMutation.mutate(
      { startDate: extratoStart, endDate: extratoEnd },
      {
        onSuccess: (extrato) => {
          setIsExtratoOpen(false);
          void downloadCaixinhaExtratoPdf(extrato).catch(() => {
            alert('Não foi possível gerar o extrato.');
          });
        },
        onError: (error) => alert(apiErrorMessage(error, 'Não foi possível gerar o extrato.')),
      },
    );
  };

  const handleOpenModal = () => {
    setEditing(null);
    setMovDate(new Date().toISOString().split('T')[0]);
    setMovType('Entrada');
    setMovValue('');
    setMovDescription('');
    setSugestoesAbertas(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: CaixinhaLancamento) => {
    const tipo = item.type === 'Saída' ? 'Saída' : 'Entrada';
    setEditing(item);
    setMovDate(item.date);
    setMovType(tipo);
    setMovValue(item.value.toString());
    setMovDescription(item.description);
    setSugestoesAbertas(false);
    setIsModalOpen(true);
  };

  const handleMovTypeChange = (value: string) => {
    const next = value === 'Saída' ? 'Saída' : 'Entrada';
    const eraPadrao = descricoes.some((item) => item.type === movType && item.description === movDescription.trim());
    setMovType(next);
    if (eraPadrao) setMovDescription('');
    setSugestoesAbertas(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const description = movDescription.trim();
    if (!description) {
      alert('Informe a descrição.');
      return;
    }
    const payload = {
      date: movDate,
      type: movType,
      value: parseFloat(movValue) || 0,
      description,
    };
    if (editing) {
      updateLancamento.mutate(
        { id: editing.id, payload },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            setEditing(null);
            alert('Lançamento da caixinha atualizado.');
          },
          onError: (error) => alert(apiErrorMessage(error, 'Não foi possível atualizar o lançamento.')),
        },
      );
      return;
    }
    createLancamento.mutate(payload, {
      onSuccess: () => {
        setIsModalOpen(false);
        setCurrentPage(1);
        alert('Lançamento registrado na caixinha.');
      },
      onError: (error) => alert(apiErrorMessage(error, 'Não foi possível registrar o lançamento.')),
    });
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('Deseja realmente excluir este lançamento da caixinha?')) return;
    deleteLancamento.mutate(id, {
      onSuccess: () => alert('Lançamento removido.'),
      onError: (error) => alert(apiErrorMessage(error, 'Não foi possível excluir o lançamento.')),
    });
  };

  const cards = [
    { label: 'Saldo do cofre', value: resumo?.saldo, tone: (resumo?.saldo ?? 0) < 0 ? '#dc2626' : '#0f172a' },
    { label: 'Entradas', value: resumo?.totalEntradas, tone: '#16a34a' },
    { label: 'Saídas', value: resumo?.totalSaidas, tone: '#dc2626' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }}></div>
          <h1 className="view-page-title">Caixinha</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="reports-dropdown-wrapper">
            <button
              type="button"
              className="reports-action-btn secondary"
              id="btn-caixinha-acoes"
              onClick={() => setIsActionsOpen((open) => !open)}
            >
              <span>Ações</span>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`reports-dropdown-menu ${isActionsOpen ? 'show' : ''}`}>
              <span
                className="reports-dropdown-item"
                id="btn-caixinha-extrato"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setIsActionsOpen(false);
                  handleOpenExtrato();
                }}
              >
                Extrato
              </span>
              <span
                className="reports-dropdown-item"
                id="btn-caixinha-descricoes"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setIsActionsOpen(false);
                  handleOpenDescricoes();
                }}
              >
                Descrições
              </span>
            </div>
          </div>
          <button
            type="button"
            className="reports-action-btn primary"
            id="btn-caixinha-new"
            style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
            onClick={handleOpenModal}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"></path>
            </svg>
            <span>Novo lançamento</span>
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {cards.map((card) => (
          <div key={card.label} className="erp-card" style={{ padding: '14px 16px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#94a3b8' }}>
              {card.label}
            </span>
            <strong style={{ display: 'block', marginTop: '6px', fontSize: '20px', color: card.tone }}>
              {resumoQuery.isLoading && resumo == null ? '—' : formatMoney(card.value ?? 0)}
            </strong>
          </div>
        ))}
      </div>

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
              placeholder="Buscar descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
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
              width: '145px',
            }}
          />

          <div className="reports-select-wrapper">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
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

      <QueryDataPanel
        query={listQuery}
        loadingMessage="Carregando caixinha..."
        refreshingMessage="Atualizando caixinha..."
        errorMessage="Não foi possível carregar a caixinha. Tente novamente."
      >
        <div className="erp-card reports-table-card comercial-browse-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="erp-table reports-table comercial-browse-table" id="caixinha-table">
              <thead>
                <tr>
                  <th
                    className="is-sortable"
                    style={{ width: '12%' }}
                    onClick={() => {
                      setDateOrdering((current) => (current === 'date_asc' ? 'date_desc' : 'date_asc'));
                      setCurrentPage(1);
                    }}
                    title="Classificar por data"
                    aria-sort={dateOrdering === 'date_asc' ? 'ascending' : 'descending'}
                  >
                    Data
                    <span className="comercial-sort-icon" aria-hidden>
                      <i className="bi bi-caret-up-fill" style={{ color: dateOrdering === 'date_asc' ? '#0f85c1' : '#c8d3e0' }} />
                      <i className="bi bi-caret-down-fill" style={{ color: dateOrdering === 'date_desc' ? '#0f85c1' : '#c8d3e0' }} />
                    </span>
                  </th>
                  <th style={{ width: '12%' }}>Tipo</th>
                  <th style={{ width: '16%' }}>Valor</th>
                  <th style={{ width: '36%' }}>Descrição</th>
                  <th style={{ width: '10%' }}>Usuário</th>
                  <th style={{ width: '14%', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {listState.canShowEmpty && rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '20px' }}>
                      Nenhum lançamento encontrado.
                    </td>
                  </tr>
                ) : (
                  rows.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{formatDateBr(item.date)}</td>
                      <td>
                        {item.type === 'Entrada' ? (
                          <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, color: '#16a34a', border: '1.5px solid #16a34a', backgroundColor: '#ffffff' }}>
                            &uarr; Entrada
                          </span>
                        ) : (
                          <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, color: '#dc2626', border: '1.5px solid #dc2626', backgroundColor: '#ffffff' }}>
                            &darr; Saída
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: item.type === 'Entrada' ? '#16a34a' : '#dc2626' }}>
                        {formatMoney(item.value)}
                      </td>
                      <td>
                        <div style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.description}>
                          {item.description}
                        </div>
                      </td>
                      <td>{item.user}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'transparent', color: '#64748b', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'transparent', color: '#64748b', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            <span>Excluir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div id="caixinha-pagination" className="erp-pagination-bar">
          <span style={{ fontWeight: 500, marginRight: '4px' }}>
            Página <span className="erp-pagination-current">{clampedPage}</span> de <span className="erp-pagination-current">{totalPages}</span>
          </span>
          <button
            type="button"
            className="reports-action-btn secondary"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            style={{ height: '28px', padding: '0 10px', fontSize: '11px', gap: '4px', opacity: currentPage <= 1 ? 0.5 : 1, cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}
          >
            Anterior
          </button>
          <button
            type="button"
            className="reports-action-btn secondary"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((page) => page + 1)}
            style={{ height: '28px', padding: '0 10px', fontSize: '11px', gap: '4px', opacity: currentPage >= totalPages ? 0.5 : 1, cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            Próximo
          </button>
        </div>
      </QueryDataPanel>

      {isExtratoOpen && (
        <div className="search-backdrop" id="caixinha-extrato-modal" style={{ display: 'flex' }} onClick={(e) => {
          if (e.target === e.currentTarget) setIsExtratoOpen(false);
        }}>
          <div className="search-modal-card" style={{ width: '460px' }}>
            <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Extrato da caixinha</h3>
              <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={() => setIsExtratoOpen(false)}>Fechar (X)</span>
            </div>
            <form id="caixinha-extrato-form" style={{ padding: '20px 24px 24px 24px' }} onSubmit={handleGerarExtrato}>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '14px' }}>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="caixinha-extrato-start">Data inicial</label>
                  <input
                    type="date"
                    id="caixinha-extrato-start"
                    required
                    value={extratoStart}
                    onChange={(e) => setExtratoStart(e.target.value)}
                    style={{ background: '#f8fafc' }}
                  />
                </div>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="caixinha-extrato-end">Data final</label>
                  <input
                    type="date"
                    id="caixinha-extrato-end"
                    required
                    value={extratoEnd}
                    onChange={(e) => setExtratoEnd(e.target.value)}
                    style={{ background: '#f8fafc' }}
                  />
                </div>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#64748b' }}>
                O PDF lista as entradas e saídas do cofre nesse período, com saldo anterior e saldo final.
              </p>
              <button
                type="submit"
                className="btn-login"
                id="btn-caixinha-extrato-submit"
                disabled={extratoMutation.isPending}
                style={{ marginTop: '12px', backgroundColor: '#118CC4' }}
              >
                {extratoMutation.isPending ? 'Gerando...' : 'Gerar PDF'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isDescricoesOpen && (
        <div className="search-backdrop" id="caixinha-descricoes-modal" style={{ display: 'flex' }} onClick={(e) => {
          if (e.target === e.currentTarget) setIsDescricoesOpen(false);
        }}>
          <div className="search-modal-card" style={{ width: '720px', maxWidth: '94vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}>
            <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Descrições padrão</h3>
              <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={() => setIsDescricoesOpen(false)}>Fechar (X)</span>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', minHeight: 0, gap: '16px' }}>
              <form id="caixinha-descricao-form" className="reports-filter-left" onSubmit={handleSubmitDescricao} style={{ width: '100%' }}>
                <div className="reports-select-wrapper" style={{ width: '148px', flexShrink: 0 }}>
                  <select
                    id="caixinha-descricao-tipo"
                    aria-label="Tipo"
                    required
                    value={descricaoTipo}
                    onChange={(e) => setDescricaoTipo(e.target.value === 'Saída' ? 'Saída' : 'Entrada')}
                    style={{ width: '100%' }}
                  >
                    <option value="Entrada">Entrada</option>
                    <option value="Saída">Saída</option>
                  </select>
                </div>
                <input
                  type="text"
                  id="caixinha-descricao-texto"
                  placeholder="Descrição padrão..."
                  maxLength={300}
                  required
                  value={descricaoTexto}
                  onChange={(e) => setDescricaoTexto(e.target.value)}
                  autoComplete="off"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: '36px',
                    padding: '0 12px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 0,
                    fontSize: '13px',
                    color: '#334155',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="submit"
                  className="reports-action-btn primary"
                  id="btn-caixinha-descricao-submit"
                  disabled={savingDescricao}
                  style={{ backgroundColor: '#118CC4', borderColor: '#118CC4', flexShrink: 0 }}
                >
                  {savingDescricao ? 'Salvando...' : editingDescricaoId != null ? 'Salvar' : 'Cadastrar'}
                </button>
                {editingDescricaoId != null && (
                  <button
                    type="button"
                    className="reports-action-btn secondary"
                    onClick={resetDescricaoForm}
                    style={{ flexShrink: 0 }}
                  >
                    Cancelar
                  </button>
                )}
              </form>

              <div className="erp-card reports-table-card comercial-browse-card" style={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div className="table-container" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                  <table className="erp-table reports-table comercial-browse-table" id="caixinha-descricoes-table">
                    <thead>
                      <tr>
                        <th style={{ width: '22%' }}>Tipo</th>
                        <th style={{ width: '58%' }}>Descrição</th>
                        <th style={{ width: '20%', textAlign: 'center' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {descricoesState.showInitialLoader ? (
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                            Carregando descrições...
                          </td>
                        </tr>
                      ) : descricoesState.showError ? (
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'center', color: '#dc2626', padding: '20px' }}>
                            Não foi possível carregar as descrições.
                          </td>
                        </tr>
                      ) : descricoesState.canShowEmpty && descricoes.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '20px' }}>
                            Nenhuma descrição cadastrada.
                          </td>
                        </tr>
                      ) : (
                        descricoes.map((item) => (
                          <tr key={item.id}>
                            <td>
                              {item.type === 'Entrada' ? (
                                <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, color: '#16a34a', border: '1.5px solid #16a34a', backgroundColor: '#ffffff' }}>
                                  &uarr; Entrada
                                </span>
                              ) : (
                                <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, color: '#dc2626', border: '1.5px solid #dc2626', backgroundColor: '#ffffff' }}>
                                  &darr; Saída
                                </span>
                              )}
                            </td>
                            <td>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.description}>
                                {item.description}
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleEditDescricao(item)}
                                  style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: 'transparent', color: '#64748b', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDescricao(item.id)}
                                  style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: 'transparent', color: '#64748b', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  Excluir
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="search-backdrop" id="caixinha-add-modal" style={{ display: 'flex' }} onClick={(e) => {
          if (e.target === e.currentTarget) setIsModalOpen(false);
        }}>
          <div className="search-modal-card" style={{ width: '500px' }}>
            <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                {editing ? 'Editar lançamento' : 'Novo lançamento'}
              </h3>
              <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={() => setIsModalOpen(false)}>Fechar (X)</span>
            </div>

            <form id="caixinha-add-form" style={{ padding: '20px 24px 24px 24px' }} onSubmit={handleSubmit}>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '14px' }}>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="caixinha-date">Data</label>
                  <input
                    type="date"
                    id="caixinha-date"
                    required
                    value={movDate}
                    onChange={(e) => setMovDate(e.target.value)}
                    style={{ background: '#f8fafc' }}
                  />
                </div>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="caixinha-type">Tipo</label>
                  <select
                    id="caixinha-type"
                    required
                    value={movType}
                    onChange={(e) => handleMovTypeChange(e.target.value)}
                  >
                    <option value="Entrada">Entrada</option>
                    <option value="Saída">Saída</option>
                  </select>
                </div>
              </div>

              <div className="login-group" style={{ marginBottom: '14px' }}>
                <label htmlFor="caixinha-value">Valor (R$)</label>
                <input
                  type="number"
                  id="caixinha-value"
                  placeholder="Ex: 150.00"
                  step="0.01"
                  min="0.01"
                  required
                  value={movValue}
                  onChange={(e) => setMovValue(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="login-group caixinha-descricao-field" style={{ marginBottom: 0 }}>
                <label htmlFor="caixinha-description">Descrição</label>
                <input
                  type="text"
                  id="caixinha-description"
                  placeholder="Digite ou escolha uma descrição"
                  maxLength={300}
                  required
                  value={movDescription}
                  onChange={(e) => {
                    setMovDescription(e.target.value);
                    setSugestoesAbertas(true);
                  }}
                  onFocus={() => setSugestoesAbertas(true)}
                  autoComplete="off"
                />
                {sugestoesAbertas && sugestoes.length > 0 && (
                  <div
                    role="listbox"
                    aria-label="Descrições padrão"
                    style={{
                      marginTop: '8px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      maxHeight: '140px',
                      overflowY: 'auto',
                    }}
                  >
                    {sugestoes.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        onClick={() => {
                          setMovDescription(item.description);
                          setSugestoesAbertas(false);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          background: 'transparent',
                          border: 'none',
                          padding: '10px 14px',
                          fontSize: '14px',
                          color: '#1e293b',
                          cursor: 'pointer',
                        }}
                      >
                        {item.description}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn-login"
                id="btn-caixinha-submit"
                disabled={saving}
                style={{ marginTop: '20px', backgroundColor: '#118CC4' }}
              >
                {saving ? 'Salvando...' : 'Salvar lançamento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceiroCaixinha;
