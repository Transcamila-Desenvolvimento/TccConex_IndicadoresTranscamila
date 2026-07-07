import { useEffect, useRef, useState } from 'react';
import { PAGE_LOADER_MIN_VISIBLE_MS } from '../utils/pageLoaderTiming';

/** Mantém o loader visível pelo menos um ciclo após `active` voltar a false. */
export function useMinLoaderVisibility(
  active: boolean,
  minMs: number = PAGE_LOADER_MIN_VISIBLE_MS,
): boolean {
  const [visible, setVisible] = useState(active);
  const shownAtRef = useRef<number | null>(active ? Date.now() : null);

  useEffect(() => {
    if (active) {
      shownAtRef.current = Date.now();
      setVisible(true);
      return;
    }

    if (shownAtRef.current === null) {
      setVisible(false);
      return;
    }

    const elapsed = Date.now() - shownAtRef.current;
    const remaining = Math.max(0, minMs - elapsed);
    const timerId = window.setTimeout(() => {
      setVisible(false);
      shownAtRef.current = null;
    }, remaining);

    return () => window.clearTimeout(timerId);
  }, [active, minMs]);

  return visible;
}
