import type { Query, QueryClient } from '@tanstack/react-query';

import { apiService } from '../services/apiService';

export type MarketingSyncHint = {
  campanhaId?: string | null;
  event?: string;
};

async function refreshMarketingQuery(
  queryClient: QueryClient,
  query: Query,
  hint?: MarketingSyncHint,
): Promise<void> {
  const key = query.queryKey;
  if (!Array.isArray(key) || key[0] !== 'marketing') return;

  try {
    if (key[1] === 'directory') {
      queryClient.setQueryData(key, await apiService.getUserDirectory('Marketing'));
      return;
    }

    if (key[1] === 'campanhas' && key[2] === 'quadro') {
      queryClient.setQueryData(key, await apiService.getCampanhaQuadro());
      return;
    }

    if (key[1] === 'campanhas' && key[2] && typeof key[2] === 'object') {
      const params = key[2] as { start?: string; end?: string; search?: string };
      queryClient.setQueryData(key, await apiService.getCampanhas(params));
      return;
    }

    if (key[1] === 'campanha' && typeof key[2] === 'string') {
      const id = key[2];
      if (hint?.event === 'deleted' && hint.campanhaId === id) {
        queryClient.removeQueries({ queryKey: key });
        return;
      }
      queryClient.setQueryData(key, await apiService.getCampanha(id));
    }
  } catch {
    /* mantém dados atuais se o refresh silencioso falhar */
  }
}

/** Atualiza queries ativas do Marketing sem disparar loader de refetch. */
export async function syncMarketingQueriesSilently(
  queryClient: QueryClient,
  hint?: MarketingSyncHint,
): Promise<void> {
  const queries = queryClient.getQueryCache().findAll({
    queryKey: ['marketing'],
    type: 'active',
  });

  await Promise.all(queries.map((query) => refreshMarketingQuery(queryClient, query, hint)));
}
