import React, { useEffect, useRef, useState } from 'react';

const TAGS = new Set(['P', 'DIV', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI']);

const ICONES: Record<string, React.ReactNode> = {
  bold: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.2 2.2h4.4a3.1 3.1 0 0 1 2.2 5.2A3.3 3.3 0 0 1 8.9 13.8H4.2V2.2Zm2 4.5h2.1a1.2 1.2 0 0 0 0-2.4H6.2v2.4Zm0 5.1h2.7a1.35 1.35 0 0 0 0-2.7H6.2v2.7Z" />
    </svg>
  ),
  italic: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M7 2.2h5.2v1.8H10l-2.2 8h2.1v1.8H4.6v-1.8h2.1l2.2-8H7V2.2Z" />
    </svg>
  ),
  underline: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.2 2.2h1.9v5.2a1.9 1.9 0 0 0 3.8 0V2.2h1.9v5.2a3.8 3.8 0 0 1-7.6 0V2.2ZM3.4 13.8h9.2V12H3.4v1.8Z" />
    </svg>
  ),
  bullets: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.2 3.4a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Zm3.2.3h8.2v1.6H5.4V3.7Zm-3.2 3.7a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Zm3.2.3h8.2v1.6H5.4V7.7Zm-3.2 3.7a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Zm3.2.3h8.2V13H5.4v-1.3Z" />
    </svg>
  ),
  numbers: (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.1 2.4h1.3v3.2h.8v1.1H2.2V5.6h.9V3.5l-.7.3V2.8l.7-.4Zm-.9 6.2h2.9v1.1l-1.6 1.7h1.6v1.1H2.1v-1.1l1.6-1.7H2.2V8.6Zm4.2-5.2h7.4v1.6H6.4V3.4Zm0 4.3h7.4v1.6H6.4V7.7Zm0 4.3h7.4V13H6.4v-1Z" />
    </svg>
  ),
};

const ACOES = [
  { cmd: 'bold', icone: 'bold', rotulo: 'Negrito', grupo: 'texto' },
  { cmd: 'italic', icone: 'italic', rotulo: 'Itálico', grupo: 'texto' },
  { cmd: 'underline', icone: 'underline', rotulo: 'Sublinhado', grupo: 'texto' },
  { cmd: 'insertUnorderedList', icone: 'bullets', rotulo: 'Tópicos', grupo: 'lista' },
  { cmd: 'insertOrderedList', icone: 'numbers', rotulo: 'Numeração', grupo: 'lista' },
] as const;

