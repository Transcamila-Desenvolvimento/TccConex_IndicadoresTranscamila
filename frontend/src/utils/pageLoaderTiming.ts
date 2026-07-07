import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/** Um ciclo das 3 barras: 0,55s de animação + 0,16s de delay da última. */
export const PAGE_LOADER_MIN_VISIBLE_MS = 700;

export function lazyWithMinDuration<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  minMs: number = PAGE_LOADER_MIN_VISIBLE_MS,
): LazyExoticComponent<T> {
  return lazy(() =>
    Promise.all([
      factory(),
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, minMs);
      }),
    ]).then(([module]) => module),
  );
}
