import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type { VeiculoComercialPayload } from '../types/domain';

export const COMERCIAL_VEICULOS_KEY = ['comercial', 'veiculos'] as const;

export function useVeiculosComercial(options: { ativo?: boolean; enabled?: boolean } = {}) {
  const ativo = Boolean(options.ativo);
  return useQuery({
    queryKey: [...COMERCIAL_VEICULOS_KEY, { ativo }],
    queryFn: () => apiService.getVeiculosComercial({ ativo }),
    enabled: options.enabled ?? true,
  });
}

export function useSaveVeiculoComercial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: VeiculoComercialPayload }) => (
      id ? apiService.updateVeiculoComercial(id, payload) : apiService.createVeiculoComercial(payload)
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_VEICULOS_KEY }),
  });
}

export function useDeleteVeiculoComercial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteVeiculoComercial(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_VEICULOS_KEY }),
  });
}
