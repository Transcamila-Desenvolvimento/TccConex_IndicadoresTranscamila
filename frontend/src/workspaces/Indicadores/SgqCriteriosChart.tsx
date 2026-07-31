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
import type { SgqCriterioStats } from '../../types/domain';

ChartJS.register(CategoryScale, LinearScale, BarElement, BarController, Title, Tooltip, Legend);

interface Props {
  criterios: SgqCriterioStats[];
}

const SgqCriteriosChart: React.FC<Props> = ({ criterios }) => {
  const chartData = useMemo(() => ({
    labels: criterios.map((c) => c.label),
    datasets: [
      {
        type: 'bar' as const,
        label: 'Ótimo',
        data: criterios.map((c) => c.otimo),
        backgroundColor: 'rgba(22, 163, 74, 0.85)',
        borderRadius: 3,
        stack: 'aval',
      },
      {
        type: 'bar' as const,
        label: 'Bom',
        data: criterios.map((c) => c.bom),
        backgroundColor: 'rgba(14, 165, 233, 0.85)',
        borderRadius: 3,
        stack: 'aval',
      },
      {
        type: 'bar' as const,
        label: 'Regular',
        data: criterios.map((c) => c.regular),
        backgroundColor: 'rgba(245, 158, 11, 0.85)',
        borderRadius: 3,
        stack: 'aval',
      },
      {
        type: 'bar' as const,
        label: 'Ruim',
        data: criterios.map((c) => c.ruim),
        backgroundColor: 'rgba(220, 38, 38, 0.85)',
        borderRadius: 3,
        stack: 'aval',
      },
    ],
  }), [criterios]);

  const options = useMemo(() => ({
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    // Em barras horizontais o eixo de categoria é Y — sem `axis: 'y'` o
    // tooltip/index usa a posição X e acaba mostrando o critério vizinho.
    interaction: { mode: 'index' as const, axis: 'y' as const, intersect: false },
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
        mode: 'index' as const,
        axis: 'y' as const,
        intersect: false,
        backgroundColor: '#0f172a',
        titleFont: { size: 12, family: 'inherit' },
        bodyFont: { size: 12, family: 'inherit' },
        padding: 12,
      },
    },
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
        grid: { color: 'rgba(226, 232, 240, 0.8)' },
        ticks: { color: '#64748b', font: { size: 11 }, precision: 0 },
      },
      y: {
        stacked: true,
        grid: { display: false },
        ticks: { color: '#334155', font: { size: 11 } },
      },
    },
  }), []);

  if (criterios.every((c) => c.otimo + c.bom + c.regular + c.ruim === 0)) {
    return <div className="cashflow-chart-empty">Sem avaliações por critério no período.</div>;
  }

  return (
    <div className="cashflow-chart-wrap">
      <Chart type="bar" data={chartData} options={options} />
    </div>
  );
};

export default SgqCriteriosChart;
