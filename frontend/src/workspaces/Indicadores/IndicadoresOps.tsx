import React, { useEffect, useMemo } from 'react';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import { useOpsIndicadores } from '../../hooks/useIndicadores';
import { useOcorrenciasIndicadoresFilters } from '../../hooks/useOcorrenciasIndicadoresFilters';
import { CHART_FAIL, CHART_MUTED, CHART_OK, CHART_OPS } from './ocorrenciasChartSetup';
import OcorrenciasIndicadoresFilters, { OcorrenciasGranularityToggle } from './OcorrenciasIndicadoresFilters';

const IndicadoresOps: React.FC = () => {
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

  const query = useOpsIndicadores(queryParams);
  const listState = useAsyncQueryState(query);
  const summary = query.data?.summary;
  const byFilial = query.data?.byFilial ?? [];
  const byPeriod = query.data?.byPeriod ?? query.data?.byMonth ?? [];
  const filiais = query.data?.meta?.availableFiliais ?? [];
  const availableYears = query.data?.meta?.availableYears ?? [];

  useEffect(() => {
    applyDefaultYear(availableYears);
  }, [availableYears, applyDefaultYear]);

  const doughnutData = useMemo(() => ({
    labels: ['MDF-e encerrada (OK)', 'MDF-e não encerrada (Falha)'],
    datasets: [{
      data: [summary?.mdfeEncerradas ?? 0, summary?.mdfePendentes ?? 0],
      backgroundColor: [CHART_OK, CHART_FAIL],
      borderWidth: 0,
    }],
  }), [summary]);

  const filialBarData = useMemo(() => ({
    labels: byFilial.map((r) => r.filial),
    datasets: [
      {
        label: 'Operação OK',
        data: byFilial.map((r) => r.encerradas),
        backgroundColor: CHART_OK,
        stack: 'ops',
        borderRadius: 3,
      },
      {
        label: 'Falha (MDF-e pendente)',
        data: byFilial.map((r) => r.pendentes),
        backgroundColor: CHART_FAIL,
        stack: 'ops',
        borderRadius: 3,
      },
    ],
  }), [byFilial]);

  const periodLineData = useMemo(() => ({
    labels: byPeriod.map((m) => m.label),
    datasets: [
      {
        label: 'Volume de OPs',
        data: byPeriod.map((m) => m.total),
        borderColor: CHART_OPS,
        backgroundColor: 'rgba(17, 140, 196, 0.12)',
        fill: true,
        tension: 0.3,
        yAxisID: 'y',
      },
      {
        label: 'Falhas (MDF-e não encerrada)',
        data: byPeriod.map((m) => m.pendentes),
        borderColor: CHART_FAIL,
        backgroundColor: 'rgba(225, 29, 72, 0.08)',
        fill: false,
        tension: 0.3,
        yAxisID: 'y',
      },
      {
        label: '% Falha',
        data: byPeriod.map((m) => m.percentualFalha),
        borderColor: CHART_MUTED,
        borderDash: [6, 4],
        pointRadius: 3,
        tension: 0.25,
        yAxisID: 'yPct',
      },
    ],
  }), [byPeriod]);

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

  return (
    <div className="indicadores-ocorrencias-page">
      <header className="view-header" style={{ marginBottom: '16px' }}>
        <h1 className="view-page-title" style={{ margin: 0 }}>Indicadores de OPs</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
          Visão analítica da operação e das falhas de encerramento de MDF-e.
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
        onClear={() => clearFilters(availableYears)}
      />

      <QueryDataPanel
        query={query}
        variant="compact"
        fullPageLoader
        refreshVariant="overlay"
        loadingMessage="Carregando indicadores de OPs..."
        refreshingMessage="Atualizando indicadores..."
        errorMessage="Não foi possível carregar os indicadores de OPs."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div className="stat-card card-neutral">
            <div className="stat-card-label">Volume da operação</div>
            <div className="stat-card-value">{summary?.volumeOperacao ?? 0}</div>
            <div className="stat-card-desc">OPs recebidas no período</div>
          </div>
          <div className="stat-card card-negative">
            <div className="stat-card-label">Falhas de processo</div>
            <div className="stat-card-value">{summary?.mdfePendentes ?? 0}</div>
            <div className="stat-card-desc">MDF-e não encerrada</div>
          </div>
          <div className="stat-card card-negative">
            <div className="stat-card-label">Taxa de falha</div>
            <div className="stat-card-value">{(summary?.percentualFalha ?? 0).toLocaleString('pt-BR')}%</div>
            <div className="stat-card-desc">Quanto do volume falhou</div>
          </div>
          <div className="stat-card card-positive">
            <div className="stat-card-label">Processo OK</div>
            <div className="stat-card-value">{(summary?.percentualEncerrado ?? 0).toLocaleString('pt-BR')}%</div>
            <div className="stat-card-desc">{summary?.mdfeEncerradas ?? 0} encerrada(s)</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(320px, 1.4fr)', gap: 16, marginBottom: 16 }}>
          <div className="erp-card" style={{ padding: 16, minHeight: 300 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#0f172a' }}>Falha vs processo OK</h3>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#94a3b8' }}>Proporção de OPs com encerramento correto.</p>
            <div style={{ height: 220 }}>
              <Doughnut
                data={doughnutData}
                options={{
                  ...chartOptions,
                  cutout: '62%',
                  plugins: {
                    ...chartOptions.plugins,
                    tooltip: {
                      callbacks: {
                        label: (ctx) => {
                          const value = Number(ctx.raw ?? 0);
                          const total = (summary?.total ?? 0) || 1;
                          return `${ctx.label}: ${value} (${((value / total) * 100).toFixed(1)}%)`;
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          <div className="erp-card" style={{ padding: 16, minHeight: 300 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#0f172a' }}>Operação por filial</h3>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#94a3b8' }}>Volume operacional e falhas de MDF-e em cada filial.</p>
            <div style={{ height: 220 }}>
              <Bar
                data={filialBarData}
                options={{
                  ...chartOptions,
                  scales: {
                    x: { stacked: true, ticks: { color: '#64748b', font: { size: 11 } }, grid: { display: false } },
                    y: { stacked: true, beginAtZero: true, ticks: { color: '#64748b', font: { size: 11 } } },
                  },
                }}
              />
            </div>
          </div>
        </div>

        <div className="erp-card" style={{ padding: 16, marginBottom: 16, minHeight: 320 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#0f172a' }}>
                Evolução {effectiveGranularity === 'day' ? 'diária' : 'mensal'} da operação e falhas
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                Tendência do volume de OPs e das falhas de encerramento ao longo do tempo.
              </p>
            </div>
            <OcorrenciasGranularityToggle
              months={months}
              granularity={granularity}
              onGranularityChange={setGranularity}
            />
          </div>
          <div style={{ height: 260 }}>
            {byPeriod.length === 0 ? (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                Sem série para o filtro atual.
              </div>
            ) : (
              <Line
                data={periodLineData}
                options={{
                  ...chartOptions,
                  interaction: { mode: 'index', intersect: false },
                  scales: {
                    y: {
                      beginAtZero: true,
                      position: 'left',
                      title: { display: true, text: 'Quantidade', color: '#94a3b8', font: { size: 11 } },
                      ticks: { color: '#64748b' },
                    },
                    yPct: {
                      beginAtZero: true,
                      max: 100,
                      position: 'right',
                      grid: { drawOnChartArea: false },
                      title: { display: true, text: '% Falha', color: '#94a3b8', font: { size: 11 } },
                      ticks: { color: '#64748b', callback: (v) => `${v}%` },
                    },
                    x: {
                      ticks: {
                        color: '#64748b',
                        maxRotation: effectiveGranularity === 'day' ? 45 : 0,
                        autoSkip: true,
                        maxTicksLimit: effectiveGranularity === 'day' ? 14 : 12,
                      },
                      grid: { display: false },
                    },
                  },
                }}
              />
            )}
          </div>
        </div>

        <div className="erp-card reports-table-card" style={{ padding: 8 }}>
          <div className="table-container">
            <table className="erp-table reports-table">
              <thead>
                <tr>
                  <th>FILIAL</th>
                  <th>VOLUME</th>
                  <th>OK</th>
                  <th>FALHAS</th>
                  <th>% FALHA</th>
                  <th>% OK</th>
                </tr>
              </thead>
              <tbody>
                {listState.canShowEmpty && byFilial.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: 20 }}>
                      Nenhum dado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  byFilial.map((row) => (
                    <tr key={row.filial}>
                      <td style={{ fontWeight: 500 }}>{row.filial}</td>
                      <td>{row.total}</td>
                      <td style={{ color: CHART_OK, fontWeight: 600 }}>{row.encerradas}</td>
                      <td style={{ color: CHART_FAIL, fontWeight: 600 }}>{row.pendentes}</td>
                      <td style={{ color: row.percentualFalha > 0 ? CHART_FAIL : undefined, fontWeight: 600 }}>
                        {row.percentualFalha.toLocaleString('pt-BR')}%
                      </td>
                      <td>{row.percentualEncerrado.toLocaleString('pt-BR')}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </QueryDataPanel>
    </div>
  );
};

export default IndicadoresOps;
