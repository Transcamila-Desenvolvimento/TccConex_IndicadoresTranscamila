/** Ambientes ERP ativos no sistema. */
export const ADMIN_ENVIRONMENT = 'Administração/Manutenção' as const;
export const LEGACY_ADMIN_ENVIRONMENT = 'Administração' as const;

/** Ordem canônica dos ambientes, crescente pelo código oficial (ver ENVIRONMENT_CODES). */
export const ACTIVE_ENVIRONMENTS = [ADMIN_ENVIRONMENT, 'Indicadores', 'Financeiro', 'Compras', 'RH', 'Faturamento', 'SGQ'] as const;

export type ActiveEnvironment = (typeof ACTIVE_ENVIRONMENTS)[number];

/** Código numérico oficial de cada ambiente, usado em vez de siglas (ex.: "00" ao invés de "ADM"). */
export const ENVIRONMENT_CODES: Record<ActiveEnvironment, string> = {
  [ADMIN_ENVIRONMENT]: '00',
  Indicadores: '01',
  Financeiro: '02',
  Compras: '03',
  RH: '04',
  Faturamento: '05',
  SGQ: '06',
};

export function normalizeEnvironment(env: string): string {
  return env === LEGACY_ADMIN_ENVIRONMENT ? ADMIN_ENVIRONMENT : env;
}

export function filterActiveEnvironments(environments: string[] | undefined): ActiveEnvironment[] {
  const allowed = new Set<string>(ACTIVE_ENVIRONMENTS);
  const active = (environments ?? [])
    .map(normalizeEnvironment)
    .filter((env): env is ActiveEnvironment => allowed.has(env));
  return sortByEnvironmentCode(active);
}

/** Ordena ambientes em ordem crescente pelo código oficial (ver ENVIRONMENT_CODES). */
export function sortByEnvironmentCode<T extends ActiveEnvironment>(environments: T[]): T[] {
  return [...environments].sort(
    (a, b) => ENVIRONMENT_CODES[a].localeCompare(ENVIRONMENT_CODES[b]),
  );
}

export function isAdminEnvironment(env: string | null | undefined): boolean {
  return normalizeEnvironment(env ?? '') === ADMIN_ENVIRONMENT;
}
