import React, { useEffect, useMemo, useRef, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useDocumentosSGQ, useDownloadDocumentoSGQ, usePastasMatrizSGQ } from '../../hooks/useSGQMatriz';
import type { QueryResultLike } from '../../hooks/useAsyncQueryState';
import type { DocumentoRH, PastaMatrizRH } from '../../types/domain';

const RAIZ_ID = 'raiz';
const COR = '#0f85c1';

type TipoNo = 'raiz' | 'pasta' | 'documento';

type NoGrafo = {
  id: string;
  tipo: TipoNo;
  rotulo: string;
  pai: string | null;
  cor: string;
  raio: number;
  x: number;
  y: number;
  ancoraX: number;
  ancoraY: number;
  vx: number;
  vy: number;
  fixo: boolean;
  documento?: DocumentoRH;
};

type Aresta = { de: string; para: string };

type EstadoGrafo = {
  nos: Map<string, NoGrafo>;
  arestas: Aresta[];
  subarvore: Map<string, Set<string>>;
  vizinhos: Map<string, Set<string>>;
  zoom: number;
  panX: number;
  panY: number;
  energia: number;
  cameraManual: boolean;
  encaixou: boolean;
  rodando: boolean;
};

type UiGrafo = {
  busca: string;
  selecionado: string | null;
  foco: string | null;
  hover: string | null;
};

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function idPasta(id: string) {
  return `pasta:${id}`;
}

function idDocumento(id: string) {
  return `doc:${id}`;
}

function montarGrafo(pastas: PastaMatrizRH[], documentos: DocumentoRH[]): EstadoGrafo {
  const nos = new Map<string, NoGrafo>();
  nos.set(RAIZ_ID, {
    id: RAIZ_ID,
    tipo: 'raiz',
    rotulo: 'Matriz SGQ',
    pai: null,
    cor: COR,
    raio: 10,
    x: 0,
    y: 0,
    ancoraX: 0,
    ancoraY: 0,
    vx: 0,
    vy: 0,
    fixo: false,
  });

  const pais = new Set(pastas.map((pasta) => pasta.id));
  pastas.forEach((pasta) => {
    const pai = pasta.parentId && pais.has(pasta.parentId) ? idPasta(pasta.parentId) : RAIZ_ID;
    nos.set(idPasta(pasta.id), {
      id: idPasta(pasta.id),
      tipo: 'pasta',
      rotulo: pasta.nome,
      pai,
      cor: COR,
      raio: 7.5,
      x: 0,
      y: 0,
      ancoraX: 0,
      ancoraY: 0,
      vx: 0,
      vy: 0,
      fixo: false,
    });
  });

  documentos.forEach((documento) => {
    const pai = documento.pastaId && pais.has(documento.pastaId) ? idPasta(documento.pastaId) : RAIZ_ID;
    nos.set(idDocumento(documento.id), {
      id: idDocumento(documento.id),
      tipo: 'documento',
      rotulo: documento.titulo,
      pai,
      cor: COR,
      raio: 5,
      x: 0,
      y: 0,
      ancoraX: 0,
      ancoraY: 0,
      vx: 0,
      vy: 0,
      fixo: false,
      documento,
    });
  });

  for (const no of nos.values()) no.cor = COR;

  const filhos = new Map<string, NoGrafo[]>();
  for (const no of nos.values()) {
    if (!no.pai) continue;
    const lista = filhos.get(no.pai) ?? [];
    lista.push(no);
    filhos.set(no.pai, lista);
  }

  const soltar = (pai: NoGrafo, angulo: number, dist: number) => {
    const lista = filhos.get(pai.id) ?? [];
    lista.forEach((filho, indice) => {
      const ang = angulo + (indice - (lista.length - 1) / 2) * 0.85;
      filho.x = pai.x + Math.cos(ang) * dist;
      filho.y = pai.y + Math.sin(ang) * dist;
      soltar(filho, ang, dist * 0.72);
    });
  };
  soltar(nos.get(RAIZ_ID) as NoGrafo, -Math.PI / 3, 150);

  const arestas: Aresta[] = [];
  const vizinhos = new Map<string, Set<string>>();
  const ligar = (de: string, para: string) => {
    const a = vizinhos.get(de) ?? new Set<string>();
    const b = vizinhos.get(para) ?? new Set<string>();
    a.add(para);
    b.add(de);
    vizinhos.set(de, a);
    vizinhos.set(para, b);
  };
  for (const no of nos.values()) {
    if (!no.pai) continue;
    arestas.push({ de: no.pai, para: no.id });
    ligar(no.pai, no.id);
  }

  const subarvore = new Map<string, Set<string>>();
  const visitar = (id: string): Set<string> => {
    const salvo = subarvore.get(id);
    if (salvo) return salvo;
    const conjunto = new Set<string>([id]);
    for (const filho of filhos.get(id) ?? []) {
      for (const item of visitar(filho.id)) conjunto.add(item);
    }
    subarvore.set(id, conjunto);
    return conjunto;
  };
  for (const id of nos.keys()) visitar(id);

  return {
    nos,
    arestas,
    subarvore,
    vizinhos,
    zoom: 1,
    panX: 0,
    panY: 0,
    energia: 1,
    cameraManual: false,
    encaixou: false,
    rodando: false,
  };
}

