import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type Chart,
  type LegendElement,
  type LegendItem,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import type { SgqAvaliacao } from '../../types/domain';
import { SGQ_AVALIACAO_OPTIONS } from '../../types/domain';
import { withMinVisibleShare } from './sgqChartScale';

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS: Record<SgqAvaliacao, string> = {
  otimo: '#16a34a',
  bom: '#0ea5e9',
  regular: '#f59e0b',
  ruim: '#dc2626',
};

interface Props {
  contagem: Record<SgqAvaliacao, number>;
}

const SgqDistribuicaoChart: React.FC<Props> = ({ contagem }) => {
  const { realValues, total, chartData } = useMemo(() => {
    const values = SGQ_AVALIACAO_OPTIONS.map((opt) => contagem[opt.value]);
    const sum = values.reduce((acc, value) => acc + value, 0);
    return {
      realValues: values,
      total: sum,
      chartData: {
        labels: SGQ_AVALIACAO_OPTIONS.map((opt) => opt.label),
        datasets: [{
          data: withMinVisibleShare(values, 0.025),
          backgroundColor: SGQ_AVALIACAO_OPTIONS.map((opt) => COLORS[opt.value]),
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
    };
  }, [contagem]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: {
        position: 'right' as const,
        onClick: (_event: unknown, legendItem: LegendItem, legend: LegendElement<'doughnut'>) => {
          const chart = legend.chart as Chart<'doughnut'>;
          const index = legendItem.index;
          if (index === undefined) return;
          chart.toggleDataVisibility(index);
          chart.update();
        },
        labels: {
          usePointStyle: true,
          pointStyle: 'circle' as const,
          boxWidth: 8,
          padding: 16,
          font: { size: 12, family: 'inherit' },
          color: '#475569',
          generateLabels: (chart: Chart) => {
            const dataset = chart.data.datasets[0];
            const colors = dataset.backgroundColor as string[];
            return SGQ_AVALIACAO_OPTIONS.map((opt, index) => {
              const value = realValues[index];
              const pct = total ? ((value / total) * 100).toFixed(1) : '0.0';
              return {
                text: `${opt.label} · ${value} (${pct}%)`,
                fillStyle: colors[index],
                strokeStyle: colors[index],
                fontColor: '#475569',
                hidden: !chart.getDataVisibility(index),
                index,
                datasetIndex: 0,
              };
            });
          },
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleFont: { size: 12, family: 'inherit' },
        bodyFont: { size: 12, family: 'inherit' },
        padding: 12,
        callbacks: {
          label: (ctx: { dataIndex: number; label?: string }) => {
            const value = realValues[ctx.dataIndex] ?? 0;
            const pct = total ? ((value / total) * 100).toFixed(1) : '0.0';
            return ` ${ctx.label}: ${value} (${pct}%)`;
          },
        },
      },
    },
  }), [realValues, total]);

  if (total === 0) {
    return <div className="cashflow-chart-empty">Sem avaliações no período selecionado.</div>;
  }

  return (
    <div className="cashflow-chart-wrap">
      <Doughnut data={chartData} options={options} />
    </div>
  );
};

export default SgqDistribuicaoChart;
