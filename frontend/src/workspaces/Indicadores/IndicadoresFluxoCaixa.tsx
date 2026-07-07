import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import QueryDataPanel from '../../components/QueryDataPanel';
import { INDICADORES_CASHFLOW_KEY, useCashflowActivityVersion, useIndicadorCashflow } from '../../hooks/useIndicadores';
import CashflowChart from './CashflowChart';
import CashflowDayDetailModal from './CashflowDayDetailModal';
import CashflowGerencialView from './CashflowGerencialView';
import type { CashflowDayDetailParams } from '../../types/domain';

type CashflowTab = 'visao-geral' | 'fluxo-diario' | 'gerencial';

const TABS: { id: CashflowTab; label: string }[] = [
  { id: 'visao-geral', label: 'Visão Geral' },
  { id: 'fluxo-diario', label: 'Fluxo Diário' },
  { id: 'gerencial', label: 'Gerencial' },
];

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const brToIso = (br: string) => {
  const parts = br.split('/');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

const clampMinDate = (value: string, min?: string) => {
  if (!value || !min) return value;
  return value < min ? min : value;
};

const IndicadoresFluxoCaixa: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CashflowTab>('visao-geral');
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [accountsDropdownOpen, setAccountsDropdownOpen] = useState(false);
  const [positionDropdownOpen, setPositionDropdownOpen] = useState(false);
  const [accountsInitialized, setAccountsInitialized] = useState(false);
  const [includeLimit, setIncludeLimit] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [gerencialDate, setGerencialDate] = useState('');
  const [detailParams, setDetailParams] = useState<CashflowDayDetailParams | null>(null);
  const [syncedPositionId, setSyncedPositionId] = useState<string | null>(null);
  const [positionTouched, setPositionTouched] = useState(false);
  const [periodTouched, setPeriodTouched] = useState(false);
  const accountsDropdownRef = useRef<HTMLDivElement>(null);
  const positionDropdownRef = useRef<HTMLDivElement>(null);

  const [knownAccountIds, setKnownAccountIds] = useState<number[]>([]);

  const accountsParam = useMemo(() => {
    if (!accountsInitialized || !knownAccountIds.length) return undefined;
    if (selectedAccountIds.length === 0) return '';
    if (selectedAccountIds.length === knownAccountIds.length) return undefined;
    return selectedAccountIds.join(',');
  }, [accountsInitialized, selectedAccountIds, knownAccountIds]);

  const queryParams = useMemo(() => {
    const base = {
      ...(positionTouched && selectedPositionId ? { position: selectedPositionId } : {}),
      ...(accountsParam !== undefined ? { accounts: accountsParam } : {}),
      includeLimit,
    };
    if (activeTab === 'gerencial') {
      return { ...base, gerencialDate: gerencialDate || undefined };
    }
    return {
      ...base,
      ...(periodTouched && startDate ? { start: startDate } : {}),
      ...(periodTouched && endDate ? { end: endDate } : {}),
    };
  }, [
    activeTab,
    startDate,
    endDate,
    gerencialDate,
    selectedPositionId,
    accountsParam,
    includeLimit,
    positionTouched,
    periodTouched,
  ]);

  const cashflowQuery = useIndicadorCashflow(queryParams);
  const { data } = cashflowQuery;

  // Sistema multiusuário: se outra pessoa alterar dados do Financeiro (lotes,
  // faturamento, ajustes, contas/saldos bancários) enquanto esta tela estiver
  // aberta, o Fluxo de Caixa deve atualizar sozinho. Fazemos polling barato de
  // um marcador de versão e só recarregamos os dados pesados quando ele muda.
  const queryClient = useQueryClient();
  const { data: activityVersion } = useCashflowActivityVersion();
  const lastActivityVersionRef = useRef<number | null>(null);
  useEffect(() => {
    if (activityVersion === undefined) return;
    if (lastActivityVersionRef.current === null) {
      lastActivityVersionRef.current = activityVersion;
      return;
    }
    if (activityVersion !== lastActivityVersionRef.current) {
      lastActivityVersionRef.current = activityVersion;
      queryClient.invalidateQueries({ queryKey: INDICADORES_CASHFLOW_KEY });
    }
  }, [activityVersion, queryClient]);

  const bankAccounts = data?.facets.bankAccounts ?? [];

  const periodLabel = data
    ? `${data.meta.periodStart} — ${data.meta.periodEnd}`
    : '—';

  const positions = data?.facets.positions ?? [];
  const selectedPositionLabel = positions.find((position) => position.id === selectedPositionId)?.referenceDate ?? '—';
  const positionMinIso = data?.meta.minPeriodDate
    ?? (data?.meta.batchReferenceDate ? brToIso(data.meta.batchReferenceDate) : undefined);
  const gerencialMinIso = data?.meta.minGerencialDate ?? positionMinIso;

  const handlePositionChange = (nextId: string) => {
    setPositionTouched(true);
    setPeriodTouched(false);
    setSelectedPositionId(nextId);
    setSyncedPositionId(null);
    setStartDate('');
    setEndDate('');
    setGerencialDate('');
  };

  const handleResetFilters = () => {
    if (activeTab === 'gerencial') {
      if (data?.meta) {
        setGerencialDate(brToIso(data.meta.batchReferenceDate));
      } else {
        setGerencialDate('');
      }
      return;
    }
    setPeriodTouched(false);
    if (data?.meta) {
      const defaultStart = data.meta.defaultPeriodStart
        ? brToIso(data.meta.defaultPeriodStart)
        : brToIso(data.meta.periodStart);
      const defaultEnd = data.meta.defaultPeriodEnd
        ? brToIso(data.meta.defaultPeriodEnd)
        : brToIso(data.meta.periodEnd);
      setStartDate(clampMinDate(defaultStart, positionMinIso));
      setEndDate(clampMinDate(defaultEnd, positionMinIso));
      setSelectedAccountIds(knownAccountIds);
      setIncludeLimit(true);
    } else {
      setStartDate('');
      setEndDate('');
      setSelectedAccountIds(knownAccountIds);
      setIncludeLimit(true);
    }
  };

  React.useEffect(() => {
    if (data?.meta.positionId && !selectedPositionId) {
      setSelectedPositionId(data.meta.positionId);
    }
  }, [data?.meta.positionId, selectedPositionId]);

  React.useEffect(() => {
    if (!data?.meta) return;
    const positionChanged = data.meta.positionId !== syncedPositionId;
    if (positionChanged || (!startDate && !endDate)) {
      const defaultStart = data.meta.defaultPeriodStart
        ? brToIso(data.meta.defaultPeriodStart)
        : brToIso(data.meta.periodStart);
      const defaultEnd = data.meta.defaultPeriodEnd
        ? brToIso(data.meta.defaultPeriodEnd)
        : brToIso(data.meta.periodEnd);
      setStartDate(clampMinDate(defaultStart, positionMinIso));
      setEndDate(clampMinDate(defaultEnd, positionMinIso));
      setSyncedPositionId(data.meta.positionId ?? null);
    }
    if (positionChanged || !gerencialDate) {
      setGerencialDate(clampMinDate(brToIso(data.meta.batchReferenceDate), gerencialMinIso));
    }
  }, [data?.meta, syncedPositionId, startDate, endDate, gerencialDate, positionMinIso, gerencialMinIso]);

  React.useEffect(() => {
    const ids = bankAccounts.map((account) => account.id);
    if (!ids.length) return;
    setKnownAccountIds((current) => {
      if (current.length === ids.length && current.every((id, index) => id === ids[index])) {
        return current;
      }
      return ids;
    });
    if (!accountsInitialized) {
      setSelectedAccountIds(ids);
      setAccountsInitialized(true);
    }
  }, [bankAccounts, accountsInitialized]);

  React.useEffect(() => {
    if (!accountsDropdownOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const root = accountsDropdownRef.current;
      if (!root) return;
      const target = event.target;
      if (target instanceof Node && root.contains(target)) return;
      setAccountsDropdownOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountsDropdownOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [accountsDropdownOpen]);

  React.useEffect(() => {
    if (!positionDropdownOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const root = positionDropdownRef.current;
      if (!root) return;
      const target = event.target;
      if (target instanceof Node && root.contains(target)) return;
      setPositionDropdownOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPositionDropdownOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [positionDropdownOpen]);

  const accountsFilterLabel = useMemo(() => {
    if (!knownAccountIds.length) return 'Contas bancárias';
    if (selectedAccountIds.length === 0) return 'Contas (nenhuma)';
    if (selectedAccountIds.length === knownAccountIds.length) return 'Todas as contas';
    return `Contas (${selectedAccountIds.length}/${knownAccountIds.length})`;
  }, [selectedAccountIds, knownAccountIds]);

  const toggleAccount = (accountId: number) => {
    setSelectedAccountIds((current) =>
      current.includes(accountId)
        ? current.filter((id) => id !== accountId)
        : [...current, accountId],
    );
  };

  const handleOpenDayDetail = (dateIso: string) => {
    setDetailParams({
      date: dateIso,
      position: selectedPositionId || data?.meta.positionId,
      ...(accountsParam !== undefined ? { accounts: accountsParam } : {}),
      includeLimit,
    });
  };

  return (
    <div className="cashflow-page">
      <header className="view-header cashflow-header">
        <div>
          <h1>Fluxo de Caixa</h1>
          <p>
            Visão consolidada
            {data?.meta.batchReferenceDate ? ` · Posição ${data.meta.batchReferenceDate}` : ' · Projeção diária'}
          </p>
        </div>
      </header>

      <div className="reports-meta-bar">
        <div className="reports-meta-item">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Importado em: <strong>{data?.meta.updatedAt ?? '—'}</strong></span>
        </div>
        <div className="reports-meta-item">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          <span>Usuário: <strong>{data?.meta.updatedBy ?? '—'}</strong></span>
        </div>
        <div className="reports-meta-item cashflow-meta-position">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-9-6h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zM14.25 15h.008v.008H14.25V15zm0 2.25h.008v.008H14.25v-.008zM16.5 15h.008v.008H16.5V15zm0 2.25h.008v.008H16.5v-.008z" />
          </svg>
          <span>Posição:</span>
          <div ref={positionDropdownRef} className="cashflow-meta-position-picker">
            <button
              type="button"
              className="cashflow-meta-position-trigger"
              onClick={() => setPositionDropdownOpen((open) => !open)}
              disabled={positions.length === 0}
              aria-expanded={positionDropdownOpen}
              aria-haspopup="listbox"
            >
              <strong>{selectedPositionLabel}</strong>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div
              className={`reports-dropdown-menu cashflow-meta-position-menu ${positionDropdownOpen ? 'show' : ''}`}
              role="listbox"
              aria-label="Posição"
            >
              {positions.map((position) => (
                <button
                  key={position.id}
                  type="button"
                  role="option"
                  aria-selected={position.id === selectedPositionId}
                  className={`cashflow-meta-position-option${position.id === selectedPositionId ? ' is-active' : ''}`}
                  onClick={() => {
                    handlePositionChange(position.id);
                    setPositionDropdownOpen(false);
                  }}
                >
                  {position.referenceDate}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="reports-tabs-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`reports-tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="reports-filters-bar">
        <div className="reports-filter-left">
          <div className="reports-filter-icon-label">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
            </svg>
            <span>{activeTab === 'gerencial' ? 'Posição em' : 'Período'}</span>
          </div>

          <div className="cashflow-disponibilidade-filters">
            <div ref={accountsDropdownRef} className="reports-dropdown-wrapper cashflow-accounts-dropdown">
              <button
                type="button"
                className="reports-action-btn secondary cashflow-accounts-trigger"
                aria-expanded={accountsDropdownOpen}
                aria-haspopup="listbox"
                disabled={bankAccounts.length === 0}
                onClick={() => setAccountsDropdownOpen((open) => !open)}
              >
                <span>{accountsFilterLabel}</span>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div
                className={`reports-dropdown-menu cashflow-accounts-menu ${accountsDropdownOpen ? 'show' : ''}`}
                role="listbox"
                aria-multiselectable="true"
              >
                <div className="cashflow-accounts-menu-actions">
                  <button type="button" onClick={() => setSelectedAccountIds(knownAccountIds)}>
                    Marcar todas
                  </button>
                  <button type="button" onClick={() => setSelectedAccountIds([])}>
                    Desmarcar todas
                  </button>
                </div>
                <label className="cashflow-accounts-menu-item cashflow-accounts-menu-limit">
                  <input
                    type="checkbox"
                    checked={includeLimit}
                    onChange={(e) => setIncludeLimit(e.target.checked)}
                  />
                  <span>Considerar limite de conta</span>
                </label>
                <div className="cashflow-accounts-menu-list">
                  {bankAccounts.map((account) => (
                    <label key={account.id} className="cashflow-accounts-menu-item">
                      <input
                        type="checkbox"
                        checked={selectedAccountIds.includes(account.id)}
                        onChange={() => toggleAccount(account.id)}
                      />
                      <span>{account.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {activeTab === 'gerencial' ? (
            <div className="cashflow-date-filter">
              <label>
                <span>Data</span>
                <input
                  type="date"
                  value={gerencialDate}
                  min={gerencialMinIso}
                  onChange={(e) => setGerencialDate(clampMinDate(e.target.value, gerencialMinIso ?? ''))}
                />
              </label>
            </div>
          ) : (
            <div className="cashflow-date-filter">
              <label>
                <span>De</span>
                <input
                  type="date"
                  value={startDate}
                  min={positionMinIso}
                  onChange={(e) => {
                    setPeriodTouched(true);
                    setStartDate(clampMinDate(e.target.value, positionMinIso));
                  }}
                />
              </label>
              <label>
                <span>Até</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || positionMinIso}
                  onChange={(e) => {
                    setPeriodTouched(true);
                    setEndDate(clampMinDate(e.target.value, startDate || positionMinIso));
                  }}
                />
              </label>
            </div>
          )}

          <button type="button" className="reports-action-btn secondary cashflow-filter-reset" onClick={handleResetFilters}>
            Limpar
          </button>
        </div>
      </div>

      <QueryDataPanel
        query={cashflowQuery}
        variant="compact"
        fullPageLoader
        loadingMessage="Carregando projeção de caixa..."
        refreshingMessage="Atualizando projeção..."
        errorMessage="Não foi possível carregar o fluxo de caixa. Tente novamente."
      >
        {data && (
        <>
          {activeTab === 'visao-geral' && (
            <div className="cashflow-kpi-grid">
              <div className="cashflow-kpi-card">
                <span className="cashflow-kpi-label">Saldo Previsto</span>
                <strong className="cashflow-kpi-value">{formatCurrency(data.summary.saldoPrevisto)}</strong>
                <span className="cashflow-kpi-hint">
                  Até {data.meta.periodEnd ?? periodLabel}
                </span>
              </div>
              <div className="cashflow-kpi-card cashflow-kpi-card--in">
                <span className="cashflow-kpi-label">Entradas</span>
                <strong className="cashflow-kpi-value">{formatCurrency(data.summary.entradas)}</strong>
                <span className="cashflow-kpi-hint">{periodLabel}</span>
              </div>
              <div className="cashflow-kpi-card cashflow-kpi-card--out">
                <span className="cashflow-kpi-label">Saídas</span>
                <strong className="cashflow-kpi-value">{formatCurrency(data.summary.saidas)}</strong>
                <span className="cashflow-kpi-hint">{periodLabel}</span>
              </div>
              <div className="cashflow-kpi-card">
                <span className="cashflow-kpi-label">Caixa Positivo até</span>
                <strong className="cashflow-kpi-value cashflow-kpi-value--date">{data.summary.caixaPositivoAte}</strong>
                <span className="cashflow-kpi-hint">Projeção global</span>
              </div>
            </div>
          )}

          {activeTab === 'visao-geral' && (
            <div className="erp-card cashflow-chart-card">
              <h2 className="cashflow-section-title">Evolução do Saldo Diário</h2>
              <CashflowChart daily={data.daily} />
            </div>
          )}

          {activeTab === 'fluxo-diario' && (
            <div className="erp-card reports-table-card cashflow-table-card">
              <div className="table-container">
                <table className="erp-table reports-table">
                  <thead>
                    <tr>
                      {['Data', 'Saldo Inicial', 'Entradas', 'Saídas', 'Ajustes', 'Saldo Projetado', ''].map(col => (
                        <th key={col || 'actions'} className={col && col !== 'Data' ? 'num' : undefined}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', color: '#64748b', fontStyle: 'italic', padding: '24px' }}>
                          Nenhum movimento no período.
                        </td>
                      </tr>
                    ) : (
                      data.daily.map((row, index) => {
                        const prevSaldo = index > 0 ? data.daily[index - 1].saldoProjetado : null;
                        const trend = prevSaldo === null
                          ? 'none'
                          : row.saldoProjetado > prevSaldo
                            ? 'up'
                            : row.saldoProjetado < prevSaldo
                              ? 'down'
                              : 'none';

                        return (
                        <tr key={row.dateIso}>
                          <td>{row.date}</td>
                          <td className="num">{formatCurrency(row.saldoInicial)}</td>
                          <td className="num" style={{ color: '#16a34a' }}>{formatCurrency(row.entradas)}</td>
                          <td className="num" style={{ color: '#dc2626' }}>{formatCurrency(row.saidas)}</td>
                          <td className="num" style={{ color: row.ajustes >= 0 ? '#16a34a' : '#dc2626' }}>
                            {formatCurrency(row.ajustes)}
                          </td>
                          <td className="num">
                            <span className="cashflow-saldo-trend">
                              {formatCurrency(row.saldoProjetado)}
                              {trend === 'up' && (
                                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" className="cashflow-trend-icon cashflow-trend-icon--up" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5v-15m0 0l-6.75 6.75M12 4.5l6.75 6.75" />
                                </svg>
                              )}
                              {trend === 'down' && (
                                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" className="cashflow-trend-icon cashflow-trend-icon--down" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0l-6.75-6.75M12 19.5l6.75-6.75" />
                                </svg>
                              )}
                            </span>
                          </td>
                          <td className="cashflow-detail-action-cell">
                            <button
                              type="button"
                              className="cashflow-detail-btn"
                              onClick={() => handleOpenDayDetail(row.dateIso)}
                            >
                              Ver detalhes
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
          )}

          {activeTab === 'gerencial' && (
            <CashflowGerencialView data={data.gerencial} />
          )}
        </>
        )}
      </QueryDataPanel>

      {detailParams && (
        <CashflowDayDetailModal
          params={detailParams}
          onClose={() => setDetailParams(null)}
        />
      )}
    </div>
  );
};

export default IndicadoresFluxoCaixa;
