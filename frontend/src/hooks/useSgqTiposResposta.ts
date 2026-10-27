import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type { SgqTipoRespostaPayload, SgqTipoRespostaQueryParams } from '../types/domain';

// A filial da sessão entra na queryKey: o escopo é aplicado no backend pelo
// header X-Prothon-Filial, então cada filial precisa do próprio cache.
export const SGQ_TIPOS_RESPOSTA_KEYS = {
  all: ['sgq', 'tipos-resposta'] as const,
  lista: (filial: string | null, params: SgqTipoRespostaQueryParams) => ['sgq', 'tipos-resposta', 'lista', filial, params] as const,
  resumo: (filial: string | null) => ['sgq', 'tipos-resposta', 'resumo', filial] as const,
  daNorma: (filial: string | null, normaId: string) => ['sgq', 'tipos-resposta', 'norma', filial, normaId] as const,
};

/** Tipos de resposta disponíveis para as perguntas da norma (não exige acesso ao cadastro de tipos). */
export function useSgqNormaTiposResposta(filial: string | null, normaId: string) {
  return useQuery({
    queryKey: SGQ_TIPOS_RESPOSTA_KEYS.daNorma(filial, normaId),
    queryFn: () => apiService.getSgqNormaTiposResposta(normaId),
  });
}

export function useSgqTiposResposta(filial: string | null, params: SgqTipoRespostaQueryParams) {
  return useQuery({
    queryKey: SGQ_TIPOS_RESPOSTA_KEYS.lista(filial, params),
    queryFn: () => apiService.getSgqTiposResposta(params),
    placeholderData: keepPreviousData,
  });
}

export function useSgqTiposRespostaResumo(filial: string | null) {
  return useQuery({
    queryKey: SGQ_TIPOS_RESPOSTA_KEYS.resumo(filial),
    queryFn: () => apiService.getSgqTiposRespostaResumo(),
  });
}

function useInvalidarTiposResposta() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: SGQ_TIPOS_RESPOSTA_KEYS.all });
}

export function useSaveSgqTipoResposta() {
  const invalidar = useInvalidarTiposResposta();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: SgqTipoRespostaPayload }) => (
      id ? apiService.updateSgqTipoResposta(id, payload) : apiService.createSgqTipoResposta(payload)
    ),
    onSuccess: invalidar,
  });
}

export function useDeleteSgqTiposResposta() {
  const invalidar = useInvalidarTiposResposta();
  return useMutation({
    mutationFn: (ids: string[]) => apiService.deleteSgqTiposResposta(ids),
    onSuccess: invalidar,
  });
}
