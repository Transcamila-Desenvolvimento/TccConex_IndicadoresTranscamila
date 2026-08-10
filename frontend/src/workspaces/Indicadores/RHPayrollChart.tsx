import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type Plugin,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { RHIndicadorSeriePonto } from '../../types/domain';
import {
  createDatasetValueLabelsPlugin,
  formatPayrollAxisLabel,
  isLineDataset,
} from './rhChartLabelPlugin';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const payrollValueLabels = createDatasetValueLabelsPlugin({
  id: 'rh-payroll-value-labels',
  fontSize: 10,
  color: '#118CC4',
  offsetY: -6,
  datasetFilter: (datasetIndex, chart) => isLineDataset(chart, datasetIndex),
  formatLabel: (value) => formatPayrollAxisLabel(value),
});

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface RHPayrollChartProps {
  series: RHIndicadorSeriePonto[];
}

const RHPayrollChart: React.FC<RHPayrollChartProps> = ({ series }) => {
  const chartData = useMemo(() => ({
    labels: series.map((ponto) => ponto.label),
    datasets: [
      {
        label: 'Folha Salarial',
        data: series.map((ponto) => ponto.payroll),
        borderColor: '#118CC4',
        backgroundColor: 'rgba(17, 140, 196, 0.12)',
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#118CC4',
        tension: 0.35,
        fill: true,
      },
    ],
  }), [series]);

  const options = useMemo(() => {
    const values = series.map((ponto) => Number(ponto.payroll) || 0);
    const maxValue = values.length ? Math.max(...values) : 0;

    return {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { left: 4, right: 8, top: 18, bottom: 2 } },
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { size: 12, family: 'inherit' },
          bodyFont: { size: 12, family: 'inherit' },
          padding: 12,
          callbacks: {
            label: (ctx: { parsed: { y: number | null } }) => formatCurrency(ctx.parsed.y ?? 0),
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#94a3b8',
            font: { size: 11 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12,
          },
        },
        y: {
          // Sem beginAtZero o Chart.js “corta” perto do mínimo (ex.: 310k–335k)
          // e exagera variações pequenas da folha.
          beginAtZero: true,
          suggestedMax: maxValue > 0 ? maxValue * 1.08 : undefined,
          grid: { color: 'rgba(226, 232, 240, 0.8)' },
          ticks: {
            color: '#64748b',
            font: { size: 11 },
            maxTicksLimit: 6,
            callback: (val: string | number) => {
              const n = Number(val);
              if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
              if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
              return formatCurrency(n);
            },
          },
        },
      },
    };
  }, [series]);

  if (series.length === 0) {
    return <div className="cashflow-chart-empty">Sem dados no período selecionado.</div>;
  }

  return (
    <div className="cashflow-chart-wrap">
      <Line data={chartData} options={options} plugins={[payrollValueLabels as Plugin<'line'>]} />
    </div>
  );
};

export default RHPayrollChart;
