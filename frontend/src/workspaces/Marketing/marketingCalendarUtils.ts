import type { CampanhaMarketing } from '../../types/domain';

export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dateInRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

export function campanhaAtivaNoDia(c: CampanhaMarketing, iso: string): boolean {
  return dateInRange(iso, c.dataInicio, c.dataFim);
}

export function monthRange(year: number, month: number): { startIso: string; endIso: string } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { startIso: toIso(start), endIso: toIso(end) };
}

export function buildMonthWeeks(year: number, month: number): (string | null)[][] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(toIso(new Date(year, month, day)));
  while (cells.length % 7 !== 0) cells.push(null);
  const result: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
  return result;
}

export function indexCampanhasPorDia(
  campanhas: CampanhaMarketing[],
  startIso: string,
  endIso: string,
): Record<string, CampanhaMarketing[]> {
  const map: Record<string, CampanhaMarketing[]> = {};
  campanhas.forEach((c) => {
    const start = new Date(c.dataInicio + 'T12:00:00');
    const end = new Date(c.dataFim + 'T12:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = toIso(d);
      if (iso >= startIso && iso <= endIso) (map[iso] ??= []).push(c);
    }
  });
  return map;
}
