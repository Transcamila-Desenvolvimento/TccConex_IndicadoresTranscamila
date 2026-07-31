/** Garante fatia mínima visível no donut sem alterar o valor real do tooltip. */
export function withMinVisibleShare(values: number[], minShare = 0.025): number[] {
  const total = values.reduce((acc, value) => acc + value, 0);
  if (total <= 0) return values;
  const floor = total * minShare;
  return values.map((value) => (value > 0 && value < floor ? floor : value));
}
