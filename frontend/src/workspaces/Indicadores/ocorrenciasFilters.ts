import type { OpsIndicadoresGranularity } from '../../types/domain';

export const MONTH_OPTIONS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Fev' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Abr' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Ago' },
  { value: 9, label: 'Set' },
  { value: 10, label: 'Out' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dez' },
] as const;

export const ALL_MONTHS = MONTH_OPTIONS.map((m) => m.value);

export function resolveDefaultYear(availableYears: number[]): number | '' {
  if (availableYears.length === 0) return '';
  const currentYear = new Date().getFullYear();
  if (availableYears.includes(currentYear)) return currentYear;
  return availableYears[0];
}

export function monthsLabel(months: number[]): string {
  if (months.length === 12) return 'Meses: Todos';
  if (months.length === 0) return 'Meses: Nenhum';
  const labels = MONTH_OPTIONS.filter((m) => months.includes(m.value)).map((m) => m.label);
  if (labels.length <= 3) return `Meses: ${labels.join(', ')}`;
  return `Meses: ${months.length} selecionados`;
}

export function monthsForApi(months: number[]): number[] | undefined {
  // 12 meses = sem filtro; lista vazia = nenhum mês (resultado vazio).
  return months.length === 12 ? undefined : months;
}

export function effectiveGranularity(
  months: number[],
  granularity: OpsIndicadoresGranularity,
): OpsIndicadoresGranularity {
  const dayAllowed = months.length === 1;
  return dayAllowed && granularity === 'day' ? 'day' : 'month';
}
