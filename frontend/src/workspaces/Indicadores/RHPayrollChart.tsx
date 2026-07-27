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
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { RHIndicadorSeriePonto } from '../../types/domain';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

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

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
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

  if (series.length === 0) {
    return <div className="cashflow-chart-empty">Sem dados no período selecionado.</div>;
  }

  return (
    <div className="cashflow-chart-wrap">
      <Line data={chartData} options={options} />
    </div>
  );
};

export default RHPayrollChart;
