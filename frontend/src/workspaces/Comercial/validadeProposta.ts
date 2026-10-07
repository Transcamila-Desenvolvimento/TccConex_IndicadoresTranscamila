/** Prazo em texto e data de vencimento descrevem a mesma janela, contada do início. */

export function diasDoPrazo(texto: string): number | null {
  const match = texto.trim().toLowerCase().match(/^(\d+)\s*(dias?|meses?|m[eê]s|anos?)$/);
  if (!match) return null;
  const quantidade = Number(match[1]);
  const unidade = match[2];
  if (!quantidade) return null;
  if (unidade.startsWith('d')) return quantidade;
  if (unidade.startsWith('ano')) return quantidade * 365;
  return quantidade * 30;
}

export function addDaysISO(iso: string, days: number): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + days);
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`;
}

export function diffDaysISO(inicio: string, fim: string): number | null {
  const [y1, m1, d1] = inicio.slice(0, 10).split('-').map(Number);
  const [y2, m2, d2] = fim.slice(0, 10).split('-').map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return null;
  const start = Date.UTC(y1, m1 - 1, d1);
  const end = Date.UTC(y2, m2 - 1, d2);
  return Math.round((end - start) / 86400000);
}

export function vencimentoDoPrazo(inicio: string, prazo: string): string {
  const dias = diasDoPrazo(prazo);
  if (!inicio || dias == null) return '';
  return addDaysISO(inicio, dias);
}

export function complementoProrrogacao(proposta: {
  validade?: string | null;
  dataProposta?: string | null;
  dataCriacao?: string | null;
  dataVencimento?: string | null;
}): string {
  const inicio = (proposta.dataProposta || proposta.dataCriacao || '').slice(0, 10);
  const natural = vencimentoDoPrazo(inicio, proposta.validade || '');
  const atual = (proposta.dataVencimento || '').slice(0, 10);
  if (!natural || !atual || atual === natural) return '';
  const dias = diffDaysISO(natural, atual);
  if (dias == null || dias <= 0) return '';
  return `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}

export function prazoParaVencimento(inicio: string, vencimento: string, opcoes: string[]): string {
  const dias = diffDaysISO(inicio, vencimento);
  if (dias == null || dias <= 0) return '';
  const iguais = opcoes.filter((opcao) => diasDoPrazo(opcao) === dias);
  const emDias = iguais.find((opcao) => /dias?$/i.test(opcao.trim()));
  return emDias || iguais[0] || `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
}
