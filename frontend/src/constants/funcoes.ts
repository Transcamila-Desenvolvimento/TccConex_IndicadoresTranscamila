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
  {
    module: 'SGQ',
    key: 'criar-pesquisas',
    label: 'Criar pesquisas',
    description: 'Permite registrar novas pesquisas de satisfação (formulário e inclusão em tabela).',
  },
  {
    module: 'SGQ',
    key: 'editar-pesquisas',
    label: 'Editar pesquisas',
    description: 'Permite alterar pesquisas de satisfação já registradas.',
  },
  {
    module: 'SGQ',
    key: 'excluir-pesquisas',
    label: 'Excluir pesquisas',
    description: 'Permite excluir pesquisas de satisfação.',
  },
  {
    module: 'SGQ',
    key: 'importar-pesquisas',
    label: 'Importar pesquisas',
    description: 'Permite importar pesquisas de satisfação a partir de planilha Excel.',
  },
  {
    module: 'Marketing',
    key: 'criar-posts',
    label: 'Criar postagens',
    description: 'Permite registrar novas postagens do Instagram.',
  },
  {
    module: 'Marketing',
    key: 'editar-posts',
    label: 'Editar postagens',
    description: 'Permite alterar e programar postagens do Instagram.',
  },
  {
    module: 'Marketing',
    key: 'excluir-posts',
    label: 'Excluir postagens',
    description: 'Permite excluir postagens do Instagram.',
  },
  {
    module: 'Marketing',
    key: 'publicar-posts',
    label: 'Publicar postagens',
    description: 'Permite vincular a conta Instagram e publicar postagens na rede.',
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
