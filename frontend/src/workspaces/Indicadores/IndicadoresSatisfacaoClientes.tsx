import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import QueryDataPanel from '../../components/QueryDataPanel';
import {
  INDICADORES_SGQ_SATISFACAO_KEY,
  useIndicadorSgqSatisfacao,
  useIndicadorSgqSatisfacaoDetalhes,
  useSgqSatisfacaoActivityVersion,
} from '../../hooks/useIndicadores';
import { useSgqClientes } from '../../hooks/useSgqPesquisas';
import SgqDistribuicaoChart from './SgqDistribuicaoChart';
import SgqCriteriosChart from './SgqCriteriosChart';
import SgqEvolucaoChart from './SgqEvolucaoChart';
import SgqFiliaisChart from './SgqFiliaisChart';
import SgqPerfilAvaliacoesTable from './SgqPerfilAvaliacoesTable';
import SgqRecorrenciasEscopoTable from './SgqRecorrenciasEscopoTable';
import SgqSatisfacaoDetalhesTable from './SgqSatisfacaoDetalhesTable';

type PeriodoKey = 'ano' | 't1' | 't2' | 't3' | 't4' | 's1' | 's2' | 'custom';
type SatisfacaoTab = 'visao-geral' | 'detalhes';

const TABS: { id: SatisfacaoTab; label: string }[] = [
  { id: 'visao-geral', label: 'Visão Geral' },
  { id: 'detalhes', label: 'Detalhes' },
];

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

const PERIODO_RANGES: Record<Exclude<PeriodoKey, 'custom'>, [string, string]> = {
  ano: ['01-01', '12-31'],
  t1: ['01-01', '03-31'],
  t2: ['04-01', '06-30'],
  t3: ['07-01', '09-30'],
  t4: ['10-01', '12-31'],
  s1: ['01-01', '06-30'],
  s2: ['07-01', '12-31'],
};

function currentYearStr(): string {
  return String(new Date().getFullYear());
}

function rangeForPeriodo(ano: number, periodo: Exclude<PeriodoKey, 'custom'>): { dataInicio: string; dataFim: string } {
  const [inicio, fim] = PERIODO_RANGES[periodo];
  return { dataInicio: `${ano}-${inicio}`, dataFim: `${ano}-${fim}` };
}

function defaultAnoInteiro() {
  const year = currentYearStr();
  const range = rangeForPeriodo(Number(year), 'ano');
  return { year, ...range };
}

