import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  type Chart,
  type Plugin,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { useSgqAuditoriasVisao } from '../../hooks/useSgqAuditorias';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const CORES_STATUS = ['#c5dff6', '#5b9bd5', '#2e75b6'] as const;
const COR_BARRA = '#a9d4f5';

function encurtar(texto: string, limite: number) {
  return texto.length > limite ? `${texto.slice(0, limite).trimEnd()}...` : texto;
}

const rotuloDaFatia: Plugin<'pie'> = {
  id: 'sgq-aud-rotulo-fatia',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const valores = chart.data.datasets[0]?.data ?? [];
    let maior = 0;
    valores.forEach((valor, indice) => {
      if (typeof valor === 'number' && valor > (valores[maior] as number)) maior = indice;
    });
    const arco = meta.data[maior] as unknown as { x: number; y: number; startAngle: number; endAngle: number; outerRadius: number } | undefined;
    const nome = chart.data.labels?.[maior];
    if (!arco || typeof nome !== 'string') return;
    const angulo = (arco.startAngle + arco.endAngle) / 2;
    const raio = arco.outerRadius * 0.55;
    ctx.save();
    ctx.fillStyle = '#2f6fad';
    ctx.font = '12px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(encurtar(nome, 16), arco.x + Math.cos(angulo) * raio, arco.y + Math.sin(angulo) * raio);
    ctx.restore();
  },
};

const rotuloDaBarra: Plugin<'bar'> = {
  id: 'sgq-aud-rotulo-barra',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const valores = (chart.data.datasets[0]?.data ?? []) as number[];
    const total = valores.reduce((soma, valor) => soma + valor, 0);
    ctx.save();
    ctx.fillStyle = '#1f2937';
    ctx.font = '12px Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    meta.data.forEach((barra, indice) => {
      const valor = valores[indice] ?? 0;
      const ponto = barra.tooltipPosition(false);
      if (ponto.x == null || ponto.y == null) return;
      const pct = total ? ((valor / total) * 100).toFixed(1) : '0.0';
      ctx.fillText(`${valor} (${pct}%)`, ponto.x + 8, ponto.y);
    });
    ctx.restore();
  },
};

