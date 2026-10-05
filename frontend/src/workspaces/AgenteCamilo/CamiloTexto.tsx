import React from 'react';

type Bloco =
  | { tipo: 'p'; texto: string }
  | { tipo: 'h'; texto: string }
  | { tipo: 'ul' | 'ol'; itens: string[] }
  | { tipo: 'tabela'; cabecalho: string[]; linhas: string[][] };

function celulas(linha: string): string[] {
  return linha.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((celula) => celula.trim());
}

function ehTabela(linha: string): boolean {
  return linha.trim().split('|').length >= 3;
}

function ehSeparador(linha: string): boolean {
  const texto = linha.trim();
  return texto.includes('|') && texto.includes('---') && /^[\s|:-]+$/.test(texto);
}

function itemLista(linha: string): { ordenada: boolean; texto: string } | null {
  const achado = /^([-*]|\d+\.)\s+(.+)$/.exec(linha.trim());
  if (!achado) return null;
  return { ordenada: /^\d+\./.test(achado[1]), texto: achado[2] };
}

function blocos(fonte: string): Bloco[] {
  const linhas = fonte.replace(/\r\n/g, '\n').split('\n');
  const saida: Bloco[] = [];
  let indice = 0;

  while (indice < linhas.length) {
    while (indice < linhas.length && !linhas[indice].trim()) indice += 1;
    if (indice >= linhas.length) break;

    const titulo = /^#{1,3}\s+(.+)$/.exec(linhas[indice].trim());
    if (titulo) {
      saida.push({ tipo: 'h', texto: titulo[1] });
      indice += 1;
      continue;
    }

    if (ehTabela(linhas[indice]) && indice + 1 < linhas.length && ehSeparador(linhas[indice + 1])) {
      const cabecalho = celulas(linhas[indice]);
      indice += 2;
      const corpo: string[][] = [];
      while (indice < linhas.length && linhas[indice].trim() && ehTabela(linhas[indice]) && !ehSeparador(linhas[indice])) {
        corpo.push(celulas(linhas[indice]));
        indice += 1;
      }
      saida.push({ tipo: 'tabela', cabecalho, linhas: corpo });
      continue;
    }

    const lista = itemLista(linhas[indice]);
    if (lista) {
      const ordenada = lista.ordenada;
      const itens = [lista.texto];
      indice += 1;
      while (indice < linhas.length) {
        const proximo = itemLista(linhas[indice]);
        if (!proximo || proximo.ordenada !== ordenada) break;
        itens.push(proximo.texto);
        indice += 1;
      }
      saida.push({ tipo: ordenada ? 'ol' : 'ul', itens });
      continue;
    }

    const paragrafo: string[] = [];
    while (indice < linhas.length && linhas[indice].trim()) {
      const candidata = linhas[indice];
      const pareceTabela = ehTabela(candidata) && indice + 1 < linhas.length && ehSeparador(linhas[indice + 1]);
      if (paragrafo.length && (/^#{1,3}\s+/.test(candidata.trim()) || itemLista(candidata) || pareceTabela)) break;
      paragrafo.push(candidata.trim());
      indice += 1;
    }
    if (paragrafo.length) saida.push({ tipo: 'p', texto: paragrafo.join(' ') });
  }

  return saida;
}

function trechos(texto: string, chave: string): React.ReactNode[] {
  const partes: React.ReactNode[] = [];
  const marca = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let cursor = 0;
  let ordem = 0;
  for (const achado of texto.matchAll(marca)) {
    const inicio = achado.index ?? 0;
    if (inicio > cursor) partes.push(texto.slice(cursor, inicio));
    if (achado[1] != null) partes.push(<strong key={`${chave}-n${ordem}`}>{achado[1]}</strong>);
    else if (achado[2] != null) partes.push(<em key={`${chave}-i${ordem}`}>{achado[2]}</em>);
    else partes.push(<code key={`${chave}-c${ordem}`}>{achado[3]}</code>);
    cursor = inicio + achado[0].length;
    ordem += 1;
  }
  if (cursor < texto.length) partes.push(texto.slice(cursor));
  return partes;
}

const CamiloTexto: React.FC<{ texto: string }> = ({ texto }) => {
  const itens = blocos(texto);
  if (!itens.length) return <p>{texto}</p>;

  return (
    <div className="camilo-md">
      {itens.map((bloco, indice) => {
        const chave = `b${indice}`;
        if (bloco.tipo === 'h') return <h3 key={chave}>{trechos(bloco.texto, chave)}</h3>;
        if (bloco.tipo === 'ul' || bloco.tipo === 'ol') {
          const Tag = bloco.tipo;
          return (
            <Tag key={chave}>
              {bloco.itens.map((item, itemIndice) => (
                <li key={`${chave}-${itemIndice}`}>{trechos(item, `${chave}-${itemIndice}`)}</li>
              ))}
            </Tag>
          );
        }
        if (bloco.tipo === 'tabela') {
          return (
            <div key={chave} className="camilo-md-table">
              <table>
                <thead>
                  <tr>
                    {bloco.cabecalho.map((celula, celulaIndice) => (
                      <th key={`${chave}-h${celulaIndice}`}>{trechos(celula, `${chave}-h${celulaIndice}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bloco.linhas.map((linha, linhaIndice) => (
                    <tr key={`${chave}-r${linhaIndice}`}>
                      {linha.map((celula, celulaIndice) => (
                        <td key={`${chave}-r${linhaIndice}-c${celulaIndice}`}>
                          {trechos(celula, `${chave}-r${linhaIndice}-c${celulaIndice}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <p key={chave}>{trechos(bloco.texto, chave)}</p>;
      })}
    </div>
  );
};

export default CamiloTexto;
