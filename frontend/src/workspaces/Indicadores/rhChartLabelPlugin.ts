import type { Chart, ChartType, Plugin } from 'chart.js';

type LabelFormatter = (value: number, datasetIndex: number, dataIndex: number, chart: Chart) => string | null;

interface DatasetValueLabelsOptions {
  formatLabel: LabelFormatter;
  id: string;
  fontSize?: number;
  color?: string | ((datasetIndex: number, chart: Chart) => string);
  offsetY?: number;
  minBarHeight?: number;
  barLabelPosition?: 'center' | 'outside';
  datasetFilter?: (datasetIndex: number, chart: Chart) => boolean;
}

export function createDatasetValueLabelsPlugin(options: DatasetValueLabelsOptions): Plugin<ChartType> {
  const {
    formatLabel,
    id,
    fontSize = 10,
    color = '#475569',
    offsetY = -8,
    minBarHeight = 12,
    barLabelPosition = 'center',
    datasetFilter,
  } = options;

  return {
    id,
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';

      chart.data.datasets.forEach((dataset, datasetIndex) => {
        if (datasetFilter && !datasetFilter(datasetIndex, chart)) return;

        const meta = chart.getDatasetMeta(datasetIndex);
        if (meta.hidden) return;

        meta.data.forEach((element, index) => {
          const raw = dataset.data[index];
          const value = typeof raw === 'number' ? raw : Number(raw);
          if (!Number.isFinite(value) || value === 0) return;

          const text = formatLabel(value, datasetIndex, index, chart);
          if (!text) return;

          const barElement = element as { x: number; y: number; base?: number };
          const x = barElement.x;
          let y = barElement.y;

          if (typeof barElement.base === 'number') {
            const height = Math.abs(barElement.y - barElement.base);
            if (height < minBarHeight) return;
            if (barLabelPosition === 'outside') {
              if (value >= 0) {
                y = Math.min(barElement.y, barElement.base) - 4;
                ctx.textBaseline = 'bottom';
              } else {
                y = Math.max(barElement.y, barElement.base) + 4;
                ctx.textBaseline = 'top';
              }
            } else {
              y = (barElement.y + barElement.base) / 2;
              ctx.textBaseline = 'middle';
            }
          } else {
            y += offsetY;
            ctx.textBaseline = 'bottom';
          }

          const fill = typeof color === 'function' ? color(datasetIndex, chart) : color;
          ctx.fillStyle = fill;
          ctx.fillText(text, x, y);
        });
      });

      ctx.restore();
    },
  };
}

export function formatPayrollAxisLabel(value: number): string {
  const n = Math.abs(value);
  if (n >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function chartConfigType(chart: Chart): ChartType {
  return (chart.config as { type?: ChartType }).type ?? 'bar';
}

export function isBarDataset(chart: Chart, datasetIndex: number): boolean {
  const dataset = chart.data.datasets[datasetIndex] as { type?: ChartType };
  return (dataset.type ?? chartConfigType(chart)) === 'bar';
}

export function isLineDataset(chart: Chart, datasetIndex: number): boolean {
  const dataset = chart.data.datasets[datasetIndex] as { type?: ChartType };
  return (dataset.type ?? chartConfigType(chart)) === 'line';
}
