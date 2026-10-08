import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type { CaixinhaDescricao, CaixinhaLancamento, CaixinhaQueryParams } from '../types/domain';

export const CAIXINHA_KEY = ['financeiro', 'caixinha'] as const;
export const CAIXINHA_RESUMO_KEY = ['financeiro', 'caixinha', 'resumo'] as const;
export const CAIXINHA_DESCRICOES_KEY = ['financeiro', 'caixinha', 'descricoes'] as const;

export function useCaixinhaLancamentos(params: CaixinhaQueryParams, enabled = true) {
  return useQuery({
    queryKey: [...CAIXINHA_KEY, params],
    queryFn: () => apiService.getCaixinhaLancamentos(params),
    enabled,
  });
}

export function useCaixinhaResumo(enabled = true) {
  return useQuery({
    queryKey: CAIXINHA_RESUMO_KEY,
    queryFn: () => apiService.getCaixinhaResumo(),
    enabled,
  });
}

function useInvalidateCaixinha() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: CAIXINHA_KEY });
    queryClient.invalidateQueries({ queryKey: CAIXINHA_RESUMO_KEY });
  };
}

export function useCreateCaixinhaLancamento() {
  const invalidate = useInvalidateCaixinha();
  return useMutation({
    mutationFn: (payload: Omit<CaixinhaLancamento, 'id' | 'user'>) => apiService.createCaixinhaLancamento(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateCaixinhaLancamento() {
  const invalidate = useInvalidateCaixinha();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Omit<CaixinhaLancamento, 'id' | 'user'>> }) =>
      apiService.updateCaixinhaLancamento(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteCaixinhaLancamento() {
  const invalidate = useInvalidateCaixinha();
  return useMutation({
    mutationFn: (id: number) => apiService.deleteCaixinhaLancamento(id),
    onSuccess: invalidate,
  });
}

export function useCaixinhaExtrato() {
  return useMutation({
    mutationFn: ({ startDate, endDate }: { startDate: string; endDate: string }) =>
      apiService.getCaixinhaExtrato(startDate, endDate),
  });
}

export function useCaixinhaDescricoes(enabled = true) {
  return useQuery({
    queryKey: CAIXINHA_DESCRICOES_KEY,
    queryFn: () => apiService.getCaixinhaDescricoes(),
    enabled,
  });
}

function useInvalidateCaixinhaDescricoes() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: CAIXINHA_DESCRICOES_KEY });
  };
}

export function useCreateCaixinhaDescricao() {
  const invalidate = useInvalidateCaixinhaDescricoes();
  return useMutation({
    mutationFn: (payload: Omit<CaixinhaDescricao, 'id'>) => apiService.createCaixinhaDescricao(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateCaixinhaDescricao() {
  const invalidate = useInvalidateCaixinhaDescricoes();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Omit<CaixinhaDescricao, 'id'>> }) =>
      apiService.updateCaixinhaDescricao(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteCaixinhaDescricao() {
  const invalidate = useInvalidateCaixinhaDescricoes();
  return useMutation({
    mutationFn: (id: number) => apiService.deleteCaixinhaDescricao(id),
    onSuccess: invalidate,
  });
}
