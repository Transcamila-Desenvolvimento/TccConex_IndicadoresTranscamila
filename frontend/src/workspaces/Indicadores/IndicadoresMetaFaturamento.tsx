import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import QueryDataPanel from '../../components/QueryDataPanel';
import {
  INDICADORES_META_FATURAMENTO_KEY,
  useCashflowActivityVersion,
  useIndicadorMetaFaturamento,
} from '../../hooks/useIndicadores';
import MetaFaturamentoChart from './MetaFaturamentoChart';
import MetaFaturamentoAcumuladoChart from './MetaFaturamentoAcumuladoChart';
import MetaFaturamentoComparativoChart from './MetaFaturamentoComparativoChart';
import MetaFaturamentoDiarioTable from './MetaFaturamentoDiarioTable';

type MetaFatTab = 'visao-geral' | 'detalhe-diario';

const TABS: { id: MetaFatTab; label: string }[] = [
  { id: 'visao-geral', label: 'Visão Geral' },
  { id: 'detalhe-diario', label: 'Detalhe Diário' },
];

const MESES = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

function currentYearStr(): string {
  return String(new Date().getFullYear());
}

function currentMonthStr(): string {
  return String(new Date().getMonth() + 1);
}

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatPercent = (value: number | null | undefined, digits = 1) => {
  if (value === null || value === undefined) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
};

