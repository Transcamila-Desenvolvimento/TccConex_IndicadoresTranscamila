import React, { useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useIndicadorRHMovimentacao } from '../../hooks/useIndicadores';
import RHPayrollChart from './RHPayrollChart';
import RHHeadcountChart from './RHHeadcountChart';
import RHAdmissoesChart from './RHAdmissoesChart';
import type { RHIndicadorLoteOption } from '../../types/domain';

const CATEGORIA_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'ADMINISTRATIVO', label: 'Administrativo' },
  { value: 'OPERACIONAL', label: 'Operacional' },
  { value: 'MOTORISTA', label: 'Motorista' },
];

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatPercent = (value: number | null) => {
  if (value === null || value === undefined) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

const periodoValue = (lote: RHIndicadorLoteOption) => `${lote.ano}-${String(lote.mes).padStart(2, '0')}`;

const IndicadoresRHMovimentacao: React.FC = () => {
  const [startPeriod, setStartPeriod] = useState('');
  const [endPeriod, setEndPeriod] = useState('');
  const [periodTouched, setPeriodTouched] = useState(false);
  const [filial, setFilial] = useState('');
  const [categoria, setCategoria] = useState('');

  const queryParams = useMemo(() => ({
    ...(periodTouched && startPeriod ? { start: startPeriod } : {}),
    ...(periodTouched && endPeriod ? { end: endPeriod } : {}),
    ...(filial ? { filial } : {}),
    ...(categoria ? { categoria } : {}),
  }), [periodTouched, startPeriod, endPeriod, filial, categoria]);

  const rhQuery = useIndicadorRHMovimentacao(queryParams);
  const { data } = rhQuery;

  const lotes = data?.meta.lotesDisponiveis ?? [];
  const series = data?.series ?? [];
  const summary = data?.summary;

  React.useEffect(() => {
    if (periodTouched || !series.length) return;
    setStartPeriod(periodoValue(series[0]));
    setEndPeriod(periodoValue(series[series.length - 1]));
  }, [periodTouched, series]);

  const periodoLabel = data?.meta.periodoInicio && data?.meta.periodoFim
    ? `${data.meta.periodoInicio} — ${data.meta.periodoFim}`
    : '—';

  const handleResetFilters = () => {
    setPeriodTouched(false);
    setFilial('');
    setCategoria('');
  };

  return (
    <div className="cashflow-page">
      <header className="view-header cashflow-header">
        <div>
          <h1>Movimentação de RH</h1>
          <p>Evolução de quantitativo e folha salarial · {periodoLabel}</p>
        </div>
      </header>

      <div className="reports-filters-bar">
        <div className="reports-filter-left">
          <div className="reports-filter-icon-label">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
            </svg>
            <span>Período</span>
          </div>

          <div className="cashflow-date-filter">
            <label>
              <span>De</span>
              <select
                className="rh-period-select"
                value={startPeriod}
                onChange={(e) => {
                  setPeriodTouched(true);
                  setStartPeriod(e.target.value);
                }}
              >
                {lotes.map((lote) => (
                  <option key={periodoValue(lote)} value={periodoValue(lote)}>{lote.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Até</span>
              <select
                className="rh-period-select"
                value={endPeriod}
                onChange={(e) => {
                  setPeriodTouched(true);
                  setEndPeriod(e.target.value);
                }}
              >
                {lotes.map((lote) => (
                  <option key={periodoValue(lote)} value={periodoValue(lote)}>{lote.label}</option>
                ))}
              </select>
            </label>
          </div>

          <select className="rh-period-select" value={filial} onChange={(e) => setFilial(e.target.value)}>
            <option value="">Todas as filiais</option>
            {(data?.meta.filiaisDisponiveis ?? []).map((nome) => (
              <option key={nome} value={nome}>{nome}</option>
            ))}
          </select>

          <select className="rh-period-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.value ? opt.label : 'Todas as categorias'}</option>
            ))}
          </select>

          <button type="button" className="reports-action-btn secondary cashflow-filter-reset" onClick={handleResetFilters}>
            Limpar
          </button>
        </div>
      </div>

      <QueryDataPanel
        query={rhQuery}
        variant="compact"
        fullPageLoader
        refreshVariant="overlay"
        loadingMessage="Carregando movimentação de RH..."
        refreshingMessage="Atualizando indicador..."
        errorMessage="Não foi possível carregar o indicador de RH. Tente novamente."
      >
        {data && summary && (
          <>
            <div className="cashflow-kpi-grid">
              <div className="cashflow-kpi-card">
                <span className="cashflow-kpi-label">Total de Colaboradores</span>
                <strong className="cashflow-kpi-value">{summary.totalColaboradores}</strong>
                <span className="cashflow-kpi-hint">{formatPercent(summary.variacaoHeadcountPercentual)} no período</span>
              </div>
              <div className="cashflow-kpi-card">
                <span className="cashflow-kpi-label">Folha Salarial Total</span>
                <strong className="cashflow-kpi-value">{formatCurrency(summary.payrollTotal)}</strong>
                <span className="cashflow-kpi-hint">{formatPercent(summary.variacaoPayrollPercentual)} no período</span>
              </div>
              <div className="cashflow-kpi-card">
                <span className="cashflow-kpi-label">Salário Médio</span>
                <strong className="cashflow-kpi-value">{formatCurrency(summary.salarioMedio)}</strong>
                <span className="cashflow-kpi-hint">Último mês da série</span>
              </div>
              <div className="cashflow-kpi-card cashflow-kpi-card--in">
                <span className="cashflow-kpi-label">Admitidos no Período</span>
                <strong className="cashflow-kpi-value">{summary.admitidosPeriodo}</strong>
                <span className="cashflow-kpi-hint">{periodoLabel}</span>
              </div>
              <div className="cashflow-kpi-card cashflow-kpi-card--out">
                <span className="cashflow-kpi-label">Desligados no Período</span>
                <strong className="cashflow-kpi-value">{summary.desligadosPeriodo}</strong>
                <span className="cashflow-kpi-hint">{periodoLabel}</span>
              </div>
              <div className="cashflow-kpi-card">
                <span className="cashflow-kpi-label">Turnover</span>
                <strong className="cashflow-kpi-value">{summary.turnoverPercentual.toFixed(1)}%</strong>
                <span className="cashflow-kpi-hint">Desligados / headcount médio</span>
              </div>
            </div>

            <div className="rh-ind-categoria-grid">
              <div className="rh-ind-categoria-card rh-ind-categoria-card--administrativo">
                <span className="rh-ind-categoria-label">Administrativo</span>
                <strong className="rh-ind-categoria-value">{summary.porCategoriaAtual.administrativo.count}</strong>
                <span className="rh-ind-categoria-hint">
                  {formatCurrency(summary.porCategoriaAtual.administrativo.payroll)} · {summary.porCategoriaAtual.administrativo.percentual.toFixed(1)}%
                </span>
              </div>
              <div className="rh-ind-categoria-card rh-ind-categoria-card--operacional">
                <span className="rh-ind-categoria-label">Operacional</span>
                <strong className="rh-ind-categoria-value">{summary.porCategoriaAtual.operacional.count}</strong>
                <span className="rh-ind-categoria-hint">
                  {formatCurrency(summary.porCategoriaAtual.operacional.payroll)} · {summary.porCategoriaAtual.operacional.percentual.toFixed(1)}%
                </span>
              </div>
              <div className="rh-ind-categoria-card rh-ind-categoria-card--motorista">
                <span className="rh-ind-categoria-label">Motorista</span>
                <strong className="rh-ind-categoria-value">{summary.porCategoriaAtual.motorista.count}</strong>
                <span className="rh-ind-categoria-hint">
                  {formatCurrency(summary.porCategoriaAtual.motorista.payroll)} · {summary.porCategoriaAtual.motorista.percentual.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="rh-ind-charts-grid">
              <div className="erp-card cashflow-chart-card">
                <h2 className="cashflow-section-title">Evolução da Folha Salarial</h2>
                <RHPayrollChart series={series} />
              </div>
              <div className="erp-card cashflow-chart-card">
                <h2 className="cashflow-section-title">Evolução do Quantitativo por Categoria</h2>
                <RHHeadcountChart series={series} />
              </div>
              <div className="erp-card cashflow-chart-card rh-ind-chart-card--wide">
                <h2 className="cashflow-section-title">Admissões x Desligamentos</h2>
                <RHAdmissoesChart series={series} />
              </div>
            </div>
          </>
        )}
      </QueryDataPanel>
    </div>
  );
};

export default IndicadoresRHMovimentacao;
