import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  type TooltipItem,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { OlhoVivoIndicadorFilial } from '../../types/domain';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_LONGOS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const COR_FILIAL: Record<string, string> = {
  'Ibiporã (Matriz)': 'rgba(17, 140, 196, 0.9)',
  Rondonópolis: 'rgba(234, 88, 12, 0.9)',
};

const legendaFilial = (filial: string) => filial.replace(' (Matriz)', '');

const valorDaBarra = (item: TooltipItem<'bar'>) => {
  if (typeof item.raw === 'number') return item.raw;
  const eixo = item.chart.options.indexAxis === 'y' ? item.parsed.x : item.parsed.y;
  return typeof eixo === 'number' ? eixo : 0;
};

const somaDoIndice = (item: TooltipItem<'bar'>) => item.chart.data.datasets.reduce((soma, dataset) => {
  const ponto = dataset.data[item.dataIndex];
  return soma + (typeof ponto === 'number' ? ponto : 0);
}, 0);

interface IndicadoresOlhoVivoChartProps {
  comportamentos: { key: string; label: string }[];
  filiais: OlhoVivoIndicadorFilial[];
}

const IndicadoresOlhoVivoChart: React.FC<IndicadoresOlhoVivoChartProps> = ({
  comportamentos,
  filiais,
}) => {
  const linhas = useMemo(() => comportamentos.map((item) => {
    const porFilial = filiais.map((filial) => ({
      filial: filial.filial,
      valor: filial.itens.find((linha) => linha.comportamento === item.key)?.recorrencia ?? 0,
    }));
    return {
      ...item,
      porFilial,
      total: porFilial.reduce((soma, parte) => soma + parte.valor, 0),
    };
  }).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt')), [comportamentos, filiais]);

  const total = linhas.reduce((soma, linha) => soma + linha.total, 0);
  const destaque = linhas[0];
  const meses = MESES.map((sigla, index) => ({
    sigla,
    nome: MESES_LONGOS[index],
    total: filiais.reduce((soma, filial) => {
      const mes = filial.meses[index];
      return soma + (mes?.respondido ? mes.total ?? 0 : 0);
    }, 0),
    respondido: filiais.some((filial) => filial.meses[index]?.respondido),
  }));
  const pico = meses.filter((mes) => mes.respondido).sort((a, b) => b.total - a.total)[0];

  if (total === 0) {
    return <p className="cashflow-chart-empty">Nenhuma resposta lançada neste recorte.</p>;
  }

  const participacao = destaque ? Math.round((destaque.total / total) * 100) : 0;

  return (
    <div className="olho-vivo-ind-graficos">
      <div className="cashflow-chart-card olho-vivo-ind-chart-card">
        <div className="olho-vivo-ind-cabecalho">
          <h2 className="cashflow-section-title">Recorrência por comportamento</h2>
          <p>
            {destaque
              ? `${destaque.label} concentra ${participacao}% (${destaque.total.toLocaleString('pt-BR')}).`
              : ''}
            {pico ? ` Pico em ${pico.nome}, com ${pico.total.toLocaleString('pt-BR')}.` : ''}
          </p>
        </div>
        <div className="olho-vivo-ind-grafico olho-vivo-ind-grafico--comportamentos">
          <GraficoComportamentos linhas={linhas} filiais={filiais} total={total} />
        </div>
      </div>

      <div className="cashflow-chart-card olho-vivo-ind-chart-card">
        <div className="olho-vivo-ind-cabecalho">
          <h2 className="cashflow-section-title">Recorrência por mês</h2>
          <p>Um tipo por linha, do maior para o menor. O tom mais forte é o maior valor. Mês sem resposta fica em branco.</p>
        </div>
        <GraficoMeses filiais={filiais} comportamentos={comportamentos} />
      </div>
    </div>
  );
};

const GraficoComportamentos: React.FC<{
  linhas: { key: string; label: string; porFilial: { filial: string; valor: number }[]; total: number }[];
  filiais: OlhoVivoIndicadorFilial[];
  total: number;
}> = ({ linhas, filiais, total }) => {
  const data = useMemo(() => ({
    labels: linhas.map((linha) => linha.label),
    datasets: filiais.map((filial, index) => ({
      label: legendaFilial(filial.filial),
      data: linhas.map((linha) => (
        linha.porFilial.find((parte) => parte.filial === filial.filial)?.valor ?? 0
      )),
      backgroundColor: COR_FILIAL[filial.filial] ?? 'rgba(17, 140, 196, 0.9)',
      stack: 'recorrencia',
      borderRadius: 4,
      borderSkipped: filiais.length < 2 ? false : (index === 0 ? 'end' as const : 'start' as const),
      maxBarThickness: 18,
    })),
  }), [filiais, linhas]);

  const options = useMemo(() => ({
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    datasets: {
      bar: { categoryPercentage: 0.62, barPercentage: 0.9 },
    },
    interaction: { mode: 'index' as const, axis: 'y' as const, intersect: false },
    plugins: {
      legend: {
        display: filiais.length > 1,
        position: 'top' as const,
        align: 'end' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle' as const,
          boxWidth: 8,
          padding: 14,
          font: { size: 11, family: 'inherit' },
          color: '#64748b',
        },
      },
      tooltip: {
        mode: 'index' as const,
        axis: 'y' as const,
        intersect: false,
        backgroundColor: '#0f172a',
        padding: 12,
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => {
            const valor = valorDaBarra(ctx);
            const soma = somaDoIndice(ctx);
            const percentual = soma ? Math.round((valor / soma) * 100) : 0;
            return `${ctx.dataset.label}: ${valor.toLocaleString('pt-BR')} (${percentual}%)`;
          },
          footer: (items: TooltipItem<'bar'>[]) => {
            if (!items.length) return '';
            const soma = somaDoIndice(items[0]);
            const geral = total ? Math.round((soma / total) * 100) : 0;
            return `Total ${soma.toLocaleString('pt-BR')} · ${geral}% do ano`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
        grace: '4%',
        border: { display: false },
        grid: { color: 'rgba(226, 232, 240, 0.9)' },
        ticks: { color: '#94a3b8', font: { size: 11 }, precision: 0, maxTicksLimit: 6 },
      },
      y: {
        stacked: true,
        border: { display: false },
        grid: { display: false },
        ticks: { color: '#334155', font: { size: 12 }, autoSkip: false, padding: 10 },
      },
    },
  }), [filiais.length, total]);

  return <Bar data={data} options={options} />;
};

const valorDoTipoNoMes = (
  filiais: OlhoVivoIndicadorFilial[],
  chave: string,
  indice: number,
) => {
  const respondidas = filiais.filter((filial) => filial.meses[indice]?.respondido);
  if (respondidas.length === 0) return null;
  return respondidas.reduce((soma, filial) => {
    const item = filial.meses[indice]?.itens.find((linha) => linha.comportamento === chave);
    return soma + (item?.recorrencia ?? 0);
  }, 0);
};

const GraficoMeses: React.FC<{
  filiais: OlhoVivoIndicadorFilial[];
  comportamentos: { key: string; label: string }[];
}> = ({ filiais, comportamentos }) => {
  const linhas = useMemo(() => comportamentos.map((item) => {
    const meses = MESES.map((_, indice) => valorDoTipoNoMes(filiais, item.key, indice));
    return {
      ...item,
      meses,
      total: meses.reduce<number>((soma, valor) => soma + (valor ?? 0), 0),
    };
  }).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt')), [comportamentos, filiais]);

  const maximo = Math.max(1, ...linhas.flatMap((linha) => linha.meses.map((valor) => valor ?? 0)));

  return (
    <div className="olho-vivo-ind-scroll">
      <table className="olho-vivo-ind-tabela olho-vivo-mes-tabela">
        <thead>
          <tr>
            <th>Comportamento</th>
            {MESES.map((mes) => <th key={mes}>{mes}</th>)}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.key}>
              <td>{linha.label}</td>
              {linha.meses.map((valor, indice) => (
                <td
                  key={MESES[indice]}
                  className={valor == null ? 'olho-vivo-ind-vazio' : undefined}
                  style={valor != null && valor > 0
                    ? { background: `rgba(17, 140, 196, ${(0.08 + (valor / maximo) * 0.62).toFixed(2)})` }
                    : undefined}
                >
                  {valor == null ? '—' : valor.toLocaleString('pt-BR')}
                </td>
              ))}
              <td>{linha.total.toLocaleString('pt-BR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default IndicadoresOlhoVivoChart;
