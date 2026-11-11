import type { User } from '../types/domain';
import { environmentRequiresFilial } from './environments';
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
  { module: 'Financeiro', key: 'caixinha', label: 'Caixinha', path: '/financeiro/caixinha' },

  { module: 'Faturamento', key: 'home', label: 'Home Faturamento', path: '/faturamento' },
  { module: 'Faturamento', key: 'envio-nf-cliente', label: 'Envio NF Cliente', path: '/faturamento/protocolos' },
  { module: 'Faturamento', key: 'cadastro-clientes', label: 'Cadastro cliente', path: '/faturamento/cadastros/clientes' },
  { module: 'Faturamento', key: 'controle-nds', label: 'Controle de NDs', path: '/faturamento/controle-nds' },

  { module: 'Compras', key: 'home', label: 'Home Compras', path: '/compras' },
  { module: 'Compras', key: 'controle-estoque', label: 'Controle de estoque', path: '/compras/controle-estoque' },
  { module: 'Compras', key: 'controle-uniformes', label: 'Controle Uniformes', path: '/compras/controle-uniformes' },
  { module: 'Compras', key: 'cadastro-consumidores', label: 'Cadastro consumidores', path: '/compras/cadastros/consumidores' },
  { module: 'Compras', key: 'cadastro-medidas', label: 'Cadastro de medidas', path: '/compras/cadastros/medidas' },
  { module: 'Compras', key: 'cadastro-fornecedores', label: 'Cadastro fornecedores', path: '/compras/cadastros/fornecedores' },

  { module: 'RH', key: 'home', label: 'Home RH', path: '/rh' },
  { module: 'RH', key: 'movimentacoes', label: 'Movimentações', path: '/rh/movimentacoes' },
  { module: 'RH', key: 'quadro-funcionarios', label: 'Quadro de Funcionários', path: '/rh/quadro-funcionarios' },
  { module: 'RH', key: 'documentos', label: 'Matriz', path: '/rh/documentos' },

  { module: 'SGQ', key: 'home', label: 'Home SGQ', path: '/sgq' },
  { module: 'SGQ', key: 'pesquisa-satisfacao', label: 'Pesquisa de satisfação', path: '/sgq/pesquisa-satisfacao' },
  { module: 'SGQ', key: 'matriz', label: 'Documentos', path: '/sgq/matriz/documentos' },
  { module: 'SGQ', key: 'matriz-ecossistema', label: 'Ecossistema SGQ', path: '/sgq/matriz/ecossistema' },
  { module: 'SGQ', key: 'auditorias-visao-geral', label: 'Visão geral', path: '/sgq/auditorias/visao-geral' },
  { module: 'SGQ', key: 'auditorias', label: 'Auditorias', path: '/sgq/auditorias/auditorias' },
  { module: 'SGQ', key: 'auditorias-minhas-acoes', label: 'Questionário', path: '/sgq/auditorias/minhas-acoes' },
  { module: 'SGQ', key: 'auditorias-normas', label: 'Normas', path: '/sgq/auditorias/normas' },
  { module: 'SGQ', key: 'auditorias-tipos-resposta', label: 'Tipos de respostas', path: '/sgq/auditorias/tipos-resposta' },
  { module: 'SGQ', key: 'auditorias-categorias', label: 'Categorias', path: '/sgq/auditorias/categorias' },
  { module: 'SGQ', key: 'sipoc', label: 'SIPOC', path: '/sgq/sipoc' },

  { module: 'Marketing', key: 'home', label: 'Home Marketing', path: '/marketing' },
  { module: 'Marketing', key: 'campanhas', label: 'Calendário Transcamila', path: '/marketing/campanhas' },

  { module: 'Logística', key: 'home', label: 'Home Logística', path: '/logistica' },
  { module: 'Logística', key: 'configuracoes', label: 'Configurações gerais', path: '/logistica/configuracoes' },

  { module: 'Frota', key: 'home', label: 'Home Frota', path: '/frota' },
  { module: 'Frota', key: 'olho-vivo', label: 'Olho vivo na estrada', path: '/frota/questionarios/olho-vivo' },
  { module: 'Frota', key: 'gestao-desempenho-ocorrencias', label: 'Ocorrências', path: '/frota/gestao-desempenho/ocorrencias' },
  { module: 'Frota', key: 'gestao-desempenho-criterios', label: 'Critérios', path: '/frota/gestao-desempenho/criterios' },
  { module: 'Frota', key: 'gestao-desempenho-parametros', label: 'Parâmetros', path: '/frota/gestao-desempenho/parametros' },
  { module: 'Frota', key: 'tccconex-motoristas-usuarios', label: 'Usuários', path: '/frota/tccconex-motoristas/usuarios' },

  { module: 'Comercial', key: 'home', label: 'Home Comercial', path: '/comercial' },
  { module: 'Comercial', key: 'cadastro-clientes', label: 'Clientes', path: '/comercial/cadastros/clientes' },
  { module: 'Comercial', key: 'cadastro-tabela-frete', label: 'Tabela frete', path: '/comercial/cadastros/tabela-frete' },
  { module: 'Comercial', key: 'cadastro-generalidades', label: 'Generalidades', path: '/comercial/cadastros/generalidades' },
  { module: 'Comercial', key: 'cadastro-icms-ufs', label: 'ICMS por UF', path: '/comercial/cadastros/icms-ufs' },
  { module: 'Comercial', key: 'cadastro-parametros', label: 'Parâmetros', path: '/comercial/parametros/prazos' },
  { module: 'Comercial', key: 'cadastro-produtos', label: 'Composição de produtos', path: '/comercial/cadastros/produtos' },
  { module: 'Comercial', key: 'propostas-comerciais', label: 'Propostas comerciais', path: '/comercial/propostas' },
  { module: 'Comercial', key: 'validacao-clientes', label: 'Validação clientes', path: '/comercial/validacao-clientes' },

  { module: 'CamiloIA', key: 'home', label: 'Chat', path: '/agente-camilo' },
] as const;

