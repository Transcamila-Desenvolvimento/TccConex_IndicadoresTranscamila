/** Voz do Camilo no navegador: captura da pergunta e leitura da resposta, em português. */

import { apiService } from '../../services/apiService';

interface AlternativaVoz {
  transcript: string;
}

interface ResultadoVoz {
  isFinal: boolean;
  [index: number]: AlternativaVoz;
}

interface EventoResultadoVoz extends Event {
  resultIndex: number;
  results: ArrayLike<ResultadoVoz>;
}

interface EventoErroVoz extends Event {
  error: string;
}

interface ReconhecimentoVoz extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: EventoResultadoVoz) => void) | null;
  onerror: ((event: EventoErroVoz) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type ConstrutorReconhecimento = new () => ReconhecimentoVoz;

function construtorReconhecimento(): ConstrutorReconhecimento | null {
  const alvo = window as Window & {
    SpeechRecognition?: ConstrutorReconhecimento;
    webkitSpeechRecognition?: ConstrutorReconhecimento;
  };
  return alvo.SpeechRecognition ?? alvo.webkitSpeechRecognition ?? null;
}

export function capturaVozDisponivel(): boolean {
  return construtorReconhecimento() !== null;
}

export function sinteseVozDisponivel(): boolean {
  return typeof window.speechSynthesis !== 'undefined';
}

/** Chamado no clique do microfone para destravar a leitura no celular. */
export function prepararSintese(): void {
  if (!sinteseVozDisponivel()) return;
  window.speechSynthesis.resume();
  const silencio = new SpeechSynthesisUtterance(' ');
  silencio.volume = 0;
  window.speechSynthesis.speak(silencio);
}

let leituraAtual = 0;
const emFala: SpeechSynthesisUtterance[] = [];
let audioAtual: HTMLAudioElement | null = null;

export function pararFala(): void {
  leituraAtual += 1;
  emFala.length = 0;
  if (audioAtual) {
    audioAtual.pause();
    const endereco = audioAtual.src;
    audioAtual.src = '';
    audioAtual = null;
    if (endereco.startsWith('blob:')) URL.revokeObjectURL(endereco);
  }
  if (!window.speechSynthesis) return;
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    window.speechSynthesis.cancel();
  }
  window.speechSynthesis.resume();
}

