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
import type { MetaFaturamentoSerieMensal } from '../../types/domain';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface MetaFaturamentoAcumuladoChartProps {
  series: MetaFaturamentoSerieMensal[];
  ano?: number;
}

const MetaFaturamentoAcumuladoChart: React.FC<MetaFaturamentoAcumuladoChartProps> = ({
  series,
  ano,
}) => {
  const anoRef = ano ?? series[0]?.ano ?? new Date().getFullYear();
  const anoAnterior = anoRef - 1;

  const chartData = useMemo(() => ({
    labels: series.map((p) => p.label),
    datasets: [
      {
        label: `Realizado ${anoRef}`,
        data: series.map((p) => p.realizadoAcumulado),
        borderColor: '#118CC4',
        backgroundColor: 'rgba(17, 140, 196, 0.12)',
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#118CC4',
        tension: 0.35,
        fill: true,
      },
      {
        label: `Realizado ${anoAnterior}`,
        data: series.map((p) => p.realizadoAnoAnteriorAcumulado),
        borderColor: '#64748b',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 4,
        pointBackgroundColor: '#64748b',
        tension: 0.35,
        fill: false,
      },
      {
        label: 'Meta acumulada',
        data: series.map((p) => p.metaAcumulada),
        borderColor: '#94a3b8',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        tension: 0.2,
        fill: false,
      },
    ],
  }), [series, anoRef, anoAnterior]);

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
    return <div className="cashflow-chart-empty">Sem dados acumulados no período.</div>;
  }

  return (
    <div className="cashflow-chart-wrap">
      <Line data={chartData} options={options} />
    </div>
  );
};

export default MetaFaturamentoAcumuladoChart;