const SGQAuditoriasVisaoGeral: React.FC = () => {
  const { selectedFilial } = useAuth();
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const visaoQuery = useSgqAuditoriasVisao(selectedFilial, ano);
  const visao = visaoQuery.data;
  const anos = useMemo(() => {
    const lista = new Set<number>([anoAtual, ano, ...(visao?.anos ?? [])]);
    return [...lista].sort((a, b) => b - a);
  }, [ano, anoAtual, visao?.anos]);

  const status = useMemo(() => [
    { label: 'Em planejamento', valor: visao?.planejamento ?? 0 },
    { label: 'Em execução', valor: visao?.execucao ?? 0 },
    { label: 'Concluída', valor: visao?.concluida ?? 0 },
  ], [visao]);
  const ocorrencias = visao?.ocorrencias ?? [];
  const totalStatus = status.reduce((soma, item) => soma + item.valor, 0);
  const maiorOcorrencia = ocorrencias.reduce((maior, item) => Math.max(maior, item.valor), 0);

  const pizza = useMemo(() => ({
    labels: status.map((item) => item.label),
    datasets: [{
      data: status.map((item) => item.valor),
      backgroundColor: [...CORES_STATUS],
      borderColor: '#ffffff',
      borderWidth: 2,
      hoverOffset: 4,
    }],
  }), [status]);

  const barras = useMemo(() => ({
    labels: ocorrencias.map((item) => item.label),
    datasets: [{
      data: ocorrencias.map((item) => item.valor),
      backgroundColor: COR_BARRA,
      borderWidth: 0,
      barThickness: 22,
      categoryPercentage: 0.7,
      barPercentage: 0.85,
    }],
  }), [ocorrencias]);

  return (
    <section className="view active sgq-aud-visao-page" aria-label="Visão geral das auditorias">
      <div className="sgq-aud-visao-topo">
        <label className="sgq-aud-visao-ano">
          Ano
          <select
            value={ano}
            onChange={(evento) => setAno(Number(evento.target.value))}
            aria-label="Ano das auditorias"
          >
            {anos.map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
          </select>
        </label>
      </div>
      <QueryDataPanel
        query={visaoQuery}
        variant="compact"
        loadingMessage="Carregando visão geral..."
        refreshingMessage="Atualizando visão geral..."
        errorMessage="Não foi possível carregar a visão geral. Tente novamente."
      >
      <div className="sgq-aud-visao">
        <article className="sgq-aud-card sgq-aud-kpi">
          <div className="sgq-aud-kpi-par">
            <div className="sgq-aud-kpi-item">
              <header className="sgq-aud-card-head">
                <div>
                  <h2>Quantidade total</h2>
                </div>
              </header>
              <strong className="sgq-aud-kpi-valor">{visao?.total ?? 0}</strong>
            </div>
            <div className="sgq-aud-kpi-item">
              <header className="sgq-aud-card-head">
                <span className="sgq-aud-alert" aria-hidden="true">
                  <i className="bi bi-exclamation-lg" />
                </span>
                <div>
                  <h2>Atrasadas</h2>
                </div>
              </header>
              <strong className="sgq-aud-kpi-valor">{visao?.atrasadas ?? 0}</strong>
            </div>
          </div>
        </article>

        <article className="sgq-aud-card">
          <header className="sgq-aud-card-head">
            <div>
              <h2>Auditorias por status</h2>
            </div>
          </header>
          <div className="sgq-aud-chart">
            {totalStatus === 0 ? (
              <p className="sgq-aud-visao-vazio">Nenhuma auditoria registrada.</p>
            ) : (
            <Pie
              data={pizza}
              plugins={[rotuloDaFatia]}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { right: 8 } },
                plugins: {
                  legend: {
                    position: 'right',
                    labels: {
                      usePointStyle: true,
                      pointStyle: 'circle',
                      boxWidth: 8,
                      padding: 14,
                      color: '#64748b',
                      font: { size: 12, family: 'Segoe UI, sans-serif' },
                      generateLabels: (chart: Chart) => {
                        const cores = chart.data.datasets[0]?.backgroundColor as string[];
                        return (chart.data.labels ?? []).map((label, index) => ({
                          text: encurtar(String(label), 14),
                          fillStyle: cores[index],
                          strokeStyle: cores[index],
                          fontColor: '#64748b',
                          hidden: !chart.getDataVisibility(index),
                          index,
                          datasetIndex: 0,
                        }));
                      },
                    },
                  },
                  tooltip: {
                    backgroundColor: '#0f172a',
                    padding: 10,
                    callbacks: {
                      label: (item) => ` ${item.label}: ${item.raw}`,
                    },
                  },
                },
              }}
            />
            )}
          </div>
        </article>

        <article className="sgq-aud-card">
          <header className="sgq-aud-card-head">
            <div>
              <h2>Ocorrências por auditoria</h2>
              <p>Não conformidades</p>
            </div>
          </header>
          <div className="sgq-aud-chart">
            {ocorrencias.length === 0 ? (
              <p className="sgq-aud-visao-vazio">Nenhuma não conformidade registrada.</p>
            ) : (
            <Bar
              data={barras}
              plugins={[rotuloDaBarra]}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { right: 72 } },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: '#0f172a',
                    padding: 10,
                    callbacks: {
                      label: (item) => {
                        const valor = Number(item.raw ?? 0);
                        const total = ((item.chart.data.datasets[0]?.data ?? []) as number[])
                          .reduce((soma, linha) => soma + Number(linha), 0);
                        const pct = total ? ((valor / total) * 100).toFixed(1) : '0.0';
                        return ` ${valor} (${pct}%)`;
                      },
                    },
                  },
                },
                scales: {
                  x: {
                    min: 0,
                    max: Math.max(maiorOcorrencia, 1),
                    ticks: {
                      precision: 0,
                      color: '#94a3b8',
                      font: { size: 11 },
                    },
                    grid: { color: '#e8eef5' },
                    border: { display: false },
                  },
                  y: {
                    ticks: {
                      color: '#334155',
                      font: { size: 11 },
                      callback(value) {
                        const texto = this.getLabelForValue(Number(value));
                        return encurtar(texto, 28);
                      },
                    },
                    grid: { display: false },
                    border: { display: false },
                  },
                },
              }}
            />
            )}
          </div>
        </article>
      </div>
      </QueryDataPanel>
    </section>
  );
};

export default SGQAuditoriasVisaoGeral;
