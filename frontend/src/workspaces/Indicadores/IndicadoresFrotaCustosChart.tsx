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
import type { FrotaCustosIndicadorVeiculo } from '../../types/domain';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export type FrotaCustosChartMode = 'total' | 'manutencao' | 'abastecimento';

interface IndicadoresFrotaCustosChartProps {
  veiculos: FrotaCustosIndicadorVeiculo[];
  mode?: FrotaCustosChartMode;
}

const IndicadoresFrotaCustosChart: React.FC<IndicadoresFrotaCustosChartProps> = ({
  veiculos,
  mode = 'total',
}) => {
  const chartData = useMemo(() => {
    const labels = veiculos.map((item) => item.placaExibicao);
    if (mode === 'manutencao') {
      return {
        labels,
        datasets: [{
          label: 'Manutenções',
          data: veiculos.map((item) => item.custoManutencao),
          backgroundColor: 'rgba(17, 140, 196, 0.88)',
          borderRadius: 3,
          maxBarThickness: 36,
        }],
      };
    }
    if (mode === 'abastecimento') {
      return {
        labels,
        datasets: [{
          label: 'Abastecimento',
          data: veiculos.map((item) => item.custoAbastecimento),
          backgroundColor: 'rgba(234, 88, 12, 0.88)',
          borderRadius: 3,
          maxBarThickness: 36,
        }],
      };
    }
    return {
      labels,
      datasets: [
        {
          label: 'Manutenções',
          data: veiculos.map((item) => item.custoManutencao),
          backgroundColor: 'rgba(17, 140, 196, 0.88)',
          borderRadius: 3,
          maxBarThickness: 36,
        },
        {
          label: 'Abastecimento',
          data: veiculos.map((item) => item.custoAbastecimento),
          backgroundColor: 'rgba(234, 88, 12, 0.88)',
          borderRadius: 3,
          maxBarThickness: 36,
        },
      ],
    };
  }, [mode, veiculos]);

  const stacked = mode === 'total';

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        display: stacked,
        position: 'top' as const,
        labels: { boxWidth: 12, font: { size: 12, family: 'inherit' } },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        padding: 12,
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      x: {
        stacked,
        grid: { display: false },
        ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 45, minRotation: 0 },
      },
      y: {
        stacked,
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.18)' },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 },
          callback: (value: string | number) => {
            const n = Number(value);
            if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
            if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
            return formatCurrency(n);
          },
        },
      },
    },
  }), [stacked]);

  if (veiculos.length === 0) {
    return <p className="cashflow-chart-empty">Importe custos de frota para ver o gráfico por veículo.</p>;
  }

  return <Bar data={chartData} options={options} />;
};

export default IndicadoresFrotaCustosChart;
