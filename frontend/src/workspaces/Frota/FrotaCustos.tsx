import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  invalidateCustoFrota,
  useCustoFrotaLotes,
  useCustoFrotaRelatorio,
  useFinalizeCustoFrotaLote,
  useImportCustoFrota,
} from '../../hooks/useFrotaCustos';
import type {
  CustoAbastecimentoRow,
  CustoFrotaImportResult,
  CustoFrotaLote,
  CustoFrotaReportType,
  CustoManutencaoRow,
} from '../../types/domain';

const REPORT_LABELS: Record<CustoFrotaReportType, string> = {
  manutencao: 'Custo de manutenção',
  abastecimento: 'Abastecimentos',
};

const MANUTENCAO_COLUMNS: { label: string; num?: boolean }[] = [
  { label: 'Placa' },
  { label: 'Grupo' },
  { label: 'Item' },
  { label: 'Material', num: true },
  { label: 'Serviços', num: true },
  { label: 'Total', num: true },
];

const ABASTECIMENTO_COLUMNS: { label: string; num?: boolean }[] = [
  { label: 'Placa' },
  { label: 'Data' },
  { label: 'Posto' },
  { label: 'Cidade' },
  { label: 'Motorista' },
  { label: 'Hodômetro', num: true },
  { label: 'Km', num: true },
  { label: 'Litros', num: true },
  { label: 'Combustível' },
  { label: 'Valor', num: true },
];

