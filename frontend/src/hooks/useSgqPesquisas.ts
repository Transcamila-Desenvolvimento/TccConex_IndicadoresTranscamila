import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiService } from '../services/apiService';
import type { SgqPesquisaBulkErrors, SgqPesquisaPayload, SgqPesquisaQueryParams } from '../types/domain';

export const SGQ_KEYS = {
  pesquisas: (params: SgqPesquisaQueryParams) => ['sgq', 'pesquisas', params] as const,
  stats: (params: SgqPesquisaQueryParams) => ['sgq', 'pesquisas-stats', params] as const,
  all: ['sgq'] as const,
};

export function useSgqPesquisas(params: SgqPesquisaQueryParams) {
  return useQuery({
    queryKey: SGQ_KEYS.pesquisas(params),
    queryFn: () => apiService.getSgqPesquisas(params),
  });
}

export function useSgqPesquisaStats(params: SgqPesquisaQueryParams) {
  return useQuery({
    queryKey: SGQ_KEYS.stats(params),
    queryFn: () => apiService.getSgqPesquisaStats(params),
  });
}

export function useCreateSgqPesquisa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SgqPesquisaPayload) => apiService.createSgqPesquisa(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SGQ_KEYS.all }),
  });
}

export function useBulkCreateSgqPesquisas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payloads: SgqPesquisaPayload[]) => apiService.bulkCreateSgqPesquisas(payloads),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SGQ_KEYS.all }),
  });
}

export function useUpdateSgqPesquisa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SgqPesquisaPayload> }) =>
      apiService.updateSgqPesquisa(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SGQ_KEYS.all }),
  });
}

export function useDeleteSgqPesquisa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteSgqPesquisa(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SGQ_KEYS.all }),
  });
}

/** Extrai os erros por linha/campo de uma falha do bulk_create (400 com { errors: {...} }). */
export function getSgqBulkErrors(error: unknown): SgqPesquisaBulkErrors | null {
  if (axios.isAxiosError(error) && error.response?.status === 400) {
    const errors = error.response.data?.errors;
    if (errors && typeof errors === 'object') return errors as SgqPesquisaBulkErrors;
  }
  return null;
}
