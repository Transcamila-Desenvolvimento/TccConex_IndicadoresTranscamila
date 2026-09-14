import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useClientesComercial, usePropostasComerciaisDashboard } from '../../hooks/useComercialClientes';
import {
  PROPOSTA_COMERCIAL_STATUS_LABEL,
  PROPOSTA_COMERCIAL_TIPO_LABEL,
  type PropostaComercialStatus,
  type PropostaComercialTipo,
} from '../../types/domain';

ChartJS.register(ArcElement, Tooltip);

const STATUS_ORDER: PropostaComercialStatus[] = ['rascunho', 'enviada', 'aprovada', 'recusada'];
const STATUS_COLORS: Record<PropostaComercialStatus, string> = {
  rascunho: '#F5C26B',
  enviada: '#5BA8E8',
  aprovada: '#00BDA5',
  recusada: '#FF7A59',
};

const TIPO_ORDER: PropostaComercialTipo[] = ['transporte_rodoviario', 'armazenagem'];
const TIPO_COLORS: Record<PropostaComercialTipo, string> = {
  transporte_rodoviario: '#5BA8E8',
  armazenagem: '#7B8CDE',
};

function pct(parte: number, total: number) {
  if (!total) return 0;
  return Math.round((parte / total) * 100);
}

const ComercialPropostasDashboard: React.FC = () => {
  const [clienteId, setClienteId] = useState('');
  const clientesQuery = useClientesComercial({ page: 1, pageSize: 200 });
  const query = usePropostasComerciaisDashboard(clienteId || null);
  const clientes = clientesQuery.data?.results ?? [];
  const data = query.data;
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
      hoverOffset: 4,
    }],
  }), [porTipo]);

  const doughnutOptions = useMemo((): ChartOptions<'doughnut'> => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#33475b',
        cornerRadius: 8,
        padding: 10,
        displayColors: false,
      },
    },
  }), []);

  return (
    <section className="crm-dash" aria-labelledby="comercial-dashboard-title">
      <header className="crm-dash-head">
        <h3 id="comercial-dashboard-title">Dashboard</h3>
        <label className="crm-dash-filter">
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            aria-label="Filtrar dashboard por cliente"
          >
            <option value="">Todos os clientes</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nomeFantasia || cliente.razaoSocial}
              </option>
            ))}
          </select>
        </label>
      </header>

      <QueryDataPanel
        query={query}
        variant="compact"
        loadingMessage="Carregando dashboard de propostas..."
        refreshingMessage="Atualizando dashboard..."
        errorMessage="Não foi possível carregar o dashboard de propostas."
      >
        {data ? (
          <div className="crm-dash-row">
            <article className="crm-dash-card">
              <h4>Funil de propostas</h4>
              <div className="crm-dash-hero">
                <strong>{total}</strong>
                <span>propostas ativas</span>
              </div>
              <div className="crm-dash-stack" aria-hidden="true">
                {STATUS_ORDER.map((key) => (
                  <span
                    key={key}
                    style={{
                      width: `${pct(porStatus?.[key] ?? 0, total)}%`,
                      background: STATUS_COLORS[key],
                    }}
                  />
                ))}
              </div>
              {total === 0 ? (
                <p className="crm-dash-empty">{emptyLabel}</p>
              ) : (
                <ul className="crm-dash-funnel-list">
                  {STATUS_ORDER.map((key) => (
                    <li key={key}>
                      <span className="crm-dash-swatch" style={{ background: STATUS_COLORS[key] }} />
                      <span>{PROPOSTA_COMERCIAL_STATUS_LABEL[key]}</span>
                      <b>{porStatus?.[key] ?? 0}</b>
                      <em>{pct(porStatus?.[key] ?? 0, total)}%</em>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="crm-dash-card">
              <h4>Origem por serviço</h4>
              {total === 0 ? (
                <p className="crm-dash-empty">{emptyLabel}</p>
              ) : (
                <div className="crm-dash-sources">
                  <div className="crm-dash-donut">
                    <Doughnut data={doughnutData} options={doughnutOptions} />
                  </div>
                  <ul className="crm-dash-source-list">
                    {TIPO_ORDER.map((key) => (
                      <li key={key}>
                        <span className="crm-dash-swatch" style={{ background: TIPO_COLORS[key] }} />
                        <span>{PROPOSTA_COMERCIAL_TIPO_LABEL[key]}</span>
                        <b>{porTipo?.[key] ?? 0}</b>
                        <em>{pct(porTipo?.[key] ?? 0, total)}%</em>
                      </li>
                    ))}
                  </ul>
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
