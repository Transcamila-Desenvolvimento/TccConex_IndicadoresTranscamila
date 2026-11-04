import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import type { OlhoVivoSalvarPayload } from '../types/domain';

export function useOlhoVivoAno(ano: number) {
  const { selectedFilial } = useAuth();
  return useQuery({
    queryKey: ['frota', 'olho-vivo', 'ano', selectedFilial, ano],
    queryFn: () => apiService.getOlhoVivoAno(ano),
  });
}

export function useOlhoVivo(params: { ano: number; mes: number }, enabled = true) {
  const { selectedFilial } = useAuth();
  return useQuery({
    queryKey: ['frota', 'olho-vivo', selectedFilial, params.ano, params.mes],
    queryFn: () => apiService.getOlhoVivo(params),
    enabled,
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

export function useSalvarOlhoVivo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: OlhoVivoSalvarPayload) => apiService.salvarOlhoVivo(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['frota', 'olho-vivo'] });
    },
  });
}
