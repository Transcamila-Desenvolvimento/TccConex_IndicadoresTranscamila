import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';

export const ND_PAGADORES_KEY = ['faturamento', 'nds', 'pagadores'] as const;

export function useNdPagadores() {
  return useQuery({
    queryKey: ND_PAGADORES_KEY,
    queryFn: () => apiService.getNdPagadores(),
    staleTime: 15_000,
  });
}

export function useSalvarNdPagadores() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (codigos: string[]) => apiService.salvarNdPagadores(codigos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faturamento', 'nds'] });
    },
  });
}

export function useNdTitulos(params: { page: number; pageSize: number; search: string }, enabled: boolean) {
  return useQuery({
    queryKey: ['faturamento', 'nds', 'titulos', params],
    queryFn: () => apiService.getNdTitulos(params),
    enabled,
    placeholderData: (prev) => prev,
  });
}
