import type React from 'react';
import type { CondicaoUniforme } from '../../../types/domain';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const formatDateBr = (iso: string) => {
  const [y, m, d] = (iso || '').slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '—';
};

export const formatDateTimeBr = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');

export const formatCpf = (cpf: string) => {
  const d = (cpf || '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf || '—';
};

export const CONDICAO_LABEL: Record<CondicaoUniforme, string> = { novo: 'Novo', usado: 'Usado' };

const ORDEM_TAMANHOS = ['ÚNICO', 'UNICO', 'U', 'PP', 'P', 'M', 'G', 'GG', '2G', 'XG', 'XGG', '3G', 'EXG', 'XXGG', '4G', '5G', '6G'];

/** Ordena tamanhos de roupa (PP→6G) antes da numeração; "GG (2G)" é ordenado pelo primeiro termo. */
export const ordemTamanho = (tamanho: string) => {
  const t = tamanho.trim().toUpperCase().split(/[\s(]/)[0];
  const indice = ORDEM_TAMANHOS.indexOf(t);
  if (indice >= 0) return indice;
  const numero = parseInt(t, 10);
  return Number.isNaN(numero) ? 1000 : 100 + numero;
};

export const compararTamanho = (a: string, b: string) => ordemTamanho(a) - ordemTamanho(b) || a.localeCompare(b);

export const normalizarBusca = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const TAMANHOS_SUGERIDOS = [
  'ÚNICO', 'PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG', 'XXGG', 'EXG',
  '2G', '3G', '4G', '5G', 'GG (2G)', 'XGG (3G)', 'XXGG (4G)',
  '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56',
];

export const inputCelula: React.CSSProperties = {
  width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px', fontSize: '13px',
};
