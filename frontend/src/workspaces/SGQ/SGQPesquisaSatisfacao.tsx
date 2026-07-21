import React, { useState, useMemo } from 'react';
import type { SgqAvaliacao, SgqPesquisa, SgqPesquisaPayload } from '../../types/domain';
import { SGQ_AVALIACAO_OPTIONS, SGQ_CLIENTE_OPTIONS, SGQ_CRITERIOS } from '../../types/domain';
import {
  useSgqPesquisas,
  useSgqPesquisaStats,
  useCreateSgqPesquisa,
  useUpdateSgqPesquisa,
  useDeleteSgqPesquisa,
} from '../../hooks/useSgqPesquisas';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';

const PAGE_SIZE = 10;

const AVALIACAO_META: Record<SgqAvaliacao, { label: string; color: string; bg: string }> = {
  otimo: { label: 'Ótimo', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.08)' },
  bom: { label: 'Bom', color: '#0f85c1', bg: 'rgba(15, 133, 193, 0.08)' },
  regular: { label: 'Regular', color: '#d97706', bg: 'rgba(217, 119, 6, 0.10)' },
  ruim: { label: 'Ruim', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.08)' },
};

const AVALIACAO_SCORE: Record<SgqAvaliacao, number> = { ruim: 1, regular: 2, bom: 3, otimo: 4 };

function formatDateBr(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function AvaliacaoBadge({ value }: { value: SgqAvaliacao }) {
  const meta = AVALIACAO_META[value];
  if (!meta) return <span>—</span>;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 600,
        color: meta.color,
        background: meta.bg,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta.color }} />
      {meta.label}
    </span>
  );
}

