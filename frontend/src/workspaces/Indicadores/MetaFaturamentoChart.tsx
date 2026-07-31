import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { MetaFaturamentoSerieMensal } from '../../types/domain';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface MetaFaturamentoChartProps {
  series: MetaFaturamentoSerieMensal[];
}

const MetaFaturamentoChart: React.FC<MetaFaturamentoChartProps> = ({ series }) => {
  const chartData = useMemo(() => ({
    labels: series.map((p) => p.label),
    datasets: [
      {
        label: 'Realizado',
        data: series.map((p) => p.realizado),
        backgroundColor: 'rgba(17, 140, 196, 0.75)',
        borderRadius: 4,
        maxBarThickness: 28,
      },
      {
        label: 'Meta',
        data: series.map((p) => p.meta),
        backgroundColor: 'rgba(148, 163, 184, 0.55)',
        borderRadius: 4,
        maxBarThickness: 28,
      },
    ],
  }), [series]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { boxWidth: 12, font: { size: 12, family: 'inherit' } },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleFont: { size: 12, family: 'inherit' },
        bodyFont: { size: 12, family: 'inherit' },
        padding: 12,
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(226, 232, 240, 0.8)' },
        ticks: {
          color: '#64748b',
          font: { size: 11 },
          callback: (val: string | number) => {
            const n = Number(val);
            if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
            if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
            return formatCurrency(n);
          },
        },
      },
    },
  }), []);

  if (!series.length) {
    return <div className="cashflow-chart-empty">Sem dados de faturamento no período.</div>;
  }

  return (
    <div className="cashflow-chart-wrap">
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default MetaFaturamentoChart;
