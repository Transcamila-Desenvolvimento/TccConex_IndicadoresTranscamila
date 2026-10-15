import type { DocumentoBipagem } from '../../types/domain';

export interface DivisaoLojaBipagem {
  loja: string;
  documentos: DocumentoBipagem[];
  total: number;
}

export interface DivisaoOrigemBipagem {
  origem: string;
  lojas: DivisaoLojaBipagem[];
  total: number;
}

export function formatarTotalBipagem(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function somarTotaisBipagem(valores: number[]): number {
  const centavos = valores.reduce((soma, valor) => soma + Math.round((Number(valor) || 0) * 100), 0);
  return centavos / 100;
}

function ordemTexto(valor: string): string {
  return valor.trim();
}

function ordemEmissao(emissao: string): number {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(emissao.trim());
  if (!match) return Number.MAX_SAFE_INTEGER;
  const tempo = Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return Number.isNaN(tempo) ? Number.MAX_SAFE_INTEGER : tempo;
}

function compararTexto(a: string, b: string): number {
  return ordemTexto(a).localeCompare(ordemTexto(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
}

/**
 * Agrupa a relação por origem e, dentro dela, por loja. Em cada loja, a emissão vai da mais antiga
 * para a mais nova e, na mesma data, o documento vai do menor para o maior número.
 */
export function agruparRelacaoBipagem(documentos: DocumentoBipagem[]): DivisaoOrigemBipagem[] {
  const porOrigem = new Map<string, Map<string, DocumentoBipagem[]>>();
  for (const documento of documentos) {
    const lojas = porOrigem.get(documento.origem) ?? new Map<string, DocumentoBipagem[]>();
    const lista = lojas.get(documento.loja) ?? [];
    lista.push(documento);
    lojas.set(documento.loja, lista);
    porOrigem.set(documento.origem, lojas);
  }

  return [...porOrigem.entries()]
    .sort(([origemA], [origemB]) => compararTexto(origemA, origemB))
    .map(([origem, lojas]) => {
      const divisoes = [...lojas.entries()]
        .sort(([lojaA], [lojaB]) => compararTexto(lojaA, lojaB))
        .map(([loja, itens]) => {
          const ordenados = [...itens].sort((a, b) => {
            const data = ordemEmissao(a.emissao) - ordemEmissao(b.emissao);
            if (data !== 0) return data;
            return compararTexto(a.docto, b.docto);
          });
          return {
            loja,
            documentos: ordenados,
            total: somarTotaisBipagem(ordenados.map((item) => item.total)),
          };
        });
      return {
        origem,
        lojas: divisoes,
        total: somarTotaisBipagem(divisoes.map((divisao) => divisao.total)),
      };
    });
}
