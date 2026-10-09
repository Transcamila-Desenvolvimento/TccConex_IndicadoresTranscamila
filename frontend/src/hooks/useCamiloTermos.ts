import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import type { CamiloTermoPublicacao } from '../types/domain';

export const CAMILO_MEU_TERMO_KEY = ['camilo', 'termo'] as const;
export const CAMILO_TERMOS_ACEITOS_KEY = ['camilo', 'termos'] as const;
export const CAMILO_TERMO_VIGENTE_KEY = ['camilo', 'termo-vigente'] as const;

export function useCamiloMeuTermo() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...CAMILO_MEU_TERMO_KEY, user?.id ?? ''],
    queryFn: apiService.getCamiloMeuTermo,
    enabled: Boolean(user?.id),
  });
}

export function useAceitarCamiloTermo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiService.aceitarCamiloTermo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAMILO_MEU_TERMO_KEY });
      queryClient.invalidateQueries({ queryKey: CAMILO_TERMOS_ACEITOS_KEY });
    },
  });
}

export function useCamiloTermosAceitos(
  search: string,
  page: number,
  ordering: 'data_asc' | 'data_desc',
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...CAMILO_TERMOS_ACEITOS_KEY, search.trim(), page, ordering],
    queryFn: () => apiService.getCamiloTermosAceitos(search, page, 10, ordering),
    enabled,
  });
}

export function useCamiloTermoVigente() {
  return useQuery({
    queryKey: CAMILO_TERMO_VIGENTE_KEY,
    queryFn: apiService.getCamiloTermoVigente,
  });
}

export function usePublicarCamiloTermo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CamiloTermoPublicacao) => apiService.publicarCamiloTermo(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAMILO_TERMO_VIGENTE_KEY });
      queryClient.invalidateQueries({ queryKey: CAMILO_MEU_TERMO_KEY });
      queryClient.invalidateQueries({ queryKey: CAMILO_TERMOS_ACEITOS_KEY });
    },
  });
}

export function useBaixarCamiloTermoComprovante() {
  return useMutation({
    mutationFn: (id: string) => apiService.downloadCamiloTermoComprovante(id),
  });
}
