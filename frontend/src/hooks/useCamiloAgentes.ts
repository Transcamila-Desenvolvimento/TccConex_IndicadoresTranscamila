import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type { CamiloAgentePayload } from '../types/domain';

export const CAMILO_PARTES_KEY = ['camilo', 'partes'] as const;
export const CAMILO_AGENTES_KEY = ['camilo', 'agentes'] as const;

export function useCamiloPartes() {
  return useQuery({
    queryKey: CAMILO_PARTES_KEY,
    queryFn: apiService.getCamiloPartes,
  });
}

export function useCamiloAgentes() {
  return useQuery({
    queryKey: CAMILO_AGENTES_KEY,
    queryFn: apiService.getCamiloAgentes,
  });
}

export function useCreateCamiloAgente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CamiloAgentePayload) => apiService.createCamiloAgente(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAMILO_AGENTES_KEY });
    },
  });
}

export function useUpdateCamiloAgente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CamiloAgentePayload }) =>
      apiService.updateCamiloAgente(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAMILO_AGENTES_KEY });
    },
  });
}

export function useDeleteCamiloAgente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteCamiloAgente(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAMILO_AGENTES_KEY });
    },
  });
}

type CamiloHistorico = { papel: 'user' | 'assistant'; texto: string }[];

export function useConversarCamilo() {
  return useMutation({
    mutationFn: ({ pergunta, historico }: { pergunta: string; historico: CamiloHistorico }) =>
      apiService.conversarCamilo(pergunta, historico),
  });
}

export function useConsultarCamiloAgente() {
  return useMutation({
    mutationFn: ({ id, pergunta, historico }: { id: string; pergunta: string; historico: CamiloHistorico }) =>
      apiService.consultarCamiloAgente(id, pergunta, historico),
  });
}
