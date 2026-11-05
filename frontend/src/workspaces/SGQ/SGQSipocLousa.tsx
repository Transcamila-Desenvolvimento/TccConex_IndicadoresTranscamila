import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { SgqSipocEsquema, SgqSipocNo, SgqSipocTipoNo } from '../../types/domain';

const MEDIDAS: Record<SgqSipocTipoNo, { w: number; h: number }> = {
  fornecedor: { w: 168, h: 58 },
  entrada: { w: 176, h: 82 },
  inicio: { w: 138, h: 64 },
  etapa: { w: 156, h: 58 },
  fim: { w: 138, h: 64 },
  saida: { w: 176, h: 82 },
  cliente: { w: 150, h: 58 },
  base: { w: 136, h: 92 },
};

const ROTULOS: Record<SgqSipocTipoNo, string> = {
  fornecedor: 'Fornecedor',
  entrada: 'Entrada',
  inicio: 'Início',
  etapa: 'Etapa',
  fim: 'Fim',
  saida: 'Saída',
  cliente: 'Cliente',
  base: 'Base de dados',
};

const AJUDA: Record<SgqSipocTipoNo, string> = {
  fornecedor: 'Quem fornece a entrada',
  entrada: 'O que entra no processo',
  inicio: 'Onde o processo começa',
  etapa: 'Uma ação do processo',
  fim: 'Onde o processo termina',
  saida: 'O que o processo entrega',
  cliente: 'Quem recebe a saída',
  base: 'Onde o dado fica registrado',
};

const ORDEM: SgqSipocTipoNo[] = ['fornecedor', 'entrada', 'inicio', 'etapa', 'fim', 'saida', 'cliente', 'base'];
type LadoPorta = 'n' | 'e' | 's' | 'w';
const PORTAS: { lado: LadoPorta; x: (w: number, h: number) => number; y: (w: number, h: number) => number }[] = [
  { lado: 'n', x: (w) => w / 2, y: () => 0 },
  { lado: 'e', x: (w) => w, y: (_w, h) => h / 2 },
  { lado: 's', x: (w) => w / 2, y: (_w, h) => h },
  { lado: 'w', x: () => 0, y: (_w, h) => h / 2 },
];

const FONTE = '12px "Segoe UI", sans-serif';
const ALTURA_LINHA = 15;

let medidaTexto: CanvasRenderingContext2D | null = null;

function larguraTexto(texto: string) {
  if (typeof document === 'undefined') return texto.length * 7;
  if (!medidaTexto) medidaTexto = document.createElement('canvas').getContext('2d');
  if (!medidaTexto) return texto.length * 7;
  medidaTexto.font = FONTE;
  return medidaTexto.measureText(texto).width;
}

function larguraUtil(tipo: SgqSipocTipoNo, largura: number) {
  if (tipo === 'entrada' || tipo === 'saida') return largura - 46;
  if (tipo === 'inicio' || tipo === 'fim') return largura - 36;
  if (tipo === 'fornecedor' || tipo === 'cliente') return largura - 32;
  if (tipo === 'base') return largura - 28;
  return largura - 24;
}

function quebrar(texto: string, limite: number) {
  const linhas: string[] = [];
  const maximo = Math.max(48, limite);
  for (const paragrafo of (texto || '').split('\n')) {
    const palavras = paragrafo.split(/\s+/).filter(Boolean);
    if (!palavras.length) {
      linhas.push('');
      continue;
    }
    let atual = '';
    const guardar = (palavra: string) => {
      if (larguraTexto(palavra) <= maximo) return palavra;
      let pedaco = '';
      for (const letra of palavra) {
        if (larguraTexto(pedaco + letra) <= maximo) pedaco += letra;
        else {
          if (pedaco) linhas.push(pedaco);
          pedaco = letra;
        }
      }
      return pedaco;
    };
    for (const palavra of palavras) {
      const candidato = atual ? `${atual} ${palavra}` : palavra;
      if (larguraTexto(candidato) <= maximo) {
        atual = candidato;
        continue;
      }
      if (atual) linhas.push(atual);
      atual = guardar(palavra);
    }
    if (atual) linhas.push(atual);
  }
  return linhas.length ? linhas : [''];
}

function caixa(no: SgqSipocNo) {
  const base = MEDIDAS[no.tipo];
  let largura = base.w;
  let linhas = quebrar(no.texto, larguraUtil(no.tipo, largura));
  if (linhas.length > 3) {
    largura = Math.min(280, Math.max(base.w, 240));
    linhas = quebrar(no.texto, larguraUtil(no.tipo, largura));
  }
  const folga = no.tipo === 'base' ? 36 : 28;
  const altura = Math.max(base.h, linhas.length * ALTURA_LINHA + folga);
  return { w: largura, h: altura, linhas };
}

function noNoPonto(lista: SgqSipocNo[], ponto: { x: number; y: number }, ignorar?: string) {
  for (let indice = lista.length - 1; indice >= 0; indice -= 1) {
    const no = lista[indice];
    if (no.id === ignorar) continue;
    const medida = caixa(no);
    if (
      ponto.x >= no.x - 18
      && ponto.x <= no.x + medida.w + 18
      && ponto.y >= no.y - 18
      && ponto.y <= no.y + medida.h + 18
    ) return no.id;
  }
  return null;
}

function portaMaisProxima(no: SgqSipocNo, ponto: { x: number; y: number }): LadoPorta {
  const medida = caixa(no);
  let melhor: LadoPorta = 'e';
  let distancia = Infinity;
  PORTAS.forEach((porta) => {
    const atual = Math.hypot(ponto.x - (no.x + porta.x(medida.w, medida.h)), ponto.y - (no.y + porta.y(medida.w, medida.h)));
    if (atual < distancia) {
      distancia = atual;
      melhor = porta.lado;
    }
  });
  return melhor;
}

function ladoValido(valor: unknown): valor is LadoPorta {
  return valor === 'n' || valor === 'e' || valor === 's' || valor === 'w';
}

function pontoPorta(no: SgqSipocNo, lado: LadoPorta) {
  const medida = caixa(no);
  const porta = PORTAS.find((item) => item.lado === lado) ?? PORTAS[1];
  return { x: no.x + porta.x(medida.w, medida.h), y: no.y + porta.y(medida.w, medida.h) };
}

function centro(no: SgqSipocNo) {
  const medida = caixa(no);
  return { x: no.x + medida.w / 2, y: no.y + medida.h / 2 };
}

function limites(no: SgqSipocNo) {
  const medida = caixa(no);
  return { l: no.x, r: no.x + medida.w, t: no.y, b: no.y + medida.h };
}

function desceNaLateral(pontos: { x: number; y: number }[], no: SgqSipocNo) {
  const box = limites(no);
  for (let indice = 1; indice < pontos.length; indice += 1) {
    const anterior = pontos[indice - 1];
    const atual = pontos[indice];
    if (Math.abs(anterior.x - atual.x) > 1) continue;
    const x = anterior.x;
    const aoLado = (x > box.r && x <= box.r + 36) || (x < box.l && x >= box.l - 36);
    if (!aoLado) continue;
    const y1 = Math.min(anterior.y, atual.y);
    const y2 = Math.max(anterior.y, atual.y);
    if (Math.min(y2, box.b) - Math.max(y1, box.t) > 12) return true;
  }
  return false;
}

