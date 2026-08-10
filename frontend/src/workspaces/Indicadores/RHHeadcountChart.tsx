import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  BarController,
  LineController,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import type { RHIndicadorPorCategoria, RHIndicadorSeriePonto } from '../../types/domain';
import {
  createDatasetValueLabelsPlugin,
  isBarDataset,
  isLineDataset,
} from './rhChartLabelPlugin';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  BarController,
  LineController,
  Title,
  Tooltip,
  Legend,
);

const CATEGORIA_COLORS: Record<keyof RHIndicadorPorCategoria, string> = {
  administrativo: 'rgba(29, 78, 216, 0.8)',
  operacional: 'rgba(217, 119, 6, 0.8)',
  motorista: 'rgba(22, 163, 74, 0.8)',
  naoMapeado: 'rgba(148, 163, 184, 0.8)',
};

const CATEGORIA_LABELS: Record<keyof RHIndicadorPorCategoria, string> = {
  administrativo: 'Administrativo',
  operacional: 'Operacional',
  motorista: 'Motorista',
  naoMapeado: 'Não mapeado',
};

const CATEGORIA_CHAVES: (keyof RHIndicadorPorCategoria)[] = ['administrativo', 'operacional', 'motorista', 'naoMapeado'];

const headcountValueLabels = createDatasetValueLabelsPlugin({
  id: 'rh-headcount-value-labels',
  fontSize: 10,
  minBarHeight: 14,
  offsetY: -8,
  color: (datasetIndex, chart) => (isLineDataset(chart, datasetIndex) ? '#0f172a' : '#ffffff'),
  formatLabel: (value, datasetIndex, _dataIndex, chart) => {
    if (isLineDataset(chart, datasetIndex) || isBarDataset(chart, datasetIndex)) {
      return String(Math.round(value));
    }
    return null;
  },
});

interface RHHeadcountChartProps {
  series: RHIndicadorSeriePonto[];
}

const RHHeadcountChart: React.FC<RHHeadcountChartProps> = ({ series }) => {
  const categoriasComDados = useMemo(
    () => CATEGORIA_CHAVES.filter((chave) => series.some((ponto) => ponto.porCategoria[chave].count > 0)),
    [series],
  );

  const chartData = useMemo(() => ({
    labels: series.map((ponto) => ponto.label),
    datasets: [
      ...categoriasComDados.map((chave) => ({
        type: 'bar' as const,
        label: CATEGORIA_LABELS[chave],
        data: series.map((ponto) => ponto.porCategoria[chave].count),
        backgroundColor: CATEGORIA_COLORS[chave],
        borderRadius: 4,
        stack: 'headcount',
        order: 2,
      })),
      {
        type: 'line' as const,
        label: 'Total',
        data: series.map((ponto) => ponto.headcount),
        borderColor: '#0f172a',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#0f172a',
        tension: 0.25,
        order: 1,
      },
    ],
  }), [series, categoriasComDados]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 16 } },
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
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 11 } },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: 'rgba(226, 232, 240, 0.8)' },
        ticks: { color: '#64748b', font: { size: 11 }, precision: 0 },
      },
    },
  }), []);

  if (series.length === 0) {
    return <div className="cashflow-chart-empty">Sem dados no período selecionado.</div>;
  }

  return (
    <div className="cashflow-chart-wrap">
      <Chart type="bar" data={chartData} options={options} plugins={[headcountValueLabels]} />
    </div>
  );
};

export default RHHeadcountChart;
