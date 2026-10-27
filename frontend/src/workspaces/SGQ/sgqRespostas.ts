import type { SgqTipoRespostaOpcao } from '../../types/domain';

export function descreverOpcao(opcao: SgqTipoRespostaOpcao): string {
  const prefixo = opcao.codigo && opcao.codigo !== opcao.texto ? `${opcao.codigo} - ` : '';
  return `${prefixo}${opcao.texto} (${opcao.valor === null ? 'N/A' : `${opcao.valor}%`})`;
}

export function novaOpcao(valor: number | null): SgqTipoRespostaOpcao {
  return { codigo: '', texto: '', valor, exigeJustificativa: false };
}

export function descreverOpcoes(opcoes: SgqTipoRespostaOpcao[]): string {
  return opcoes.map(descreverOpcao).join(', ');
}