function paresDePorta(origem: SgqSipocNo, destino: SgqSipocNo) {
  const a = limites(origem);
  const b = limites(destino);
  const folga: Record<LadoPorta, number> = {
    s: b.t - a.b,
    n: a.t - b.b,
    e: b.l - a.r,
    w: a.l - b.r,
  };
  const saidas = (['s', 'n', 'e', 'w'] as LadoPorta[])
    .filter((lado) => folga[lado] > -4)
    .sort((um, outro) => folga[outro] - folga[um]);
  if (!saidas.length) {
    const dx = (b.l + b.r) / 2 - (a.l + a.r) / 2;
    const dy = (b.t + b.b) / 2 - (a.t + a.b) / 2;
    const lado: LadoPorta = Math.abs(dy) >= Math.abs(dx) ? (dy >= 0 ? 's' : 'n') : (dx >= 0 ? 'e' : 'w');
    saidas.push(lado);
  }
  const meioOrigem = { x: (a.l + a.r) / 2, y: (a.t + a.b) / 2 };
  const pares: { saida: LadoPorta; entrada: LadoPorta }[] = [];
  saidas.forEach((saida) => {
    const entradas: LadoPorta[] = [];
    if (meioOrigem.x <= b.l + 4) entradas.push('w');
    if (meioOrigem.x >= b.r - 4) entradas.push('e');
    if (meioOrigem.y <= b.t + 4) entradas.push('n');
    if (meioOrigem.y >= b.b - 4) entradas.push('s');
    const oposto: LadoPorta = ({ n: 's', s: 'n', e: 'w', w: 'e' } as const)[saida];
    entradas.push(oposto);
    [...new Set(entradas)].forEach((entrada) => pares.push({ saida, entrada }));
  });
  return pares;
}

function enxugar(pontos: { x: number; y: number }[]) {
  const saida = [pontos[0]];
  pontos.slice(1).forEach((ponto) => {
    const ultimo = saida[saida.length - 1];
    if (Math.abs(ultimo.x - ponto.x) < 0.8 && Math.abs(ultimo.y - ponto.y) < 0.8) return;
    if (saida.length >= 2) {
      const anterior = saida[saida.length - 2];
      const mesmaColuna = Math.abs(anterior.x - ultimo.x) < 0.8 && Math.abs(ultimo.x - ponto.x) < 0.8;
      const mesmaLinha = Math.abs(anterior.y - ultimo.y) < 0.8 && Math.abs(ultimo.y - ponto.y) < 0.8;
      if (mesmaColuna || mesmaLinha) {
        saida[saida.length - 1] = ponto;
        return;
      }
    }
    saida.push(ponto);
  });
  return saida;
}