function textoParaFala(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, '')
    .replace(/\|/g, ', ')
    .replace(/[*_~>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fatiar(texto: string): string[] {
  const frases = texto.split(/(?<=[.!?;:])\s+/).map((frase) => frase.trim()).filter(Boolean);
  const partes: string[] = [];
  let atual = '';
  frases.forEach((frase) => {
    if (`${atual} ${frase}`.trim().length > 240 && atual) {
      partes.push(atual);
      atual = frase;
    } else {
      atual = `${atual} ${frase}`.trim();
    }
  });
  if (atual) partes.push(atual);
  return partes;
}

function notaDaVoz(voz: SpeechSynthesisVoice): number {
  const nome = voz.name.toLowerCase();
  const idioma = voz.lang.toLowerCase();
  if (idioma !== 'pt-br' && !idioma.startsWith('pt')) return -1;
  let nota = idioma === 'pt-br' ? 40 : 16;
  if (/natural|neural|wavenet|premium/.test(nome)) nota += 36;
  if (nome.includes('google')) nota += 24;
  if (/francisca|antonio|thalita|lelo/.test(nome)) nota += 12;
  if (/espeak|compact/.test(nome)) nota -= 30;
  return nota;
}

function vozPortugues(): SpeechSynthesisVoice | null {
  const lista = window.speechSynthesis.getVoices();
  let melhor: SpeechSynthesisVoice | null = null;
  let notaMelhor = -1;
  lista.forEach((voz) => {
    const nota = notaDaVoz(voz);
    if (nota > notaMelhor) {
      notaMelhor = nota;
      melhor = voz;
    }
  });
  return melhor;
}

function textoFalado(markdown: string): string {
  const limpo = textoParaFala(markdown);
  if (limpo.length <= 500) return limpo;
  const corte = limpo.slice(0, 500);
  const ponto = Math.max(corte.lastIndexOf('.'), corte.lastIndexOf('!'), corte.lastIndexOf('?'));
  return (ponto > 80 ? corte.slice(0, ponto + 1) : corte).trim();
}

function tocarAudio(blob: Blob, token: number, eventos: { onStart?: () => void; onEnd?: () => void }): Promise<void> {
  return new Promise((resolve, reject) => {
    if (token !== leituraAtual) {
      resolve();
      return;
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioAtual = audio;
    let terminou = false;
    const fechar = (erro?: unknown) => {
      if (terminou) return;
      terminou = true;
      if (audioAtual === audio) audioAtual = null;
      URL.revokeObjectURL(url);
      if (erro) reject(erro);
      else resolve();
    };
    audio.onplay = () => {
      if (token !== leituraAtual) {
        audio.pause();
        fechar();
        return;
      }
      eventos.onStart?.();
    };
    audio.onended = () => {
      fechar();
      if (token === leituraAtual) eventos.onEnd?.();
    };
    audio.onerror = () => fechar(new Error('audio'));
    audio.play().catch((erro) => fechar(erro));
  });
}

function falarNoNavegador(
  texto: string,
  token: number,
  eventos: { onStart?: () => void; onEnd?: () => void },
): void {
  if (!sinteseVozDisponivel() || token !== leituraAtual) {
    if (token === leituraAtual) eventos.onEnd?.();
    return;
  }
  const partes = fatiar(texto);
  if (!partes.length) {
    eventos.onEnd?.();
    return;
  }
  window.speechSynthesis.resume();
  const voz = vozPortugues();
  let indice = 0;
  let tentativas = 0;
  let encerrou = false;
  const encerrar = () => {
    if (encerrou || token !== leituraAtual) return;
    encerrou = true;
    emFala.length = 0;
    eventos.onEnd?.();
  };
  const proxima = () => {
    if (token !== leituraAtual) return;
    if (indice >= partes.length) {
      encerrar();
      return;
    }
    const fala = new SpeechSynthesisUtterance(partes[indice]);
    fala.lang = 'pt-BR';
    fala.rate = 0.94;
    fala.pitch = 1;
    fala.volume = 1;
    if (voz) fala.voice = voz;
    fala.onend = () => {
      if (token !== leituraAtual) return;
      indice += 1;
      tentativas = 0;
      proxima();
    };
    fala.onerror = () => {
      if (token !== leituraAtual) return;
      if (tentativas < 1) {
        tentativas += 1;
        window.setTimeout(() => {
          window.speechSynthesis.resume();
          proxima();
        }, 150);
        return;
      }
      indice += 1;
      tentativas = 0;
      proxima();
    };
    emFala.push(fala);
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(fala);
  };
  eventos.onStart?.();
  proxima();
}

export function falarTexto(
  markdown: string,
  eventos: { onStart?: () => void; onEnd?: () => void } = {},
): void {
  pararFala();
  const token = leituraAtual;
  const texto = textoFalado(markdown);
  if (!texto) {
    eventos.onEnd?.();
    return;
  }
  apiService.sintetizarVozCamilo(texto)
    .then((blob) => tocarAudio(blob, token, eventos))
    .catch(() => {
      if (token !== leituraAtual) return;
      falarNoNavegador(texto, token, eventos);
    });
}

export interface SessaoCaptura {
  /** Para de ouvir e devolve o texto já escrito, inclusive o trecho ainda provisório. */
  parar: () => string;
  /** Descarta a captura sem enviar. */
  cancelar: () => void;
}

function espacos(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

/** O trecho novo é a mesma fala que já está no fim do texto. */
function repetido(base: string, extra: string): boolean {
  const trecho = espacos(extra);
  if (trecho.length < 48) return false;
  const amostra = trecho.slice(0, Math.min(160, trecho.length));
  if (amostra.length < 48) return false;
  return base.slice(-Math.max(trecho.length * 2, amostra.length)).includes(amostra);
}

/** Junta o trecho novo sem repetir o que o navegador devolve de novo ao religar a escuta. */
function juntar(base: string, extra: string): string {
  const esquerda = espacos(base);
  const direita = espacos(extra);
  if (!direita) return esquerda;
  if (!esquerda) return direita;
  if (direita.startsWith(esquerda)) {
    const acrescimo = direita.slice(esquerda.length).trim();
    if (!acrescimo || repetido(esquerda, acrescimo)) return esquerda;
    return `${esquerda} ${acrescimo}`.trim();
  }
  if (esquerda.endsWith(direita) || repetido(esquerda, direita)) return esquerda;
  const limite = Math.min(esquerda.length, direita.length, 4000);
  for (let tamanho = limite; tamanho >= 24; tamanho -= 1) {
    if (esquerda.slice(-tamanho) === direita.slice(0, tamanho)) {
      const acrescimo = direita.slice(tamanho).trim();
      if (!acrescimo || repetido(esquerda, acrescimo)) return esquerda;
      return `${esquerda}${direita.slice(tamanho)}`.trim();
    }
  }
  if (repetido(esquerda, direita)) return esquerda;
  return `${esquerda} ${direita}`.trim();
}

/** Se a fala inteira foi colada de novo no fim, fica uma cópia. */
function apararRepeticao(texto: string): string {
  const palavras = espacos(texto).split(' ').filter(Boolean);
  if (palavras.length < 16) return palavras.join(' ');
  let fim = palavras.length;
  let mudou = true;
  while (mudou && fim >= 16) {
    mudou = false;
    let k = Math.floor(fim / 2);
    while (k >= 8) {
      let igual = true;
      for (let j = 0; j < k; j += 1) {
        if (palavras[fim - (k * 2) + j].toLowerCase() !== palavras[fim - k + j].toLowerCase()) {
          igual = false;
          break;
        }
      }
      if (igual) {
        fim -= k;
        mudou = true;
        break;
      }
      k = k > 64 ? Math.floor(k / 2) : k - 1;
    }
  }
  return palavras.slice(0, fim).join(' ');
}

/**
 * Ouve até `parar` ou `cancelar`.
 * Silêncio, queda de rede, troca de aba ou outro app no microfone encerram a escuta do Chrome.
 * O texto já escrito fica guardado e o microfone religa sozinho.
 */
export function iniciarCaptura(eventos: {
  onTexto: (confirmado: string, parcial: string) => void;
  onErro: (mensagem: string) => void;
  /** Na conversa ao vivo, a pausa na fala envia sozinha. */
  onSilencio?: (texto: string) => void;
}): SessaoCaptura | null {
  const Construtor = construtorReconhecimento();
  if (!Construtor) {
    eventos.onErro('Este navegador não captura voz. Use Chrome ou Edge.');
    return null;
  }
  const reconhecimento = new Construtor();
  reconhecimento.lang = 'pt-BR';
  reconhecimento.continuous = true;
  reconhecimento.interimResults = true;
  let acumulado = '';
  let sessaoFinal = '';
  let parcialAtual = '';
  let ativo = true;
  let escutando = false;
  let ligando = false;
  let geracao = 0;
  let reinicio: number | null = null;
  let vigia: number | null = null;
  let silencio: number | null = null;
  let ultimoSinal = Date.now();
  let ultimoTextoEm = Date.now();

  const textoAtual = () => apararRepeticao(juntar(acumulado, [sessaoFinal, parcialAtual].filter(Boolean).join(' ')));
  const publicar = () => eventos.onTexto(apararRepeticao(juntar(acumulado, sessaoFinal)), parcialAtual);
  const marcar = () => {
    ultimoSinal = Date.now();
  };
  const marcarFala = () => {
    ultimoSinal = Date.now();
    ultimoTextoEm = Date.now();
  };
  const limparReinicio = () => {
    if (reinicio === null) return;
    window.clearTimeout(reinicio);
    reinicio = null;
  };
  const religar = () => {
    if (!ativo || escutando || ligando) return;
    ligando = true;
    marcar();
    try {
      reconhecimento.start();
    } catch {
      ligando = false;
      agendarReinicio(700);
    }
  };
  const agendarReinicio = (atraso: number) => {
    if (!ativo || reinicio !== null) return;
    reinicio = window.setTimeout(() => {
      reinicio = null;
      religar();
    }, atraso);
  };
  const aoVoltar = () => {
    if (!ativo || document.visibilityState === 'hidden') return;
    if (!escutando) agendarReinicio(300);
  };
  const soltar = () => {
    ativo = false;
    limparReinicio();
    if (vigia !== null) {
      window.clearInterval(vigia);
      vigia = null;
    }
    if (silencio !== null) {
      window.clearInterval(silencio);
      silencio = null;
    }
    document.removeEventListener('visibilitychange', aoVoltar);
    window.removeEventListener('online', aoVoltar);
    window.removeEventListener('pageshow', aoVoltar);
  };
  const guardarSessao = () => {
    geracao += 1;
    acumulado = apararRepeticao(juntar(acumulado, sessaoFinal));
    sessaoFinal = '';
    parcialAtual = '';
    publicar();
    marcar();
  };

  reconhecimento.onstart = () => {
    ligando = false;
    escutando = true;
    marcar();
    sessaoFinal = '';
    parcialAtual = '';
  };
  reconhecimento.onresult = (event) => {
    const minha = geracao;
    let finais = '';
    let parcial = '';
    for (let indice = 0; indice < event.results.length; indice += 1) {
      const resultado = event.results[indice];
      const texto = resultado[0]?.transcript ?? '';
      if (resultado.isFinal) finais = juntar(finais, texto);
      else parcial = texto;
    }
    if (minha !== geracao || !ativo) return;
    sessaoFinal = finais;
    parcialAtual = parcial;
    if (`${finais} ${parcial}`.trim()) marcarFala();
    else marcar();
    publicar();
  };
  reconhecimento.onerror = (event) => {
    ligando = false;
    if (!ativo) return;
    if (event.error === 'not-allowed') {
      soltar();
      try {
        reconhecimento.abort();
      } catch {
        /* o navegador já encerrou */
      }
      eventos.onErro('Permita o microfone para perguntar por voz.');
      return;
    }
    marcar();
    window.setTimeout(() => {
      if (!ativo || escutando || ligando || document.visibilityState === 'hidden') return;
      religar();
    }, 400);
  };
  reconhecimento.onend = () => {
    ligando = false;
    escutando = false;
    if (!ativo) return;
    guardarSessao();
    if (document.visibilityState === 'hidden') return;
    agendarReinicio(280);
  };

  vigia = window.setInterval(() => {
    if (!ativo || document.visibilityState === 'hidden' || Date.now() - ultimoSinal < 20000) return;
    ligando = false;
    if (escutando) {
      try {
        reconhecimento.abort();
      } catch {
        escutando = false;
        religar();
      }
      return;
    }
    religar();
  }, 4000);

  document.addEventListener('visibilitychange', aoVoltar);
  window.addEventListener('online', aoVoltar);
  window.addEventListener('pageshow', aoVoltar);

  if (eventos.onSilencio) {
    let avisou = false;
    silencio = window.setInterval(() => {
      if (!ativo || avisou) return;
      const texto = textoAtual().trim();
      if (texto.length < 8 || Date.now() - ultimoTextoEm < 1400) return;
      avisou = true;
      eventos.onSilencio?.(texto);
    }, 300);
  }

  try {
    prepararSintese();
  } catch {
    /* a leitura da resposta pode esperar o próximo toque */
  }
  window.setTimeout(() => {
    if (!ativo) return;
    religar();
  }, 250);

  return {
    parar: () => {
      const texto = textoAtual();
      soltar();
      try {
        reconhecimento.stop();
      } catch {
        try {
          reconhecimento.abort();
        } catch {
          /* já estava parado */
        }
      }
      return texto;
    },
    cancelar: () => {
      soltar();
      try {
        reconhecimento.abort();
      } catch {
        /* já estava parado */
      }
    },
  };
}
