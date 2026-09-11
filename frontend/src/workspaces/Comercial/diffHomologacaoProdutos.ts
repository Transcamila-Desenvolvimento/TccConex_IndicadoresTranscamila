import type { ClienteComercialProduto, HomologacaoProdutoEvento } from '../../types/domain';

export type HomologacaoProdutoAlteracaoTipo = 'incluido' | 'removido' | 'alterado';

export type HomologacaoProdutoAlteracao = {
  tipo: HomologacaoProdutoAlteracaoTipo;
  nome: string;
  detalhe: string;
};

type SnapProduto = {
  chave: string;
  nome: string;
  classeRisco: string;
  numeroOnu: string;
  grupoEmbalagem: string;
  fispq: string;
};

const CAMPOS: { key: keyof Omit<SnapProduto, 'chave' | 'nome'>; label: string }[] = [
  { key: 'classeRisco', label: 'Classe' },
  { key: 'numeroOnu', label: 'ONU' },
  { key: 'grupoEmbalagem', label: 'Grupo' },
  { key: 'fispq', label: 'FISPQ' },
];

export const HOMOLOGACAO_ALTERACAO_LABEL: Record<HomologacaoProdutoAlteracaoTipo, string> = {
  incluido: 'Incluído',
  removido: 'Removido',
  alterado: 'Alterado',
};

function texto(value: string) {
  return (value || '').trim() || '—';
}

function snapDe(raw: ClienteComercialProduto | Record<string, unknown>): SnapProduto {
  const id = String(raw.id || raw.produtoId || '');
  const nome = String(raw.nome || '').trim();
  return {
    chave: (id || nome).toLowerCase(),
    nome: nome || 'Produto',
    classeRisco: String(raw.classeRisco || ''),
    numeroOnu: String(raw.numeroOnu || ''),
    grupoEmbalagem: String(raw.grupoEmbalagem || ''),
    fispq: String(raw.fispq || ''),
  };
}

export function diffHomologacaoProdutos(
  atual: ClienteComercialProduto[] | undefined,
  anterior: ClienteComercialProduto[] | undefined,
): HomologacaoProdutoAlteracao[] {
  const novos = (atual || []).map(snapDe);
  const velhos = (anterior || []).map(snapDe);
  if (!velhos.length && !novos.length) return [];
  if (!velhos.length) {
    return novos.map((item) => ({ tipo: 'incluido' as const, nome: item.nome, detalhe: 'Incluído' }));
  }

  const mapaNovo = new Map(novos.map((item) => [item.chave, item]));
  const mapaVelho = new Map(velhos.map((item) => [item.chave, item]));
  const resultado: HomologacaoProdutoAlteracao[] = [];

  for (const item of novos) {
    const antes = mapaVelho.get(item.chave);
    if (!antes) {
      resultado.push({ tipo: 'incluido', nome: item.nome, detalhe: 'Incluído' });
      continue;
    }
    const mudancas = CAMPOS
      .filter((campo) => texto(String(antes[campo.key])) !== texto(String(item[campo.key])))
      .map((campo) => `${campo.label} ${texto(String(antes[campo.key]))} → ${texto(String(item[campo.key]))}`);
    if (antes.nome !== item.nome) {
      mudancas.unshift(`Nome ${antes.nome} → ${item.nome}`);
    }
    if (mudancas.length) {
      resultado.push({ tipo: 'alterado', nome: item.nome, detalhe: mudancas.join(' · ') });
    }
  }

  for (const item of velhos) {
    if (!mapaNovo.has(item.chave)) {
      resultado.push({ tipo: 'removido', nome: item.nome, detalhe: 'Removido' });
    }
  }

  return resultado;
}

export function alteracoesDoEvento(
  eventos: HomologacaoProdutoEvento[],
  indice: number,
): HomologacaoProdutoAlteracao[] {
  const atual = eventos[indice];
  const anterior = eventos[indice + 1];
  return diffHomologacaoProdutos(atual?.produtosSnapshot, anterior?.produtosSnapshot);
}