export type AbaKey = (typeof ABA_ITEMS)[number]['key'];

export function abasDoModulo(module: string) {
  return ABA_ITEMS.filter((item) => item.module === module);
}

/** Rotinas que o admin pode ocultar. Home fica de fora: sempre visível no ambiente. */
export function rotinasConfiguraveisDoModulo(module: string) {
  return abasDoModulo(module).filter((item) => item.key !== HOME_ABA_KEY);
}

/** Submenus do admin. Rotinas fora da lista aparecem soltas, sem grupo. */
const DETALHE_DA_ROTINA: Record<string, Record<string, string>> = {};

export function detalheDaRotina(module: string, key: string): string {
  return DETALHE_DA_ROTINA[module]?.[key] ?? '';
}

const GRUPOS_DE_ROTINA: Record<string, { titulo: string; keys: string[] }[]> = {
  SGQ: [
    { titulo: '', keys: ['pesquisa-satisfacao'] },
    { titulo: 'Matriz de conhecimento', keys: ['matriz', 'matriz-ecossistema'] },
    { titulo: 'Auditorias', keys: ['auditorias-visao-geral', 'auditorias', 'auditorias-minhas-acoes', 'auditorias-normas', 'auditorias-tipos-resposta', 'auditorias-categorias'] },
    { titulo: 'SIPOC', keys: ['sipoc'] },
  ],
  Frota: [
    { titulo: 'Questionários', keys: ['olho-vivo'] },
    { titulo: 'Gestão de desempenho', keys: ['gestao-desempenho-ocorrencias', 'gestao-desempenho-criterios', 'gestao-desempenho-parametros'] },
    { titulo: 'TccConex motoristas', keys: ['tccconex-motoristas-usuarios'] },
  ],
  Faturamento: [
    { titulo: 'Envio', keys: ['envio-nf-cliente', 'controle-nds'] },
    { titulo: 'Cadastros', keys: ['cadastro-clientes'] },
  ],
  Compras: [
    { titulo: 'Controle', keys: ['controle-estoque', 'controle-uniformes'] },
    { titulo: 'Cadastros', keys: ['cadastro-consumidores', 'cadastro-medidas', 'cadastro-fornecedores'] },
  ],
  Comercial: [
    { titulo: 'Cadastros', keys: ['cadastro-clientes', 'cadastro-tabela-frete', 'cadastro-generalidades', 'cadastro-icms-ufs', 'cadastro-parametros', 'cadastro-produtos'] },
    { titulo: 'Propostas', keys: ['propostas-comerciais'] },
    { titulo: 'Validação', keys: ['validacao-clientes'] },
  ],
};

