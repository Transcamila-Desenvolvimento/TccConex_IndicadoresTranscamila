import type { User } from '../types/domain';

/**
 * Funções extras liberáveis por ambiente para operadores (admin sempre tem todas).
 * Mantém paridade com backend/apps/accounts/constants.py (FUNCOES_POR_AMBIENTE).
 */
export const FUNCAO_ITEMS = [
  {
    module: 'Faturamento',
    aba: 'envio-nf-cliente',
    key: 'criar-protocolos',
    label: 'Criar protocolos',
    description: 'Permite registrar novos protocolos de envio de NF.',
  },
  {
    module: 'Faturamento',
    aba: 'envio-nf-cliente',
    key: 'editar-protocolos',
    label: 'Editar protocolos',
    description: 'Permite alterar protocolos já registrados.',
  },
  {
    module: 'Faturamento',
    aba: 'envio-nf-cliente',
    key: 'excluir-protocolos',
    label: 'Excluir protocolos',
    description: 'Permite excluir protocolos de envio de NF (individual e em lote).',
  },
  {
    module: 'Faturamento',
    aba: 'cadastro-clientes',
    key: 'gerenciar-clientes',
    label: 'Cadastrar e editar',
    description: 'Permite cadastrar, editar e excluir clientes de protocolo e suas filiais.',
  },
  {
    module: 'SGQ',
    aba: 'pesquisa-satisfacao',
    key: 'criar-pesquisas',
    label: 'Criar',
    description: 'Permite registrar novas pesquisas de satisfação (formulário e inclusão em tabela).',
  },
  {
    module: 'SGQ',
    aba: 'pesquisa-satisfacao',
    key: 'editar-pesquisas',
    label: 'Editar',
    description: 'Permite alterar pesquisas de satisfação já registradas.',
  },
  {
    module: 'SGQ',
    aba: 'pesquisa-satisfacao',
    key: 'excluir-pesquisas',
    label: 'Excluir',
    description: 'Permite excluir pesquisas de satisfação.',
  },
  {
    module: 'SGQ',
    aba: 'pesquisa-satisfacao',
    key: 'importar-pesquisas',
    label: 'Importar planilha',
    description: 'Permite importar pesquisas de satisfação a partir de planilha Excel.',
  },
  {
    module: 'SGQ',
    aba: 'pesquisa-satisfacao',
    key: 'gerenciar-escopos',
    label: 'Gerenciar escopos',
    description: 'Permite cadastrar, editar, ocultar e excluir escopos e opções da análise nas pesquisas de satisfação.',
  },
  {
    module: 'Marketing',
    aba: 'campanhas',
    key: 'criar-campanhas',
    label: 'Criar',
    description: 'Permite registrar novas campanhas no calendário de marketing.',
  },
  {
    module: 'Marketing',
    aba: 'campanhas',
    key: 'editar-campanhas',
    label: 'Editar',
    description: 'Permite alterar campanhas e movê-las no kanban.',
  },
  {
    module: 'Marketing',
    aba: 'campanhas',
    key: 'excluir-campanhas',
    label: 'Excluir',
    description: 'Permite excluir campanhas do calendário.',
  },
  {
    module: 'Frota',
    aba: 'cadastro-veiculos',
    key: 'gerenciar-veiculos',
    label: 'Cadastrar e editar',
    description: 'Permite cadastrar, editar e excluir veículos da frota.',
  },
  {
    module: 'Frota',
    aba: 'cadastro-condutores',
    key: 'gerenciar-condutores',
    label: 'Cadastrar e editar',
    description: 'Permite cadastrar, editar e excluir condutores da frota.',
  },
  {
    module: 'Frota',
    aba: 'custos-frota',
    key: 'gerenciar-custos-frota',
    label: 'Importar relatórios',
    description: 'Permite importar planilhas de manutenção e abastecimento para o indicador de custos da frota.',
  },
] as const;

export type FuncaoKey = (typeof FUNCAO_ITEMS)[number]['key'];

export function funcoesDoModulo(module: string) {
  return FUNCAO_ITEMS.filter((item) => item.module === module);
}

export function funcoesDaAba(module: string, aba: string) {
  return FUNCAO_ITEMS.filter((item) => item.module === module && item.aba === aba);
}

export function userHasFuncao(user: User | null, module: string, key: FuncaoKey): boolean {
  if (user?.roleId === '1') return true;
  return (user?.funcoes?.[module] ?? []).includes(key);
}