function escapar(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** O editor troca alguns espaços por &nbsp;. Sem isso, o código aparece no campo. */
function espacosNormais(texto: string) {
  return texto
    .replace(/\u00a0/g, ' ')
    .replace(/&(amp;)*(?:nbsp|#160|#x0*a0);/gi, ' ');
}

function sanitizarHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const limpar = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapar(espacosNormais(node.textContent ?? ''));
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return '';
    const filhos = [...el.childNodes].map(limpar).join('');
    if (!TAGS.has(el.tagName)) return filhos;
    if (el.tagName === 'BR') return '<br>';
    return `<${el.tagName.toLowerCase()}>${filhos}</${el.tagName.toLowerCase()}>`;
  };
  return [...doc.body.childNodes].map(limpar).join('');
}

function temMarcacao(valor: string) {
  return /<[a-z!/]/i.test(valor);
}

export function htmlParaExibir(valor: string): string {
  const texto = espacosNormais((valor ?? '').replace(/\r\n/g, '\n'));
  if (!temMarcacao(texto)) return escapar(texto).replace(/\n/g, '<br>');
  return sanitizarHtml(texto);
}

export function textoPlanoFormatado(valor: string): string {
  const texto = espacosNormais((valor ?? '').replace(/\r\n/g, '\n')).trim();
  if (!temMarcacao(texto)) return texto;
  const comQuebras = sanitizarHtml(texto)
    .replace(/<li>/g, '\n• ')
    .replace(/<br>/g, '\n')
    .replace(/<\/(p|div|ul|ol|li)>/g, '\n');
  const doc = new DOMParser().parseFromString(comQuebras, 'text/html');
  return (doc.body.textContent ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function textoVisivel(valor: string): string {
  const doc = new DOMParser().parseFromString(htmlParaExibir(valor), 'text/html');
  return (doc.body.textContent ?? '').replace(/\u00a0/g, ' ').trim();
}

export function normalizarTextoFormatado(valor: string): string {
  const texto = espacosNormais((valor ?? '').replace(/\r\n/g, '\n')).trim();
  if (!texto) return '';
  if (!temMarcacao(texto)) return texto;
  const html = sanitizarHtml(texto);
  return textoVisivel(html) ? html : '';
}

interface EditorTextoProps {
  valor: string;
  rotulo: string;
  placeholder: string;
  disabled?: boolean;
  onChange: (valor: string) => void;
  onFocus?: () => void;
  onBlur?: (valor: string) => void;
  /** Quando muda, o texto de fora substitui o que está no campo, mesmo com o foco nele. */
  revisao?: number;
}

const EditorTexto: React.FC<EditorTextoProps> = ({ valor, rotulo, placeholder, disabled = false, onChange, onFocus, onBlur, revisao = 0 }) => {
  const area = useRef<HTMLDivElement>(null);
  const [ativos, setAtivos] = useState<Set<string>>(new Set());
  const revisaoAplicada = useRef(0);

  useEffect(() => {
    const el = area.current;
    if (!el || document.activeElement === el) return;
    const html = htmlParaExibir(valor);
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [valor]);

  useEffect(() => {
    if (!revisao || revisaoAplicada.current === revisao) return;
    revisaoAplicada.current = revisao;
    const el = area.current;
    if (!el) return;
    el.innerHTML = htmlParaExibir(valor);
  }, [revisao, valor]);

  const publicar = () => {
    const el = area.current;
    if (!el) return '';
    const texto = normalizarTextoFormatado(el.innerHTML);
    onChange(texto);
    return texto;
  };

  const atualizarAtivos = () => {
    const el = area.current;
    if (!el || document.activeElement !== el) return;
    setAtivos(new Set(ACOES.filter((acao) => document.queryCommandState(acao.cmd)).map((acao) => acao.cmd)));
  };

  const aplicar = (comando: string) => {
    area.current?.focus();
    document.execCommand(comando);
    publicar();
    atualizarAtivos();
  };

  return (
    <div className={`sgq-editor${disabled ? ' is-disabled' : ''}`}>
      <div className="sgq-editor-barra" role="toolbar" aria-label={`Formatação de ${rotulo}`}>
        {ACOES.map((acao, indice) => (
          <React.Fragment key={acao.cmd}>
            {indice > 0 && ACOES[indice - 1].grupo !== acao.grupo && <span className="sgq-editor-separa" />}
            <button
              type="button"
              className={ativos.has(acao.cmd) ? 'is-ativo' : undefined}
              title={acao.rotulo}
              aria-label={acao.rotulo}
              aria-pressed={ativos.has(acao.cmd)}
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => aplicar(acao.cmd)}
            >
              {ICONES[acao.icone]}
            </button>
          </React.Fragment>
        ))}
      </div>
      <div
        ref={area}
        className="sgq-editor-area"
        contentEditable={!disabled}
        role="textbox"
        aria-multiline="true"
        aria-disabled={disabled}
        aria-label={rotulo}
        data-placeholder={placeholder}
        data-vazio={textoVisivel(valor) ? undefined : 'true'}
        onFocus={() => { if (!disabled) onFocus?.(); }}
        onInput={() => { if (!disabled) publicar(); }}
        onKeyUp={atualizarAtivos}
        onMouseUp={atualizarAtivos}
        onBlur={() => { if (!disabled) onBlur?.(publicar()); }}
      />
    </div>
  );
};

export const TextoFormatado: React.FC<{ valor: string }> = ({ valor }) => (
  <div className="sgq-texto-formatado" dangerouslySetInnerHTML={{ __html: htmlParaExibir(valor) }} />
);

export default EditorTexto;
