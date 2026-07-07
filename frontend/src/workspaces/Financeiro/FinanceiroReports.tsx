import React, { useState, useEffect, useMemo } from 'react';
import type { PagarRow, ReceberRow, AgingRow, ReportBatch, ReportImportResult } from '../../types/domain';
import { REPORT_TEMPLATE_HINTS } from '../../services/reportImportService';
import {
  useReportBatches,
  usePagarReport,
  useReceberReport,
  useAgingReport,
  useReportFacets,
  useImportReport,
  usePrepareReportImport,
  useFinalizeReportBatch,
  invalidateFinanceiroReports,
} from '../../hooks/useFinanceiroReports';
import { useQueryClient } from '@tanstack/react-query';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import GerencialEmailModal from './GerencialEmailModal';
import PrAnalysisModal from './PrAnalysisModal';
import PagarDiffModal from './PagarDiffModal';

type BatchReportKey = 'pagar' | 'receber' | 'aging';
type ReportRow = (PagarRow | ReceberRow | AgingRow) & { selected?: boolean };

const REPORT_LABELS: Record<BatchReportKey, string> = {
  pagar: 'Contas a Pagar',
  receber: 'Contas a Receber',
  aging: 'Aging Luft',
};

type ReportColumn = { label: string; num?: boolean; history?: boolean };

const PAGAR_COLUMNS: ReportColumn[] = [
  { label: 'Filial' }, { label: 'Cód. Forn.' }, { label: 'Fornecedor' }, { label: 'Título' },
  { label: 'Tipo' }, { label: 'Emissão' }, { label: 'Vencto' }, { label: 'Vencto Real' },
  { label: 'Valor', num: true }, { label: 'Saldo', num: true }, { label: 'Histórico', history: true },
];

const RECEBER_COLUMNS: ReportColumn[] = [
  { label: 'Filial' }, { label: 'Cód. Cliente' }, { label: 'Cliente' }, { label: 'Título' },
  { label: 'Natureza' }, { label: 'Emissão' }, { label: 'Vencto' }, { label: 'Vencto Real' },
  { label: 'Valor', num: true }, { label: 'Saldo', num: true }, { label: 'Histórico', history: true },
];

const AGING_COLUMNS: ReportColumn[] = [
  { label: 'Origem' }, { label: 'Cód. Cliente' }, { label: 'Cliente' }, { label: 'Loja' },
  { label: 'Docto' }, { label: 'Série' }, { label: 'Tipo' }, { label: 'Emissão' },
  { label: 'Vencto' }, { label: 'Região' }, { label: 'Total', num: true },
];

const formatReportAmount = (val?: number) =>
  val != null && Number.isFinite(val)
    ? val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';

const columnHeaderClass = (col: ReportColumn) =>
  [col.num ? 'num' : '', col.history ? 'history-cell' : ''].filter(Boolean).join(' ') || undefined;

