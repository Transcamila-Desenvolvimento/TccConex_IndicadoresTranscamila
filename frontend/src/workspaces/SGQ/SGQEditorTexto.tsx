import React, { useEffect, useRef, useState } from 'react';

const TAGS = new Set(['P', 'DIV', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI']);

const ACOES = [
  { cmd: 'bold', icone: 'type-bold', rotulo: 'Negrito' },
  { cmd: 'italic', icone: 'type-italic', rotulo: 'Itálico' },
  { cmd: 'underline', icone: 'type-underline', rotulo: 'Sublinhado' },
  { cmd: 'insertUnorderedList', icone: 'list-ul', rotulo: 'Tópicos' },
  { cmd: 'insertOrderedList', icone: 'list-ol', rotulo: 'Numeração' },
] as const;

function escapar(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizarHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const limpar = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapar(node.textContent ?? '');
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
  const texto = (valor ?? '').replace(/\r\n/g, '\n');
  if (!temMarcacao(texto)) return escapar(texto).replace(/\n/g, '<br>');
  return sanitizarHtml(texto);
}

export function textoPlanoFormatado(valor: string): string {
  const texto = (valor ?? '').replace(/\r\n/g, '\n').trim();
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
  const texto = (valor ?? '').replace(/\r\n/g, '\n').trim();
  if (!texto) return '';
  if (!temMarcacao(texto)) return texto;
  const html = sanitizarHtml(texto);
  return textoVisivel(html) ? html : '';
}

interface EditorTextoProps {
  valor: string;
  rotulo: string;
  placeholder: string;
  onChange: (valor: string) => void;
}

const EditorTexto: React.FC<EditorTextoProps> = ({ valor, rotulo, placeholder, onChange }) => {
  const area = useRef<HTMLDivElement>(null);
  const [ativos, setAtivos] = useState<Set<string>>(new Set());

  useEffect(() => {
    const el = area.current;
    if (!el || document.activeElement === el) return;
    const html = htmlParaExibir(valor);
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [valor]);

  const publicar = () => {
    const el = area.current;
    if (!el) return;
    onChange(normalizarTextoFormatado(el.innerHTML));
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
    <div className="sgq-editor">
      <div className="sgq-editor-barra" role="toolbar" aria-label={`Formatação de ${rotulo}`}>
        {ACOES.map((acao) => (
          <button
            key={acao.cmd}
            type="button"
            className={ativos.has(acao.cmd) ? 'is-ativo' : undefined}
            title={acao.rotulo}
            aria-label={acao.rotulo}
            aria-pressed={ativos.has(acao.cmd)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => aplicar(acao.cmd)}
          >
            <i className={`bi bi-${acao.icone}`} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div
        ref={area}
        className="sgq-editor-area"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={rotulo}
        data-placeholder={placeholder}
        data-vazio={textoVisivel(valor) ? undefined : 'true'}
        onInput={publicar}
        onKeyUp={atualizarAtivos}
        onMouseUp={atualizarAtivos}
        onBlur={publicar}
      />
    </div>
  );
};

export const TextoFormatado: React.FC<{ valor: string }> = ({ valor }) => (
  <div className="sgq-texto-formatado" dangerouslySetInnerHTML={{ __html: htmlParaExibir(valor) }} />
);

export default EditorTexto;
