import type { User } from '../types/domain';
import { ALL_INDICADOR_KEYS, getAllowedIndicadores, type IndicadorKey } from './indicadores';

/**
 * Abas de menu liberáveis por ambiente (exceto Indicadores, que usa `user.indicadores`).
 * Lista vazia em `user.abas[modulo]` = todas as abas daquele ambiente.
 * A aba `home` não pode ser oculta: quem tem o ambiente sempre vê a home.
 * Mantém paridade com backend/apps/accounts/constants.py (ABAS_POR_AMBIENTE).
 */
export const HOME_ABA_KEY = 'home';

export const ABA_ITEMS = [
  { module: 'Financeiro', key: 'home', label: 'Home Financeiro', path: '/financeiro/home' },
  { module: 'Financeiro', key: 'calendario', label: 'Calendário', path: '/financeiro/calendar' },
  { module: 'Financeiro', key: 'inclusao-relatorios', label: 'Inclusão de Relatórios', path: '/financeiro/reports' },
  { module: 'Financeiro', key: 'saldos-bancarios', label: 'Saldos Bancários', path: '/financeiro/balances' },
  { module: 'Financeiro', key: 'ajustes-caixa', label: 'Ajustes de caixa', path: '/financeiro/adjustments' },
  { module: 'Financeiro', key: 'faturamento', label: 'Faturamento', path: '/financeiro/billing' },

  { module: 'Faturamento', key: 'home', label: 'Home Faturamento', path: '/faturamento' },
  { module: 'Faturamento', key: 'envio-nf-cliente', label: 'Envio NF Cliente', path: '/faturamento/protocolos' },
  { module: 'Faturamento', key: 'cadastro-clientes', label: 'Cadastro cliente', path: '/faturamento/cadastros/clientes' },

  { module: 'Compras', key: 'home', label: 'Home Compras', path: '/compras' },
  { module: 'Compras', key: 'controle-estoque', label: 'Controle de estoque', path: '/compras/controle-estoque' },

  { module: 'RH', key: 'home', label: 'Home RH', path: '/rh' },
  { module: 'RH', key: 'movimentacoes', label: 'Movimentações', path: '/rh/movimentacoes' },

  { module: 'SGQ', key: 'home', label: 'Home SGQ', path: '/sgq' },
  { module: 'SGQ', key: 'pesquisa-satisfacao', label: 'Pesquisa de satisfação', path: '/sgq/pesquisa-satisfacao' },

  { module: 'Marketing', key: 'home', label: 'Home Marketing', path: '/marketing' },
  { module: 'Marketing', key: 'campanhas', label: 'Calendário Transcamila', path: '/marketing/campanhas' },

  { module: 'Logística', key: 'home', label: 'Home Logística', path: '/logistica' },
  { module: 'Logística', key: 'configuracoes', label: 'Configurações gerais', path: '/logistica/configuracoes' },
] as const;

export type AbaKey = (typeof ABA_ITEMS)[number]['key'];

export function abasDoModulo(module: string) {
  return ABA_ITEMS.filter((item) => item.module === module);
}

/** Rotinas que o admin pode ocultar. Home fica de fora: sempre visível no ambiente. */
export function rotinasConfiguraveisDoModulo(module: string) {
  return abasDoModulo(module).filter((item) => item.key !== HOME_ABA_KEY);
}

export function getAllowedAbas(user: User | null, module: string): Set<string> {
  if (module === 'Indicadores') {
    return getAllowedIndicadores(user) as Set<string>;
  }
  const catalog = abasDoModulo(module).map((item) => item.key as string);
  if (user?.roleId === '1' || catalog.length === 0) return new Set(catalog);
  const selected = (user?.abas?.[module] ?? []).filter((key) => catalog.includes(key));
  if (selected.length === 0) return new Set(catalog);
  const allowed = new Set(selected);
  if (catalog.includes(HOME_ABA_KEY)) allowed.add(HOME_ABA_KEY);
  return allowed;
}

export function userCanSeeAba(user: User | null, module: string, key: string): boolean {
  if (module === 'Indicadores') {
    return getAllowedIndicadores(user).has(key as IndicadorKey);
  }
  return getAllowedAbas(user, module).has(key);
}

export function firstAllowedAbaPath(user: User | null, module: string, fallback: string): string {
  if (module === 'Indicadores') {
    const allowed = getAllowedIndicadores(user);
    if (allowed.size === ALL_INDICADOR_KEYS.length || allowed.size === 0) return fallback;
  }
  const allowed = getAllowedAbas(user, module);
  const first = abasDoModulo(module).find((item) => allowed.has(item.key));
  return first?.path ?? fallback;
}
