import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type { SgqCategoriaPayload, SgqCategoriaQueryParams } from '../types/domain';
import { SGQ_AUDITORIAS_KEYS } from './useSgqAuditorias';

// A filial da sessão entra na queryKey: o escopo é aplicado no backend pelo
// header X-Prothon-Filial, então cada filial precisa do próprio cache.
export const SGQ_CATEGORIAS_KEYS = {
  all: ['sgq', 'categorias'] as const,
  lista: (filial: string | null, params: SgqCategoriaQueryParams) => ['sgq', 'categorias', 'lista', filial, params] as const,
  resumo: (filial: string | null) => ['sgq', 'categorias', 'resumo', filial] as const,
  sugestoes: (filial: string | null) => ['sgq', 'categorias', 'sugestoes', filial] as const,
};

export function useSgqCategoriasSugestoes(filial: string | null, enabled: boolean) {
  return useQuery({
    queryKey: SGQ_CATEGORIAS_KEYS.sugestoes(filial),
    queryFn: () => apiService.getSgqCategoriasSugestoes(),
    enabled,
  });
}

export function useSgqCategorias(filial: string | null, params: SgqCategoriaQueryParams) {
  return useQuery({
    queryKey: SGQ_CATEGORIAS_KEYS.lista(filial, params),
    queryFn: () => apiService.getSgqCategorias(params),
    placeholderData: keepPreviousData,
  });
}

export function useSgqCategoriasResumo(filial: string | null) {
  return useQuery({
    queryKey: SGQ_CATEGORIAS_KEYS.resumo(filial),
    queryFn: () => apiService.getSgqCategoriasResumo(),
  });
}

function useInvalidarCategorias() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: SGQ_CATEGORIAS_KEYS.all });
    // Renomear propaga para as auditorias e as ativas alimentam o formulário de auditoria.
    queryClient.invalidateQueries({ queryKey: SGQ_AUDITORIAS_KEYS.all });
  };
}

export function useSaveSgqCategoria() {
  const invalidar = useInvalidarCategorias();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: SgqCategoriaPayload }) => (
      id ? apiService.updateSgqCategoria(id, payload) : apiService.createSgqCategoria(payload)
    ),
    onSuccess: invalidar,
  });
}

export function useDeleteSgqCategorias() {
  const invalidar = useInvalidarCategorias();
  return useMutation({
    mutationFn: (ids: string[]) => apiService.deleteSgqCategorias(ids),
    onSuccess: invalidar,
  });
}
