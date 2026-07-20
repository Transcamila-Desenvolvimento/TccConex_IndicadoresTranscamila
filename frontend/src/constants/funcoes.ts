import type { User } from '../types/domain';

/**
 * Funções extras liberáveis por ambiente para operadores (admin sempre tem todas).
 * Mantém paridade com backend/apps/accounts/constants.py (FUNCOES_POR_AMBIENTE).
 */
export const FUNCAO_ITEMS = [
  {
    module: 'Faturamento',
    key: 'criar-protocolos',
    label: 'Criar protocolos',
    description: 'Permite registrar novos protocolos de envio de NF.',
  },
  {
    module: 'Faturamento',
    key: 'editar-protocolos',
    label: 'Editar protocolos',
    description: 'Permite alterar protocolos já registrados.',
  },
  {
    module: 'Faturamento',
    key: 'excluir-protocolos',
    label: 'Excluir protocolos',
    description: 'Permite excluir protocolos de envio de NF (individual e em lote).',
  },
  {
    module: 'Faturamento',
    key: 'gerenciar-clientes',
    label: 'Gerenciar clientes',
    description: 'Permite cadastrar, editar e excluir clientes de protocolo e suas filiais.',
  },
] as const;

export type FuncaoKey = (typeof FUNCAO_ITEMS)[number]['key'];

export function funcoesDoModulo(module: string) {
  return FUNCAO_ITEMS.filter((item) => item.module === module);
}

export function userHasFuncao(user: User | null, module: string, key: FuncaoKey): boolean {
  if (user?.roleId === '1') return true;
  return (user?.funcoes?.[module] ?? []).includes(key);
}
