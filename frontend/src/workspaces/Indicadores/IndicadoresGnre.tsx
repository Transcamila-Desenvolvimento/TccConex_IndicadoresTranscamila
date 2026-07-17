import React, { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import { useGnreIndicadores, useGnreIndicadoresGuias } from '../../hooks/useIndicadores';
import { useOcorrenciasIndicadoresFilters } from '../../hooks/useOcorrenciasIndicadoresFilters';
import { CHART_FAIL, CHART_OK, CHART_OPS } from './ocorrenciasChartSetup';
import OcorrenciasIndicadoresFilters, { OcorrenciasGranularityToggle } from './OcorrenciasIndicadoresFilters';

const GUIAS_PAGE_SIZE = 10;

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPeriodo(value: string): string {
  if (!value) return '—';
  // Aceita YYYY-MM ou data ISO.
  const iso = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split('-');
    return `01/${m}/${y}`;
  }
  return value;
}

const IndicadoresGnre: React.FC = () => {
  const {
    filial,
    setFilial,
    year,
    setYear,
    months,
    setMonths,
    granularity,
    setGranularity,
    effectiveGranularity,
    queryParams,
    applyDefaultYear,
    clearFilters,
  } = useOcorrenciasIndicadoresFilters();

  const [tableSearch, setTableSearch] = useState('');
  const [tablePage, setTablePage] = useState(1);
  const isDayView = effectiveGranularity === 'day';

  const guiasParams = useMemo(
    () => ({
      filial: queryParams.filial,
      year: queryParams.year,
      months: queryParams.months,
      search: tableSearch.trim() || undefined,
      page: tablePage,
      pageSize: GUIAS_PAGE_SIZE,
    }),
    [queryParams.filial, queryParams.year, queryParams.months, tableSearch, tablePage],
  );

  const query = useGnreIndicadores(queryParams);
  const guiasQuery = useGnreIndicadoresGuias(guiasParams);
  const guiasState = useAsyncQueryState(guiasQuery);
  const summary = query.data?.summary;
  const byFilial = query.data?.byFilial ?? [];
  const byPeriod = query.data?.byPeriod ?? query.data?.byMonth ?? [];
  const guias = guiasQuery.data?.results ?? [];
  const guiasCount = guiasQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(guiasCount / GUIAS_PAGE_SIZE));
  const filiais = query.data?.meta?.availableFiliais ?? [];
  const availableYears = query.data?.meta?.availableYears ?? [];

  useEffect(() => {
    applyDefaultYear(availableYears);
  }, [availableYears, applyDefaultYear]);

  useEffect(() => {
    setTablePage(1);
  }, [filial, year, months]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { usePointStyle: true, boxWidth: 8, color: '#64748b', font: { size: 11 } },
      },
    },
  };

  const valorAcumuladoPeriodoData = useMemo(() => ({
    labels: byPeriod.map((r) => r.label),
    datasets: [
      {
        label: 'Valor acumulado',
        data: byPeriod.map((r) => r.valorTotal),
        backgroundColor: CHART_OPS,
        borderRadius: 3,
      },
    ],
  }), [byPeriod]);

  const valorAcumuladoFilialData = useMemo(() => ({
    labels: byFilial.map((r) => r.filial),
    datasets: [
      {
        label: 'Valor acumulado',
        data: byFilial.map((r) => r.valorTotal),
        backgroundColor: CHART_OPS,
        borderRadius: 3,
      },
    ],
  }), [byFilial]);

  const percentualGuiasData = useMemo(() => ({
    labels: byFilial.map((r) => r.filial),
    datasets: [
      {
        label: 'Validadas',
        data: byFilial.map((r) => r.percentualValidado),
        backgroundColor: CHART_OK,
        stack: 'pct',
        borderRadius: 3,
      },
      {
        label: 'Não validadas',
        data: byFilial.map((r) => r.percentualFalha),
        backgroundColor: CHART_FAIL,
        stack: 'pct',
        borderRadius: 3,
      },
    ],
  }), [byFilial]);

  return (
    <div className="indicadores-ocorrencias-page">
      <header className="view-header" style={{ marginBottom: '16px' }}>
        <h1 className="view-page-title" style={{ margin: 0 }}>GNREs — Resumo financeiro</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
          Visão geral do valor de ICMS e da validação das guias.
        </p>
      </header>

      <OcorrenciasIndicadoresFilters
        filial={filial}
        onFilialChange={setFilial}
        year={year}
        onYearChange={setYear}
        months={months}
        onMonthsChange={setMonths}
        availableYears={availableYears}
        filiais={filiais}
        onClear={() => {
          clearFilters(availableYears);
          setTableSearch('');
          setTablePage(1);
        }}
      />

      <QueryDataPanel
        query={query}
        variant="compact"
        fullPageLoader
        refreshVariant="overlay"
        loadingMessage="Carregando resumo de GNREs..."
        refreshingMessage="Atualizando resumo..."
        errorMessage="Não foi possível carregar o resumo de GNREs."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div className="stat-card card-neutral">
            <div className="stat-card-label">Valor total de ICMS</div>
            <div className="stat-card-value" style={{ fontSize: 18 }}>{formatMoney(summary?.valorTotal ?? 0)}</div>
          </div>
          <div className="stat-card card-positive">
            <div className="stat-card-label">Guias validadas</div>
            <div className="stat-card-value">{summary?.validadas ?? 0}</div>
          </div>
          <div className="stat-card card-negative">
            <div className="stat-card-label">Guias não validadas</div>
            <div className="stat-card-value">{summary?.naoValidadas ?? 0}</div>
          </div>
          <div className="stat-card card-neutral">
            <div className="stat-card-label">Total de guias</div>
            <div className="stat-card-value">{summary?.total ?? 0}</div>
          </div>
        </div>

        <div className="erp-card" style={{ padding: 16, marginBottom: 16, minHeight: 320 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#0f172a' }}>
                Valor acumulado por {isDayView ? 'dia' : 'mês'}
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                Soma do valor das guias GNRE/ICMS no período
                {isDayView ? ' (visão diária)' : ' (visão mensal)'}.
              </p>
            </div>
            <OcorrenciasGranularityToggle
              months={months}
              granularity={granularity}
              onGranularityChange={setGranularity}
            />
          </div>
          <div style={{ height: 280 }}>
            {byPeriod.length === 0 ? (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                Sem série para o filtro atual.
              </div>
            ) : (
              <Bar
                data={valorAcumuladoPeriodoData}
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => {
                          const row = byPeriod[ctx.dataIndex];
                          return [
                            `Quantidade: ${row?.total ?? 0}`,
                            `Valor: ${formatMoney(Number(ctx.raw ?? 0))}`,
                          ];
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      ticks: {
                        color: '#64748b',
                        maxRotation: isDayView ? 45 : 0,
                        autoSkip: true,
                        maxTicksLimit: isDayView ? 16 : 12,
                      },
                      grid: { display: false },
                    },
                    y: {
                      beginAtZero: true,
                      ticks: {
                        color: '#64748b',
                        callback: (v) => Number(v).toLocaleString('pt-BR', { notation: 'compact' }),
                      },
                    },
                  },
                }}
              />
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div className="erp-card" style={{ padding: 16, minHeight: 300 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#0f172a' }}>
              Valor acumulado por filial
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#94a3b8' }}>
              Soma do valor das guias por filial de origem.
            </p>
            <div style={{ height: 240 }}>
              {byFilial.length === 0 ? (
                <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                  Sem dados por filial.
                </div>
              ) : (
                <Bar
                  data={valorAcumuladoFilialData}
                  options={{
                    ...chartOptions,
                    indexAxis: 'y' as const,
                    plugins: {
                      ...chartOptions.plugins,
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => {
                            const row = byFilial[ctx.dataIndex];
                            return [
                              `Quantidade: ${row?.total ?? 0}`,
                              `Valor: ${formatMoney(Number(ctx.raw ?? 0))}`,
                            ];
                          },
                        },
                      },
                    },

                    scales: {
                      x: {
                        beginAtZero: true,
                        ticks: {
                          color: '#64748b',
                          callback: (v) => Number(v).toLocaleString('pt-BR', { notation: 'compact' }),
                        },
                      },
                      y: { ticks: { color: '#64748b' }, grid: { display: false } },
                    },
                  }}
                />
              )}
            </div>
          </div>

          <div className="erp-card" style={{ padding: 16, minHeight: 300 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#0f172a' }}>
              Percentual de guias validadas e não validadas
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#94a3b8' }}>
              Proporção de validação por filial de origem.
            </p>
            <div style={{ height: 240 }}>
              {byFilial.length === 0 ? (
                <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                  Sem dados por filial.
                </div>
              ) : (
                <Bar
                  data={percentualGuiasData}
                  options={{
                    ...chartOptions,
                    scales: {
                      x: { stacked: true, ticks: { color: '#64748b' }, grid: { display: false } },
                      y: {
                        stacked: true,
                        beginAtZero: true,
                        max: 100,
                        ticks: { color: '#64748b', callback: (v) => `${v}%` },
                      },
                    },
                    plugins: {
                      ...chartOptions.plugins,
                      tooltip: {
                        callbacks: {
                          label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw ?? 0).toLocaleString('pt-BR')}%`,
                        },
                      },
                    },
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <div className="erp-card reports-table-card" style={{ padding: 8 }}>
          <div
            className="reports-filters-bar"
            style={{ marginBottom: 12, padding: '4px 4px 0', position: 'relative', zIndex: 2 }}
          >
            <div className="reports-filter-left">
              <div className="reports-search-wrapper">
                <input
                  type="text"
                  placeholder="Buscar filial, CT-e ou período..."
                  value={tableSearch}
                  onChange={(e) => {
                    setTableSearch(e.target.value);
                    setTablePage(1);
                  }}
                  aria-label="Pesquisar guias"
                />
              </div>
              <span className="reports-records-count">
                <strong>{guiasCount}</strong> guia(s)
              </span>
            </div>
          </div>

          <QueryDataPanel
            query={guiasQuery}
            variant="compact"
            refreshVariant="overlay"
            loadingMessage="Carregando guias..."
            refreshingMessage="Atualizando guias..."
            errorMessage="Não foi possível carregar as guias."
          >
            <div className="table-container">
              <table className="erp-table reports-table">
                <thead>
                  <tr>
                    <th>STATUS</th>
                    <th>GUIA</th>
                    <th>FILIAL DE ORIGEM</th>
                    <th>CTE</th>
                    <th>PERÍODO DE REFERÊNCIA</th>
                    <th>VALOR</th>
                  </tr>
                </thead>
                <tbody>
                  {guiasState.canShowEmpty && guias.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: 20 }}>
                        Nenhuma guia para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    guias.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: row.validada ? 'rgba(5, 150, 105, 0.12)' : 'rgba(225, 29, 72, 0.12)',
                              color: row.validada ? CHART_OK : CHART_FAIL,
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                            aria-label={row.validada ? 'Validada' : 'Não validada'}
                          >
                            {row.validada ? '✓' : '✕'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: row.validada ? CHART_OK : CHART_FAIL }}>
                          {row.validada ? 'SIM' : 'NÃO'}
                        </td>
                        <td>{row.filial}</td>
                        <td>{row.cte}</td>
                        <td>{formatPeriodo(row.periodoReferencia || row.dataPagamento)}</td>
                        <td style={{ fontWeight: 600 }}>{formatMoney(row.valorGuia)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </QueryDataPanel>

          <div className="erp-pagination-bar">
            <span style={{ fontWeight: 500, marginRight: 4 }}>
              Página <span className="erp-pagination-current">{Math.min(tablePage, totalPages)}</span> de{' '}
              <span className="erp-pagination-current">{totalPages}</span>
            </span>
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={tablePage <= 1}
              onClick={() => setTablePage((p) => Math.max(1, p - 1))}
              style={{
                height: 28,
                padding: '0 10px',
                fontSize: 11,
                opacity: tablePage <= 1 ? 0.5 : 1,
                cursor: tablePage <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Anterior
            </button>
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={tablePage >= totalPages}
              onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
              style={{
                height: 28,
                padding: '0 10px',
                fontSize: 11,
                opacity: tablePage >= totalPages ? 0.5 : 1,
                cursor: tablePage >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Próximo
            </button>
          </div>
        </div>
      </QueryDataPanel>
    </div>
  );
};

export default IndicadoresGnre;
