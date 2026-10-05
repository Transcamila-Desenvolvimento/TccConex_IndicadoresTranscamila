import { useRef, type DragEvent } from 'react';

export function reordenarLista<T>(lista: T[], de: number, antesDe: number): T[] {
  if (de < 0 || de >= lista.length) return lista;
  const destino = Math.max(0, Math.min(antesDe, lista.length));
  if (destino === de || destino === de + 1) return lista;
  const proxima = [...lista];
  const [item] = proxima.splice(de, 1);
  proxima.splice(destino > de ? destino - 1 : destino, 0, item);
  return proxima;
}

export function useArrasteLista(ativo: boolean) {
  const caixa = useRef<HTMLDivElement>(null);
  const linha = useRef<HTMLSpanElement>(null);
  const origem = useRef<number | null>(null);
  const antesDeRef = useRef<number | null>(null);

  const pintar = (topo: number | null, esquerda: number, largura: number) => {
    const el = linha.current;
    if (!el) return;
    if (topo === null) {
      el.classList.remove('is-on');
      return;
    }
    el.classList.add('is-on');
    el.style.top = `${topo}px`;
    el.style.left = `${esquerda}px`;
    el.style.width = `${largura}px`;
  };

  const limpar = () => {
    origem.current = null;
    antesDeRef.current = null;
    pintar(null, 0, 0);
  };

  const propsAlca = (index: number) => ({
    type: 'button' as const,
    className: 'proposta-drag-handle',
    draggable: ativo,
    title: 'Arrastar para reordenar',
    'aria-label': 'Arrastar para reordenar',
    onDragStart: (event: DragEvent<HTMLButtonElement>) => {
      if (!ativo) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
      origem.current = index;
      antesDeRef.current = null;
    },
    onDragEnd: () => {
      window.setTimeout(limpar, 0);
    },
  });

  const propsLinha = (index: number, mover: (de: number, antesDe: number) => void) => ({
    onDragOver: (event: DragEvent<HTMLTableRowElement>) => {
      const de = origem.current;
      if (!ativo || de === null) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const rect = event.currentTarget.getBoundingClientRect();
      const antes = event.clientY < rect.top + rect.height / 2;
      const antesDe = antes ? index : index + 1;
      if (antesDe === de || antesDe === de + 1) {
        antesDeRef.current = null;
        pintar(null, 0, 0);
        return;
      }
      const area = caixa.current;
      if (!area) return;
      const areaRect = area.getBoundingClientRect();
      const borda = antes ? rect.top : rect.bottom;
      antesDeRef.current = antesDe;
      pintar(
        borda - areaRect.top + area.scrollTop,
        rect.left - areaRect.left + area.scrollLeft,
        rect.width,
      );
    },
    onDrop: (event: DragEvent<HTMLTableRowElement>) => {
      event.preventDefault();
      const de = origem.current ?? Number(event.dataTransfer.getData('text/plain'));
      const antesDe = antesDeRef.current;
      if (!ativo || Number.isNaN(de) || antesDe === null) return;
      mover(de, antesDe);
    },
  });

  const marca = <span ref={linha} className="proposta-insert-line" aria-hidden="true" />;

  return { refCaixa: caixa, marca, propsAlca, propsLinha };
}

export function AlcaArraste(props: ReturnType<ReturnType<typeof useArrasteLista>['propsAlca']>) {
  return (
    <button {...props}>
      <i className="bi bi-grip-vertical" aria-hidden="true" />
    </button>
  );
}
