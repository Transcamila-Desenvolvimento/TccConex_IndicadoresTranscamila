/** Voz do Camilo no navegador: captura da pergunta e leitura da resposta, em português. */

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

export function pararFala(): void {
  leituraAtual += 1;
  emFala.length = 0;
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

function vozPortugues(): SpeechSynthesisVoice | null {
  const lista = window.speechSynthesis.getVoices();
  return lista.find((voz) => voz.lang.toLowerCase() === 'pt-br')
    ?? lista.find((voz) => voz.lang.toLowerCase().startsWith('pt'))
    ?? null;
}

export function falarTexto(
  markdown: string,
  eventos: { onStart?: () => void; onEnd?: () => void } = {},
): void {
  if (!sinteseVozDisponivel()) {
    eventos.onEnd?.();
    return;
  }
  pararFala();
  const token = leituraAtual;
  const partes = fatiar(textoParaFala(markdown));
  if (!partes.length) {
    eventos.onEnd?.();
    return;
  }

  let comecou = false;
  const comecar = () => {
    if (comecou || token !== leituraAtual) return;
    comecou = true;
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
      fala.rate = 1;
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
  };

  const agendar = () => window.setTimeout(comecar, 150);
  if (window.speechSynthesis.getVoices().length > 0) {
    agendar();
    return;
  }
  const seguir = () => {
    window.speechSynthesis.removeEventListener('voiceschanged', seguir);
    agendar();
  };
  window.speechSynthesis.addEventListener('voiceschanged', seguir);
  window.speechSynthesis.getVoices();
  window.setTimeout(seguir, 500);
}

export interface SessaoCaptura {
  /** Para de ouvir e devolve o texto já escrito, inclusive o trecho ainda provisório. */
  parar: () => string;
  /** Descarta a captura sem enviar. */
  cancelar: () => void;
}

/** Ouve até `parar` ou `cancelar`. O navegador pode encerrar sozinho; nesse caso a escuta recomeça. */
export function iniciarCaptura(eventos: {
  onTexto: (confirmado: string, parcial: string) => void;
  onErro: (mensagem: string) => void;
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

  const textoAtual = () => [acumulado, sessaoFinal, parcialAtual].filter(Boolean).join(' ').trim();
  const publicar = () => eventos.onTexto([acumulado, sessaoFinal].filter(Boolean).join(' '), parcialAtual);

  reconhecimento.onresult = (event) => {
    let finais = '';
    let parcial = '';
    for (let indice = 0; indice < event.results.length; indice += 1) {
      const resultado = event.results[indice];
      const texto = resultado[0]?.transcript ?? '';
      if (resultado.isFinal) finais = `${finais} ${texto}`.trim();
      else parcial = `${parcial} ${texto}`.trim();
    }
    sessaoFinal = finais;
    parcialAtual = parcial;
    publicar();
  };
  reconhecimento.onerror = (event) => {
    if (event.error === 'aborted' || event.error === 'no-speech') return;
    if (event.error === 'not-allowed') {
      ativo = false;
      eventos.onErro('Permita o microfone para perguntar por voz.');
      return;
    }
    if (!ativo) return;
    eventos.onErro('Não foi possível ouvir. Tente de novo.');
  };
  reconhecimento.onend = () => {
    if (!ativo) return;
    acumulado = textoAtual();
    sessaoFinal = '';
    parcialAtual = '';
    try {
      reconhecimento.start();
    } catch {
      ativo = false;
      eventos.onErro('A escuta foi interrompida. Aperte o microfone para continuar.');
    }
  };

  try {
    prepararSintese();
    reconhecimento.start();
  } catch {
    eventos.onErro('Não foi possível abrir o microfone.');
    return null;
  }

  return {
    parar: () => {
      ativo = false;
      const texto = textoAtual();
      try {
        reconhecimento.stop();
      } catch {
        reconhecimento.abort();
      }
      return texto;
    },
    cancelar: () => {
      ativo = false;
      reconhecimento.abort();
    },
  };
}
