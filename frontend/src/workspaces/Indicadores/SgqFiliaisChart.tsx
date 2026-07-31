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
import type { SgqSatisfacaoPorFilial } from '../../types/domain';

ChartJS.register(CategoryScale, LinearScale, BarElement, BarController, Title, Tooltip, Legend);

interface Props {
  porFilial: SgqSatisfacaoPorFilial[];
}

const SgqFiliaisChart: React.FC<Props> = ({ porFilial }) => {
  const chartData = useMemo(() => ({
    labels: porFilial.map((f) => f.filial.replace(' (Matriz)', '')),
    datasets: [
      {
        type: 'bar' as const,
        label: 'Ótimo',
        data: porFilial.map((f) => (f.contagem.otimo > 0 ? f.contagem.otimo : null)),
        backgroundColor: 'rgba(22, 163, 74, 0.85)',
        borderRadius: 4,
        minBarLength: 6,
      },
      {
        type: 'bar' as const,
        label: 'Bom',
        data: porFilial.map((f) => (f.contagem.bom > 0 ? f.contagem.bom : null)),
        backgroundColor: 'rgba(14, 165, 233, 0.85)',
        borderRadius: 4,
        minBarLength: 6,
      },
      {
        type: 'bar' as const,
        label: 'Regular',
        data: porFilial.map((f) => (f.contagem.regular > 0 ? f.contagem.regular : null)),
        backgroundColor: 'rgba(245, 158, 11, 0.85)',
        borderRadius: 4,
        minBarLength: 6,
      },
      {
        type: 'bar' as const,
        label: 'Ruim',
        data: porFilial.map((f) => (f.contagem.ruim > 0 ? f.contagem.ruim : null)),
        backgroundColor: 'rgba(220, 38, 38, 0.85)',
        borderRadius: 4,
        minBarLength: 6,
      },
    ],
  }), [porFilial]);

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
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(226, 232, 240, 0.8)' },
        ticks: { color: '#64748b', font: { size: 11 }, precision: 0 },
      },
    },
  }), []);

  if (porFilial.every((f) => f.totalAvaliacoes === 0)) {
    return <div className="cashflow-chart-empty">Sem avaliações por filial no período.</div>;
  }

  return (
    <div className="cashflow-chart-wrap">
      <Chart type="bar" data={chartData} options={options} />
    </div>
  );
};

export default SgqFiliaisChart;