const REPORT_HINTS: Record<CustoFrotaReportType, string> = {
  manutencao: 'analisecustomanutencao.xls / .xlsx',
  abastecimento: 'analitico-abastecimentos.xlsx',
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const formatAmount = (val?: number | null) =>
  val != null && Number.isFinite(val)
    ? val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';

const formatInt = (val?: number | null) =>
  val != null && Number.isFinite(val) ? val.toLocaleString('pt-BR') : '';

export default function FrotaCustos() {
  const queryClient = useQueryClient();
  const { data: batchesData } = useCustoFrotaLotes();
  const batches = batchesData?.results ?? [];
  const importReport = useImportCustoFrota();
  const finalizeBatch = useFinalizeCustoFrotaLote();

  const [activeTab, setActiveTab] = useState<CustoFrotaReportType>('manutencao');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchStep, setBatchStep] = useState<'history' | 'import'>('history');
  const [importSelections, setImportSelections] = useState<Record<CustoFrotaReportType, boolean>>({
    manutencao: false,
    abastecimento: false,
  });
  const [importFiles, setImportFiles] = useState<Record<CustoFrotaReportType, File | null>>({
    manutencao: null,
    abastecimento: null,
  });
  const [importResults, setImportResults] = useState<Record<CustoFrotaReportType, CustoFrotaImportResult | null>>({
    manutencao: null,
    abastecimento: null,
  });
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const [batchImportProgress, setBatchImportProgress] = useState<Record<CustoFrotaReportType, number>>({
    manutencao: 0,
    abastecimento: 0,
  });
  const [batchImportDone, setBatchImportDone] = useState<Record<CustoFrotaReportType, boolean>>({
    manutencao: false,
    abastecimento: false,
  });

  const queryParams = useMemo(() => ({
    page: currentPage,
    pageSize,
    search: search.trim() || undefined,
  }), [currentPage, pageSize, search]);

  const manutQuery = useCustoFrotaRelatorio('manutencao', queryParams, activeTab === 'manutencao');
  const abastQuery = useCustoFrotaRelatorio('abastecimento', queryParams, activeTab === 'abastecimento');
  const activeQuery = activeTab === 'manutencao' ? manutQuery : abastQuery;
  const activePage = activeQuery.data;
  useAsyncQueryState(activeQuery);

  useEffect(() => {
    const contentEl = document.querySelector('.content') as HTMLElement | null;
    if (!contentEl) return;
    const prev = contentEl.style.overflowY;
    contentEl.style.overflowY = 'hidden';
    return () => { contentEl.style.overflowY = prev; };
  }, []);

  useEffect(() => {
    setSearch('');
    setCurrentPage(1);
  }, [activeTab]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.reports-dropdown-wrapper')) setIsActionsOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const totalItems = activePage?.count ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const clampedPage = Math.min(currentPage, totalPages) || 1;
  const rows = activePage?.results ?? [];
  const activeBatch = batches.find((b) => b.isActive) ?? null;

  const resetImportState = () => {
    setImportSelections({ manutencao: false, abastecimento: false });
    setImportFiles({ manutencao: null, abastecimento: null });
    setImportResults({ manutencao: null, abastecimento: null });
    setIsBatchImporting(false);
    setBatchImportProgress({ manutencao: 0, abastecimento: 0 });
    setBatchImportDone({ manutencao: false, abastecimento: false });
  };

  const handleFileSelect = (key: CustoFrotaReportType, file: File | undefined) => {
    if (!file) return;
    setImportFiles((prev) => ({ ...prev, [key]: file }));
    setImportSelections((prev) => ({ ...prev, [key]: true }));
    setImportResults((prev) => ({ ...prev, [key]: null }));
  };

  const handleStartBatchImport = async () => {
    const toImport = (Object.keys(importSelections) as CustoFrotaReportType[]).filter((k) => importSelections[k]);
    if (toImport.length === 0) {
      alert('Selecione pelo menos um arquivo para importar.');
      return;
    }
    const missingFile = toImport.find((k) => !importFiles[k]);
    if (missingFile) {
      alert(`Selecione o arquivo de ${REPORT_LABELS[missingFile]}.`);
      return;
    }

    setIsBatchImporting(true);
    setBatchImportProgress(Object.fromEntries(toImport.map((k) => [k, 0])) as Record<CustoFrotaReportType, number>);
    setBatchImportDone({ manutencao: false, abastecimento: false });
    setImportResults({ manutencao: null, abastecimento: null });

    for (const type of toImport) {
      const file = importFiles[type]!;
      setBatchImportProgress((prev) => ({ ...prev, [type]: 25 }));
      try {
        const result = await importReport.mutateAsync({ type, file });
        setImportResults((prev) => ({ ...prev, [type]: result }));
        setBatchImportDone((prev) => ({ ...prev, [type]: true }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro inesperado ao importar.';
        setImportResults((prev) => ({
          ...prev,
          [type]: {
            type,
            fileName: file.name,
            success: false,
            rowCount: 0,
            skippedRows: 0,
            issues: [{ severity: 'error', message }],
          },
        }));
        setBatchImportDone((prev) => ({ ...prev, [type]: true }));
      } finally {
        setBatchImportProgress((prev) => ({ ...prev, [type]: 100 }));
      }
    }
  };

  const selectedKeys = (Object.keys(importSelections) as CustoFrotaReportType[]).filter((k) => importSelections[k]);
  const allImportDone = selectedKeys.every((k) => batchImportDone[k]);
  const allImportSuccess = selectedKeys.every((k) => importResults[k]?.success);

  const handleFinishBatchImport = async () => {
    if (!allImportSuccess) return;
    const loteIds = selectedKeys
      .map((k) => importResults[k]?.loteId)
      .filter((id): id is string => Boolean(id));
    const uniqueIds = [...new Set(loteIds)];
    const lastId = uniqueIds[uniqueIds.length - 1];
    if (!lastId) {
      alert('Não foi possível identificar o lote importado.');
      return;
    }
    try {
      await finalizeBatch.mutateAsync(lastId);
      invalidateCustoFrota(queryClient);
      setIsBatchModalOpen(false);
      setBatchStep('history');
      resetImportState();
    } catch {
      alert('Não foi possível concluir a importação. Tente novamente.');
    }
  };

  const td = (content: React.ReactNode, extra?: React.CSSProperties) => (
    <td style={{ borderBottom: '1px solid #f1f5f9', borderRight: 'none', ...extra }}>{content}</td>
  );
  const tdNum = (val?: number | null) => (
    <td className="num" style={{ borderBottom: '1px solid #f1f5f9', borderRight: 'none' }}>{formatAmount(val)}</td>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Custos de frota</h1>
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
              <span
                className="reports-dropdown-item"
                onClick={() => {
                  setBatchStep('history');
                  resetImportState();
                  setIsActionsOpen(false);
                  setIsBatchModalOpen(true);
                }}
              >
                Histórico de Lotes
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="reports-meta-bar" style={{ flexShrink: 0 }}>
        <div className="reports-meta-item">
          <span>Lote atual: <strong>{activeBatch?.label ?? '—'}</strong></span>
        </div>
        <div className="reports-meta-item">
          <span>Período: <strong>{activeBatch ? `${activeBatch.periodoInicio} a ${activeBatch.periodoFim}` : '—'}</strong></span>
        </div>
        <div className="reports-meta-item">
          <span>Atualizado por: <strong>{activeBatch?.updatedBy ?? '—'}</strong></span>
        </div>
      </div>

      <div className="reports-tabs-bar" style={{ flexShrink: 0 }}>
        {(['manutencao', 'abastecimento'] as const).map((tab) => (
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

      <div className="reports-filters-bar" style={{ flexShrink: 0 }}>
        <div className="reports-filter-left">
          <div className="reports-search-wrapper">
            <input
              type="text"
              placeholder="Buscar placa, item ou posto..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <button
            type="button"
            className="reports-action-btn secondary"
            onClick={() => {
              setSearch('');
              setCurrentPage(1);
            }}
          >
            Limpar Filtros
          </button>
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{totalItems}</strong> Registros</span>
        </div>
      </div>

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
                <tr>
                  {(activeTab === 'manutencao' ? MANUTENCAO_COLUMNS : ABASTECIMENTO_COLUMNS).map((col) => (
                    <th
                      key={col.label}
                      className={col.num ? 'num' : undefined}
                      style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'manutencao' ? MANUTENCAO_COLUMNS.length : ABASTECIMENTO_COLUMNS.length} style={{ padding: '28px 16px', textAlign: 'center', color: '#94a3b8' }}>
                      Nenhum registro no lote atual. Use Atualizar para importar as planilhas do período.
                    </td>
                  </tr>
                ) : activeTab === 'manutencao' ? (
                  (rows as CustoManutencaoRow[]).map((row, idx) => (
                    <tr key={row.id} className={idx % 2 === 1 ? 'zebra-row' : ''}>
                      {td(row.placa, { fontWeight: 600 })}
                      {td(row.grupo)}
                      {td(row.item)}
                      {tdNum(row.valorMaterial)}
                      {tdNum(row.valorServicos)}
                      {tdNum(row.valorTotal)}
                    </tr>
                  ))
                ) : (
                  (rows as CustoAbastecimentoRow[]).map((row, idx) => (
                    <tr key={row.id} className={idx % 2 === 1 ? 'zebra-row' : ''}>
                      {td(row.placa, { fontWeight: 600 })}
                      {td(row.data)}
                      {td(row.estabelecimento)}
                      {td(row.cidade)}
                      {td(row.motorista)}
                      {td(formatInt(row.hodometro), { textAlign: 'right' })}
                      {td(formatInt(row.kmTrecho), { textAlign: 'right' })}
                      {tdNum(row.litragem)}
                      {td(row.combustivel)}
                      {tdNum(row.valorTotal)}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-pagination-bar">
          <div className="erp-pagination-page-size">
            <label htmlFor="custos-frota-page-size">Itens por página</label>
            <select
              id="custos-frota-page-size"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
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
            onClick={() => setCurrentPage(1)}
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
          <button
            type="button"
            className="reports-action-btn secondary"
            title="Última página"
            aria-label="Última página"
            disabled={clampedPage >= totalPages}
            onClick={() => setCurrentPage(totalPages)}
            style={{ height: '32px', width: '32px', padding: 0, fontSize: '12px', opacity: clampedPage >= totalPages ? 0.5 : 1, cursor: clampedPage >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5M12.75 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </QueryDataPanel>

      {isBatchModalOpen && (
        <div className="search-backdrop" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget && !isBatchImporting) setIsBatchModalOpen(false); }}>
          <div className="search-modal-card" style={{ width: '700px' }}>
            <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                  {batchStep === 'history' ? 'Histórico de Lotes' : 'Atualizar relatórios'}
                </h3>
                {batchStep === 'import' && (
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                    O lote é definido pelo período da planilha. Reimportar o mesmo mês substitui só aquele relatório.
                  </p>
                )}
              </div>
              {!isBatchImporting && (
                <span className="search-close-key" style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px' }} onClick={() => setIsBatchModalOpen(false)}>Fechar (X)</span>
              )}
            </div>

            {batchStep === 'history' && (
              <div style={{ padding: '20px 24px 16px' }}>
                {batches.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#64748b' }}>Nenhum lote importado ainda.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '8px 12px', color: '#94a3b8', fontWeight: 500, textAlign: 'left' }}>Lote</th>
                        <th style={{ padding: '8px 12px', color: '#94a3b8', fontWeight: 500, textAlign: 'left' }}>Período</th>
                        <th style={{ padding: '8px 12px', color: '#94a3b8', fontWeight: 500, textAlign: 'left' }}>Atualizado por</th>
                        <th style={{ padding: '8px 12px', color: '#94a3b8', fontWeight: 500, textAlign: 'left' }}>Relatórios</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((batch: CustoFrotaLote, i) => (
                        <tr key={batch.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 1 ? '#fafafa' : 'white', opacity: batch.isActive ? 1 : 0.65 }}>
                          <td style={{ padding: '10px 12px' }}>
                            <strong>{batch.label}</strong>
                            {batch.isActive && (
                              <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '8px', background: '#dbeafe', color: '#1d4ed8' }}>Atual</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px' }}>{batch.periodoInicio} a {batch.periodoFim}</td>
                          <td style={{ padding: '10px 12px' }}>{batch.updatedBy}</td>
                          <td style={{ padding: '10px 12px' }}>
                            {[batch.importedReports.manutencao && 'Manutenção', batch.importedReports.abastecimento && 'Abastecimento'].filter(Boolean).join(' · ') || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {batchStep === 'import' && (
              <div style={{ padding: '20px 24px 0' }}>
                {!isBatchImporting && (
                  <div style={{ marginBottom: '4px' }}>
                    {(['manutencao', 'abastecimento'] as CustoFrotaReportType[]).map((key) => {
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
                              {hasFile ? file!.name : `Modelo: ${REPORT_HINTS[key]}`}
                            </div>
                          </div>
                          <input
                            type="file"
                            id={`frota-custo-file-${key}`}
                            accept=".xlsx,.xls"
                            onChange={(e) => {
                              handleFileSelect(key, e.target.files?.[0]);
                              e.target.value = '';
                            }}
                            style={{ display: 'none' }}
                          />
                          <button
                            type="button"
                            onClick={() => document.getElementById(`frota-custo-file-${key}`)?.click()}
                            style={{
                              height: '30px', padding: '0 12px', fontSize: '11px', fontWeight: 500,
                              border: '1px solid #e2e8f0', borderRadius: '4px',
                              background: 'white', color: '#475569', cursor: 'pointer',
                            }}
                          >
                            Escolher arquivo
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {isBatchImporting && (
                  <div style={{ padding: '4px 0 8px' }}>
                    {selectedKeys.map((key) => {
                      const result = importResults[key];
                      const done = batchImportDone[key];
                      const failed = done && result && !result.success;
                      return (
                        <div key={key} style={{ marginBottom: '18px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: failed ? '#dc2626' : done ? '#16a34a' : '#1e293b' }}>{REPORT_LABELS[key]}</span>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: failed ? '#dc2626' : done ? '#16a34a' : '#64748b' }}>
                              {done ? (result?.success ? `${result.rowCount} registros` : 'Falhou') : `${batchImportProgress[key]}%`}
                            </span>
                          </div>
                          <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${batchImportProgress[key]}%`, background: failed ? '#ef4444' : done ? '#16a34a' : '#118CC4' }} />
                          </div>
                          {result?.loteLabel && (
                            <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
                              Lote {result.loteLabel}{result.skippedRows > 0 ? ` · ${result.skippedRows} linha(s) ignorada(s)` : ''}
                            </div>
                          )}
                          {(result?.issues?.length ?? 0) > 0 && (
                            <div style={{ marginTop: '8px', maxHeight: '140px', overflowY: 'auto', borderRadius: '4px', border: `1px solid ${failed ? '#fecaca' : '#fde68a'}`, background: failed ? '#fef2f2' : '#fffbeb', padding: '8px 10px' }}>
                              {(result?.issues ?? []).slice(0, 10).map((issue, idx) => (
                                <div key={idx} style={{ fontSize: '11px', color: issue.severity === 'error' ? '#dc2626' : '#b45309', marginBottom: '4px' }}>
                                  {issue.message}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {allImportDone && allImportSuccess && (
                      <div style={{ padding: '10px 14px', borderRadius: '6px', background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '13px', color: '#16a34a', fontWeight: 500 }}>
                        Importação concluída. Clique em Concluir para definir este período como lote atual.
                      </div>
                    )}
                    {allImportDone && !allImportSuccess && (
                      <div style={{ padding: '10px 14px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', fontSize: '13px', color: '#dc2626', fontWeight: 500 }}>
                        Corrija os avisos (cadastre as placas faltantes, se for o caso) e importe novamente.
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '16px 0', borderTop: '1px solid #f1f5f9', marginTop: '8px' }}>
                  {!isBatchImporting && (
                    <button type="button" className="reports-action-btn primary" onClick={handleStartBatchImport}>
                      Iniciar Importação
                    </button>
                  )}
                  {isBatchImporting && allImportDone && allImportSuccess && (
                    <button type="button" className="reports-action-btn primary" onClick={handleFinishBatchImport}>
                      Concluir importação
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