export function blocosDeRotina(module: string) {
  const items = rotinasConfiguraveisDoModulo(module);
  const grupos = GRUPOS_DE_ROTINA[module];
  if (!grupos) return [{ titulo: '', items }];
  const usados = new Set<string>();
  const blocos = grupos.flatMap((grupo) => {
    const doGrupo = items.filter((item) => grupo.keys.includes(item.key));
    doGrupo.forEach((item) => usados.add(item.key));
    return doGrupo.length ? [{ titulo: grupo.titulo, items: doGrupo }] : [];
  });
  const soltas = items.filter((item) => !usados.has(item.key));
  if (soltas.length) blocos.push({ titulo: '', items: soltas });
  return blocos;
}

function abaVisivelNaFilial(user: User | null, module: string, key: string, filial?: string | null) {
  if (!filial || user?.roleId === '1' || !environmentRequiresFilial(module)) return true;
  const restritas = user?.abaFiliais?.[module]?.[key] ?? [];
  if (restritas.length === 0) return true;
  return restritas.includes(filial);
}

function semAuditoriasBloqueadas(user: User | null, module: string, allowed: Set<string>): Set<string> {
  if (module !== 'SGQ' || user?.sgqAuditoriasLiberadas === true || user?.roleId === '1') return allowed;
  const explicitas = new Set(user?.abas?.SGQ ?? []);
  return new Set([...allowed].filter((key) => !key.startsWith('auditorias') || explicitas.has(key)));
}

function semSipocBloqueado(user: User | null, module: string, allowed: Set<string>): Set<string> {
  if (module !== 'SGQ' || user?.sgqSipocLiberado === true) return allowed;
  const explicitas = new Set(user?.abas?.SGQ ?? []);
  if (explicitas.has('sipoc')) return allowed;
  return new Set([...allowed].filter((key) => key !== 'sipoc'));
}

export function getAllowedAbas(user: User | null, module: string): Set<string> {
  if (module === 'Indicadores') {
    return getAllowedIndicadores(user) as Set<string>;
  }
  const catalog = abasDoModulo(module).map((item) => item.key as string);
  if (user?.roleId === '1' || catalog.length === 0) {
    return semSipocBloqueado(user, module, semAuditoriasBloqueadas(user, module, new Set(catalog)));
  }
  const selected = (user?.abas?.[module] ?? []).filter((key) => catalog.includes(key));
  if (selected.length === 0) {
    return semSipocBloqueado(user, module, semAuditoriasBloqueadas(user, module, new Set(catalog)));
  }
  const allowed = new Set(selected);
  if (catalog.includes(HOME_ABA_KEY)) allowed.add(HOME_ABA_KEY);
  return semSipocBloqueado(user, module, semAuditoriasBloqueadas(user, module, allowed));
}

export function userCanSeeAba(user: User | null, module: string, key: string, filial?: string | null): boolean {
  if (module === 'Indicadores') {
    return getAllowedIndicadores(user).has(key as IndicadorKey);
  }
  return getAllowedAbas(user, module).has(key) && abaVisivelNaFilial(user, module, key, filial);
}

export function firstAllowedAbaPath(user: User | null, module: string, fallback: string, filial?: string | null): string {
  if (module === 'Indicadores') {
    const allowed = getAllowedIndicadores(user);
    if (allowed.size === ALL_INDICADOR_KEYS.length || allowed.size === 0) return fallback;
  }
  const allowed = getAllowedAbas(user, module);
  const first = abasDoModulo(module).find((item) => allowed.has(item.key) && abaVisivelNaFilial(user, module, item.key, filial));
  return first?.path ?? fallback;
}
