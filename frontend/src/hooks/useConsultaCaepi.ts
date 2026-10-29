import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/apiService';

export function useConsultaCaepi(numero: string) {
  return useQuery({
    queryKey: ['compras', 'caepi', numero],
    queryFn: () => apiService.consultarCaepi(numero),
    enabled: numero.length > 0,
    retry: false,
    staleTime: 30 * 60 * 1000,
  });
}
