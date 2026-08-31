import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type { CondutorFrotaPayload, VeiculoFrotaPayload } from '../types/domain';

export const FROTA_VEICULOS_KEY = ['frota', 'veiculos'] as const;
export const FROTA_CONDUTORES_KEY = ['frota', 'condutores'] as const;

export function useVeiculosFrota() {
  return useQuery({
    queryKey: FROTA_VEICULOS_KEY,
    queryFn: () => apiService.getVeiculosFrota(),
  });
}

export function useCreateVeiculoFrota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: VeiculoFrotaPayload) => apiService.createVeiculoFrota(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FROTA_VEICULOS_KEY }),
  });
}

export function useUpdateVeiculoFrota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<VeiculoFrotaPayload> }) =>
      apiService.updateVeiculoFrota(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FROTA_VEICULOS_KEY }),
  });
}

export function useDeleteVeiculoFrota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteVeiculoFrota(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FROTA_VEICULOS_KEY }),
  });
}

export function useCondutoresFrota() {
  return useQuery({
    queryKey: FROTA_CONDUTORES_KEY,
    queryFn: () => apiService.getCondutoresFrota(),
  });
}

export function useCreateCondutorFrota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CondutorFrotaPayload) => apiService.createCondutorFrota(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FROTA_CONDUTORES_KEY }),
  });
}

export function useUpdateCondutorFrota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CondutorFrotaPayload> }) =>
      apiService.updateCondutorFrota(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FROTA_CONDUTORES_KEY }),
  });
}

export function useDeleteCondutorFrota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteCondutorFrota(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FROTA_CONDUTORES_KEY }),
  });
}

export function getFrotaErrorMessage(error: unknown): string {
  if (error instanceof Error && !('response' in error) && error.message) {
    return error.message;
  }
  const err = error as {
    response?: { data?: Record<string, unknown> | string };
    message?: string;
  };
  const data = err.response?.data;
  if (!data) return err.message || 'Não foi possível concluir a operação.';
  if (typeof data === 'string') return data;
  if (typeof data.detail === 'string') return data.detail;
  for (const value of Object.values(data)) {
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    if (typeof value === 'string') return value;
  }
  return 'Não foi possível concluir a operação.';
}
