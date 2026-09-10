export const parseTabelaNumber = (value?: string | number | null) => {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  const cleaned = String(value).replace(/R\$\s?/gi, '').replace(/%/g, '').trim();
  if (!cleaned || cleaned === '—') return null;
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const amount = Number(normalized);
  return Number.isNaN(amount) ? null : amount;
};

const VEICULO_KEYS = new Set(['de9000', 'de14001', 'acima26001']);

export const isTarifaVeiculo = (tarifa?: { unidade?: string | null; key?: string | null } | string | null) => {
  if (tarifa == null) return false;
  if (typeof tarifa === 'string') {
    const unidade = tarifa.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return unidade === 'veiculo' || VEICULO_KEYS.has(tarifa);
  }
  const unidade = (tarifa.unidade || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const key = (tarifa.key || '').toLowerCase();
  return unidade === 'veiculo' || VEICULO_KEYS.has(key);
};

export const formatTabelaAmount = (value?: string | number | null) => {
  const amount = parseTabelaNumber(value);
  if (amount == null) return '—';
  return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatTabelaMoney = (value?: string | number | null) => {
  const amount = formatTabelaAmount(value);
  return amount === '—' ? '—' : `R$ ${amount}`;
};

export const formatTabelaMoneyPdf = (value?: string | number | null) => {
  const amount = parseTabelaNumber(value);
  if (amount == null) return '—';
  const numero = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `R$&nbsp;${numero}`;
};

export const formatTabelaPercent = (value?: string | number | null) => {
  const amount = parseTabelaNumber(value);
  if (amount == null) return '—';
  return `${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
};

const roundDecimal = (value: number, places = 8) => {
  const fator = 10 ** places;
  return Math.round((value + Number.EPSILON) * fator) / fator;
};

/** Fator gravado (0,0015) → percentual comum para digitação (0,15). */
export const fatorToPercentualInput = (fator?: string | number | null) => {
  const amount = parseTabelaNumber(fator);
  if (amount == null) return '';
  const percentual = roundDecimal(amount * 100, 6);
  return percentual.toLocaleString('pt-BR', { maximumFractionDigits: 6, minimumFractionDigits: 0 });
};

/** Percentual comum digitado (0,15 ou 0,15%) → fator da cotação (0,0015). */
export const percentualToFator = (percentual?: string | number | null) => {
  const amount = parseTabelaNumber(percentual);
  if (amount == null) return '';
  return String(roundDecimal(amount / 100, 10));
};

/** Fator gravado (0,0015) → texto da grade (0,15%). */
export const formatTabelaPercentFator = (fator?: string | number | null) => {
  const amount = parseTabelaNumber(fator);
  if (amount == null) return '—';
  const percentual = roundDecimal(amount * 100, 6);
  return `${percentual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
};

export const formatColunaExtraValor = (extra?: { valor?: string; formato?: string; calculo?: string } | null) => {
  if (!extra) return '—';
  const percentual = extra.formato === 'percentual'
    || extra.calculo === 'percentual_nf'
    || extra.calculo === 'percentual_frete';
  return percentual ? formatTabelaPercent(extra.valor) : formatTabelaAmount(extra.valor);
};

/** Remove sufixo legado "Rev.61" do nome — a revisão oficial fica no campo `revisao`. */
export const nomeBaseTabelaFrete = (nome?: string | null) => {
  const trimmed = (nome ?? '').trim();
  if (!trimmed) return '';
  const base = trimmed.replace(/\s*rev\.?\s*\d+\s*$/i, '').trim();
  return base || trimmed;
};

export const formatTabelaFreteClientes = (tabela: { clientesNomes?: string[] }) => {
  const nomes = tabela.clientesNomes?.filter(Boolean) ?? [];
  return nomes.length > 0 ? nomes.join(', ') : '—';
};

export const isGrisAdvUnificado = (config?: { grisAdvUnificado?: boolean; grisAdvPercent?: string } | null) => {
  if (config?.grisAdvUnificado != null) return Boolean(config.grisAdvUnificado);
  return Boolean(String(config?.grisAdvPercent ?? '').trim());
};