function encaixar(estado: EstadoGrafo, largura: number, altura: number) {
  const lista = [...estado.nos.values()];
  if (lista.length === 0 || largura < 40 || altura < 40) return;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  lista.forEach((no) => {
    minX = Math.min(minX, no.x - no.raio);
    minY = Math.min(minY, no.y - no.raio);
    maxX = Math.max(maxX, no.x + no.raio);
    maxY = Math.max(maxY, no.y + no.raio + 36);
  });
  const zoom = Math.min(
    1.15,
    Math.max(0.55, Math.min((largura - 240) / Math.max(180, maxX - minX), (altura - 160) / Math.max(180, maxY - minY))),
  );
  estado.zoom = zoom;
  estado.panX = largura / 2 - ((minX + maxX) / 2) * zoom;
  estado.panY = altura / 2 - ((minY + maxY) / 2) * zoom;
}

function passo(estado: EstadoGrafo, flutuar: boolean) {
  const lista = [...estado.nos.values()];
  const alcance = 340 * 340;
  for (let i = 0; i < lista.length; i += 1) {
    for (let j = i + 1; j < lista.length; j += 1) {
      const a = lista[i];
      const b = lista[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let dist2 = dx * dx + dy * dy;
      if (dist2 < 0.04) {
        dx = (i + 1) * 0.2;
        dy = (j + 1) * 0.2;
        dist2 = dx * dx + dy * dy;
      }
      if (dist2 > alcance) continue;
      const dist = Math.sqrt(dist2);
      const forca = 6400 / dist2;
      const fx = (dx / dist) * forca;
      const fy = (dy / dist) * forca;
      if (!a.fixo) {
        a.vx += fx;
        a.vy += fy;
      }
      if (!b.fixo) {
        b.vx -= fx;
        b.vy -= fy;
      }
      const minimo = a.raio + b.raio + 78;
      if (dist < minimo) {
        const empurra = (minimo - dist) * 0.12;
        if (!a.fixo) {
          a.vx += (dx / dist) * empurra;
          a.vy += (dy / dist) * empurra;
        }
        if (!b.fixo) {
          b.vx -= (dx / dist) * empurra;
          b.vy -= (dy / dist) * empurra;
        }
      }
    }
  }

  estado.arestas.forEach((aresta) => {
    const a = estado.nos.get(aresta.de);
    const b = estado.nos.get(aresta.para);
    if (!a || !b) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 0.01;
    const ideal = a.tipo === 'documento' || b.tipo === 'documento' ? 128 : 168;
    const forca = (dist - ideal) * 0.012;
    const fx = (dx / dist) * forca;
    const fy = (dy / dist) * forca;
    if (!a.fixo) {
      a.vx += fx;
      a.vy += fy;
    }
    if (!b.fixo) {
      b.vx -= fx;
      b.vy -= fy;
    }
  });

  const tempo = performance.now() / 1000;
  let energia = 0;
  lista.forEach((no, indice) => {
    if (no.fixo) {
      no.vx = 0;
      no.vy = 0;
      return;
    }
    no.vx -= no.x * 0.006;
    no.vy -= no.y * 0.006;
    if (flutuar) {
      no.vx += Math.sin(tempo * 0.45 + indice * 1.7) * 0.012;
      no.vy += Math.cos(tempo * 0.38 + indice * 1.3) * 0.012;
    }
    no.vx *= flutuar ? 0.9 : 0.8;
    no.vy *= flutuar ? 0.9 : 0.8;
    no.x += no.vx;
    no.y += no.vy;
    energia += no.vx * no.vx + no.vy * no.vy;
  });
  estado.energia = lista.length ? energia / lista.length : 0;
}

function casamentos(estado: EstadoGrafo, busca: string) {
  const termo = busca.trim().toLowerCase();
  const ids = new Set<string>();
  if (!termo) return ids;
  estado.nos.forEach((no) => {
    if (no.rotulo.toLowerCase().includes(termo)) {
      let atual: NoGrafo | undefined = no;
      while (atual) {
        ids.add(atual.id);
        atual = atual.pai ? estado.nos.get(atual.pai) : undefined;
      }
    }
  });
  return ids;
}

function alphaDoNo(estado: EstadoGrafo, ui: UiGrafo, id: string, casados: Set<string>) {
  const termo = ui.busca.trim();
  if (termo) return casados.has(id) ? 1 : 0.07;
  if (ui.foco) return estado.subarvore.get(ui.foco)?.has(id) ? 1 : 0.07;
  const ativo = ui.hover ?? ui.selecionado;
  if (!ativo) return 1;
  if (id === ativo) return 1;
  const no = estado.nos.get(ativo);
  if (!no) return 0.14;
  if (no.tipo === 'pasta' || no.tipo === 'raiz') return estado.subarvore.get(ativo)?.has(id) ? 1 : 0.12;
  if (id === no.pai || estado.vizinhos.get(ativo)?.has(id)) return 1;
  return 0.12;
}

function desenhar(
  ctx: CanvasRenderingContext2D,
  estado: EstadoGrafo,
  ui: UiGrafo,
  largura: number,
  altura: number,
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, largura, altura);

  const espaco = 26;
  const passoGrade = espaco * estado.zoom;
  if (passoGrade >= 8) {
    const origemX = ((estado.panX % passoGrade) + passoGrade) % passoGrade;
    const origemY = ((estado.panY % passoGrade) + passoGrade) % passoGrade;
    const ponto = Math.max(1.1, Math.min(2, 1.35 * estado.zoom));
    ctx.fillStyle = '#c5d0dc';
    for (let x = origemX; x < largura; x += passoGrade) {
      for (let y = origemY; y < altura; y += passoGrade) {
        ctx.beginPath();
        ctx.arc(x, y, ponto / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const casados = casamentos(estado, ui.busca);
  const tela = (no: NoGrafo) => ({
    x: no.x * estado.zoom + estado.panX,
    y: no.y * estado.zoom + estado.panY,
    raio: Math.max(4, Math.min(16, no.raio * estado.zoom)),
  });

  estado.arestas.forEach((aresta) => {
    const a = estado.nos.get(aresta.de);
    const b = estado.nos.get(aresta.para);
    if (!a || !b) return;
    const alpha = Math.min(alphaDoNo(estado, ui, a.id, casados), alphaDoNo(estado, ui, b.id, casados));
    if (alpha < 0.05) return;
    const pa = tela(a);
    const pb = tela(b);
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    ctx.strokeStyle = `rgba(148, 163, 184, ${0.72 * alpha})`;
    ctx.lineWidth = 1.15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pa.x + ux * (pa.raio + 3), pa.y + uy * (pa.raio + 3));
    ctx.lineTo(pb.x - ux * (pb.raio + 3), pb.y - uy * (pb.raio + 3));
    ctx.stroke();
  });

  const ordem = [...estado.nos.values()].sort((a, b) => {
    const peso = { raiz: 0, pasta: 1, documento: 2 };
    return peso[a.tipo] - peso[b.tipo];
  });

  ordem.forEach((no) => {
    const alpha = alphaDoNo(estado, ui, no.id, casados);
    const ponto = tela(no);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ponto.x, ponto.y, ponto.raio + 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = no.cor;
    ctx.beginPath();
    ctx.arc(ponto.x, ponto.y, ponto.raio, 0, Math.PI * 2);
    ctx.fill();
    if (no.id === ui.selecionado || no.id === ui.hover) {
      ctx.strokeStyle = '#0f85c1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ponto.x, ponto.y, ponto.raio + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ordem.forEach((no) => {
    const alpha = alphaDoNo(estado, ui, no.id, casados);
    const destacado = no.id === ui.selecionado || no.id === ui.hover || (ui.busca.trim() && casados.has(no.id) && no.rotulo.toLowerCase().includes(ui.busca.trim().toLowerCase()));
    const mostrar = no.tipo !== 'documento'
      ? alpha > 0.35
      : destacado || (estado.zoom >= 0.85 && alpha > 0.85 && estado.nos.size < 90);
    if (!mostrar) return;
    const ponto = tela(no);
    const texto = no.rotulo.length > 24 ? `${no.rotulo.slice(0, 24).trimEnd()}...` : no.rotulo;
    ctx.globalAlpha = Math.max(alpha, destacado ? 1 : 0);
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.94)';
    ctx.strokeText(texto, ponto.x, ponto.y + ponto.raio + 8);
    ctx.fillStyle = no.tipo === 'documento' ? '#64748b' : '#334155';
    ctx.fillText(texto, ponto.x, ponto.y + ponto.raio + 8);
    ctx.globalAlpha = 1;
  });
}

function noNoPonto(estado: EstadoGrafo, x: number, y: number) {
  const mundoX = (x - estado.panX) / estado.zoom;
  const mundoY = (y - estado.panY) / estado.zoom;
  const lista = [...estado.nos.values()].reverse();
  return lista.find((no) => {
    const folga = 6 / estado.zoom;
    return Math.hypot(no.x - mundoX, no.y - mundoY) <= no.raio + folga;
  }) ?? null;
}

type GrafoProps = {
  pastas: PastaMatrizRH[];
  documentos: DocumentoRH[];
  busca: string;
  selecionado: string | null;
  foco: string | null;
  onSelecionar: (id: string | null) => void;
  onAbrir: (documento: DocumentoRH) => void;
  comandos: React.MutableRefObject<{ aproximar: () => void; afastar: () => void; encaixar: () => void }>;
};

const GrafoEcossistema: React.FC<GrafoProps> = ({
  pastas,
  documentos,
  busca,
  selecionado,
  foco,
  onSelecionar,
  onAbrir,
  comandos,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const estadoRef = useRef<EstadoGrafo | null>(null);
  const uiRef = useRef<UiGrafo>({ busca, selecionado, foco, hover: null });
  const acordarRef = useRef<() => void>(() => undefined);
  uiRef.current = { ...uiRef.current, busca, selecionado, foco };

  useEffect(() => {
    acordarRef.current();
  }, [busca, selecionado, foco]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;
    const contexto = canvas.getContext('2d');
    if (!contexto) return undefined;

    const estado = montarGrafo(pastas, documentos);
    estadoRef.current = estado;
    const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let quadro = 0;
    let passos = 0;

    const medidas = () => {
      const rect = host.getBoundingClientRect();
      return { largura: Math.max(1, rect.width), altura: Math.max(1, rect.height) };
    };

    const ajustarTela = () => {
      const { largura, altura } = medidas();
      const dpr = window.devicePixelRatio || 1;
      const larguraPx = Math.max(1, Math.round(largura * dpr));
      const alturaPx = Math.max(1, Math.round(altura * dpr));
      if (canvas.width !== larguraPx) canvas.width = larguraPx;
      if (canvas.height !== alturaPx) canvas.height = alturaPx;
      return { largura, altura };
    };

    const desenharAgora = () => {
      const { largura, altura } = medidas();
      desenhar(contexto, estado, uiRef.current, largura, altura);
    };

    const loop = () => {
      const esfriando = !reduzirMovimento && passos < 420 && estado.energia > 0.02;
      if (!reduzirMovimento) {
        passo(estado, !esfriando);
        if (esfriando) passos += 1;
      }
      if (!estado.cameraManual && !estado.encaixou) {
        const { largura, altura } = medidas();
        encaixar(estado, largura, altura);
        if (reduzirMovimento || !esfriando) estado.encaixou = true;
      }
      desenharAgora();
      if (reduzirMovimento) {
        estado.rodando = false;
        return;
      }
      quadro = requestAnimationFrame(loop);
    };

    const acordar = () => {
      if (estado.rodando) return;
      estado.rodando = true;
      quadro = requestAnimationFrame(loop);
    };
    acordarRef.current = acordar;

    const tamanho = ajustarTela();
    encaixar(estado, tamanho.largura, tamanho.altura);
    acordar();

    const observer = new ResizeObserver(() => {
      const atual = ajustarTela();
      if (!estado.cameraManual) encaixar(estado, atual.largura, atual.altura);
      desenharAgora();
    });
    observer.observe(host);

    let ponteiro: { id: number; x: number; y: number; no: NoGrafo | null; moveu: boolean; pan: boolean } | null = null;

    const posicao = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const aoPressionar = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const ponto = posicao(event);
      const no = noNoPonto(estado, ponto.x, ponto.y);
      ponteiro = { id: event.pointerId, x: ponto.x, y: ponto.y, no, moveu: false, pan: !no };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = no ? 'grabbing' : 'grabbing';
    };

    const aoMover = (event: PointerEvent) => {
      const ponto = posicao(event);
      if (!ponteiro || ponteiro.id !== event.pointerId) {
        const sob = noNoPonto(estado, ponto.x, ponto.y);
        const proximo = sob?.id ?? null;
        canvas.style.cursor = sob ? 'pointer' : 'grab';
        if (uiRef.current.hover !== proximo) {
          uiRef.current.hover = proximo;
          acordar();
        }
        return;
      }
      const dx = ponto.x - ponteiro.x;
      const dy = ponto.y - ponteiro.y;
      if (Math.hypot(dx, dy) > 3) ponteiro.moveu = true;
      if (ponteiro.no && ponteiro.moveu) {
        ponteiro.no.x += dx / estado.zoom;
        ponteiro.no.y += dy / estado.zoom;
        ponteiro.no.fixo = true;
        ponteiro.no.vx = dx / estado.zoom;
        ponteiro.no.vy = dy / estado.zoom;
        estado.energia = 1;
        passos = 0;
        estado.cameraManual = true;
      } else if (ponteiro.pan) {
        estado.panX += dx;
        estado.panY += dy;
        estado.cameraManual = true;
      }
      ponteiro.x = ponto.x;
      ponteiro.y = ponto.y;
      acordar();
    };

    const aoSoltar = (event: PointerEvent) => {
      if (!ponteiro || ponteiro.id !== event.pointerId) return;
      if (ponteiro.no && ponteiro.moveu) {
        ponteiro.no.fixo = false;
        estado.energia = 1;
        passos = 0;
      } else if (ponteiro.no) onSelecionar(ponteiro.no.id);
      ponteiro = null;
      canvas.style.cursor = 'grab';
    };

    const aoSair = () => {
      if (uiRef.current.hover) {
        uiRef.current.hover = null;
        acordar();
      }
    };

    const aoRolar = (event: WheelEvent) => {
      event.preventDefault();
      const ponto = posicao(event);
      const fator = event.deltaY < 0 ? 1.08 : 0.92;
      const proximo = Math.min(2.6, Math.max(0.22, estado.zoom * fator));
      const mundoX = (ponto.x - estado.panX) / estado.zoom;
      const mundoY = (ponto.y - estado.panY) / estado.zoom;
      estado.zoom = proximo;
      estado.panX = ponto.x - mundoX * proximo;
      estado.panY = ponto.y - mundoY * proximo;
      estado.cameraManual = true;
      acordar();
    };

    const aoDuplo = (event: MouseEvent) => {
      const ponto = posicao(event);
      const no = noNoPonto(estado, ponto.x, ponto.y);
      if (no?.documento) onAbrir(no.documento);
    };

    comandos.current = {
      aproximar: () => {
        const { largura, altura } = medidas();
        const fator = Math.min(2.6, estado.zoom * 1.15);
        const mundoX = (largura / 2 - estado.panX) / estado.zoom;
        const mundoY = (altura / 2 - estado.panY) / estado.zoom;
        estado.zoom = fator;
        estado.panX = largura / 2 - mundoX * fator;
        estado.panY = altura / 2 - mundoY * fator;
        estado.cameraManual = true;
        acordar();
      },
      afastar: () => {
        const { largura, altura } = medidas();
        const fator = Math.max(0.22, estado.zoom / 1.15);
        const mundoX = (largura / 2 - estado.panX) / estado.zoom;
        const mundoY = (altura / 2 - estado.panY) / estado.zoom;
        estado.zoom = fator;
        estado.panX = largura / 2 - mundoX * fator;
        estado.panY = altura / 2 - mundoY * fator;
        estado.cameraManual = true;
        acordar();
      },
      encaixar: () => {
        const { largura, altura } = medidas();
        encaixar(estado, largura, altura);
        estado.cameraManual = false;
        estado.encaixou = true;
        acordar();
      },
    };

    canvas.addEventListener('pointerdown', aoPressionar);
    canvas.addEventListener('pointermove', aoMover);
    canvas.addEventListener('pointerup', aoSoltar);
    canvas.addEventListener('pointercancel', aoSoltar);
    canvas.addEventListener('pointerleave', aoSair);
    canvas.addEventListener('wheel', aoRolar, { passive: false });
    canvas.addEventListener('dblclick', aoDuplo);

    return () => {
      cancelAnimationFrame(quadro);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', aoPressionar);
      canvas.removeEventListener('pointermove', aoMover);
      canvas.removeEventListener('pointerup', aoSoltar);
      canvas.removeEventListener('pointercancel', aoSoltar);
      canvas.removeEventListener('pointerleave', aoSair);
      canvas.removeEventListener('wheel', aoRolar);
      canvas.removeEventListener('dblclick', aoDuplo);
      acordarRef.current = () => undefined;
    };
  }, [pastas, documentos, comandos, onSelecionar, onAbrir]);

  return (
    <div className="sgq-eco-palco" ref={hostRef}>
      <canvas ref={canvasRef} className="sgq-eco-canvas" aria-label="Mapa do ecossistema da matriz de conhecimento" />
    </div>
  );
};

const SGQEcossistema: React.FC = () => {
  const documentosQuery = useDocumentosSGQ();
  const pastasQuery = usePastasMatrizSGQ();
  const baixar = useDownloadDocumentoSGQ();
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [foco, setFoco] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const comandos = useRef({ aproximar: () => undefined, afastar: () => undefined, encaixar: () => undefined });

  const pastas = pastasQuery.data?.results ?? [];
  const documentos = documentosQuery.data?.results ?? [];
  const consulta = {
    isLoading: documentosQuery.isLoading || pastasQuery.isLoading,
    isFetching: documentosQuery.isFetching || pastasQuery.isFetching,
    isError: documentosQuery.isError || pastasQuery.isError,
    data: documentosQuery.data && pastasQuery.data ? { ok: true as const } : undefined,
    error: documentosQuery.error ?? pastasQuery.error ?? undefined,
    refetch: () => Promise.all([documentosQuery.refetch(), pastasQuery.refetch()]),
  } as unknown as QueryResultLike<{ ok: true }>;

  const ramos = useMemo(
    () => pastas.filter((pasta) => !pasta.parentId).map((pasta) => ({
      id: idPasta(pasta.id),
      nome: pasta.nome,
      cor: COR,
    })),
    [pastas],
  );

  const noSelecionado = useMemo(() => {
    if (!selecionado) return null;
    if (selecionado === RAIZ_ID) {
      return { tipo: 'raiz' as const, rotulo: 'Matriz SGQ', caminho: ['Matriz SGQ'], documento: undefined as DocumentoRH | undefined };
    }
    const pasta = pastas.find((item) => idPasta(item.id) === selecionado);
    const documento = documentos.find((item) => idDocumento(item.id) === selecionado);
    if (!pasta && !documento) return null;
    const nomes: string[] = [];
    if (documento) nomes.push(documento.titulo);
    else if (pasta) nomes.push(pasta.nome);
    const porId = new Map(pastas.map((item) => [item.id, item]));
    let pastaId = documento ? (documento.pastaId ?? null) : (pasta?.parentId ?? null);
    const vistos = new Set<string>();
    while (pastaId && !vistos.has(pastaId)) {
      vistos.add(pastaId);
      const atual = porId.get(pastaId);
      if (!atual) break;
      nomes.push(atual.nome);
      pastaId = atual.parentId;
    }
    nomes.push('Matriz SGQ');
    return {
      tipo: documento ? 'documento' as const : 'pasta' as const,
      rotulo: documento?.titulo ?? pasta?.nome ?? '',
      caminho: nomes.reverse(),
      documento,
    };
  }, [selecionado, pastas, documentos]);

  const abrirDocumento = React.useCallback((documento: DocumentoRH) => {
    setAviso('');
    if (documento.linkExterno) {
      window.open(documento.linkExterno, '_blank', 'noopener');
      return;
    }
    baixar.mutate(documento.id, {
      onSuccess: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = documento.nomeArquivo || documento.titulo;
        link.click();
        URL.revokeObjectURL(url);
      },
      onError: () => setAviso('Não foi possível abrir este documento.'),
    });
  }, [baixar]);

  const escolher = React.useCallback((id: string | null) => {
    setSelecionado(id);
    setFoco(null);
  }, []);

  const alternarRamo = (id: string) => {
    setFoco((atual) => (atual === id ? null : id));
    setSelecionado((atual) => (atual === id && foco === id ? null : id));
  };

  const documentosNoRamo = (id: string) => {
    const mapa = new Map(pastas.map((pasta) => [pasta.id, pasta.parentId]));
    const raiz = id.replace('pasta:', '');
    const dentro = (pastaId: string | null | undefined): boolean => {
      let atual = pastaId ?? null;
      const vistos = new Set<string>();
      while (atual && !vistos.has(atual)) {
        if (atual === raiz) return true;
        vistos.add(atual);
        atual = mapa.get(atual) ?? null;
      }
      return false;
    };
    return documentos.filter((documento) => dentro(documento.pastaId)).length;
  };

  return (
    <div className="fat-list-compact sgq-eco">
      <header className="view-header matriz-cabecalho">
        <div className="matriz-titulo">
          <div className="matriz-titulo__marca" />
          <h1 className="view-page-title">Ecossistema SGQ</h1>
        </div>
        <p className="sgq-eco-resumo">
          {pastas.length} {pastas.length === 1 ? 'pasta' : 'pastas'}
          {' · '}
          {documentos.length} {documentos.length === 1 ? 'documento' : 'documentos'}
        </p>
      </header>

      {aviso && <p className="matriz-erro">{aviso}</p>}

      <QueryDataPanel
        query={consulta}
        loadingMessage="Carregando o ecossistema..."
        refreshingMessage="Atualizando o ecossistema..."
        errorMessage="Não foi possível carregar o ecossistema da matriz."
        refreshVariant="overlay"
      >
        <div className="sgq-eco-corpo">
          <div className="sgq-eco-mapa">
            <GrafoEcossistema
              pastas={pastas}
              documentos={documentos}
              busca={busca}
              selecionado={selecionado}
              foco={foco}
              onSelecionar={escolher}
              onAbrir={abrirDocumento}
              comandos={comandos}
            />
            <div className="sgq-eco-zoom" role="group" aria-label="Controles do mapa">
              <button type="button" onClick={() => comandos.current.aproximar()} aria-label="Aproximar">+</button>
              <button type="button" onClick={() => comandos.current.afastar()} aria-label="Afastar">−</button>
              <button type="button" onClick={() => comandos.current.encaixar()}>Encaixar</button>
            </div>
            <aside className="sgq-eco-painel">
              <label className="sgq-eco-busca">
                <span>Buscar</span>
                <input
                  type="search"
                  value={busca}
                  placeholder="Pasta ou documento"
                  onChange={(event) => setBusca(event.target.value)}
                />
              </label>

              <div className="sgq-eco-detalhe">
                {noSelecionado ? (
                  <>
                    <span className="sgq-eco-tipo">
                      {noSelecionado.tipo === 'documento' ? 'Documento' : noSelecionado.tipo === 'pasta' ? 'Pasta' : 'Raiz'}
                    </span>
                    <strong>{noSelecionado.rotulo}</strong>
                    <p>{noSelecionado.caminho.join(' / ')}</p>
                    {noSelecionado.documento && (
                      <p>
                        {noSelecionado.documento.nomeArquivo}
                        {noSelecionado.documento.tamanho ? ` · ${formatBytes(noSelecionado.documento.tamanho)}` : ''}
                        {noSelecionado.documento.incluidoPor ? ` · ${noSelecionado.documento.incluidoPor}` : ''}
                      </p>
                    )}
                    {noSelecionado.documento && (
                      <button
                        type="button"
                        className="sgq-eco-abrir"
                        onClick={() => abrirDocumento(noSelecionado.documento as DocumentoRH)}
                        disabled={baixar.isPending}
                      >
                        {baixar.isPending ? 'Abrindo...' : noSelecionado.documento.linkExterno ? 'Abrir no Drive' : 'Baixar'}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <strong>Mapa da matriz</strong>
                    <p>Cada ponto é uma pasta ou um documento. A linha mostra onde ele está guardado. Clique para destacar o ramo, arraste o fundo para mover e use a roda para aproximar.</p>
                  </>
                )}
              </div>

              {ramos.length > 0 && (
                <div className="sgq-eco-ramos">
                  <span>Ramos</span>
                  <ul>
                    {ramos.map((ramo) => (
                      <li key={ramo.id}>
                        <button
                          type="button"
                          className={foco === ramo.id ? 'is-ativo' : ''}
                          onClick={() => alternarRamo(ramo.id)}
                        >
                          <i style={{ background: ramo.cor }} aria-hidden="true" />
                          <span>{ramo.nome}</span>
                          <em>{documentosNoRamo(ramo.id)}</em>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </div>
      </QueryDataPanel>
    </div>
  );
};

export default SGQEcossistema;
