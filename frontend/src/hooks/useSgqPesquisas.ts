import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiService } from '../services/apiService';
import { INDICADORES_SGQ_SATISFACAO_KEY } from './useIndicadores';
import type {
  SgqLoteDraftRow,
  SgqPesquisaBulkErrors,
  SgqPesquisaPayload,
  SgqPesquisaQueryParams,
} from '../types/domain';

// A filial da sessão entra na queryKey (não é enviada como filtro à API — o
// escopo real é aplicado no backend via header X-Prothon-Filial). Sem isso, o
// cache do TanStack Query é compartilhado entre filiais: ao trocar de filial
// sem reload de página, a tela mostrava as pesquisas da filial anterior até o
// staleTime expirar, já que a queryKey continuava idêntica.
export const SGQ_KEYS = {
  pesquisas: (filial: string | null, params: SgqPesquisaQueryParams) =>
    ['sgq', 'pesquisas', filial, params] as const,
  stats: (filial: string | null, params: SgqPesquisaQueryParams) =>
    ['sgq', 'pesquisas-stats', filial, params] as const,
  motoristas: (filial: string | null) => ['sgq', 'motoristas', filial] as const,
  lancadores: (filial: string | null) => ['sgq', 'lancadores', filial] as const,
  loteDraft: (filial: string | null) => ['sgq', 'lote-draft', filial] as const,
  all: ['sgq'] as const,
};

function invalidateSgqAndIndicador(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: SGQ_KEYS.all });
  // Atualiza o indicador de Satisfação na mesma sessão (polling cobre outros usuários).
  queryClient.invalidateQueries({ queryKey: INDICADORES_SGQ_SATISFACAO_KEY });
}

export function useSgqPesquisas(filial: string | null, params: SgqPesquisaQueryParams) {
  return useQuery({
    queryKey: SGQ_KEYS.pesquisas(filial, params),
    queryFn: () => apiService.getSgqPesquisas(params),
  });
}

export function useSgqPesquisaStats(filial: string | null, params: SgqPesquisaQueryParams) {
  return useQuery({
    queryKey: SGQ_KEYS.stats(filial, params),
    queryFn: () => apiService.getSgqPesquisaStats(params),
  });
}

/** Sugestões de nomes de motoristas já usados na filial, para o autocomplete
 * do formulário (ver `motoristas` em `apps/sgq/views.py`). */
export function useSgqMotoristas(filial: string | null) {
  return useQuery({
    queryKey: SGQ_KEYS.motoristas(filial),
    queryFn: () => apiService.getSgqMotoristas(),
    staleTime: 60_000,
  });
}

/** Usuários que já lançaram pesquisa na filial — filtro "Lançado por". */
export function useSgqLancadores(filial: string | null) {
  return useQuery({
    queryKey: SGQ_KEYS.lancadores(filial),
    queryFn: () => apiService.getSgqLancadores(),
    staleTime: 60_000,
  });
}

export function useCreateSgqPesquisa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SgqPesquisaPayload) => apiService.createSgqPesquisa(payload),
    onSuccess: () => invalidateSgqAndIndicador(queryClient),
  });
}

export function useBulkCreateSgqPesquisas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payloads: SgqPesquisaPayload[]) => apiService.bulkCreateSgqPesquisas(payloads),
    onSuccess: () => invalidateSgqAndIndicador(queryClient),
  });
}

/** Rascunho server-side da inclusão em tabela — isolado por usuário + filial. */
export function useSgqLoteDraft(filial: string | null) {
  return useQuery({
    queryKey: SGQ_KEYS.loteDraft(filial),
    queryFn: () => apiService.getSgqLoteDraft(),
    enabled: Boolean(filial),
    staleTime: 15_000,
  });
}

export function useSaveSgqLoteDraft(filial: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rows: SgqLoteDraftRow[]) => apiService.saveSgqLoteDraft(rows),
    onSuccess: (data) => {
      queryClient.setQueryData(SGQ_KEYS.loteDraft(filial), data);
    },
  });
}

export function useDeleteSgqLoteDraft(filial: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiService.deleteSgqLoteDraft(),
    onSuccess: () => {
      queryClient.setQueryData(SGQ_KEYS.loteDraft(filial), {
        version: 1,
        updatedAt: null,
        filial: filial ?? '',
        hasDraft: false,
        rows: [],
      });
      queryClient.invalidateQueries({ queryKey: SGQ_KEYS.loteDraft(filial) });
    },
  });
}

export function useUpdateSgqPesquisa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SgqPesquisaPayload> }) =>
      apiService.updateSgqPesquisa(id, payload),
    onSuccess: () => invalidateSgqAndIndicador(queryClient),
  });
}

export function useDeleteSgqPesquisa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteSgqPesquisa(id),
    onSuccess: () => invalidateSgqAndIndicador(queryClient),
  });
}

/** Extrai os erros por linha/campo de uma falha do bulk_create (400 com { errors: {...} }). */
export function getSgqBulkErrors(error: unknown): SgqPesquisaBulkErrors | null {
  if (axios.isAxiosError(error) && error.response?.status === 400) {
    const errors = error.response.data?.errors;
    if (errors && typeof errors === 'object') return errors as SgqPesquisaBulkErrors;
  }
  return null;
}
