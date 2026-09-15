import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import QueryDataPanel from '../../components/QueryDataPanel';
import { usePropostasComerciaisDashboard } from '../../hooks/useComercialClientes';
import {
  PROPOSTA_COMERCIAL_STATUS_LABEL,
  PROPOSTA_COMERCIAL_TIPO_LABEL,
  type PropostaComercialStatus,
  type PropostaComercialTipo,
} from '../../types/domain';

ChartJS.register(ArcElement, Tooltip);

const STATUS_ORDER: PropostaComercialStatus[] = ['rascunho', 'enviada', 'aprovada', 'recusada'];
const STATUS_COLORS: Record<PropostaComercialStatus, string> = {
  rascunho: '#F0C14A',
  enviada: '#3AA0D9',
  aprovada: '#2EC4B6',
  recusada: '#E05A4F',
};

const TIPO_ORDER: PropostaComercialTipo[] = ['transporte_rodoviario', 'armazenagem'];
const TIPO_COLORS: Record<PropostaComercialTipo, string> = {
  transporte_rodoviario: STATUS_COLORS.enviada,
  armazenagem: '#C5D0D6',
};

function pct(parte: number, total: number) {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}

function formatAtualizacao(ts: number) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function MetricRows({
  items,
}: {
  items: Array<{ key: string; label: string; valor: number; total: number; cor: string }>;
}) {
  return (
    <ul className="crm-dash-metrics">
      {items.map((item) => (
        <li key={item.key}>
          <span className="crm-dash-swatch" style={{ background: item.cor }} />
          <span className="crm-dash-metric-label">{item.label}</span>
          <span className="crm-dash-meter" aria-hidden="true">
            <span style={{ width: `${pct(item.valor, item.total)}%`, background: item.cor }} />
          </span>
          <b>{item.valor}</b>
          <em>{pct(item.valor, item.total)}%</em>
        </li>
      ))}
    </ul>
  );
}

const ComercialPropostasDashboard: React.FC = () => {
  const [clienteId, setClienteId] = useState('');
  const query = usePropostasComerciaisDashboard(clienteId || null);
  const data = query.data;
  const clientes = data?.clientesComProposta ?? [];
  const total = data?.total ?? 0;
  const porStatus = data?.porStatus;
  const porTipo = data?.porTipo;
  const emptyLabel = clienteId ? 'Nenhuma proposta deste cliente.' : 'Nenhuma proposta cadastrada ainda.';

  const doughnutData = useMemo(() => ({
    labels: TIPO_ORDER.map((key) => PROPOSTA_COMERCIAL_TIPO_LABEL[key]),
    datasets: [{
      data: TIPO_ORDER.map((key) => porTipo?.[key] ?? 0),
      backgroundColor: TIPO_ORDER.map((key) => TIPO_COLORS[key]),
      borderWidth: 0,
      hoverOffset: 0,
    }],
  }), [porTipo]);

  const doughnutOptions = useMemo((): ChartOptions<'doughnut'> => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#2c3e50',
        cornerRadius: 2,
        padding: 8,
        displayColors: false,
        callbacks: {
          label: (item) => {
            const valor = Number(item.raw ?? 0);
            return `${valor} (${pct(valor, total)}%)`;
          },
        },
      },
    },
  }), [total]);

  return (
    <section className="crm-dash" aria-labelledby="comercial-dashboard-title">
      <header className="crm-dash-head">
        <div>
          <h3 id="comercial-dashboard-title">Dashboard</h3>
          <p>Última atualização: {formatAtualizacao(query.dataUpdatedAt)}</p>
        </div>
        {clientes.length > 0 ? (
          <label className="crm-dash-visao">
            <span>Visão</span>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              aria-label="Filtrar dashboard por cliente"
            >
              <option value="">Todos os clientes</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      <QueryDataPanel
        query={query}
        variant="compact"
        refreshVariant="overlay"
        className="crm-dash-panel"
        loadingMessage="Carregando dashboard de propostas..."
        refreshingMessage="Atualizando dashboard..."
        errorMessage="Não foi possível carregar o dashboard de propostas."
      >
        {data ? (
          <div className="crm-dash-row">
            <article className="crm-dash-card">
              <h4>Por status <em>{total} propostas</em></h4>
              {total === 0 ? (
                <p className="crm-dash-empty">{emptyLabel}</p>
              ) : (
                <MetricRows
                  items={STATUS_ORDER.map((key) => ({
                    key,
                    label: PROPOSTA_COMERCIAL_STATUS_LABEL[key],
                    valor: porStatus?.[key] ?? 0,
                    total,
                    cor: STATUS_COLORS[key],
                  }))}
                />
              )}
            </article>

            <article className="crm-dash-card">
              <h4>Por origem de serviço</h4>
              {total === 0 ? (
                <p className="crm-dash-empty">{emptyLabel}</p>
              ) : (
                <div className="crm-dash-sources">
                  <div className="crm-dash-donut-wrap">
                    <div className="crm-dash-donut">
                      <Doughnut data={doughnutData} options={doughnutOptions} />
                    </div>
                    <div className="crm-dash-donut-center">
                      <strong>{total}</strong>
                      <span>total</span>
                    </div>
                  </div>
                  <MetricRows
                    items={TIPO_ORDER.map((key) => ({
                      key,
                      label: PROPOSTA_COMERCIAL_TIPO_LABEL[key],
                      valor: porTipo?.[key] ?? 0,
                      total,
                      cor: TIPO_COLORS[key],
                    }))}
                  />
                </div>
              )}
            </article>
          </div>
        ) : null}
      </QueryDataPanel>
    </section>
  );
};

export default ComercialPropostasDashboard;
