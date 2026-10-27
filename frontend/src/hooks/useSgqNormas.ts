import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type { SgqNormaItemPayload, SgqNormaItensImportParams, SgqNormaPayload, SgqNormaQueryParams } from '../types/domain';
import { SGQ_AUDITORIAS_KEYS } from './useSgqAuditorias';
import { SGQ_CATEGORIAS_KEYS } from './useSgqCategorias';

// A filial da sessão entra na queryKey: o escopo é aplicado no backend pelo
// header X-Prothon-Filial, então cada filial precisa do próprio cache.
export const SGQ_NORMAS_KEYS = {
  all: ['sgq', 'normas'] as const,
  lista: (filial: string | null, params: SgqNormaQueryParams) => ['sgq', 'normas', 'lista', filial, params] as const,
  resumo: (filial: string | null) => ['sgq', 'normas', 'resumo', filial] as const,
  detalhe: (filial: string | null, id: string) => ['sgq', 'normas', 'detalhe', filial, id] as const,
  itens: (filial: string | null, id: string) => ['sgq', 'normas', 'itens', filial, id] as const,
};

export function useSgqNorma(filial: string | null, id: string) {
  return useQuery({
    queryKey: SGQ_NORMAS_KEYS.detalhe(filial, id),
    queryFn: () => apiService.getSgqNorma(id),
  });
}

export function useSgqNormaItens(filial: string | null, normaId: string) {
  return useQuery({
    queryKey: SGQ_NORMAS_KEYS.itens(filial, normaId),
    queryFn: () => apiService.getSgqNormaItens(normaId),
  });
}

function useInvalidarItens(filial: string | null, normaId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: SGQ_NORMAS_KEYS.itens(filial, normaId) });
    // Alterar itens atualiza a data e o emissor da norma no backend.
    queryClient.invalidateQueries({ queryKey: SGQ_NORMAS_KEYS.detalhe(filial, normaId) });
    queryClient.invalidateQueries({ queryKey: ['sgq', 'normas', 'lista', filial] });
  };
}

export function useSaveSgqNormaItem(filial: string | null, normaId: string) {
  const invalidar = useInvalidarItens(filial, normaId);
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: SgqNormaItemPayload }) => (
      id ? apiService.updateSgqNormaItem(id, payload) : apiService.createSgqNormaItem(payload)
    ),
    onSuccess: invalidar,
  });
}

export function useDeleteSgqNormaItem(filial: string | null, normaId: string) {
  const invalidar = useInvalidarItens(filial, normaId);
  return useMutation({
    mutationFn: (id: string) => apiService.deleteSgqNormaItem(id),
    onSuccess: invalidar,
  });
}

export function useMoverSgqNormaItem(filial: string | null, normaId: string) {
  const invalidar = useInvalidarItens(filial, normaId);
  return useMutation({
    mutationFn: ({ id, direcao }: { id: string; direcao: 'cima' | 'baixo' }) => apiService.moverSgqNormaItem(id, direcao),
    onSuccess: invalidar,
  });
}

export function useExportarModeloItensNorma() {
  return useMutation({
    mutationFn: () => apiService.exportarModeloItensNorma(),
  });
}

export function useImportarSgqNormaItens(filial: string | null, normaId: string) {
  const invalidar = useInvalidarItens(filial, normaId);
  return useMutation({
    mutationFn: (params: SgqNormaItensImportParams) => apiService.importarSgqNormaItens(normaId, params),
    onSuccess: (_resumo, params) => {
      if (!params.dryRun) invalidar();
    },
  });
}

export function useSgqNormas(filial: string | null, params: SgqNormaQueryParams) {
  return useQuery({
    queryKey: SGQ_NORMAS_KEYS.lista(filial, params),
    queryFn: () => apiService.getSgqNormas(params),
    placeholderData: keepPreviousData,
  });
}

export function useSgqNormasResumo(filial: string | null) {
  return useQuery({
    queryKey: SGQ_NORMAS_KEYS.resumo(filial),
    queryFn: () => apiService.getSgqNormasResumo(),
  });
}

function useInvalidarNormas() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: SGQ_NORMAS_KEYS.all });
    // As normas ativas alimentam as sugestões dos formulários de auditoria e de categoria.
    queryClient.invalidateQueries({ queryKey: SGQ_AUDITORIAS_KEYS.all });
    queryClient.invalidateQueries({ queryKey: SGQ_CATEGORIAS_KEYS.all });
  };
}

export function useSaveSgqNorma() {
  const invalidar = useInvalidarNormas();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: SgqNormaPayload }) => (
      id ? apiService.updateSgqNorma(id, payload) : apiService.createSgqNorma(payload)
    ),
    onSuccess: invalidar,
  });
}

export function useDeleteSgqNormas() {
  const invalidar = useInvalidarNormas();
  return useMutation({
    mutationFn: (ids: string[]) => apiService.deleteSgqNormas(ids),
    onSuccess: invalidar,
  });
}
