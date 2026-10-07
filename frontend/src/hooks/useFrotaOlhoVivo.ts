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

export function useSalvarOlhoVivo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: OlhoVivoSalvarPayload) => apiService.salvarOlhoVivo(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['frota', 'olho-vivo'] });
    },
  });
}
