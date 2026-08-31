import React, { useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useIndicadorFrotaCustos } from '../../hooks/useIndicadores';
import IndicadoresFrotaCustosChart from './IndicadoresFrotaCustosChart';

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatKm = (value: number | null | undefined) =>
  value == null ? '—' : `${value.toLocaleString('pt-BR')} km`;

const formatKmL = (value: number | null | undefined) =>
  value == null
    ? '—'
    : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km/L`;

function formatPeriodo(inicio: string | null, fim: string | null): string {
  if (!inicio || !fim) return '';
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  return `${fmt(inicio)} a ${fmt(fim)}`;
}

type FrotaCustosTab = 'visao-geral' | 'manutencoes' | 'abastecimento' | 'detalhe';

const TABS: { id: FrotaCustosTab; label: string }[] = [
  { id: 'visao-geral', label: 'Visão geral' },
  { id: 'manutencoes', label: 'Manutenções' },
  { id: 'abastecimento', label: 'Abastecimento' },
  { id: 'detalhe', label: 'Detalhe por veículo' },
];

const IndicadoresFrotaCustos: React.FC = () => {
  const [loteId, setLoteId] = useState<string>('');
  const [filial, setFilial] = useState('');
  const [activeTab, setActiveTab] = useState<FrotaCustosTab>('visao-geral');

  const queryParams = useMemo(() => ({
    ...(loteId ? { loteId: Number(loteId) } : {}),
    ...(filial ? { filial } : {}),
  }), [loteId, filial]);

  const query = useIndicadorFrotaCustos(queryParams);
  const { data } = query;
  const summary = data?.summary;
  const veiculos = data?.veiculos ?? [];
  const manutencaoPorTipo = data?.manutencaoPorTipo ?? [];
  const lotes = data?.meta.lotes ?? [];
  const filiais = data?.meta.filiaisDisponiveis ?? [];

  const periodoHint = data
    ? formatPeriodo(data.meta.periodoInicio, data.meta.periodoFim)
    : '';

  return (
    <div className="cashflow-page">
      <header className="view-header cashflow-header">
        <div>
          <h1>Custos de frota</h1>
          <p>
            Controle de gastos por veículo
            {periodoHint ? ` · ${periodoHint}` : ''}
            {data?.meta.loteLabel ? ` · ${data.meta.loteLabel}` : ''}
          </p>
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
        <div className="reports-filter-left" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="rh-period-select"
            value={loteId}
            onChange={(e) => setLoteId(e.target.value)}
            aria-label="Período / lote"
          >
            <option value="">Todos os períodos</option>
            {lotes.map((lote) => (
              <option key={lote.id} value={String(lote.id)}>
                {lote.label}
              </option>
            ))}
          </select>

          <select
            className="rh-period-select"
            value={filial}
            onChange={(e) => setFilial(e.target.value)}
            aria-label="Filial"
          >
            <option value="">Todas as filiais</option>
            {filiais.map((nome) => (
              <option key={nome} value={nome}>{nome}</option>
            ))}
          </select>

          <button
            type="button"
            className="reports-action-btn secondary cashflow-filter-reset"
            onClick={() => {
              setLoteId('');
              setFilial('');
            }}
          >
            Limpar
          </button>
        </div>
      </div>

      <QueryDataPanel
        query={query}
        variant="compact"
        fullPageLoader
        refreshVariant="overlay"
        loadingMessage="Carregando custos de frota..."
        refreshingMessage="Atualizando indicador..."
        errorMessage="Não foi possível carregar o indicador de custos de frota. Tente novamente."
      >
        {summary && (
          <>
            {activeTab === 'visao-geral' && (
              <>
                <div className="cashflow-kpi-grid rh-ind-kpi-grid">
                  <div className="cashflow-kpi-card">
                    <span className="cashflow-kpi-label">Custo total de operação</span>
                    <strong className="cashflow-kpi-value">{formatCurrency(summary.custoTotal)}</strong>
                    <span className="cashflow-kpi-hint">Manutenções + abastecimento</span>
                  </div>
                  <div className="cashflow-kpi-card">
                    <span className="cashflow-kpi-label">Manutenções gerais</span>
                    <strong className="cashflow-kpi-value">{formatCurrency(summary.custoManutencao)}</strong>
                    <span className="cashflow-kpi-hint">
                      {summary.veiculosCount.toLocaleString('pt-BR')} veículo{summary.veiculosCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="cashflow-kpi-card">
                    <span className="cashflow-kpi-label">Abastecimento geral</span>
                    <strong className="cashflow-kpi-value">{formatCurrency(summary.custoAbastecimento)}</strong>
                    <span className="cashflow-kpi-hint">
                      {summary.litragemTotal
                        ? `${summary.litragemTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L`
                        : 'Sem litragem'}
                    </span>
                  </div>
                  <div className="cashflow-kpi-card">
                    <span className="cashflow-kpi-label">Média dos veículos</span>
                    <strong className="cashflow-kpi-value">{formatKmL(summary.mediaKmPorLitro)}</strong>
                    <span className="cashflow-kpi-hint">Consumo médio (km/L)</span>
                  </div>
                  <div className="cashflow-kpi-card">
                    <span className="cashflow-kpi-label">Custo total por km</span>
                    <strong className="cashflow-kpi-value">
                      {summary.custoPorKm != null ? formatCurrency(summary.custoPorKm) : '—'}
                    </strong>
                    <span className="cashflow-kpi-hint">Manutenção + abastecimento / km</span>
                  </div>
                  <div className="cashflow-kpi-card">
                    <span className="cashflow-kpi-label">Km rodado</span>
                    <strong className="cashflow-kpi-value">{formatKm(summary.kmTotal)}</strong>
                    <span className="cashflow-kpi-hint">Tempo em operação no período</span>
                  </div>
                </div>

                <div className="cashflow-chart-card frota-custos-chart-card">
                  <h2 className="cashflow-section-title">Custo total de operação</h2>
                  <div className="cashflow-chart-wrap frota-custos-chart-wrap">
                    <IndicadoresFrotaCustosChart veiculos={veiculos} />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'manutencoes' && (
              <>
                <div className="cashflow-kpi-grid sgq-ind-kpi-grid">
                  <div className="cashflow-kpi-card">
                    <span className="cashflow-kpi-label">Manutenções gerais</span>
                    <strong className="cashflow-kpi-value">{formatCurrency(summary.custoManutencao)}</strong>
                    <span className="cashflow-kpi-hint">Total no recorte</span>
                  </div>
                  <div className="cashflow-kpi-card">
                    <span className="cashflow-kpi-label">Participação na operação</span>
                    <strong className="cashflow-kpi-value">
                      {summary.custoTotal
                        ? `${((summary.custoManutencao / summary.custoTotal) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
                        : '—'}
                    </strong>
                    <span className="cashflow-kpi-hint">Sobre o custo total</span>
                  </div>
                  <div className="cashflow-kpi-card">
                    <span className="cashflow-kpi-label">Veículos com manutenção</span>
                    <strong className="cashflow-kpi-value">
                      {veiculos.filter((item) => item.custoManutencao > 0).length.toLocaleString('pt-BR')}
                    </strong>
                    <span className="cashflow-kpi-hint">de {summary.veiculosCount.toLocaleString('pt-BR')} no recorte</span>
                  </div>
                </div>

                <div className="reports-table-card">
                  <h2 className="cashflow-section-title cashflow-section-title--table">Tipos de manutenção</h2>
                  {manutencaoPorTipo.length === 0 ? (
                    <p className="cashflow-chart-empty" style={{ padding: 24 }}>
                      Sem tipos de manutenção neste recorte.
                    </p>
                  ) : (
                    <div className="table-responsive">
                      <table className="reports-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Participação</th>
                            <th className="num">Valor</th>
                            <th className="num">Lançamentos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {manutencaoPorTipo.map((tipo) => (
                            <tr key={tipo.item}>
                              <td>{tipo.label}</td>
                              <td>
                                <div className="frota-tipo-bar">
                                  <div className="frota-tipo-bar-track" aria-hidden="true">
                                    <div
                                      className="frota-tipo-bar-fill"
                                      style={{ width: `${Math.min(100, Math.max(0, tipo.percentual))}%` }}
                                    />
                                  </div>
                                  <span className="frota-tipo-bar-pct">
                                    {tipo.percentual.toLocaleString('pt-BR', {
                                      minimumFractionDigits: 1,
                                      maximumFractionDigits: 1,
                                    })}%
                                  </span>
                                </div>
                              </td>
                              <td className="num">{formatCurrency(tipo.valor)}</td>
                              <td className="num">{tipo.quantidade.toLocaleString('pt-BR')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="reports-table-card">
                  <h2 className="cashflow-section-title cashflow-section-title--table">Detalhe de manutenções</h2>
                  {veiculos.filter((item) => item.custoManutencao > 0).length === 0 ? (
                    <p className="cashflow-chart-empty" style={{ padding: 24 }}>
                      Nenhuma manutenção importada neste recorte.
                    </p>
                  ) : (
                    <div className="table-responsive">
                      <table className="reports-table">
                        <thead>
                          <tr>
                            <th>Placa</th>
                            <th>Veículo</th>
                            <th>Filial</th>
                            <th className="num">Manutenções</th>
                            <th className="num">% das manutenções</th>
                            <th className="num">% da operação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...veiculos]
                            .filter((item) => item.custoManutencao > 0)
                            .sort((a, b) => b.custoManutencao - a.custoManutencao)
                            .map((item) => (
                              <tr key={item.veiculoId}>
                                <td>{item.placaExibicao}</td>
                                <td>{`${item.marca} ${item.modelo}`.trim()}</td>
                                <td>{item.filial}</td>
                                <td className="num">{formatCurrency(item.custoManutencao)}</td>
                                <td className="num">
                                  {summary.custoManutencao
                                    ? `${((item.custoManutencao / summary.custoManutencao) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
                                    : '—'}
                                </td>
                                <td className="num">
                                  {summary.custoTotal
                                    ? `${((item.custoManutencao / summary.custoTotal) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'abastecimento' && (
              <>
                <div className="cashflow-kpi-grid sgq-ind-kpi-grid">
                  <div className="cashflow-kpi-card">
                    <span className="cashflow-kpi-label">Abastecimento geral</span>
                    <strong className="cashflow-kpi-value">{formatCurrency(summary.custoAbastecimento)}</strong>
                    <span className="cashflow-kpi-hint">Total no recorte</span>
                  </div>
                  <div className="cashflow-kpi-card">
                    <span className="cashflow-kpi-label">Litragem</span>
                    <strong className="cashflow-kpi-value">
                      {summary.litragemTotal
                        ? `${summary.litragemTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L`
                        : '—'}
                    </strong>
                    <span className="cashflow-kpi-hint">Combustível no período</span>
                  </div>
                  <div className="cashflow-kpi-card">
                    <span className="cashflow-kpi-label">Média dos veículos</span>
                    <strong className="cashflow-kpi-value">{formatKmL(summary.mediaKmPorLitro)}</strong>
                    <span className="cashflow-kpi-hint">Consumo médio (km/L)</span>
                  </div>
                  <div className="cashflow-kpi-card">
                    <span className="cashflow-kpi-label">Km rodado</span>
                    <strong className="cashflow-kpi-value">{formatKm(summary.kmTotal)}</strong>
                    <span className="cashflow-kpi-hint">Tempo em operação no período</span>
                  </div>
                </div>

                <div className="reports-table-card">
                  <h2 className="cashflow-section-title cashflow-section-title--table">Detalhe de abastecimento</h2>
                  {veiculos.filter((item) => item.custoAbastecimento > 0).length === 0 ? (
                    <p className="cashflow-chart-empty" style={{ padding: 24 }}>
                      Nenhum abastecimento importado neste recorte.
                    </p>
                  ) : (
                    <div className="table-responsive">
                      <table className="reports-table">
                        <thead>
                          <tr>
                            <th>Placa</th>
                            <th>Veículo</th>
                            <th>Filial</th>
                            <th className="num">Abastecimento</th>
                            <th className="num">Litros</th>
                            <th className="num">Km rodado</th>
                            <th className="num">Média (km/L)</th>
                            <th className="num">R$/L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...veiculos]
                            .filter((item) => item.custoAbastecimento > 0)
                            .sort((a, b) => b.custoAbastecimento - a.custoAbastecimento)
                            .map((item) => (
                              <tr key={item.veiculoId}>
                                <td>{item.placaExibicao}</td>
                                <td>{`${item.marca} ${item.modelo}`.trim()}</td>
                                <td>{item.filial}</td>
                                <td className="num">{formatCurrency(item.custoAbastecimento)}</td>
                                <td className="num">
                                  {item.litragem
                                    ? item.litragem.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
                                    : '—'}
                                </td>
                                <td className="num">{item.km != null ? item.km.toLocaleString('pt-BR') : '—'}</td>
                                <td className="num">{formatKmL(item.kmPorLitro)}</td>
                                <td className="num">
                                  {item.litragem
                                    ? formatCurrency(item.custoAbastecimento / item.litragem)
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'detalhe' && (
              <div className="reports-table-card">
                <h2 className="cashflow-section-title cashflow-section-title--table">Detalhe por veículo</h2>
                {veiculos.length === 0 ? (
                  <p className="cashflow-chart-empty" style={{ padding: 24 }}>
                    Nenhum custo importado neste recorte. Importe manutenção e abastecimento em Frota → Custos de frota.
                  </p>
                ) : (
                  <div className="table-responsive">
                    <table className="reports-table">
                      <thead>
                        <tr>
                          <th>Placa</th>
                          <th>Veículo</th>
                          <th>Filial</th>
                          <th className="num">Manutenções</th>
                          <th className="num">Abastecimento</th>
                          <th className="num">Total operação</th>
                          <th className="num">Km rodado</th>
                          <th className="num">Média (km/L)</th>
                          <th className="num">R$/km</th>
                        </tr>
                      </thead>
                      <tbody>
                        {veiculos.map((item) => (
                          <tr key={item.veiculoId}>
                            <td>{item.placaExibicao}</td>
                            <td>{`${item.marca} ${item.modelo}`.trim()}</td>
                            <td>{item.filial}</td>
                            <td className="num">{formatCurrency(item.custoManutencao)}</td>
                            <td className="num">{formatCurrency(item.custoAbastecimento)}</td>
                            <td className="num">{formatCurrency(item.custoTotal)}</td>
                            <td className="num">{item.km != null ? item.km.toLocaleString('pt-BR') : '—'}</td>
                            <td className="num">{formatKmL(item.kmPorLitro)}</td>
                            <td className="num">{item.custoPorKm != null ? formatCurrency(item.custoPorKm) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </QueryDataPanel>
    </div>
  );
};

export default IndicadoresFrotaCustos;