const IndicadoresMetaFaturamento: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MetaFatTab>('visao-geral');
  const [ano, setAno] = useState(currentYearStr());
  const [mes, setMes] = useState(currentMonthStr());

  const anoNum = Number(ano) || new Date().getFullYear();
  const mesNum = Number(mes) || new Date().getMonth() + 1;

  const queryParams = useMemo(() => ({
    ano: anoNum,
    mes: mesNum,
  }), [anoNum, mesNum]);

  const query = useIndicadorMetaFaturamento(queryParams);
  const { data } = query;

  // BillingRecord vive no Financeiro — reutiliza o marcador de atividade do fluxo
  // de caixa para atualizar o indicador quando alguém lança faturamento.
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
      queryClient.invalidateQueries({ queryKey: INDICADORES_META_FATURAMENTO_KEY });
    }
  }, [activityVersion, queryClient]);

  const summary = data?.summary;
  const seriesMensal = data?.seriesMensal ?? [];
  const serieDiaria = data?.serieDiaria;

  const anosDisponiveis = useMemo(() => {
    const yearNum = Number(currentYearStr());
    const anos = new Set(data?.meta.anosDisponiveis ?? []);
    anos.add(yearNum);
    anos.add(anoNum);
    return Array.from(anos).sort((a, b) => b - a);
  }, [data?.meta.anosDisponiveis, anoNum]);

  const handleResetFilters = () => {
    setAno(currentYearStr());
    setMes(currentMonthStr());
  };

  const nomeMes = data?.meta.nomeMesReferencia
    ?? MESES.find((m) => m.value === mes)?.label
    ?? '';
  const periodoLabel = `${nomeMes} / ${ano}`;

  return (
    <div className="cashflow-page">
      <header className="view-header cashflow-header">
        <div>
          <h1>Meta de Faturamento</h1>
          <p>Realizado do Financeiro × metas mensais · {periodoLabel}</p>
        </div>
      </header>

      <div className="reports-tabs-bar">
        {TABS.map((tab) => (
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
            <span>Filtrar</span>
          </div>

          <select className="rh-period-select" value={ano} onChange={(e) => setAno(e.target.value)}>
            {anosDisponiveis.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>

          <select className="rh-period-select" value={mes} onChange={(e) => setMes(e.target.value)}>
            {MESES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button type="button" className="reports-action-btn secondary cashflow-filter-reset" onClick={handleResetFilters}>
            Limpar
          </button>
        </div>
      </div>

      <QueryDataPanel
        query={query}
        variant="compact"
        fullPageLoader
        refreshVariant="overlay"
        loadingMessage="Carregando meta de faturamento..."
        refreshingMessage="Atualizando indicador..."
        errorMessage="Não foi possível carregar o indicador de meta de faturamento. Tente novamente."
      >
        {data && summary && (
          <>
            {activeTab === 'visao-geral' && (
              <>
                <div className="cashflow-kpi-grid meta-fat-kpi-grid">
                  <div className="cashflow-kpi-card">
                    <span className="cashflow-kpi-label">Realizado do mês</span>
                    <strong className="cashflow-kpi-value">{formatCurrency(summary.realizadoMes)}</strong>
                    <span className="cashflow-kpi-hint">
                      Meta {formatCurrency(summary.metaMes)} · {formatPercent(summary.percentualVsMetaMes)}
                    </span>
                  </div>
                  <div className={`cashflow-kpi-card ${summary.metaSuperadaMes ? 'cashflow-kpi-card--in' : 'cashflow-kpi-card--out'}`}>
                    <span className="cashflow-kpi-label">
                      {summary.metaSuperadaMes ? 'Meta do mês superada em' : 'Falta para a meta do mês'}
                    </span>
                    <strong className="cashflow-kpi-value">{formatCurrency(Math.abs(summary.gapMetaMes))}</strong>
                    <span className="cashflow-kpi-hint">
                      {summary.diasUteisDecorridos}/{summary.diasUteis} dias úteis · meta/dia {formatCurrency(summary.metaDia)}
                    </span>
                  </div>
                  <div className="cashflow-kpi-card">
                    <span className="cashflow-kpi-label">Realizado acumulado</span>
                    <strong className="cashflow-kpi-value">{formatCurrency(summary.realizadoAcumulado)}</strong>
                    <span className="cashflow-kpi-hint">
                      Meta acum. {formatCurrency(summary.metaAcumulada)} · {formatPercent(summary.percentualVsMetaAcumulada)}
                    </span>
                  </div>
                  <div className={`cashflow-kpi-card ${summary.gapMetaAcumulada >= 0 ? 'cashflow-kpi-card--in' : 'cashflow-kpi-card--out'}`}>
                    <span className="cashflow-kpi-label">
                      {summary.gapMetaAcumulada >= 0 ? 'Acima da meta acumulada' : 'Abaixo da meta acumulada'}
                    </span>
                    <strong className="cashflow-kpi-value">{formatCurrency(Math.abs(summary.gapMetaAcumulada))}</strong>
                    <span className="cashflow-kpi-hint">
                      {summary.percentualMetaAno.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% da meta anual
                      ({formatCurrency(summary.metaAno)})
                    </span>
                  </div>
                  <div className="cashflow-kpi-card">
                    <span className="cashflow-kpi-label">Vs ano anterior</span>
                    <strong className="cashflow-kpi-value">{formatPercent(summary.variacaoAnoAnteriorAcumulada)}</strong>
                    <span className="cashflow-kpi-hint">
                      Acum. ant. {formatCurrency(summary.realizadoAnoAnteriorAcumulado)}
                    </span>
                  </div>
                </div>

                <div className="meta-fat-filial-grid">
                  {summary.porFilial.map((bucket) => (
                    <div key={bucket.filial} className="meta-fat-filial-card">
                      <span className="meta-fat-filial-label">{bucket.filial}</span>
                      <strong className="meta-fat-filial-value">{formatCurrency(bucket.valor)}</strong>
                      <span className="meta-fat-filial-hint">{bucket.percentual.toFixed(1)}% do mês</span>
                    </div>
                  ))}
                </div>

                <div className="rh-ind-charts-grid">
                  <div className="erp-card cashflow-chart-card rh-ind-chart-card--wide">
                    <h2 className="cashflow-section-title">
                      Comparativo mensal · {anoNum} × {anoNum - 1}
                    </h2>
                    <MetaFaturamentoComparativoChart series={seriesMensal} ano={anoNum} />
                  </div>
                  <div className="erp-card cashflow-chart-card">
                    <h2 className="cashflow-section-title">Realizado × Meta mensal</h2>
                    <MetaFaturamentoChart series={seriesMensal} />
                  </div>
                  <div className="erp-card cashflow-chart-card">
                    <h2 className="cashflow-section-title">Acumulado no ano</h2>
                    <MetaFaturamentoAcumuladoChart series={seriesMensal} ano={anoNum} />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'detalhe-diario' && serieDiaria && (
              <MetaFaturamentoDiarioTable
                payload={serieDiaria}
                ano={anoNum}
                titulo={`Faturamento diário — ${periodoLabel}`}
              />
            )}
          </>
        )}
      </QueryDataPanel>
    </div>
  );
};

export default IndicadoresMetaFaturamento;
