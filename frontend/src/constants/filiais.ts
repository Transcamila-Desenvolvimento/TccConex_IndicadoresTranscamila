/** Filiais operacionais do ERP. Mantém paridade com backend/apps/accounts/constants.py. */
export const ALL_BRANCHES = ['Ibiporã (Matriz)', 'Rondonópolis', 'Paranaguá'] as const;

/**
 * Filiais liberáveis por módulo. Módulos ausentes usam ALL_BRANCHES (padrão).
 * SGQ e Frota operam só nas unidades Ibiporã e Rondonópolis.
 * Mantém paridade com backend/apps/accounts/constants.py (MODULE_BRANCHES).
 */
export const MODULE_BRANCHES: Record<string, readonly string[]> = {
  SGQ: ['Ibiporã (Matriz)', 'Rondonópolis'],
  Frota: ['Ibiporã (Matriz)', 'Rondonópolis'],
};

export function branchesForModule(module: string): readonly string[] {
  return MODULE_BRANCHES[module] ?? ALL_BRANCHES;
}

/** Filiais do cadastro do quadro de funcionários. Porto Alegre entra só aqui. */
export const FILIAIS_QUADRO = ['Ibiporã (Matriz)', 'Rondonópolis', 'Paranaguá', 'Porto Alegre'] as const;

export const DEPARTAMENTOS_QUADRO = ['Administrativo', 'Logística', 'Frota', 'Gerencia', 'Motoristas'] as const;
