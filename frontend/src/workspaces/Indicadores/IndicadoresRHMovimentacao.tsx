import React, { useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useIndicadorRHMovimentacao } from '../../hooks/useIndicadores';
import RHPayrollChart from './RHPayrollChart';
import RHHeadcountChart from './RHHeadcountChart';
import RHAdmissoesChart from './RHAdmissoesChart';

const CATEGORIA_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'ADMINISTRATIVO', label: 'Administrativo' },
  { value: 'OPERACIONAL', label: 'Operacional' },
  { value: 'MOTORISTA', label: 'Motorista' },
];

type PeriodoKey = 'ano' | 't1' | 't2' | 't3' | 't4' | 's1' | 's2' | 'custom';

const PERIODO_OPTIONS: { value: PeriodoKey; label: string }[] = [
  { value: 'ano', label: 'Ano inteiro' },
  { value: 't1', label: '1º Trimestre' },
  { value: 't2', label: '2º Trimestre' },
  { value: 't3', label: '3º Trimestre' },
  { value: 't4', label: '4º Trimestre' },
  { value: 's1', label: '1º Semestre' },
  { value: 's2', label: '2º Semestre' },
  { value: 'custom', label: 'Personalizado' },
];

/** Meses início/fim (YYYY-MM) — o indicador de RH trabalha por lote mensal. */
const PERIODO_RANGES: Record<Exclude<PeriodoKey, 'custom'>, [string, string]> = {
  ano: ['01', '12'],
  t1: ['01', '03'],
  t2: ['04', '06'],
  t3: ['07', '09'],
  t4: ['10', '12'],
  s1: ['01', '06'],
  s2: ['07', '12'],
};

function currentYearStr(): string {
  return String(new Date().getFullYear());
}

function rangeForPeriodo(ano: number, periodo: Exclude<PeriodoKey, 'custom'>): { start: string; end: string } {
  const [inicio, fim] = PERIODO_RANGES[periodo];
  return { start: `${ano}-${inicio}`, end: `${ano}-${fim}` };
}

function defaultAnoInteiro() {
  const year = currentYearStr();
  return { year, ...rangeForPeriodo(Number(year), 'ano') };
}

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatPercent = (value: number | null) => {
  if (value === null || value === undefined) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

const CATEGORIA_KEYS = [
  ['administrativo', 'Administrativo'],
  ['operacional', 'Operacional'],
  ['motorista', 'Motorista'],
] as const;

const IndicadoresRHMovimentacao: React.FC = () => {
  const defaults = useMemo(() => defaultAnoInteiro(), []);
  const [ano, setAno] = useState(defaults.year);
  const [periodo, setPeriodo] = useState<PeriodoKey>('ano');
  const [startPeriod, setStartPeriod] = useState(defaults.start);
  const [endPeriod, setEndPeriod] = useState(defaults.end);
  const [filial, setFilial] = useState('');
  const [categoria, setCategoria] = useState('');

  const queryParams = useMemo(() => ({
    ...(startPeriod ? { start: startPeriod } : {}),
    ...(endPeriod ? { end: endPeriod } : {}),
    ...(filial ? { filial } : {}),
    ...(categoria ? { categoria } : {}),
  }), [startPeriod, endPeriod, filial, categoria]);

  const rhQuery = useIndicadorRHMovimentacao(queryParams);
  const { data } = rhQuery;

  const series = data?.series ?? [];
  const summary = data?.summary;

  const anosDisponiveis = useMemo(() => {
    const yearNum = Number(currentYearStr());
    const anos = new Set((data?.meta.lotesDisponiveis ?? []).map((lote) => lote.ano));
    anos.add(yearNum);
    return Array.from(anos).sort((a, b) => b - a);
  }, [data?.meta.lotesDisponiveis]);

  const applyPeriodo = (nextAno: string, nextPeriodo: Exclude<PeriodoKey, 'custom'>) => {
    const yearNum = Number(nextAno);
    if (!yearNum) return;
    const range = rangeForPeriodo(yearNum, nextPeriodo);
    setStartPeriod(range.start);
    setEndPeriod(range.end);
  };

  const handleAnoChange = (value: string) => {
    setAno(value);
    const nextPeriodo: Exclude<PeriodoKey, 'custom'> = periodo === 'custom' ? 'ano' : periodo;
    if (periodo === 'custom') setPeriodo('ano');
    applyPeriodo(value, nextPeriodo);
  };

  const handlePeriodoChange = (value: PeriodoKey) => {
    setPeriodo(value);
    if (value === 'custom') return;
    const year = ano || currentYearStr();
    if (!ano) setAno(year);
    applyPeriodo(year, value);
  };

  const handleStartChange = (value: string) => {
    setStartPeriod(value);
    setPeriodo('custom');
  };

  const handleEndChange = (value: string) => {
    setEndPeriod(value);
    setPeriodo('custom');
  };

  const periodoLabel = (() => {
    const inicio = data?.meta.periodoInicio;
    const fim = data?.meta.periodoFim;
    if (!inicio || !fim) return '—';
    return inicio === fim ? inicio : `${inicio} — ${fim}`;
  })();

  const handleResetFilters = () => {
    const reset = defaultAnoInteiro();
    setFilial('');
    setCategoria('');
    setAno(reset.year);
    setPeriodo('ano');
    setStartPeriod(reset.start);
    setEndPeriod(reset.end);
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
            <span>Filtrar</span>
          </div>

          <select className="rh-period-select" value={ano} onChange={(e) => handleAnoChange(e.target.value)}>
            {anosDisponiveis.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>

          <select
            className="rh-period-select"
            value={periodo}
            onChange={(e) => handlePeriodoChange(e.target.value as PeriodoKey)}
          >
            {PERIODO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {periodo === 'custom' && (
            <div className="cashflow-date-filter">
              <label>
                <span>De</span>
                <input type="month" value={startPeriod} onChange={(e) => handleStartChange(e.target.value)} />
              </label>
              <label>
                <span>Até</span>
                <input type="month" value={endPeriod} onChange={(e) => handleEndChange(e.target.value)} />
              </label>
            </div>
          )}

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
            <div className="cashflow-kpi-grid rh-ind-kpi-grid">
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
            </div>

            <div className="rh-ind-categoria-grid">
              {CATEGORIA_KEYS.map(([key, label]) => {
                const bucket = summary.porCategoriaAtual[key];
                return (
                  <div key={key} className="meta-fat-filial-card">
                    <span className="meta-fat-filial-label">{label}</span>
                    <strong className="meta-fat-filial-value">{bucket.count}</strong>
                    <span className="meta-fat-filial-hint">
                      {formatCurrency(bucket.payroll)} · {bucket.percentual.toFixed(1)}% do total
                    </span>
                    <span className="meta-fat-filial-hint">
                      {bucket.ativos.count} ativos · {bucket.afastados.count} afastados
                    </span>
                  </div>
                );
              })}
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
                <h2 className="cashflow-section-title">Admissões × Desligamentos</h2>
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
