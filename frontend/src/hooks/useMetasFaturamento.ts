import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type { MetaFaturamentoConfigPayload } from '../types/domain';
import { INDICADORES_META_FATURAMENTO_KEY } from './useIndicadores';

export const METAS_FATURAMENTO_KEY = ['financeiro', 'metas-faturamento'] as const;

export function useMetasFaturamento(ano: number) {
  return useQuery({
    queryKey: [...METAS_FATURAMENTO_KEY, ano],
    queryFn: () => apiService.getMetasFaturamento(ano),
    enabled: Number.isFinite(ano) && ano >= 2000,
    placeholderData: (prev) => prev,
  });
}

export function useSaveMetasFaturamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MetaFaturamentoConfigPayload) => apiService.saveMetasFaturamento(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: METAS_FATURAMENTO_KEY });
      queryClient.invalidateQueries({ queryKey: INDICADORES_META_FATURAMENTO_KEY });
      queryClient.setQueryData([...METAS_FATURAMENTO_KEY, data.ano], data);
    },
  });
}
