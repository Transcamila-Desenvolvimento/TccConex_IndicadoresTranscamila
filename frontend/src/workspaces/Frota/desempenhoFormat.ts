export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function numeroBonito(valor: string | number) {
  const numero = Number(valor);
  if (Number.isNaN(numero)) return String(valor);
  return numero.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function moeda(valor: string | number) {
  const numero = Number(valor);
  if (Number.isNaN(numero)) return String(valor);
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function dataBr(iso: string) {
  const [ano, mes, dia] = iso.split('-');
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}
