import type { UseQueryResult } from '@tanstack/react-query';

export interface AsyncQueryInput {
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  hasData: boolean;
}

/** Subconjunto estável de `UseQueryResult` usado pelo painel de loading. */
export type QueryResultLike<T> = Pick<
  UseQueryResult<T, Error>,
  'isLoading' | 'isFetching' | 'isError' | 'data'
>;

export function toAsyncQueryInput<T>(query: QueryResultLike<T>): AsyncQueryInput {
  return {
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    hasData: query.data != null,
  };
}

export function useAsyncQueryState(input: AsyncQueryInput | QueryResultLike<unknown>) {
  const flags = 'hasData' in input ? input : toAsyncQueryInput(input);
  const { isLoading, isFetching, isError, hasData } = flags;

  const showInitialLoader = isLoading && !hasData;
  const showRefreshing = isFetching && hasData;
  const showError = isError && !hasData;
  const canShowEmpty = !showInitialLoader && !showError && !isFetching && hasData;

  return {
    showInitialLoader,
    showRefreshing,
    showError,
    canShowEmpty,
  };
}
