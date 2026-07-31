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
import type { SgqSatisfacaoSerieMensal } from '../../types/domain';

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

interface Props {
  serie: SgqSatisfacaoSerieMensal[];
}

const SgqEvolucaoChart: React.FC<Props> = ({ serie }) => {
  const chartData = useMemo(() => ({
    labels: serie.map((p) => p.label),
    datasets: [
      {
        type: 'bar' as const,
        label: 'Pesquisas',
        data: serie.map((p) => p.totalPesquisas),
        backgroundColor: 'rgba(17, 140, 196, 0.25)',
        borderColor: 'rgba(17, 140, 196, 0.55)',
        borderWidth: 1,
        borderRadius: 4,
        yAxisID: 'y',
        order: 2,
      },
      {
        type: 'line' as const,
        label: '% Ótimo',
        data: serie.map((p) => p.percentualOtimo),
        borderColor: '#16a34a',
        backgroundColor: 'rgba(22, 163, 74, 0.12)',
        borderWidth: 2.5,
        pointRadius: 3.5,
        pointBackgroundColor: '#16a34a',
        tension: 0.3,
        fill: true,
        yAxisID: 'y1',
        order: 1,
      },
      {
        type: 'line' as const,
        label: 'Score médio',
        data: serie.map((p) => p.scoreMedio),
        borderColor: '#0f172a',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 4],
        pointRadius: 3,
        pointBackgroundColor: '#0f172a',
        tension: 0.3,
        yAxisID: 'y2',
        order: 0,
      },
    ],
  }), [serie]);

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
          pointStyle: 'circle' as const,
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
          label: (ctx: { dataset: { label?: string; yAxisID?: string }; parsed: { y: number | null } }) => {
            const v = ctx.parsed.y ?? 0;
            if (ctx.dataset.yAxisID === 'y1') return ` ${ctx.dataset.label}: ${v.toFixed(1)}%`;
            if (ctx.dataset.yAxisID === 'y2') return ` ${ctx.dataset.label}: ${v.toFixed(2)}`;
            return ` ${ctx.dataset.label}: ${v}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        position: 'left' as const,
        grid: { color: 'rgba(226, 232, 240, 0.8)' },
        ticks: { color: '#64748b', font: { size: 11 }, precision: 0 },
        title: { display: true, text: 'Pesquisas', color: '#94a3b8', font: { size: 11 } },
      },
      y1: {
        beginAtZero: true,
        max: 100,
        position: 'right' as const,
        grid: { drawOnChartArea: false },
        ticks: {
          color: '#16a34a',
          font: { size: 11 },
          callback: (value: string | number) => `${value}%`,
        },
        title: { display: true, text: '% Ótimo', color: '#16a34a', font: { size: 11 } },
      },
      y2: {
        display: false,
        min: 1,
        max: 4,
      },
    },
  }), []);

  if (serie.length === 0) {
    return <div className="cashflow-chart-empty">Sem dados mensais no período selecionado.</div>;
  }

  return (
    <div className="cashflow-chart-wrap">
      <Chart type="bar" data={chartData} options={options} />
    </div>
  );
};

export default SgqEvolucaoChart;
