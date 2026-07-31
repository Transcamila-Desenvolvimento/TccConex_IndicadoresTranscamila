import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { MetaFaturamentoSerieMensal } from '../../types/domain';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface MetaFaturamentoComparativoChartProps {
  series: MetaFaturamentoSerieMensal[];
  ano: number;
}

const MetaFaturamentoComparativoChart: React.FC<MetaFaturamentoComparativoChartProps> = ({
  series,
  ano,
}) => {
  const anoAnterior = ano - 1;

  const chartData = useMemo(() => ({
    labels: series.map((p) => p.nomeMes.slice(0, 3)),
    datasets: [
      {
        label: String(ano),
        data: series.map((p) => p.realizado),
        backgroundColor: 'rgba(17, 140, 196, 0.8)',
        borderRadius: 4,
        maxBarThickness: 32,
      },
      {
        label: String(anoAnterior),
        data: series.map((p) => p.realizadoAnoAnterior),
        backgroundColor: 'rgba(100, 116, 139, 0.55)',
        borderRadius: 4,
        maxBarThickness: 32,
      },
    ],
  }), [series, ano, anoAnterior]);

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
          afterBody: (items: { dataIndex: number }[]) => {
            const idx = items[0]?.dataIndex;
            if (idx == null) return [];
            const ponto = series[idx];
            if (!ponto || ponto.variacaoAnoAnterior == null) return [];
            const sign = ponto.variacaoAnoAnterior > 0 ? '+' : '';
            return [
              `Variação: ${sign}${ponto.variacaoAnoAnterior.toLocaleString('pt-BR', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}%`,
            ];
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
  }), [series]);

  if (!series.length) {
    return <div className="cashflow-chart-empty">Sem dados para comparar com o ano anterior.</div>;
  }

  return (
    <div className="cashflow-chart-wrap">
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default MetaFaturamentoComparativoChart;