function cruzaRetangulo(
  a: { x: number; y: number },
  b: { x: number; y: number },
  ret: { x: number; y: number; w: number; h: number },
) {
  const x1 = Math.min(a.x, b.x);
  const x2 = Math.max(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const y2 = Math.max(a.y, b.y);
  if (Math.abs(a.y - b.y) < 1) {
    return a.y > ret.y && a.y < ret.y + ret.h && x2 > ret.x && x1 < ret.x + ret.w;
  }
  if (Math.abs(a.x - b.x) < 1) {
    return a.x > ret.x && a.x < ret.x + ret.w && y2 > ret.y && y1 < ret.y + ret.h;
  }
  return true;
}

function obstaculosDe(nos: SgqSipocNo[]) {
  return nos.map((no) => {
    const medida = caixa(no);
    const margem = 14;
    return { x: no.x - margem, y: no.y - margem, w: medida.w + margem * 2, h: medida.h + margem * 2 };
  });
}

function livre(pontos: { x: number; y: number }[], obstaculos: { x: number; y: number; w: number; h: number }[]) {
  for (let indice = 1; indice < pontos.length; indice += 1) {
    if (obstaculos.some((ret) => cruzaRetangulo(pontos[indice - 1], pontos[indice], ret))) return false;
  }
  return true;
}

function vetorPorta(lado: LadoPorta) {
  if (lado === 'e') return { x: 1, y: 0 };
  if (lado === 'w') return { x: -1, y: 0 };
  if (lado === 's') return { x: 0, y: 1 };
  return { x: 0, y: -1 };
}

function arredondar(valor: number) {
  return Math.round(valor * 2) / 2;
}

function pontoArredondado(ponto: { x: number; y: number }) {
  return { x: arredondar(ponto.x), y: arredondar(ponto.y) };
}

function buscaOrtogonal(
  inicio: { x: number; y: number },
  fim: { x: number; y: number },
  bloqueios: { x: number; y: number; w: number; h: number }[],
) {
  const xs = [...new Set([inicio.x, fim.x, ...bloqueios.flatMap((ret) => [ret.x, arredondar(ret.x + ret.w)])])].sort((um, outro) => um - outro);
  const ys = [...new Set([inicio.y, fim.y, ...bloqueios.flatMap((ret) => [ret.y, arredondar(ret.y + ret.h)])])].sort((um, outro) => um - outro);
  const coluna = new Map(xs.map((valor, indice) => [valor, indice]));
  const linha = new Map(ys.map((valor, indice) => [valor, indice]));
  const origemI = coluna.get(inicio.x);
  const origemJ = linha.get(inicio.y);
  const destinoI = coluna.get(fim.x);
  const destinoJ = linha.get(fim.y);
  if (origemI == null || origemJ == null || destinoI == null || destinoJ == null) return [];

  const direcoes = [
    { d: 1, di: 1, dj: 0 },
    { d: 2, di: -1, dj: 0 },
    { d: 3, di: 0, dj: 1 },
    { d: 4, di: 0, dj: -1 },
  ];
  type Passo = { i: number; j: number; d: number; g: number; f: number; prev: number };
  const abertos: Passo[] = [{
    i: origemI,
    j: origemJ,
    d: 0,
    g: 0,
    f: Math.abs(fim.x - inicio.x) + Math.abs(fim.y - inicio.y),
    prev: -1,
  }];
  const vistos = new Set<string>();
  const veio: Passo[] = [];

  while (abertos.length) {
    let melhor = 0;
    for (let indice = 1; indice < abertos.length; indice += 1) {
      if (abertos[indice].f < abertos[melhor].f) melhor = indice;
    }
    const atual = abertos.splice(melhor, 1)[0];
    const marca = `${atual.i}:${atual.j}:${atual.d}`;
    if (vistos.has(marca)) continue;
    vistos.add(marca);
    const id = veio.length;
    veio.push(atual);
    if (atual.i === destinoI && atual.j === destinoJ) {
      const caminho: { x: number; y: number }[] = [];
      let cursor = id;
      while (cursor >= 0) {
        caminho.push({ x: xs[veio[cursor].i], y: ys[veio[cursor].j] });
        cursor = veio[cursor].prev;
      }
      return caminho.reverse();
    }
    direcoes.forEach((direcao) => {
      const proximaColuna = atual.i + direcao.di;
      const proximaLinha = atual.j + direcao.dj;
      if (proximaColuna < 0 || proximaLinha < 0 || proximaColuna >= xs.length || proximaLinha >= ys.length) return;
      const de = { x: xs[atual.i], y: ys[atual.j] };
      const para = { x: xs[proximaColuna], y: ys[proximaLinha] };
      if (bloqueios.some((ret) => cruzaRetangulo(de, para, ret))) return;
      const distancia = Math.abs(para.x - de.x) + Math.abs(para.y - de.y);
      const curva = atual.d !== 0 && atual.d !== direcao.d ? 42 : 0;
      const g = atual.g + distancia + curva;
      abertos.push({
        i: proximaColuna,
        j: proximaLinha,
        d: direcao.d,
        g,
        f: g + Math.abs(fim.x - para.x) + Math.abs(fim.y - para.y),
        prev: id,
      });
    });
  }
  return [];
}

function pontasDaRota(origem: SgqSipocNo, destino: SgqSipocNo, saida: LadoPorta, entrada: LadoPorta) {
  const a = pontoArredondado(pontoPorta(origem, saida));
  const b = pontoArredondado(pontoPorta(destino, entrada));
  const pontaA = pontoArredondado({
    x: a.x + vetorPorta(saida).x * 24,
    y: a.y + vetorPorta(saida).y * 24,
  });
  const pontaB = pontoArredondado({
    x: b.x + vetorPorta(entrada).x * 24,
    y: b.y + vetorPorta(entrada).y * 24,
  });
  return { a, b, pontaA, pontaB };
}

function rotaLimpa(pontos: { x: number; y: number }[], origem: SgqSipocNo, destino: SgqSipocNo) {
  return !desceNaLateral(pontos, origem) && !desceNaLateral(pontos, destino);
}

function rotaDireta(
  origem: SgqSipocNo,
  destino: SgqSipocNo,
  saida: LadoPorta,
  entrada: LadoPorta,
  obstaculos: { x: number; y: number; w: number; h: number }[],
  solta = false,
) {
  const { a, b, pontaA, pontaB } = pontasDaRota(origem, destino, saida, entrada);
  return [
    enxugar([a, b]),
    enxugar([a, pontaA, { x: pontaB.x, y: pontaA.y }, pontaB, b]),
    enxugar([a, pontaA, { x: pontaA.x, y: pontaB.y }, pontaB, b]),
  ].find((pontos) => livre(pontos, obstaculos) && (solta || rotaLimpa(pontos, origem, destino)));
}

function rotaEntrePortas(
  origem: SgqSipocNo,
  destino: SgqSipocNo,
  saida: LadoPorta,
  entrada: LadoPorta,
  outros: SgqSipocNo[],
  solta = false,
) {
  const { a, b, pontaA, pontaB } = pontasDaRota(origem, destino, saida, entrada);
  const corpos = obstaculosDe([origem, destino, ...outros]).map((ret) => ({
    ...ret,
    x: arredondar(ret.x),
    y: arredondar(ret.y),
    w: arredondar(ret.w),
    h: arredondar(ret.h),
  }));
  const meio = buscaOrtogonal(pontaA, pontaB, corpos);
  if (!meio.length) return null;
  const rota = enxugar([a, ...meio, b]);
  return solta || rotaLimpa(rota, origem, destino) ? rota : null;
}

function rotaEscolhida(
  origem: SgqSipocNo,
  destino: SgqSipocNo,
  saida: LadoPorta,
  entrada: LadoPorta,
  outros: SgqSipocNo[],
) {
  const noCaminho = obstaculosDe(outros).map((ret) => ({
    ...ret,
    x: arredondar(ret.x),
    y: arredondar(ret.y),
    w: arredondar(ret.w),
    h: arredondar(ret.h),
  }));
  const direta = rotaDireta(origem, destino, saida, entrada, noCaminho, true);
  if (direta) return direta;
  const busca = rotaEntrePortas(origem, destino, saida, entrada, outros, true);
  if (busca) return busca;
  const { a, b, pontaA, pontaB } = pontasDaRota(origem, destino, saida, entrada);
  return enxugar([a, pontaA, { x: pontaB.x, y: pontaA.y }, pontaB, b]);
}

function rotaEvitando(
  origem: SgqSipocNo,
  destino: SgqSipocNo,
  outros: SgqSipocNo[],
  escolha?: { saida?: LadoPorta; entrada?: LadoPorta },
) {
  if (escolha?.saida && escolha.entrada) {
    return rotaEscolhida(origem, destino, escolha.saida, escolha.entrada, outros);
  }
  if (escolha?.saida || escolha?.entrada) {
    const saidas: LadoPorta[] = escolha.saida ? [escolha.saida] : ['n', 'e', 's', 'w'] as LadoPorta[];
    const entradas: LadoPorta[] = escolha.entrada ? [escolha.entrada] : ['n', 'e', 's', 'w'] as LadoPorta[];
    const noCaminho = obstaculosDe(outros).map((ret) => ({
      ...ret,
      x: arredondar(ret.x),
      y: arredondar(ret.y),
      w: arredondar(ret.w),
      h: arredondar(ret.h),
    }));
    const direta = saidas
      .flatMap((saida) => entradas.map((entrada) => rotaDireta(origem, destino, saida, entrada, noCaminho, true)))
      .find((pontos) => pontos?.length);
    if (direta) return direta;
    return rotaEscolhida(origem, destino, saidas[0], entradas[0], outros);
  }
  const pares = paresDePorta(origem, destino);
  const noCaminho = obstaculosDe(outros).map((ret) => ({
    ...ret,
    x: arredondar(ret.x),
    y: arredondar(ret.y),
    w: arredondar(ret.w),
    h: arredondar(ret.h),
  }));
  const direta = pares
    .map((par) => rotaDireta(origem, destino, par.saida, par.entrada, noCaminho))
    .find((pontos) => pontos?.length);
  if (direta) return direta;
  const desviada = pares
    .slice(0, 4)
    .map((par) => rotaEntrePortas(origem, destino, par.saida, par.entrada, outros))
    .find((pontos) => pontos?.length);
  if (desviada) return desviada;
  const reserva = pares[0];
  const { a, b, pontaA, pontaB } = pontasDaRota(origem, destino, reserva.saida, reserva.entrada);
  return enxugar([a, pontaA, { x: pontaB.x, y: pontaA.y }, pontaB, b]);
}

function montarRotas(ligacoes: { id: string; de: string; para: string; saida?: string; entrada?: string }[], porId: Map<string, SgqSipocNo>) {
  const nos = [...porId.values()];
  const rotas = new Map<string, { x: number; y: number }[]>();
  ligacoes.forEach((ligacao) => {
    const origem = porId.get(ligacao.de);
    const destino = porId.get(ligacao.para);
    if (!origem || !destino) return;
    rotas.set(ligacao.id, rotaEvitando(
      origem,
      destino,
      nos.filter((no) => no.id !== origem.id && no.id !== destino.id),
      {
        saida: ladoValido(ligacao.saida) ? ligacao.saida : undefined,
        entrada: ladoValido(ligacao.entrada) ? ligacao.entrada : undefined,
      },
    ));
  });
  return rotas;
}

function traco(pontos: { x: number; y: number }[]) {
  return pontos.map((ponto, indice) => `${indice === 0 ? 'M' : 'L'} ${ponto.x} ${ponto.y}`).join(' ');
}

function recuarPonta(pontos: { x: number; y: number }[], recuo = 12) {
  if (pontos.length < 2) return pontos;
  const fim = pontos[pontos.length - 1];
  const antes = pontos[pontos.length - 2];
  const dx = fim.x - antes.x;
  const dy = fim.y - antes.y;
  const tamanho = Math.hypot(dx, dy) || 1;
  const quanto = Math.min(recuo, Math.max(0, tamanho - 8));
  if (quanto < 1) return pontos;
  return [...pontos.slice(0, -1), {
    x: fim.x - (dx / tamanho) * quanto,
    y: fim.y - (dy / tamanho) * quanto,
  }];
}

const CORES_NO: Record<SgqSipocTipoNo, string> = {
  fornecedor: '#0c2348',
  entrada: '#163e78',
  inicio: '#2f6edb',
  etapa: '#2f6edb',
  fim: '#2f6edb',
  saida: '#7eb6f0',
  cliente: '#7eb6f0',
  base: '#7eb6f0',
};

function xml(valor: string) {
  return valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formaSvg(no: SgqSipocNo) {
  const { w, h, linhas } = caixa(no);
  const topo = no.tipo === 'base' ? 18 : 0;
  const y = topo + (h - topo - linhas.length * ALTURA_LINHA) / 2 + ALTURA_LINHA / 2;
  const spans = linhas.map((linha, indice) => (
    `<tspan x="${w / 2}" dy="${indice === 0 ? 0 : ALTURA_LINHA}">${xml(linha)}</tspan>`
  )).join('');
  const texto = `<text x="${w / 2}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="12" font-family="Segoe UI, sans-serif">${spans}</text>`;
  const fill = CORES_NO[no.tipo];
  let corpo = `<rect width="${w}" height="${h}" rx="${no.tipo === 'etapa' ? 8 : 29}" fill="${fill}" />`;
  if (no.tipo === 'inicio' || no.tipo === 'fim') {
    corpo = `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" />`;
  } else if (no.tipo === 'entrada' || no.tipo === 'saida') {
    const ponta = 18;
    const d = no.tipo === 'entrada'
      ? `M ${ponta} 1 H ${w - 1} L ${w - ponta} ${h - 1} H 1 Z`
      : `M 1 1 H ${w - ponta} L ${w - 1} ${h - 1} H ${ponta} Z`;
    corpo = `<path d="${d}" fill="${fill}" />`;
  } else if (no.tipo === 'base') {
    corpo = `<path d="M 8 16 C 8 6, ${w - 8} 6, ${w - 8} 16 L ${w - 8} ${h - 18} C ${w - 8} ${h - 6}, 8 ${h - 6}, 8 ${h - 18} Z" fill="${fill}" /><ellipse cx="${w / 2}" cy="16" rx="${(w - 16) / 2}" ry="10" fill="#b9d8f8" />`;
  }
  return `<g transform="translate(${no.x} ${no.y})">${corpo}${texto}</g>`;
}

export function svgSipoc(esquema: SgqSipocEsquema) {
  const porId = new Map(esquema.nos.map((no) => [no.id, no]));
  const rotas = montarRotas(esquema.ligacoes, porId);
  const pontos: { x: number; y: number }[] = [];
  esquema.nos.forEach((no) => {
    const medida = caixa(no);
    pontos.push({ x: no.x, y: no.y }, { x: no.x + medida.w, y: no.y + medida.h });
  });
  rotas.forEach((rota) => pontos.push(...rota));
  const folga = 32;
  const minX = pontos.length ? Math.min(...pontos.map((ponto) => ponto.x)) : 0;
  const minY = pontos.length ? Math.min(...pontos.map((ponto) => ponto.y)) : 0;
  const maxX = pontos.length ? Math.max(...pontos.map((ponto) => ponto.x)) : 640;
  const maxY = pontos.length ? Math.max(...pontos.map((ponto) => ponto.y)) : 360;
  const largura = Math.max(320, Math.ceil(maxX - minX + folga * 2));
  const altura = Math.max(220, Math.ceil(maxY - minY + folga * 2));
  const linhas = esquema.ligacoes.map((ligacao) => {
    const rota = rotas.get(ligacao.id);
    if (!rota) return '';
    return `<path d="${traco(recuarPonta(rota))}" fill="none" stroke="#94a3b8" stroke-width="1.35" stroke-linecap="square" stroke-linejoin="miter" marker-end="url(#sipoc-pdf-seta)" />`;
  }).join('');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}">
  <defs>
    <pattern id="sipoc-pdf-grade" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#e2e8f0" stroke-width="1" />
    </pattern>
    <marker id="sipoc-pdf-seta" viewBox="0 0 10 10" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M 0 1.2 L 8 5 L 0 8.8 Z" fill="#475569" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#f8fafc" />
  <rect width="100%" height="100%" fill="url(#sipoc-pdf-grade)" />
  <g transform="translate(${folga - minX} ${folga - minY})">${linhas}${esquema.nos.map(formaSvg).join('')}</g>
</svg>`;
  return { svg, largura, altura };
}

function meioDaRota(pontos: { x: number; y: number }[]) {
  const trechos: number[] = [];
  let total = 0;
  for (let indice = 1; indice < pontos.length; indice += 1) {
    const tamanho = Math.hypot(pontos[indice].x - pontos[indice - 1].x, pontos[indice].y - pontos[indice - 1].y);
    trechos.push(tamanho);
    total += tamanho;
  }
  let resta = total / 2;
  for (let indice = 0; indice < trechos.length; indice += 1) {
    if (resta <= trechos[indice] || indice === trechos.length - 1) {
      const parte = trechos[indice] ? Math.min(1, resta / trechos[indice]) : 0;
      return {
        x: pontos[indice].x + (pontos[indice + 1].x - pontos[indice].x) * parte,
        y: pontos[indice].y + (pontos[indice + 1].y - pontos[indice].y) * parte,
      };
    }
    resta -= trechos[indice];
  }
  return pontos[0];
}

function antesDoFim(pontos: { x: number; y: number }[]) {
  const anterior = pontos[pontos.length - 2] ?? pontos[0];
  const fim = pontos[pontos.length - 1];
  const tamanho = Math.hypot(fim.x - anterior.x, fim.y - anterior.y) || 1;
  const recuo = Math.min(14, tamanho * 0.45);
  return {
    x: fim.x - ((fim.x - anterior.x) / tamanho) * recuo,
    y: fim.y - ((fim.y - anterior.y) / tamanho) * recuo,
  };
}

function areaDoTexto(no: SgqSipocNo) {
  const { w, h } = caixa(no);
  if (no.tipo === 'inicio' || no.tipo === 'fim') return { x: w * 0.16, y: h * 0.2, w: w * 0.68, h: h * 0.6 };
  if (no.tipo === 'entrada' || no.tipo === 'saida') return { x: 22, y: 8, w: Math.max(40, w - 44), h: Math.max(24, h - 16) };
  if (no.tipo === 'base') return { x: 16, y: 24, w: Math.max(40, w - 32), h: Math.max(24, h - 42) };
  const lado = no.tipo === 'fornecedor' || no.tipo === 'cliente' ? 20 : 12;
  return { x: lado, y: 8, w: Math.max(40, w - lado * 2), h: Math.max(24, h - 16) };
}

function Forma({ no, ocultarTexto = false }: { no: SgqSipocNo; ocultarTexto?: boolean }) {
  const { w, h, linhas } = caixa(no);
  const topo = no.tipo === 'base' ? 18 : 0;
  const texto = ocultarTexto ? null : (
    <text x={w / 2} y={topo + (h - topo - linhas.length * ALTURA_LINHA) / 2 + ALTURA_LINHA / 2} textAnchor="middle" dominantBaseline="middle" className="sipoc-no-texto">
      {linhas.map((linha, indice) => (
        <tspan key={indice} x={w / 2} dy={indice === 0 ? 0 : ALTURA_LINHA}>{linha}</tspan>
      ))}
    </text>
  );
  if (no.tipo === 'inicio' || no.tipo === 'fim') {
    return <><ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} />{texto}</>;
  }
  if (no.tipo === 'entrada' || no.tipo === 'saida') {
    const ponta = 18;
    const d = no.tipo === 'entrada'
      ? `M ${ponta} 1 H ${w - 1} L ${w - ponta} ${h - 1} H 1 Z`
      : `M 1 1 H ${w - ponta} L ${w - 1} ${h - 1} H ${ponta} Z`;
    return <><path d={d} />{texto}</>;
  }
  if (no.tipo === 'base') {
    return (
      <>
        <path d={`M 8 16 C 8 6, ${w - 8} 6, ${w - 8} 16 L ${w - 8} ${h - 18} C ${w - 8} ${h - 6}, 8 ${h - 6}, 8 ${h - 18} Z`} />
        <ellipse cx={w / 2} cy={16} rx={(w - 16) / 2} ry={10} />
        {texto}
      </>
    );
  }
  const raio = no.tipo === 'etapa' ? 8 : 29;
  return <><rect width={w} height={h} rx={raio} />{texto}</>;
}

function Miniatura({ tipo }: { tipo: SgqSipocTipoNo }) {
  const fill = CORES_NO[tipo];
  if (tipo === 'inicio' || tipo === 'fim') {
    return (
      <svg className="sipoc-peca-forma" viewBox="0 0 36 18" aria-hidden="true">
        <ellipse cx="18" cy="9" rx="17" ry="8" fill={fill} />
      </svg>
    );
  }
  if (tipo === 'entrada') {
    return (
      <svg className="sipoc-peca-forma" viewBox="0 0 36 20" aria-hidden="true">
        <path d="M 7 1 H 35 L 29 19 H 1 Z" fill={fill} />
      </svg>
    );
  }
  if (tipo === 'saida') {
    return (
      <svg className="sipoc-peca-forma" viewBox="0 0 36 20" aria-hidden="true">
        <path d="M 1 1 H 29 L 35 19 H 7 Z" fill={fill} />
      </svg>
    );
  }
  if (tipo === 'base') {
    return (
      <svg className="sipoc-peca-forma" viewBox="0 0 32 26" aria-hidden="true">
        <path d="M 4 7 C 4 3, 28 3, 28 7 L 28 19 C 28 23, 4 23, 4 19 Z" fill={fill} />
        <ellipse cx="16" cy="7" rx="12" ry="4" fill="#b9d8f8" />
      </svg>
    );
  }
  if (tipo === 'etapa') {
    return (
      <svg className="sipoc-peca-forma" viewBox="0 0 36 18" aria-hidden="true">
        <rect width="36" height="18" rx="4" fill={fill} />
      </svg>
    );
  }
  return (
    <svg className="sipoc-peca-forma" viewBox="0 0 36 16" aria-hidden="true">
      <rect width="36" height="16" rx="8" fill={fill} />
    </svg>
  );
}

const SGQSipocLousa: React.FC<{
  esquema: SgqSipocEsquema;
  onChange: (esquema: SgqSipocEsquema) => void;
  onExportar?: () => void;
  exportando?: boolean;
}> = ({ esquema, onChange, onExportar, exportando = false }) => {
  const quadro = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 12, y: 12 });
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [ligando, setLigando] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string | null; x: number; y: number } | null>(null);
  const [ligacaoAtiva, setLigacaoAtiva] = useState<string | null>(null);
  const [linkHover, setLinkHover] = useState<string | null>(null);
  const [fio, setFio] = useState<{ de: string; x: number; y: number; alvo: string | null; lado?: LadoPorta; entrada?: LadoPorta } | null>(null);
  const [fantasma, setFantasma] = useState<{ tipo: SgqSipocTipoNo; x: number; y: number; mx: number; my: number; sobre: boolean } | null>(null);
  const [chegando, setChegando] = useState<string | null>(null);
  const editandoRef = useRef<string | null>(null);
  const inlineRef = useRef<HTMLTextAreaElement>(null);
  const ultimoClique = useRef({ id: '', em: 0 });
  const arraste = useRef<
    | { id: string; dx: number; dy: number; x: number; y: number; moved: boolean }
    | { pan: true; x: number; y: number; ox: number; oy: number }
    | { liga: true; de: string; alvo: string | null; lado: LadoPorta; entrada?: LadoPorta }
    | { religa: true; id: string; fixa: string; alvo: string | null; saida?: LadoPorta; entrada?: LadoPorta; moved: boolean; x: number; y: number }
    | null
  >(null);
  const cena = useRef({ esquema, pan, zoom, onChange, selecionado, ligacaoAtiva });
  cena.current = { esquema, pan, zoom, onChange, selecionado, ligacaoAtiva };
  const copiado = useRef<{ no: SgqSipocNo; passo: number } | null>(null);
  const paletaArraste = useRef<{ tipo: SgqSipocTipoNo; x: number; y: number; moved: boolean } | null>(null);
  const veioDoArraste = useRef(false);

  const nos = esquema.nos;
  const porId = useMemo(() => new Map(nos.map((no) => [no.id, no])), [nos]);
  const ativo = nos.find((no) => no.id === selecionado) ?? null;

  function mundo(event: React.PointerEvent | PointerEvent) {
    const area = quadro.current?.getBoundingClientRect();
    if (!area) return { x: 0, y: 0 };
    return {
      x: (event.clientX - area.left - pan.x) / zoom,
      y: (event.clientY - area.top - pan.y) / zoom,
    };
  }

  function atualizarNo(id: string, patch: Partial<SgqSipocNo>) {
    onChange({
      ...esquema,
      nos: esquema.nos.map((no) => (no.id === id ? { ...no, ...patch } : no)),
    });
  }

  function adicionar(tipo: SgqSipocTipoNo) {
    const id = `${tipo}-${Date.now()}`;
    const area = quadro.current?.getBoundingClientRect();
    const medida = MEDIDAS[tipo];
    const x = area ? (area.width / 2 - pan.x) / zoom - medida.w / 2 : 80;
    const y = area ? (area.height / 2 - pan.y) / zoom - medida.h / 2 : 80;
    onChange({
      ...esquema,
      nos: [...esquema.nos, { id, tipo, texto: ROTULOS[tipo], x, y }],
    });
    abrirEdicao(id);
  }

  function focar(no: SgqSipocNo) {
    const area = quadro.current?.getBoundingClientRect();
    if (!area) return;
    const meio = centro(no);
    setPan({
      x: area.width / 2 - meio.x * zoom,
      y: area.height / 2 - meio.y * zoom,
    });
  }

  function remover(id: string) {
    onChange({
      nos: esquema.nos.filter((no) => no.id !== id),
      ligacoes: esquema.ligacoes.filter((ligacao) => ligacao.de !== id && ligacao.para !== id),
    });
    if (selecionado === id) setSelecionado(null);
    if (ligando === id) setLigando(null);
    if (editandoRef.current === id) fecharEdicao();
    setMenu(null);
  }

  function abrirMenu(id: string, clientX: number, clientY: number) {
    arraste.current = null;
    setSelecionado(id);
    setMenu({
      id,
      x: Math.min(clientX, window.innerWidth - 248),
      y: Math.min(clientY, window.innerHeight - 280),
    });
  }

  function abrirEdicao(id: string) {
    editandoRef.current = id;
    arraste.current = null;
    setLigando(null);
    setSelecionado(id);
    setEditando(id);
  }

  function fecharEdicao() {
    editandoRef.current = null;
    setEditando(null);
  }

  function escolher(id: string, levarAteOElemento = false) {
    if (ligando && ligando !== id && !esquema.ligacoes.some((item) => item.de === ligando && item.para === id)) {
      onChange({
        ...esquema,
        ligacoes: [...esquema.ligacoes, { id: `l-${Date.now()}`, de: ligando, para: id }],
      });
      setLigando(null);
      setSelecionado(id);
      return;
    }
    setSelecionado(id);
    if (ligando === id) setLigando(null);
    if (levarAteOElemento) {
      const no = esquema.nos.find((item) => item.id === id);
      if (no) focar(no);
    }
  }

  useEffect(() => {
    const mover = (event: PointerEvent) => {
      const paleta = paletaArraste.current;
      const atualCena = cena.current;
      if (paleta) {
        if (!paleta.moved && Math.hypot(event.clientX - paleta.x, event.clientY - paleta.y) < 5) return;
        paleta.moved = true;
        const areaPaleta = quadro.current?.getBoundingClientRect();
        const sobre = Boolean(
          areaPaleta
          && event.clientX >= areaPaleta.left
          && event.clientX <= areaPaleta.right
          && event.clientY >= areaPaleta.top
          && event.clientY <= areaPaleta.bottom,
        );
        const medida = MEDIDAS[paleta.tipo];
        setFantasma({
          tipo: paleta.tipo,
          x: event.clientX,
          y: event.clientY,
          mx: areaPaleta ? (event.clientX - areaPaleta.left - atualCena.pan.x) / atualCena.zoom - medida.w / 2 : 0,
          my: areaPaleta ? (event.clientY - areaPaleta.top - atualCena.pan.y) / atualCena.zoom - medida.h / 2 : 0,
          sobre,
        });
        return;
      }
      const atual = arraste.current;
      if (!atual) return;
      if ('pan' in atual) {
        setPan({ x: atual.ox + event.clientX - atual.x, y: atual.oy + event.clientY - atual.y });
        return;
      }
      if ('liga' in atual || 'religa' in atual) {
        const areaFio = quadro.current?.getBoundingClientRect();
        if (!areaFio) return;
        const ponto = {
          x: (event.clientX - areaFio.left - atualCena.pan.x) / atualCena.zoom,
          y: (event.clientY - areaFio.top - atualCena.pan.y) / atualCena.zoom,
        };
        if ('religa' in atual && !atual.moved && Math.hypot(event.clientX - atual.x, event.clientY - atual.y) < 5) return;
        if ('religa' in atual) atual.moved = true;
        const origemId = 'liga' in atual ? atual.de : atual.fixa;
        atual.alvo = noNoPonto(atualCena.esquema.nos, ponto, origemId);
        const alvoNo = atual.alvo ? atualCena.esquema.nos.find((no) => no.id === atual.alvo) : undefined;
        atual.entrada = alvoNo ? portaMaisProxima(alvoNo, ponto) : undefined;
        setFio({
          de: origemId,
          x: ponto.x,
          y: ponto.y,
          alvo: atual.alvo,
          lado: 'liga' in atual ? atual.lado : atual.saida,
          entrada: atual.entrada,
        });
        return;
      }
      if (!atual.moved && Math.hypot(event.clientX - atual.x, event.clientY - atual.y) < 5) return;
      atual.moved = true;
      const area = quadro.current?.getBoundingClientRect();
      if (!area) return;
      const ponto = {
        x: (event.clientX - area.left - atualCena.pan.x) / atualCena.zoom,
        y: (event.clientY - area.top - atualCena.pan.y) / atualCena.zoom,
      };
      atualCena.onChange({
        ...atualCena.esquema,
        nos: atualCena.esquema.nos.map((no) => (
          no.id === atual.id ? { ...no, x: ponto.x - atual.dx, y: ponto.y - atual.dy } : no
        )),
      });
    };
    const soltar = (event: PointerEvent) => {
      const paleta = paletaArraste.current;
      if (paleta) {
        paletaArraste.current = null;
        setFantasma(null);
        if (!paleta.moved) return;
        veioDoArraste.current = true;
        const areaPaleta = quadro.current?.getBoundingClientRect();
        const sobre = Boolean(
          areaPaleta
          && event.clientX >= areaPaleta.left
          && event.clientX <= areaPaleta.right
          && event.clientY >= areaPaleta.top
          && event.clientY <= areaPaleta.bottom,
        );
        if (!sobre || !areaPaleta || cena.current.esquema.nos.length >= 200) return;
        const medida = MEDIDAS[paleta.tipo];
        const id = `${paleta.tipo}-${Date.now()}`;
        cena.current.onChange({
          ...cena.current.esquema,
          nos: [...cena.current.esquema.nos, {
            id,
            tipo: paleta.tipo,
            texto: ROTULOS[paleta.tipo],
            x: (event.clientX - areaPaleta.left - cena.current.pan.x) / cena.current.zoom - medida.w / 2,
            y: (event.clientY - areaPaleta.top - cena.current.pan.y) / cena.current.zoom - medida.h / 2,
          }],
        });
        setSelecionado(id);
        setChegando(id);
        window.setTimeout(() => setChegando((atual) => (atual === id ? null : atual)), 420);
        return;
      }
      const atual = arraste.current;
      arraste.current = null;
      if (!atual || !('liga' in atual || 'religa' in atual)) return;
      const esquemaAtual = cena.current.esquema;
      if ('liga' in atual && atual.alvo && atual.entrada) {
        const repetida = esquemaAtual.ligacoes.find((item) => item.de === atual.de && item.para === atual.alvo);
        cena.current.onChange({
          ...esquemaAtual,
          ligacoes: repetida
            ? esquemaAtual.ligacoes.map((item) => (
              item.id === repetida.id ? { ...item, saida: atual.lado, entrada: atual.entrada } : item
            ))
            : [...esquemaAtual.ligacoes, {
              id: `l-${Date.now()}`,
              de: atual.de,
              para: atual.alvo,
              saida: atual.lado,
              entrada: atual.entrada,
            }],
        });
      }
      if ('religa' in atual && atual.moved && atual.alvo && atual.entrada && atual.alvo !== atual.fixa) {
        const repetida = esquemaAtual.ligacoes.some((item) => item.id !== atual.id && item.de === atual.fixa && item.para === atual.alvo);
        cena.current.onChange({
          ...esquemaAtual,
          ligacoes: repetida
            ? esquemaAtual.ligacoes.filter((item) => item.id !== atual.id)
            : esquemaAtual.ligacoes.map((item) => (
              item.id === atual.id ? { ...item, para: atual.alvo as string, entrada: atual.entrada, saida: atual.saida ?? item.saida } : item
            )),
        });
      }
      setFio(null);
    };
    const roda = (event: WheelEvent) => {
      event.preventDefault();
      const fator = event.deltaY > 0 ? 0.92 : 1.08;
      setZoom((valor) => Math.min(1.8, Math.max(0.45, Number((valor * fator).toFixed(3)))));
    };
    const area = quadro.current;
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    const tecla = (event: KeyboardEvent) => {
      const alvo = event.target as HTMLElement | null;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const atalho = event.ctrlKey || event.metaKey;
      if (atalho && event.key.toLowerCase() === 'c' && cena.current.selecionado) {
        const no = cena.current.esquema.nos.find((item) => item.id === cena.current.selecionado);
        if (!no) return;
        event.preventDefault();
        copiado.current = { no: { ...no }, passo: 1 };
        return;
      }
      if (atalho && event.key.toLowerCase() === 'v' && copiado.current) {
        event.preventDefault();
        if (cena.current.esquema.nos.length >= 200) return;
        const { no, passo } = copiado.current;
        const id = `${no.tipo}-${Date.now()}`;
        const copia: SgqSipocNo = {
          ...no,
          id,
          x: Math.min(20000, no.x + passo * 32),
          y: Math.min(20000, no.y + passo * 32),
        };
        copiado.current = { no, passo: passo + 1 };
        cena.current.onChange({
          ...cena.current.esquema,
          nos: [...cena.current.esquema.nos, copia],
        });
        setSelecionado(id);
        setLigacaoAtiva(null);
        setMenu(null);
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && cena.current.ligacaoAtiva) {
        event.preventDefault();
        const idLigacao = cena.current.ligacaoAtiva;
        cena.current.onChange({
          ...cena.current.esquema,
          ligacoes: cena.current.esquema.ligacoes.filter((item) => item.id !== idLigacao),
        });
        setLigacaoAtiva(null);
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && cena.current.selecionado) {
        event.preventDefault();
        const id = cena.current.selecionado;
        cena.current.onChange({
          nos: cena.current.esquema.nos.filter((no) => no.id !== id),
          ligacoes: cena.current.esquema.ligacoes.filter((ligacao) => ligacao.de !== id && ligacao.para !== id),
        });
        setSelecionado(null);
        setLigando(null);
      }
      if (event.key === 'Escape') {
        fecharEdicao();
        setMenu(null);
        setLigando(null);
        setSelecionado(null);
      }
    };
    area?.addEventListener('wheel', roda, { passive: false });
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('keydown', tecla);
      area?.removeEventListener('wheel', roda);
    };
  }, []);

  useEffect(() => {
    if (!editando) return;
    inlineRef.current?.focus();
    inlineRef.current?.select();
  }, [editando]);

  useEffect(() => {
    if (!menu) return undefined;
    const fechar = (event: PointerEvent) => {
      if (event.button === 2) return;
      const alvo = event.target as Element | null;
      if (alvo?.closest('.sipoc-menu')) return;
      setMenu(null);
    };
    window.addEventListener('pointerdown', fechar);
    return () => window.removeEventListener('pointerdown', fechar);
  }, [menu]);

  const lista = [...nos].sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo) || a.y - b.y);
  const rotas = useMemo(() => montarRotas(esquema.ligacoes, porId), [esquema.ligacoes, porId]);
  const fioPontos = (() => {
    if (!fio) return null;
    const origemFio = porId.get(fio.de);
    if (!origemFio) return null;
    const destinoFio = fio.alvo ? porId.get(fio.alvo) : undefined;
    if (destinoFio && (fio.lado || fio.entrada)) {
      return rotaEvitando(
        origemFio,
        destinoFio,
        nos.filter((no) => no.id !== origemFio.id && no.id !== destinoFio.id),
        { saida: fio.lado, entrada: fio.entrada },
      );
    }
    if (destinoFio) {
      return rotaEvitando(origemFio, destinoFio, nos.filter((no) => no.id !== origemFio.id && no.id !== destinoFio.id));
    }
    const inicio = pontoPorta(origemFio, fio.lado ?? 'e');
    const horizontal = !fio.lado || fio.lado === 'e' || fio.lado === 'w';
    return horizontal
      ? enxugar([inicio, { x: fio.x, y: inicio.y }, fio])
      : enxugar([inicio, { x: inicio.x, y: fio.y }, fio]);
  })();
  return (
    <div className="sipoc-lousa">
      <aside className="sipoc-painel">
        <h3>Adicionar</h3>
        <div className="sipoc-paleta">
          {ORDEM.map((tipo) => (
            <button
              key={tipo}
              type="button"
              className={`sipoc-peca is-${tipo}${fantasma?.tipo === tipo ? ' is-puxando' : ''}`}
              title={`${AJUDA[tipo]}. Arraste para a lousa.`}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                paletaArraste.current = { tipo, x: event.clientX, y: event.clientY, moved: false };
              }}
              onClick={() => {
                if (veioDoArraste.current) {
                  veioDoArraste.current = false;
                  return;
                }
                adicionar(tipo);
              }}
            >
              <Miniatura tipo={tipo} />
              <span className="sipoc-peca-texto">
                <strong>{ROTULOS[tipo]}</strong>
                <small>{AJUDA[tipo]}</small>
              </span>
            </button>
          ))}
        </div>
        <h3>Elementos</h3>
        <p className="sipoc-dica">
          {fio ? 'Solte no ponto do outro bloco.' : 'Passe o mouse no bloco e puxe um ponto até o outro.'}
        </p>
        <ul className="sipoc-escolha">
          {lista.map((no) => (
            <li key={no.id}>
              <button
                type="button"
                className={`${selecionado === no.id ? 'is-ativo' : ''}${ligando === no.id ? ' is-origem' : ''}`}
                onClick={() => { setLigacaoAtiva(null); escolher(no.id, true); }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  abrirMenu(no.id, event.clientX, event.clientY);
                }}
              >
                <Miniatura tipo={no.tipo} />
                <span>
                  <strong>{no.texto.split('\n')[0] || 'Sem título'}</strong>
                  <small>{ROTULOS[no.tipo]}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {ativo && (
          <div className="sipoc-editor-acoes">
            <button type="button" className="btn-secondary" onClick={() => remover(ativo.id)}>Excluir</button>
          </div>
        )}
      </aside>
      <div
        ref={quadro}
        className={`sipoc-quadro${fantasma?.sobre ? ' is-recebendo' : ''}`}
        onContextMenu={(event) => {
          event.preventDefault();
          const alvo = event.target as Element;
          if (alvo.closest('.sipoc-no') || alvo.closest('.sipoc-zoom')) return;
          setSelecionado(null);
          setLigacaoAtiva(null);
          setMenu({
            id: null,
            x: Math.min(event.clientX, window.innerWidth - 248),
            y: Math.min(event.clientY, window.innerHeight - 80),
          });
        }}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget && !(event.target as Element).classList.contains('sipoc-fundo')) return;
          fecharEdicao();
          setMenu(null);
          setSelecionado(null);
          arraste.current = { pan: true, x: event.clientX, y: event.clientY, ox: pan.x, oy: pan.y };
        }}
      >
        <svg className="sipoc-fundo" width="100%" height="100%">
          <defs>
            <marker id="sipoc-seta" viewBox="0 0 10 10" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 1.2 L 8 5 L 0 8.8 Z" fill="#475569" />
            </marker>
          </defs>
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            {esquema.ligacoes.map((ligacao) => {
              const pontos = rotas.get(ligacao.id);
              if (!pontos) return null;
              const d = traco(pontos);
              const visivel = traco(recuarPonta(pontos));
              return (
                <g
                  key={ligacao.id}
                  className={ligacaoAtiva === ligacao.id ? 'is-ativa' : ''}
                  onPointerEnter={() => setLinkHover(ligacao.id)}
                  onPointerLeave={() => setLinkHover((atual) => (atual === ligacao.id ? null : atual))}
                >
                  <path d={visivel} className="sipoc-ligacao" markerEnd="url(#sipoc-seta)" />
                  <path
                    d={d}
                    className="sipoc-ligacao-area"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      if (event.button === 2) return;
                      setLigacaoAtiva(ligacao.id);
                      setSelecionado(null);
                      setMenu(null);
                    }}
                  />
                </g>
              );
            })}
            {fioPontos && <path d={traco(fioPontos)} className="sipoc-fio" markerEnd="url(#sipoc-seta)" />}
            {fantasma?.sobre && (
              <g className="sipoc-previa" transform={`translate(${fantasma.mx} ${fantasma.my})`}>
                <Forma no={{ id: 'previa', tipo: fantasma.tipo, texto: ROTULOS[fantasma.tipo], x: 0, y: 0 }} />
              </g>
            )}
            {nos.map((no) => (
              <g
                key={no.id}
                className={`sipoc-no is-${no.tipo}${selecionado === no.id ? ' is-selecionado' : ''}${fio?.alvo === no.id ? ' is-alvo' : ''}`}
                transform={`translate(${no.x} ${no.y})`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  if (event.button === 2) return;
                  const agora = Date.now();
                  const duplo = ultimoClique.current.id === no.id && agora - ultimoClique.current.em < 350;
                  ultimoClique.current = { id: no.id, em: agora };
                  if (duplo) {
                    abrirEdicao(no.id);
                    return;
                  }
                  if (editandoRef.current) fecharEdicao();
                  setLigacaoAtiva(null);
                  const ponto = mundo(event);
                  arraste.current = { id: no.id, dx: ponto.x - no.x, dy: ponto.y - no.y, x: event.clientX, y: event.clientY, moved: false };
                  escolher(no.id);
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  abrirEdicao(no.id);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  abrirMenu(no.id, event.clientX, event.clientY);
                }}
              >
                <rect className="sipoc-area" x={-10} y={-10} width={caixa(no).w + 20} height={caixa(no).h + 20} />
                {selecionado === no.id && (
                  <rect className="sipoc-halo" x={-7} y={-7} width={caixa(no).w + 14} height={caixa(no).h + 14} rx={12} />
                )}
                <g className={chegando === no.id ? 'sipoc-chega' : undefined}>
                  <Forma no={no} ocultarTexto={editando === no.id} />
                </g>
                {editando === no.id && (
                  <foreignObject x={areaDoTexto(no).x} y={areaDoTexto(no).y} width={areaDoTexto(no).w} height={areaDoTexto(no).h}>
                    <div className="sipoc-inline-caixa" {...{ xmlns: 'http://www.w3.org/1999/xhtml' }}>
                      <textarea
                        ref={inlineRef}
                        className="sipoc-inline"
                        aria-label="Texto do elemento"
                        rows={Math.max(1, caixa(no).linhas.length)}
                        value={no.texto}
                        onChange={(event) => atualizarNo(no.id, { texto: event.target.value.slice(0, 220) })}
                        onPointerDown={(event) => event.stopPropagation()}
                        onBlur={fecharEdicao}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            fecharEdicao();
                          }
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            fecharEdicao();
                          }
                        }}
                      />
                    </div>
                  </foreignObject>
                )}
                {PORTAS.map((porta) => {
                  const medida = caixa(no);
                  const raio = 5.5 / zoom;
                  const folga = raio + 2 / zoom;
                  const sentido = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] }[porta.lado];
                  const cx = porta.x(medida.w, medida.h) + sentido[0] * folga;
                  const cy = porta.y(medida.w, medida.h) + sentido[1] * folga;
                  return (
                    <g
                      key={porta.lado}
                      className={`sipoc-porta${fio?.alvo === no.id && fio.entrada === porta.lado ? ' is-escolhida' : ''}`}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        if (event.button === 2) return;
                        const inicio = pontoPorta(no, porta.lado);
                        arraste.current = { liga: true, de: no.id, alvo: null, lado: porta.lado };
                        setFio({ de: no.id, x: inicio.x, y: inicio.y, alvo: null, lado: porta.lado });
                        setSelecionado(no.id);
                        setLigacaoAtiva(null);
                        setMenu(null);
                        fecharEdicao();
                      }}
                    >
                      <circle cx={cx} cy={cy} r={raio} strokeWidth={1.4 / zoom} />
                      <title>Puxar ligação</title>
                    </g>
                  );
                })}
              </g>
            ))}
            {esquema.ligacoes.map((ligacao) => {
              const origem = porId.get(ligacao.de);
              const destino = porId.get(ligacao.para);
              if (!origem || !destino) return null;
              if (ligacaoAtiva !== ligacao.id && linkHover !== ligacao.id) return null;
              const pontos = rotas.get(ligacao.id);
              if (!pontos) return null;
              const b = antesDoFim(pontos);
              const meio = meioDaRota(pontos);
              return (
                <g key={`ponta-${ligacao.id}`}>
                  <circle
                    className="sipoc-ponta"
                    cx={b.x}
                    cy={b.y}
                    r={8 / zoom}
                    strokeWidth={2 / zoom}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      if (event.button === 2) return;
                      arraste.current = { religa: true, id: ligacao.id, fixa: ligacao.de, alvo: ligacao.para, saida: ligacao.saida, moved: false, x: event.clientX, y: event.clientY };
                      setLigacaoAtiva(ligacao.id);
                      setSelecionado(null);
                      setMenu(null);
                    }}
                  >
                    <title>Puxar esta seta</title>
                  </circle>
                  {ligacaoAtiva === ligacao.id && (
                    <g
                      className="sipoc-apagar-seta"
                      transform={`translate(${meio.x} ${meio.y})`}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        onChange({
                          ...esquema,
                          ligacoes: esquema.ligacoes.filter((item) => item.id !== ligacao.id),
                        });
                        setLigacaoAtiva(null);
                      }}
                    >
                      <circle r={10 / zoom} />
                      <path d={`M ${-4 / zoom} ${-4 / zoom} L ${4 / zoom} ${4 / zoom} M ${4 / zoom} ${-4 / zoom} L ${-4 / zoom} ${4 / zoom}`} />
                      <title>Excluir seta</title>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
        <div className="sipoc-zoom">
          <button type="button" onClick={() => setZoom((valor) => Math.min(1.8, Number((valor + 0.1).toFixed(2))))} aria-label="Aumentar">+</button>
          <button type="button" onClick={() => setZoom((valor) => Math.max(0.5, Number((valor - 0.1).toFixed(2))))} aria-label="Diminuir">−</button>
        </div>
      </div>
      {fantasma && (
        <div className={`sipoc-fantasma${fantasma.sobre ? ' is-sobre' : ''}`} style={{ left: fantasma.x, top: fantasma.y }}>
          <Miniatura tipo={fantasma.tipo} />
          <span>{ROTULOS[fantasma.tipo]}</span>
        </div>
      )}
      {menu && (menu.id == null || porId.get(menu.id)) && (
        <div
          className="sipoc-menu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
          onContextMenu={(event) => event.preventDefault()}
        >
          {menu.id && porId.get(menu.id) && (
            <>
              <button type="button" onClick={() => { abrirEdicao(menu.id as string); setMenu(null); }}>Editar texto</button>
              <button type="button" onClick={() => { setLigando(menu.id); setSelecionado(menu.id); setMenu(null); }}>Ligar a outro</button>
              <div className="sipoc-menu-tipos">
                {ORDEM.map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                title={`${ROTULOS[tipo]}. ${AJUDA[tipo]}`}
                aria-label={`${ROTULOS[tipo]}. ${AJUDA[tipo]}`}
                    className={`sipoc-peca is-${tipo}${porId.get(menu.id as string)?.tipo === tipo ? ' is-ativo' : ''}`}
                    onClick={() => { atualizarNo(menu.id as string, { tipo }); setMenu(null); }}
                  >
                    <Miniatura tipo={tipo} />
                  </button>
                ))}
              </div>
              <button type="button" className="is-perigo" onClick={() => remover(menu.id as string)}>Excluir</button>
            </>
          )}
          <button
            type="button"
            disabled={exportando}
            onClick={() => { setMenu(null); onExportar?.(); }}
          >
            {exportando ? 'Gerando...' : 'Exportar PDF'}
          </button>
        </div>
      )}
    </div>
  );
};

export default SGQSipocLousa;
