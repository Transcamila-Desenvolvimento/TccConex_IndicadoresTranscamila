import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  LineController,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import type { CashflowDailyPoint } from '../../types/domain';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  LineController,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface CashflowChartProps {
  daily: CashflowDailyPoint[];
}

const CashflowChart: React.FC<CashflowChartProps> = ({ daily }) => {
  const chartData = useMemo(() => ({
    labels: daily.map(d => d.date),
    datasets: [
      {
        type: 'bar' as const,
        label: 'Entradas',
        data: daily.map(d => d.entradas),
        backgroundColor: 'rgba(22, 163, 74, 0.75)',
        borderColor: 'rgba(22, 163, 74, 1)',
        borderWidth: 1,
        borderRadius: 4,
        yAxisID: 'yFlow',
        order: 2,
      },
      {
        type: 'bar' as const,
        label: 'Saídas',
        data: daily.map(d => d.saidas),
        backgroundColor: 'rgba(220, 38, 38, 0.75)',
        borderColor: 'rgba(220, 38, 38, 1)',
        borderWidth: 1,
        borderRadius: 4,
        yAxisID: 'yFlow',
        order: 2,
      },
      {
        type: 'line' as const,
        label: 'Saldo Projetado',
        data: daily.map(d => d.saldoProjetado),
        borderColor: '#118CC4',
        backgroundColor: 'rgba(17, 140, 196, 0.12)',
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#118CC4',
        tension: 0.35,
        fill: true,
        yAxisID: 'yBalance',
        order: 1,
      },
    ],
  }), [daily]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'end' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          padding: 18,
          font: { size: 12, family: 'inherit' },
          color: '#64748b',
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleFont: { size: 12, family: 'inherit' },
        bodyFont: { size: 12, family: 'inherit' },
        padding: 12,
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
            const val = ctx.parsed.y ?? 0;
            return `${ctx.dataset.label}: ${formatCurrency(val)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 16 },
      },
      yBalance: {
        type: 'linear' as const,
        position: 'left' as const,
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
      yFlow: {
        type: 'linear' as const,
        position: 'right' as const,
        grid: { drawOnChartArea: false },
        ticks: {
          color: '#94a3b8',
          font: { size: 10 },
          callback: (val: string | number) => {
            const n = Number(val);
            if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
            if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
            return n.toLocaleString('pt-BR');
          },
        },
      },
    },
  }), []);

  if (daily.length === 0) {
    return (
      <div className="cashflow-chart-empty">
        Sem movimentações no período selecionado.
      </div>
    );
  }

  return (
    <div className="cashflow-chart-wrap">
      <Chart type="bar" data={chartData} options={options} />
    </div>
  );
};

export default CashflowChart;
