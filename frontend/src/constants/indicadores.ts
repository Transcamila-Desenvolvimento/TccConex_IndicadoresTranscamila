import type { User } from '../types/domain';

/**
 * Indicadores liberáveis individualmente no ambiente Indicadores.
 * Mantém paridade com backend/apps/accounts/constants.py (INDICADORES_KEYS).
 * Lista vazia em user.indicadores = acesso a todos os indicadores.
 */
export const INDICADOR_ITEMS = [
  { key: 'fluxo-caixa', label: 'Fluxo de Caixa', group: 'Financeiro' },
  { key: 'meta-faturamento', label: 'Meta de Faturamento', group: 'Logística' },
] as const;

export type IndicadorKey = (typeof INDICADOR_ITEMS)[number]['key'];

export const ALL_INDICADOR_KEYS = INDICADOR_ITEMS.map((item) => item.key);

/** Conjunto de indicadores liberados para o usuário (lista vazia = todos). */
export function getAllowedIndicadores(user: User | null): Set<IndicadorKey> {
  const selected = (user?.indicadores ?? []).filter(
    (key): key is IndicadorKey => (ALL_INDICADOR_KEYS as string[]).includes(key),
  );
  if (selected.length === 0) return new Set(ALL_INDICADOR_KEYS);
  return new Set(selected);
}
