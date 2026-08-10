import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import type { RHIndicadorSeriePonto } from '../../types/domain';
import { createDatasetValueLabelsPlugin } from './rhChartLabelPlugin';

ChartJS.register(CategoryScale, LinearScale, BarElement, BarController, Title, Tooltip, Legend);

const admissoesValueLabels = createDatasetValueLabelsPlugin({
  id: 'rh-admissoes-value-labels',
  fontSize: 10,
  minBarHeight: 8,
  barLabelPosition: 'outside',
  color: (datasetIndex) => (datasetIndex === 0 ? '#15803d' : '#b91c1c'),
  formatLabel: (value) => {
    const abs = Math.abs(Math.round(value));
    if (abs === 0) return null;
    return String(abs);
  },
});

interface RHAdmissoesChartProps {
  series: RHIndicadorSeriePonto[];
}

const RHAdmissoesChart: React.FC<RHAdmissoesChartProps> = ({ series }) => {
  const chartData = useMemo(() => ({
    labels: series.map((ponto) => ponto.label),
    datasets: [
      {
        type: 'bar' as const,
        label: 'Admissões',
        data: series.map((ponto) => ponto.admitidos),
        backgroundColor: 'rgba(22, 163, 74, 0.75)',
        borderColor: 'rgba(22, 163, 74, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        type: 'bar' as const,
        label: 'Desligamentos',
        data: series.map((ponto) => -ponto.desligados),
        backgroundColor: 'rgba(220, 38, 38, 0.75)',
        borderColor: 'rgba(220, 38, 38, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }), [series]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 14, bottom: 14 } },
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'end' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          padding: 14,
          font: { size: 11, family: 'inherit' },
          color: '#64748b',
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleFont: { size: 12, family: 'inherit' },
        bodyFont: { size: 12, family: 'inherit' },
        padding: 12,
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            `${ctx.dataset.label}: ${Math.abs(ctx.parsed.y ?? 0)}`,
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
        grid: { color: 'rgba(226, 232, 240, 0.8)' },
        ticks: {
          color: '#64748b',
          font: { size: 11 },
          precision: 0,
          callback: (val: string | number) => Math.abs(Number(val)),
        },
      },
    },
  }), []);

  if (series.length === 0) {
    return <div className="cashflow-chart-empty">Sem dados no período selecionado.</div>;
  }

  return (
    <div className="cashflow-chart-wrap">
      <Chart type="bar" data={chartData} options={options} plugins={[admissoesValueLabels]} />
    </div>
  );
};

export default RHAdmissoesChart;