const brDateToIso = (br: string) => {
  const parts = br.split('/');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

export default function FinanceiroReports() {
  const queryClient = useQueryClient();
  const { data: batchesData } = useReportBatches();
  const batches = batchesData?.results ?? [];
  const maxBatches = batchesData?.maxBatches ?? batches.length;
  const importReport = useImportReport();
  const prepareImport = usePrepareReportImport();
  const finalizeBatch = useFinalizeReportBatch();

  const [activeTab, setActiveTab] = useState<'pagar' | 'receber' | 'aging'>('pagar');
  const [pageRows, setPageRows] = useState<ReportRow[]>([]);
  const [search, setSearch] = useState('');
  const [filialFilter, setFilialFilter] = useState('Todas');
  const [fornecedorFilter, setFornecedorFilter] = useState('Todos');
  const [tipoFilter, setTipoFilter] = useState('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isGerencialEmailOpen, setIsGerencialEmailOpen] = useState(false);
  const [isPrAnalysisOpen, setIsPrAnalysisOpen] = useState(false);
  const [isPagarDiffOpen, setIsPagarDiffOpen] = useState(false);

  // Batch / lote system
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchStep, setBatchStep] = useState<'history' | 'import'>('history');
  const [importSelections, setImportSelections] = useState<Record<BatchReportKey, boolean>>({ pagar: false, receber: false, aging: false });
  const [importFiles, setImportFiles] = useState<Record<BatchReportKey, File | null>>({ pagar: null, receber: null, aging: null });
  const [importResults, setImportResults] = useState<Record<BatchReportKey, ReportImportResult | null>>({ pagar: null, receber: null, aging: null });
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const [batchImportProgress, setBatchImportProgress] = useState<Record<BatchReportKey, number>>({ pagar: 0, receber: 0, aging: 0 });
  const [batchImportDone, setBatchImportDone] = useState<Record<BatchReportKey, boolean>>({ pagar: false, receber: false, aging: false });
  const [importBatch, setImportBatch] = useState<ReportBatch | null>(null);

  const queryParams = useMemo(() => ({
    page: currentPage,
    pageSize,
    search: search.trim() || undefined,
    filial: filialFilter !== 'Todas' ? filialFilter : undefined,
    party: fornecedorFilter !== 'Todos' ? fornecedorFilter : undefined,
    tipo: tipoFilter !== 'Todos' && tipoFilter !== 'Todas' ? tipoFilter : undefined,
  }), [currentPage, search, filialFilter, fornecedorFilter, tipoFilter]);

  const pagarQuery = usePagarReport(queryParams, activeTab === 'pagar');
  const receberQuery = useReceberReport(queryParams, activeTab === 'receber');
  const agingQuery = useAgingReport(queryParams, activeTab === 'aging');
  const { data: facets } = useReportFacets(activeTab);

  const activeQuery = activeTab === 'pagar' ? pagarQuery : activeTab === 'receber' ? receberQuery : agingQuery;
  const activePage = activeQuery.data;
  const listQueryState = useAsyncQueryState(activeQuery);

  // Parent overflow lock for fixed pagination
  useEffect(() => {
    const contentEl = document.querySelector('.content') as HTMLElement | null;
    if (!contentEl) return;
    const prev = contentEl.style.overflowY;
    contentEl.style.overflowY = 'hidden';
    return () => { contentEl.style.overflowY = prev; };
  }, []);

  useEffect(() => {
    setPageRows((activePage?.results ?? []).map(r => ({ ...r, selected: false })));
  }, [activePage]);

  useEffect(() => {
    setSearch('');
    setFilialFilter('Todas');
    setFornecedorFilter('Todos');
    setTipoFilter(activeTab === 'receber' ? 'Todas' : 'Todos');
    setCurrentPage(1);
  }, [activeTab]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.reports-dropdown-wrapper')) setIsActionsOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Pagination (server-side)
  const totalItems = activePage?.count ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const clampedPage = Math.min(currentPage, totalPages) || 1;
  const paginatedRows = pageRows;

  const handleSelectAll = (checked: boolean) =>
    setPageRows(pageRows.map(r => ({ ...r, selected: checked })));
  const handleSelectRow = (idx: number, checked: boolean) => {
    const updated = [...pageRows];
    updated[idx].selected = checked;
    setPageRows(updated);
  };
  const isAllSelected = pageRows.length > 0 && pageRows.every(r => r.selected);

  // Active batch from database
  const activeBatch = batches.find(b => b.isActive) ?? null;
  const gerencialEmailDate = activeBatch ? brDateToIso(activeBatch.date) : '';

  const openGerencialEmail = () => {
    setIsActionsOpen(false);
    if (!activeBatch || !gerencialEmailDate) {
      alert('Nenhum lote ativo para enviar o relatório gerencial.');
      return;
    }
    setIsGerencialEmailOpen(true);
  };

  const openPrAnalysis = () => {
    setIsActionsOpen(false);
    if (!activeBatch) {
      alert('Nenhum lote ativo para analisar PRs.');
      return;
    }
    setIsPrAnalysisOpen(true);
  };

  const openPagarDiff = () => {
    setIsActionsOpen(false);
    if (!activeBatch) {
      alert('Nenhum lote ativo para comparar lançamentos.');
      return;
    }
    if (!activeBatch.importedReports.pagar) {
      alert('O lote ativo não possui Contas a Pagar importado.');
      return;
    }
    setIsPagarDiffOpen(true);
  };
  const allImportDone = (Object.keys(importSelections) as BatchReportKey[]).every(k => !importSelections[k] || batchImportDone[k]);

  const handleClearFilters = () => {
    setSearch('');
    setFilialFilter('Todas');
    setFornecedorFilter('Todos');
    setTipoFilter(activeTab === 'receber' ? 'Todas' : 'Todos');
    setCurrentPage(1);
  };

  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const resetImportState = () => {
    setImportBatch(null);
    setImportSelections({ pagar: false, receber: false, aging: false });
    setImportFiles({ pagar: null, receber: null, aging: null });
    setImportResults({ pagar: null, receber: null, aging: null });
    setIsBatchImporting(false);
    setBatchImportProgress({ pagar: 0, receber: 0, aging: 0 });
    setBatchImportDone({ pagar: false, receber: false, aging: false });
  };

  const openBatchHistory = () => {
    setBatchStep('history');
    resetImportState();
    setIsActionsOpen(false);
    setIsBatchModalOpen(true);
  };

  const handleFileSelect = (key: BatchReportKey, file: File | undefined) => {
    if (!file) return;
    setImportFiles(prev => ({ ...prev, [key]: file }));
    setImportSelections(prev => ({ ...prev, [key]: true }));
    setImportResults(prev => ({ ...prev, [key]: null }));
  };

  const handleStartBatchImport = async () => {
    const toImport = (Object.keys(importSelections) as BatchReportKey[]).filter(k => importSelections[k]);
    if (toImport.length === 0) {
      alert('Selecione pelo menos um arquivo para importar.');
      return;
    }

    const missingFile = toImport.find(k => !importFiles[k]);
    if (missingFile) {
      alert(`Selecione o arquivo de ${REPORT_LABELS[missingFile]}.`);
      return;
    }

    setIsBatchImporting(true);
    setBatchImportProgress(Object.fromEntries(toImport.map(k => [k, 0])) as Record<BatchReportKey, number>);
    setBatchImportDone({ pagar: false, receber: false, aging: false });
    setImportResults({ pagar: null, receber: null, aging: null });

    let batch = importBatch;
    if (!batch) {
      try {
        batch = await prepareImport.mutateAsync();
        setImportBatch(batch);
      } catch {
        alert('Não foi possível criar o lote para importação. Tente novamente.');
        setIsBatchImporting(false);
        return;
      }
    }

    for (const type of toImport) {
      const file = importFiles[type]!;
      setBatchImportProgress(prev => ({ ...prev, [type]: 25 }));
      try {
        const result = await importReport.mutateAsync({ batchId: batch!.id, type, file });
        setImportResults(prev => ({ ...prev, [type]: result }));
        setBatchImportDone(prev => ({ ...prev, [type]: result.success }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro inesperado ao importar.';
        setImportResults(prev => ({
          ...prev,
          [type]: {
            type,
            fileName: file.name,
            success: false,
            rowCount: 0,
            skippedRows: 0,
            issues: [{ severity: 'error', message }],
            data: [],
          },
        }));
        setBatchImportDone(prev => ({ ...prev, [type]: true }));
      } finally {
        setBatchImportProgress(prev => ({ ...prev, [type]: 100 }));
      }
    }
  };

  const allImportSuccess = (Object.keys(importSelections) as BatchReportKey[])
    .filter(k => importSelections[k])
    .every(k => importResults[k]?.success);

  const handleFinishBatchImport = async () => {
    if (!importBatch || !allImportSuccess) return;
    try {
      await finalizeBatch.mutateAsync(importBatch.id);
      invalidateFinanceiroReports(queryClient);
      setIsBatchModalOpen(false);
      setBatchStep('history');
      resetImportState();
    } catch {
      alert('Não foi possível concluir a importação. Tente novamente.');
    }
  };

  const renderTableRow = (row: any, idx: number) => {
    const zebraClass = idx % 2 === 1 ? 'zebra-row' : '';
    const checkbox = (
      <td className="checkbox-cell" style={{ borderBottom: '1px solid #f1f5f9', borderRight: 'none' }}>
        <input type="checkbox" checked={!!row.selected} onChange={(e) => handleSelectRow(idx, e.target.checked)} style={{ borderRadius: '4px' }} />
      </td>
    );
    const td = (content: React.ReactNode, extra?: React.CSSProperties, className?: string) => (
      <td
        className={className}
        style={{ borderBottom: '1px solid #f1f5f9', borderRight: 'none', ...extra }}
      >
        {content}
      </td>
    );
    const tdNum = (val?: number) => (
      <td className="num" style={{ borderBottom: '1px solid #f1f5f9', borderRight: 'none' }}>
        {formatReportAmount(val)}
      </td>
    );

    if (activeTab === 'pagar') {
      const r = row as PagarRow;
      return (
        <tr key={idx} className={zebraClass}>
          {checkbox}
          {td(r.filial)}
          {td(r.codForn)}
          {td(r.fornecedor)}
          {td(r.titulo, { fontWeight: 600 })}
          {td(r.tipo)}
          {td(r.emissao)}
          {td(r.vencimento)}
          {td(r.vencimentoReal)}
          {tdNum(r.valor)}
          {tdNum(r.saldo)}
          {td(r.historico, undefined, 'history-cell')}
        </tr>
      );
    }

    if (activeTab === 'receber') {
      const r = row as ReceberRow;
      return (
        <tr key={idx} className={zebraClass}>
          {checkbox}
          {td(r.filial)}
          {td(r.codCliente)}
          {td(r.cliente)}
          {td(r.titulo, { fontWeight: 600 })}
          {td(r.natureza)}
          {td(r.emissao)}
          {td(r.vencimento)}
          {td(r.vencimentoReal)}
          {tdNum(r.valor)}
          {tdNum(r.saldo)}
          {td(r.historico, undefined, 'history-cell')}
        </tr>
      );
    }

    const r = row as AgingRow;
    return (
      <tr key={idx} className={zebraClass}>
        {checkbox}
        {td(r.origem)}
        {td(r.codCliente)}
        {td(r.cliente)}
        {td(r.loja)}
        {td(r.docto, { fontWeight: 600 })}
        {td(r.serie)}
        {td(r.tipo)}
        {td(r.emissao)}
        {td(r.vencimento)}
        {td(r.regiao)}
        {tdNum(r.total)}
      </tr>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '4px' }}>

      {/* Header */}
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Inclusão de Relatórios</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            className="reports-action-btn primary"
            style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
            onClick={() => {
              resetImportState();
              setBatchStep('import');
              setIsActionsOpen(false);
              setIsBatchModalOpen(true);
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>Atualizar</span>
          </button>

          <div className="reports-dropdown-wrapper">
            <button type="button" className="reports-action-btn secondary" onClick={() => setIsActionsOpen(!isActionsOpen)}>
              <span>Outras Ações</span>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`reports-dropdown-menu ${isActionsOpen ? 'show' : ''}`}>
              <span className="reports-dropdown-item" onClick={openBatchHistory}>Histórico de Lotes</span>
              <span className="reports-dropdown-item" onClick={openPagarDiff}>Novos Títulos</span>
              <span className="reports-dropdown-item" onClick={openPrAnalysis}>Análise de PR</span>
              <span className="reports-dropdown-item" onClick={openGerencialEmail}>Enviar Gerencial</span>
            </div>
          </div>
        </div>
      </header>

      {/* Meta info bar */}
      <div className="reports-meta-bar" style={{ flexShrink: 0 }}>
        <div className="reports-meta-item">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Lote atual: <strong>{activeBatch?.label ?? '—'}</strong></span>
        </div>
        <div className="reports-meta-item">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
          </svg>
          <span>Data: <strong>{activeBatch?.date ?? '—'}</strong></span>
        </div>
        <div className="reports-meta-item">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          <span>Atualizado por: <strong>{activeBatch?.updatedBy ?? '—'}</strong></span>
        </div>
      </div>

      {/* Tabs */}
      <div className="reports-tabs-bar" style={{ flexShrink: 0 }}>
        {(['pagar', 'receber', 'aging'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            className={`reports-tab-btn${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {REPORT_LABELS[tab]}
          </button>
        ))}
      </div>

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
              placeholder="Buscar na tabela..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="reports-select-wrapper">
            {activeTab === 'aging' ? (
              <select value={filialFilter} onChange={(e) => handleFilterChange(setFilialFilter, e.target.value)}>
                <option value="Todas">Origem: Todas</option>
                {(facets?.filiais ?? []).map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            ) : (
              <select value={filialFilter} onChange={(e) => handleFilterChange(setFilialFilter, e.target.value)}>
                <option value="Todas">Filial: Todas</option>
                {(facets?.filiais ?? []).map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            )}
          </div>

          <div className="reports-select-wrapper">
            {activeTab === 'pagar' ? (
              <select value={fornecedorFilter} onChange={(e) => handleFilterChange(setFornecedorFilter, e.target.value)}>
                <option value="Todos">Fornecedor: Todos</option>
                {(facets?.parties ?? []).map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            ) : (
              <select value={fornecedorFilter} onChange={(e) => handleFilterChange(setFornecedorFilter, e.target.value)}>
                <option value="Todos">Cliente: Todos</option>
                {(facets?.parties ?? []).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          <div className="reports-select-wrapper">
            <select value={tipoFilter} onChange={(e) => handleFilterChange(setTipoFilter, e.target.value)}>
              <option value={activeTab === 'receber' ? 'Todas' : 'Todos'}>
                {activeTab === 'receber' ? 'Natureza: Todas' : 'Tipo: Todos'}
              </option>
              {(facets?.tipos ?? []).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
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
        query={activeQuery}
        loadingMessage="Carregando relatório..."
        refreshingMessage="Atualizando relatório..."
        errorMessage="Não foi possível carregar o relatório. Tente novamente."
      >
      <div className="erp-card reports-table-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
          <table className="erp-table reports-table">
            <thead>
              {activeTab === 'pagar' && (
                <tr>
                  <th className="checkbox-cell" style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0' }}>
                    <input type="checkbox" checked={isAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} style={{ borderRadius: '4px' }} />
                  </th>
                  {PAGAR_COLUMNS.map(col => (
                    <th
                      key={col.label}
                      className={columnHeaderClass(col)}
                      style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              )}
              {activeTab === 'receber' && (
                <tr>
                  <th className="checkbox-cell" style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0' }}>
                    <input type="checkbox" checked={isAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} style={{ borderRadius: '4px' }} />
                  </th>
                  {RECEBER_COLUMNS.map(col => (
                    <th
                      key={col.label}
                      className={columnHeaderClass(col)}
                      style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              )}
              {activeTab === 'aging' && (
                <tr>
                  <th className="checkbox-cell" style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0' }}>
                    <input type="checkbox" checked={isAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} style={{ borderRadius: '4px' }} />
                  </th>
                  {AGING_COLUMNS.map(col => (
                    <th
                      key={col.label}
                      className={columnHeaderClass(col)}
                      style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {listQueryState.canShowEmpty && paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => renderTableRow(row, idx))
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

      {/* MODAL: HISTÓRICO DE LOTES */}
      {isBatchModalOpen && (
        <div className="search-backdrop" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget && !isBatchImporting) setIsBatchModalOpen(false); }}>
          <div className="search-modal-card" style={{ width: '700px' }}>

            {/* Header */}
            <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                  {batchStep === 'history' ? 'Histórico de Lotes' : 'Atualizar Relatórios'}
                </h3>
                {batchStep === 'import' && importBatch && (
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                    Lote do dia: <strong>{importBatch.label}</strong> · {importBatch.date}
                  </p>
                )}
                {batchStep === 'import' && !importBatch && (
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                    Será usado o lote de hoje (criado automaticamente se ainda não existir).
                  </p>
                )}
              </div>
              {!isBatchImporting && (
                <span className="search-close-key" style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px' }} onClick={() => setIsBatchModalOpen(false)}>Fechar (X)</span>
              )}
            </div>

            {/* STEP 1 — History (informational only) */}
            {batchStep === 'history' && (
              <div style={{ padding: '20px 24px 0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ width: '120px', padding: '8px 12px', color: '#94a3b8', fontWeight: 500, textAlign: 'left' }}>Lote</th>
                      <th style={{ width: '100px', padding: '8px 12px', color: '#94a3b8', fontWeight: 500, textAlign: 'left', whiteSpace: 'nowrap' }}>Data</th>
                      <th style={{ padding: '8px 12px', color: '#94a3b8', fontWeight: 500, textAlign: 'left', whiteSpace: 'nowrap' }}>Atualizado por</th>
                      <th style={{ width: '110px', padding: '8px 12px', color: '#94a3b8', fontWeight: 500, textAlign: 'left' }}>Relatórios</th>
                      <th style={{ width: '130px', padding: '8px 12px', color: '#94a3b8', fontWeight: 500, textAlign: 'left' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch, i) => {
                      const isActiveBatch = batch.isActive;
                      return (
                        <tr key={batch.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 1 ? '#fafafa' : 'white', opacity: isActiveBatch ? 1 : 0.65 }}>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{batch.label}</span>
                            {isActiveBatch && (
                              <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '8px', background: '#dbeafe', color: '#1d4ed8', verticalAlign: 'middle' }}>
                                Atual
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#475569', whiteSpace: 'nowrap' }}>{batch.date}</td>
                          <td style={{ padding: '10px 12px', color: '#475569', whiteSpace: 'nowrap' }}>{batch.updatedBy}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap' }}>
                              {(['pagar','receber','aging'] as BatchReportKey[]).map(k => (
                                <span key={k} style={{
                                  fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '10px', whiteSpace: 'nowrap',
                                  background: batch.importedReports[k] ? '#dcfce7' : '#f1f5f9',
                                  color: batch.importedReports[k] ? '#16a34a' : '#94a3b8',
                                }}>
                                  {k === 'pagar' ? 'CP' : k === 'receber' ? 'CR' : 'AL'}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {isActiveBatch ? (
                              <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '10px', background: '#dbeafe', color: '#1d4ed8', whiteSpace: 'nowrap' }}>Ativo</span>
                            ) : (
                              <span style={{ fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: '10px', background: '#f1f5f9', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                                Somente leitura
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    CP = Contas a Pagar · CR = Contas a Receber · AL = Aging Luft · últimos {maxBatches} lotes
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 0' }}>
                  <button type="button" className="reports-action-btn secondary" onClick={() => setIsBatchModalOpen(false)}>Fechar</button>
                </div>
              </div>
            )}

            {/* STEP 2 — Import */}
            {batchStep === 'import' && (
              <div style={{ padding: '20px 24px 0' }}>

                {/* Report cards */}
                {!isBatchImporting && (
                  <div style={{ marginBottom: '4px' }}>
                    {(['pagar','receber','aging'] as BatchReportKey[]).map(key => {
                      const file = importFiles[key];
                      const hasFile = !!file;
                      return (
                        <div
                          key={key}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px 14px', borderRadius: '6px', marginBottom: '8px',
                            border: `1px solid ${hasFile ? '#93c5fd' : '#e2e8f0'}`,
                            background: hasFile ? '#eff6ff' : '#fafafa',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>{REPORT_LABELS[key]}</div>
                            <div style={{ fontSize: '11px', color: hasFile ? '#3b82f6' : '#94a3b8', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {hasFile ? file!.name : `Modelo: ${REPORT_TEMPLATE_HINTS[key]}`}
                            </div>
                          </div>
                          <input
                            type="file"
                            id={`import-file-${key}`}
                            accept=".xlsx,.xls"
                            onChange={(e) => {
                              handleFileSelect(key, e.target.files?.[0]);
                              e.target.value = '';
                            }}
                            style={{ display: 'none' }}
                          />
                          <button
                            type="button"
                            onClick={() => document.getElementById(`import-file-${key}`)?.click()}
                            style={{
                              height: '30px', padding: '0 12px', fontSize: '11px', fontWeight: 500,
                              border: '1px solid #e2e8f0', borderRadius: '4px',
                              background: 'white', color: '#475569',
                              cursor: 'pointer', display: 'flex', alignItems: 'center',
                              gap: '5px', whiteSpace: 'nowrap', flexShrink: 0,
                            }}
                          >
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                            Escolher arquivo
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Progress */}
                {isBatchImporting && (
                  <div style={{ padding: '4px 0 8px' }}>
                    {(['pagar','receber','aging'] as BatchReportKey[]).filter(k => importSelections[k]).map(key => {
                      const result = importResults[key];
                      const done = batchImportDone[key];
                      const failed = done && result && !result.success;
                      return (
                      <div key={key} style={{ marginBottom: '18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {done && !failed ? (
                              <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg width="11" height="11" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                              </span>
                            ) : failed ? (
                              <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#dc2626', fontSize: '12px', fontWeight: 700 }}>!</span>
                            ) : (
                              <span style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid #e2e8f0', borderTopColor: '#118CC4', animation: 'spin 0.8s linear infinite', flexShrink: 0, display: 'inline-block' }} />
                            )}
                            <span style={{ fontSize: '13px', fontWeight: 500, color: failed ? '#dc2626' : done ? '#16a34a' : '#1e293b' }}>{REPORT_LABELS[key]}</span>
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: failed ? '#dc2626' : done ? '#16a34a' : '#64748b' }}>
                            {done
                              ? (result?.success ? `${result.rowCount} registros` : 'Falhou')
                              : `${batchImportProgress[key]}%`}
                          </span>
                        </div>
                        <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '3px', transition: 'width 0.1s linear', width: `${batchImportProgress[key]}%`, background: failed ? '#ef4444' : done ? '#16a34a' : '#118CC4' }} />
                        </div>
                        {result && done && (
                          <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
                            <span>{result.fileName}</span>
                            {result.skippedRows > 0 && <span> · {result.skippedRows} linha(s) ignorada(s)</span>}
                          </div>
                        )}
                        {result && (result.issues?.length ?? 0) > 0 && (
                          <div style={{ marginTop: '8px', maxHeight: '120px', overflowY: 'auto', borderRadius: '4px', border: `1px solid ${failed ? '#fecaca' : '#e2e8f0'}`, background: failed ? '#fef2f2' : '#f8fafc', padding: '8px 10px' }}>
                            {(result.issues ?? []).slice(0, 8).map((issue, idx) => (
                              <div key={idx} style={{ fontSize: '11px', color: issue.severity === 'error' ? '#dc2626' : '#b45309', marginBottom: idx < 7 ? '4px' : 0 }}>
                                {issue.row ? `Linha ${issue.row}: ` : ''}{issue.message}
                              </div>
                            ))}
                            {(result.issues?.length ?? 0) > 8 && (
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>+ {(result.issues?.length ?? 0) - 8} aviso(s)...</div>
                            )}
                          </div>
                        )}
                      </div>
                    );})}
                    {allImportDone && allImportSuccess && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '6px', background: '#f0fdf4', border: '1px solid #bbf7d0', marginTop: '4px' }}>
                        <svg width="16" height="16" fill="none" stroke="#16a34a" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 500 }}>Validação concluída. Clique em Concluir importação para aplicar os dados.</span>
                      </div>
                    )}
                    {allImportDone && !allImportSuccess && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', marginTop: '4px' }}>
                        <svg width="16" height="16" fill="none" stroke="#dc2626" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                        <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: 500 }}>Corrija os erros e importe novamente.</span>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '16px 0', borderTop: '1px solid #f1f5f9', marginTop: '8px' }}>
                  {!isBatchImporting && (
                    <button type="button" className="reports-action-btn primary" onClick={handleStartBatchImport}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      Iniciar Importação
                    </button>
                  )}
                  {isBatchImporting && allImportDone && allImportSuccess && (
                    <button type="button" className="reports-action-btn primary" onClick={handleFinishBatchImport}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Concluir importação
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isGerencialEmailOpen && gerencialEmailDate && (
        <GerencialEmailModal
          initialDate={gerencialEmailDate}
          batchLabel={activeBatch?.label}
          onClose={() => setIsGerencialEmailOpen(false)}
        />
      )}

      {isPrAnalysisOpen && (
        <PrAnalysisModal onClose={() => setIsPrAnalysisOpen(false)} />
      )}

      {isPagarDiffOpen && (
        <PagarDiffModal
          activeBatch={activeBatch}
          onClose={() => setIsPagarDiffOpen(false)}
        />
      )}

    </div>
  );
}