/** Seletor de avaliação em estrelas (1=Ruim … 4=Ótimo), mesma escala da plataforma anterior. */
function StarRating({ value, onChange }: { value: SgqAvaliacao | ''; onChange: (v: SgqAvaliacao) => void }) {
  const [hovered, setHovered] = useState(0);
  const selected = value ? AVALIACAO_SCORE[value] : 0;
  const active = hovered || selected;
  const activeOption = SGQ_AVALIACAO_OPTIONS.find((opt) => AVALIACAO_SCORE[opt.value] === active);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '2px' }} onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4].map((star) => {
          const option = SGQ_AVALIACAO_OPTIONS.find((opt) => AVALIACAO_SCORE[opt.value] === star)!;
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange(option.value)}
              onMouseEnter={() => setHovered(star)}
              title={option.label}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: '0 2px',
                fontSize: '22px',
                lineHeight: 1,
                color: star <= active ? '#f59e0b' : '#d1d5db',
                transition: 'color 0.1s ease, transform 0.1s ease',
                transform: hovered === star ? 'scale(1.15)' : 'scale(1)',
              }}
            >
              ★
            </button>
          );
        })}
      </div>
      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          minWidth: '52px',
          color: activeOption ? AVALIACAO_META[activeOption.value].color : '#94a3b8',
        }}
      >
        {activeOption ? activeOption.label : 'Avaliar'}
      </span>
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
  const [viewMode, setViewMode] = useState<'registros' | 'resumo'>('registros');

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

  const statsQuery = useSgqPesquisaStats(filterParams);
  const stats = statsQuery.data;

  const createPesquisa = useCreateSgqPesquisa();
  const updatePesquisa = useUpdateSgqPesquisa();
  const deletePesquisa = useDeleteSgqPesquisa();
  const isSaving = createPesquisa.isPending || updatePesquisa.isPending;

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPesquisa, setEditingPesquisa] = useState<SgqPesquisa | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const resetFilters = () => {
    setSearch('');
    setFilterCliente('');
    setFilterAvaliacao('');
    setFilterDataInicio('');
    setFilterDataFim('');
    setCurrentPage(1);
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

  const handleDelete = (pesquisa: SgqPesquisa) => {
    if (window.confirm(`Excluir a pesquisa do CT-e ${pesquisa.cte} (${pesquisa.cliente})?`)) {
      deletePesquisa.mutate(pesquisa.id, {
        onError: () => alert('Erro ao excluir a pesquisa. Tente novamente.'),
      });
    }
  };

  const pctOtimo = stats?.percentual.otimo ?? 0;
  const metaOtimo = stats?.metaOtimo ?? 80;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '4px' }}>
      {/* Header */}
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }}></div>
          <h1 className="view-page-title">Pesquisa de Satisfação</h1>
        </div>
        <button
          type="button"
          className="reports-action-btn primary"
          style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
          onClick={openCreateModal}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"></path>
          </svg>
          <span>Nova Pesquisa</span>
        </button>
      </header>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '18px' }}>
        <div className="stat-card">
          <div className="stat-card-label">Total de Pesquisas</div>
          <div className="stat-card-value">{stats?.totalPesquisas ?? '—'}</div>
          <div className="stat-card-desc">{stats ? `${stats.totalAvaliacoes} avaliações registradas` : 'Carregando...'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Avaliação Ótimo</div>
          <div className="stat-card-value" style={{ color: pctOtimo >= metaOtimo ? '#16a34a' : '#d97706' }}>
            {stats ? `${pctOtimo.toFixed(1)}%` : '—'}
          </div>
          <div className="stat-card-desc">
            Meta alvo: {metaOtimo}% {stats ? (pctOtimo >= metaOtimo ? '— atingida' : '— abaixo da meta') : ''}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Avaliação Bom</div>
          <div className="stat-card-value">{stats ? `${stats.percentual.bom.toFixed(1)}%` : '—'}</div>
          <div className="stat-card-desc">{stats ? `${stats.contagem.bom} avaliações` : 'Carregando...'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Pontos de Atenção</div>
          <div className="stat-card-value" style={{ color: (stats?.pontosAtencao ?? 0) > 0 ? '#dc2626' : undefined }}>
            {stats?.pontosAtencao ?? '—'}
          </div>
          <div className="stat-card-desc">Avaliações Regular + Ruim</div>
        </div>
      </div>

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
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <div className="reports-select-wrapper">
            <select value={filterCliente} onChange={(e) => { setFilterCliente(e.target.value); setCurrentPage(1); }}>
              <option value="">Cliente: Todos</option>
              {SGQ_CLIENTE_OPTIONS.map((cliente) => (
                <option key={cliente} value={cliente}>{cliente}</option>
              ))}
            </select>
          </div>

          <div className="reports-select-wrapper">
            <select value={filterAvaliacao} onChange={(e) => { setFilterAvaliacao(e.target.value); setCurrentPage(1); }}>
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
            onChange={(e) => { setFilterDataInicio(e.target.value); setCurrentPage(1); }}
            style={{ height: '36px', padding: '0 12px', background: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155', outline: 'none', boxSizing: 'border-box', width: '140px' }}
          />
          <input
            type="date"
            title="Data final"
            value={filterDataFim}
            onChange={(e) => { setFilterDataFim(e.target.value); setCurrentPage(1); }}
            style={{ height: '36px', padding: '0 12px', background: '#ffffff', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155', outline: 'none', boxSizing: 'border-box', width: '140px' }}
          />

          <button type="button" className="reports-action-btn secondary" onClick={resetFilters}>
            Limpar Filtros
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0', marginLeft: 'auto' }}>
          {(['registros', 'resumo'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className="reports-action-btn secondary"
              onClick={() => setViewMode(mode)}
              style={{
                backgroundColor: viewMode === mode ? '#118CC4' : undefined,
                borderColor: viewMode === mode ? '#118CC4' : undefined,
                color: viewMode === mode ? '#ffffff' : undefined,
              }}
            >
              {mode === 'registros' ? 'Registros' : 'Resumo por critério'}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'registros' ? (
        <QueryDataPanel
          query={listQuery}
          loadingMessage="Carregando pesquisas de satisfação..."
          refreshingMessage="Atualizando pesquisas..."
          errorMessage="Não foi possível carregar as pesquisas. Tente novamente."
        >
          <div className="erp-card reports-table-card" style={{ padding: '8px', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
              <table className="erp-table reports-table">
                <thead>
                  <tr>
                    <th style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 }}>DATA</th>
                    <th style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 }}>CLIENTE</th>
                    <th style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 }}>MOTORISTA</th>
                    <th style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 }}>CT-E</th>
                    <th style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 }}>NF</th>
                    {SGQ_CRITERIOS.map((criterio) => (
                      <th key={criterio.key} title={criterio.label} style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500, textAlign: 'center' }}>
                        {criterio.label.split(' ')[0].toUpperCase()}
                      </th>
                    ))}
                    <th style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500, textAlign: 'center' }}>AÇÕES</th>
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
                        <td style={{ fontWeight: 500 }}>{formatDateBr(pesquisa.data)}</td>
                        <td>{pesquisa.cliente}</td>
                        <td>
                          <div style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pesquisa.motorista}>
                            {pesquisa.motorista}
                          </div>
                        </td>
                        <td>{pesquisa.cte}</td>
                        <td>{pesquisa.notaFiscal}</td>
                        {SGQ_CRITERIOS.map((criterio) => (
                          <td key={criterio.key} style={{ textAlign: 'center' }}>
                            <AvaliacaoBadge value={pesquisa[criterio.key]} />
                          </td>
                        ))}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => openEditModal(pesquisa)}
                              title="Editar"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'transparent', color: '#64748b', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.color = '#118CC4'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
                            >
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                              </svg>
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(pesquisa)}
                              title="Excluir"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'transparent', color: '#64748b', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
                            >
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
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

          {/* Paginação */}
          <div className="erp-pagination-bar">
            <span style={{ fontWeight: 500, marginRight: '4px' }}>
              {totalItems} registro(s) — Página <span className="erp-pagination-current">{Math.min(currentPage, totalPages)}</span> de <span className="erp-pagination-current">{totalPages}</span>
            </span>
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{ height: '28px', padding: '0 10px', fontSize: '11px', gap: '4px', opacity: currentPage >= totalPages ? 0.5 : 1, cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}
            >
              Próximo
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </QueryDataPanel>
      ) : (
        <QueryDataPanel
          query={statsQuery}
          loadingMessage="Calculando resumo por critério..."
          refreshingMessage="Atualizando resumo..."
          errorMessage="Não foi possível calcular o resumo. Tente novamente."
        >
          <div className="erp-card reports-table-card" style={{ padding: '8px', flex: 1, minHeight: 0, overflow: 'auto' }}>
            <table className="erp-table reports-table">
              <thead>
                <tr>
                  <th style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 }}>CRITÉRIO</th>
                  {SGQ_AVALIACAO_OPTIONS.map((opt) => (
                    <th key={opt.value} style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: AVALIACAO_META[opt.value].color, fontWeight: 600, textAlign: 'center' }}>
                      {opt.label.toUpperCase()}
                    </th>
                  ))}
                  <th style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500, textAlign: 'center' }}>% ÓTIMO</th>
                  <th style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500, textAlign: 'center' }}>SCORE (1–4)</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.criterios ?? []).map((criterio) => {
                  const total = criterio.otimo + criterio.bom + criterio.regular + criterio.ruim;
                  const pct = total ? (criterio.otimo / total) * 100 : 0;
                  return (
                    <tr key={criterio.campo}>
                      <td style={{ fontWeight: 600 }}>{criterio.label}</td>
                      <td style={{ textAlign: 'center' }}>{criterio.otimo}</td>
                      <td style={{ textAlign: 'center' }}>{criterio.bom}</td>
                      <td style={{ textAlign: 'center' }}>{criterio.regular}</td>
                      <td style={{ textAlign: 'center' }}>{criterio.ruim}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: pct >= metaOtimo ? '#16a34a' : '#d97706' }}>
                        {total ? `${pct.toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '90px', height: '6px', borderRadius: '3px', background: '#e2e8f0', overflow: 'hidden' }}>
                            <div style={{ width: `${(criterio.score / 4) * 100}%`, height: '100%', borderRadius: '3px', background: criterio.score >= 3.5 ? '#16a34a' : criterio.score >= 2.5 ? '#0f85c1' : criterio.score >= 1.5 ? '#d97706' : '#dc2626' }} />
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '12px' }}>{total ? criterio.score.toFixed(2) : '—'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </QueryDataPanel>
      )}

      {/* MODAL: NOVA/EDITAR PESQUISA */}
      {isModalOpen && (
        <div className="search-backdrop" style={{ display: 'flex' }} onClick={(e) => {
          if (e.target === e.currentTarget) setIsModalOpen(false);
        }}>
          <div className="search-modal-card" style={{ width: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                {editingPesquisa ? 'Editar Pesquisa de Satisfação' : 'Nova Pesquisa de Satisfação'}
              </h3>
              <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={() => setIsModalOpen(false)}>Fechar (X)</span>
            </div>

            <form style={{ padding: '18px 24px 24px 24px' }} onSubmit={handleSubmit}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#118CC4', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px' }}>Dados principais</div>
              <div style={{ display: 'flex', gap: '14px', marginBottom: '12px' }}>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="sgq-data">Data</label>
                  <input type="date" id="sgq-data" required value={form.data} onChange={(e) => setField('data', e.target.value)} style={{ background: '#f8fafc' }} />
                </div>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="sgq-cliente">Cliente</label>
                  <select id="sgq-cliente" required value={form.cliente} onChange={(e) => setField('cliente', e.target.value)}>
                    {SGQ_CLIENTE_OPTIONS.map((cliente) => (
                      <option key={cliente} value={cliente}>{cliente}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="login-group" style={{ marginBottom: '12px' }}>
                <label htmlFor="sgq-motorista">Motorista</label>
                <input type="text" id="sgq-motorista" required placeholder="Nome do motorista" value={form.motorista} onChange={(e) => setField('motorista', e.target.value)} autoComplete="off" />
              </div>
              <div style={{ display: 'flex', gap: '14px', marginBottom: '16px' }}>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="sgq-cte">CT-e</label>
                  <input type="text" id="sgq-cte" required placeholder="Nº do CT-e" value={form.cte} onChange={(e) => setField('cte', e.target.value)} autoComplete="off" />
                </div>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="sgq-nf">Nota Fiscal</label>
                  <input type="text" id="sgq-nf" required placeholder="Nº da NF" value={form.notaFiscal} onChange={(e) => setField('notaFiscal', e.target.value)} autoComplete="off" />
                </div>
              </div>

              <div style={{ fontSize: '12px', fontWeight: 700, color: '#118CC4', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px' }}>Avaliações</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                {SGQ_CRITERIOS.map((criterio) => (
                  <div key={criterio.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>{criterio.label} <span style={{ color: '#dc2626' }}>*</span></span>
                    <StarRating value={form[criterio.key]} onChange={(v) => setField(criterio.key, v)} />
                  </div>
                ))}
              </div>

              <div style={{ fontSize: '12px', fontWeight: 700, color: '#118CC4', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px' }}>Análise e tratativa</div>
              <div className="login-group" style={{ marginBottom: '12px' }}>
                <label htmlFor="sgq-analise">Análise (opcional)</label>
                <textarea id="sgq-analise" rows={2} placeholder="Digite a análise..." value={form.analise} onChange={(e) => setField('analise', e.target.value)} />
              </div>
              <div className="login-group" style={{ marginBottom: 0 }}>
                <label htmlFor="sgq-tratativa">Tratativa e Justificativa (opcional)</label>
                <textarea id="sgq-tratativa" rows={2} placeholder="Digite a tratativa e justificativa..." value={form.tratativaJustificativa} onChange={(e) => setField('tratativaJustificativa', e.target.value)} />
              </div>

              {formError && (
                <div style={{ marginTop: '14px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '13px' }}>
                  {formError}
                </div>
              )}

              <button type="submit" className="btn-login" disabled={isSaving} style={{ marginTop: '18px', backgroundColor: '#118CC4', opacity: isSaving ? 0.7 : 1 }}>
                {isSaving ? 'Salvando...' : (editingPesquisa ? 'Salvar Alterações' : 'Registrar Pesquisa')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SGQPesquisaSatisfacao;