const IndicadoresSatisfacaoClientes: React.FC = () => {
  const defaults = useMemo(() => defaultAnoInteiro(), []);
  const [filial, setFilial] = useState('');
  const [motorista, setMotorista] = useState('');
  const [dataInicio, setDataInicio] = useState(defaults.dataInicio);
  const [dataFim, setDataFim] = useState(defaults.dataFim);
  const [cliente, setCliente] = useState('');
  const [ano, setAno] = useState(defaults.year);
  const [periodo, setPeriodo] = useState<PeriodoKey>('ano');
  const [activeTab, setActiveTab] = useState<SatisfacaoTab>('visao-geral');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const queryParams = useMemo(() => ({
    ...(filial ? { filial } : {}),
    ...(motorista ? { motorista } : {}),
    ...(dataInicio ? { dataInicio } : {}),
    ...(dataFim ? { dataFim } : {}),
    ...(cliente ? { cliente } : {}),
  }), [filial, motorista, dataInicio, dataFim, cliente]);

  const query = useIndicadorSgqSatisfacao(queryParams);
  const data = query.data;
  const detalhesQuery = useIndicadorSgqSatisfacaoDetalhes(
    { ...queryParams, page, pageSize },
    activeTab === 'detalhes',
  );
  const clientesQuery = useSgqClientes(true);
  const clientesFiltro = clientesQuery.data ?? [];

  // Sistema multiusuário: se alguém lançar/alterar/excluir pesquisas no SGQ
  // enquanto esta tela estiver aberta, o indicador atualiza sozinho — mesmo
  // padrão do Fluxo de Caixa (polling leve de versão + invalidate da query pesada).
  const queryClient = useQueryClient();
  const { data: activityVersion } = useSgqSatisfacaoActivityVersion();
  const lastActivityVersionRef = useRef<number | null>(null);
  useEffect(() => {
    if (activityVersion === undefined) return;
    if (lastActivityVersionRef.current === null) {
      lastActivityVersionRef.current = activityVersion;
      return;
    }
    if (activityVersion !== lastActivityVersionRef.current) {
      lastActivityVersionRef.current = activityVersion;
      queryClient.invalidateQueries({ queryKey: INDICADORES_SGQ_SATISFACAO_KEY });
    }
  }, [activityVersion, queryClient]);

  const motoristasDisponiveis = data?.meta.motoristasDisponiveis ?? [];
  const anosDisponiveis = useMemo(() => {
    const yearNum = Number(currentYearStr());
    const anos = new Set(data?.meta.anosDisponiveis ?? []);
    anos.add(yearNum);
    return Array.from(anos).sort((a, b) => b - a);
  }, [data?.meta.anosDisponiveis]);

  const applyPeriodo = (nextAno: string, nextPeriodo: Exclude<PeriodoKey, 'custom'>) => {
    const yearNum = Number(nextAno);
    if (!yearNum) return;
    const range = rangeForPeriodo(yearNum, nextPeriodo);
    setDataInicio(range.dataInicio);
    setDataFim(range.dataFim);
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

  const handleDataInicioChange = (value: string) => {
    setDataInicio(value);
    setPeriodo('custom');
  };

  const handleDataFimChange = (value: string) => {
    setDataFim(value);
    setPeriodo('custom');
  };

  const handleResetFilters = () => {
    const reset = defaultAnoInteiro();
    setFilial('');
    setMotorista('');
    setCliente('');
    setAno(reset.year);
    setPeriodo('ano');
    setDataInicio(reset.dataInicio);
    setDataFim(reset.dataFim);
    setPage(1);
  };

  const metaHint = filial || 'Ibiporã + Rondonópolis';

  useEffect(() => {
    setPage(1);
  }, [filial, motorista, cliente, dataInicio, dataFim]);

  return (
    <div className={`cashflow-page${activeTab === 'detalhes' ? ' cashflow-page--sgq-detalhes' : ''}`}>
      <header className="view-header cashflow-header">
        <div>
          <h1>Satisfação dos Clientes</h1>
          <p>Pesquisas de satisfação · {metaHint}</p>
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

          <select
            className="rh-period-select"
            value={filial}
            onChange={(e) => {
              setFilial(e.target.value);
              setMotorista('');
            }}
          >
            <option value="">Filial: Todas</option>
            {(data?.meta.filiaisDisponiveis ?? ['Ibiporã (Matriz)', 'Rondonópolis']).map((nome) => (
              <option key={nome} value={nome}>{nome}</option>
            ))}
          </select>

          <select className="rh-period-select" value={motorista} onChange={(e) => setMotorista(e.target.value)}>
            <option value="">Motorista: Todos</option>
            {motoristasDisponiveis.map((nome) => (
              <option key={nome} value={nome}>{nome}</option>
            ))}
          </select>

          <select className="rh-period-select" value={cliente} onChange={(e) => setCliente(e.target.value)}>
            <option value="">Cliente: Todos</option>
            {clientesFiltro.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

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
                <input type="date" value={dataInicio} onChange={(e) => handleDataInicioChange(e.target.value)} />
              </label>
              <label>
                <span>Até</span>
                <input type="date" value={dataFim} onChange={(e) => handleDataFimChange(e.target.value)} />
              </label>
            </div>
          )}

          <button type="button" className="reports-action-btn secondary cashflow-filter-reset" onClick={handleResetFilters}>
            Limpar
          </button>
        </div>
      </div>

      {activeTab === 'visao-geral' ? (
      <QueryDataPanel
        query={query}
        variant="compact"
        fullPageLoader
        refreshVariant="overlay"
        loadingMessage="Carregando satisfação dos clientes..."
        refreshingMessage="Atualizando indicador..."
        errorMessage="Não foi possível carregar o indicador de satisfação. Tente novamente."
      >
        {data && (
          <>
            <div className="cashflow-kpi-grid sgq-ind-kpi-grid">
              <div className="cashflow-kpi-card">
                <span className="cashflow-kpi-label">Total de Pesquisas</span>
                <strong className="cashflow-kpi-value">{data.totalPesquisas.toLocaleString('pt-BR')}</strong>
                <span className="cashflow-kpi-hint">{data.totalAvaliacoes.toLocaleString('pt-BR')} avaliações</span>
              </div>
              <div className={`cashflow-kpi-card ${data.percentual.otimo >= data.metaOtimo ? 'cashflow-kpi-card--in' : 'cashflow-kpi-card--out'}`}>
                <span className="cashflow-kpi-label">% Ótimo</span>
                <strong className="cashflow-kpi-value">
                  {data.percentual.otimo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                </strong>
                <span className="cashflow-kpi-hint">Meta {data.metaOtimo}%</span>
              </div>
              <div className="cashflow-kpi-card">
                <span className="cashflow-kpi-label">Score Médio</span>
                <strong className="cashflow-kpi-value">
                  {data.scoreMedio !== null && data.scoreMedio !== undefined ? data.scoreMedio.toFixed(2) : '—'}
                </strong>
                <span className="cashflow-kpi-hint">Escala 1 a 4</span>
              </div>
              <div className="cashflow-kpi-card cashflow-kpi-card--out">
                <span className="cashflow-kpi-label">Pontos de Atenção</span>
                <strong className="cashflow-kpi-value">{data.pontosAtencao.toLocaleString('pt-BR')}</strong>
                <span className="cashflow-kpi-hint">Regular + Ruim</span>
              </div>
              <div className="cashflow-kpi-card">
                <span className="cashflow-kpi-label">Não avaliou</span>
                <strong className="cashflow-kpi-value">{data.totalRecusas.toLocaleString('pt-BR')}</strong>
                <span className="cashflow-kpi-hint">Em branco ou recusa</span>
              </div>
            </div>

            <div className="rh-ind-charts-grid">
              <div className="erp-card cashflow-chart-card">
                <h2 className="cashflow-section-title">Distribuição das Avaliações</h2>
                <SgqDistribuicaoChart contagem={data.contagem} />
              </div>
              <div className="erp-card cashflow-chart-card">
                <h2 className="cashflow-section-title">Comparativo por Filial</h2>
                <SgqFiliaisChart porFilial={data.porFilial} />
              </div>
              <div className="erp-card cashflow-chart-card rh-ind-chart-card--wide">
                <h2 className="cashflow-section-title">Avaliações por Critério</h2>
                <SgqCriteriosChart criterios={data.criterios} />
              </div>
              <div className="erp-card cashflow-chart-card rh-ind-chart-card--wide">
                <h2 className="cashflow-section-title">Evolução Mensal</h2>
                <SgqEvolucaoChart serie={data.serieMensal} />
              </div>
            </div>

            <div className="erp-card reports-table-card cashflow-table-card" style={{ marginTop: '16px', flex: 'none', minHeight: 'auto' }}>
              <h2 className="cashflow-section-title cashflow-section-title--table">Perfil das Avaliações</h2>
              <div style={{ padding: '0 16px 16px' }}>
                <SgqPerfilAvaliacoesTable criterios={data.criterios} />
              </div>
            </div>

            <div className="erp-card reports-table-card cashflow-table-card" style={{ marginTop: '16px', flex: 'none', minHeight: 'auto' }}>
              <h2 className="cashflow-section-title cashflow-section-title--table">Recorrências por Escopo</h2>
              <div style={{ padding: '0 16px 16px' }}>
                <SgqRecorrenciasEscopoTable grupos={data.recorrenciasEscopo ?? []} />
              </div>
            </div>
          </>
        )}
      </QueryDataPanel>
      ) : (
        <SgqSatisfacaoDetalhesTable
          query={detalhesQuery}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}
    </div>
  );
};

export default IndicadoresSatisfacaoClientes;
