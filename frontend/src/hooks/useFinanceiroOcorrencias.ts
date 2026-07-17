import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type {
  OpsRecebidaOcorrencia,
  GnreIcmsOcorrencia,
  NotaPagaSemLancamento,
  OpsRecebidaQueryParams,
  GnreIcmsQueryParams,
  NotaPagaQueryParams,
} from '../types/domain';

export const OCORRENCIAS_META_KEY = ['financeiro', 'ocorrencias', 'meta'] as const;
export const OPS_RECEBIDAS_KEY = ['financeiro', 'ocorrencias', 'ops-recebidas'] as const;
export const GNRE_ICMS_KEY = ['financeiro', 'ocorrencias', 'gnre-icms'] as const;
export const NOTAS_PAGAS_KEY = ['financeiro', 'ocorrencias', 'notas-pagas'] as const;

export function useOcorrenciasMeta(enabled = true) {
  return useQuery({
    queryKey: OCORRENCIAS_META_KEY,
    queryFn: () => apiService.getOcorrenciasMeta(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useOpsRecebidas(params: OpsRecebidaQueryParams, enabled = true) {
  return useQuery({
    queryKey: [...OPS_RECEBIDAS_KEY, params],
    queryFn: () => apiService.getOpsRecebidas(params),
    enabled,
  });
}

export function useCreateOpsRecebida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<OpsRecebidaOcorrencia, 'id'>) => apiService.createOpsRecebida(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OPS_RECEBIDAS_KEY }),
  });
}

export function useUpdateOpsRecebida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Omit<OpsRecebidaOcorrencia, 'id'>> }) =>
      apiService.updateOpsRecebida(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OPS_RECEBIDAS_KEY }),
  });
}

export function useDeleteOpsRecebida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiService.deleteOpsRecebida(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OPS_RECEBIDAS_KEY }),
  });
}

export function useGnreIcms(params: GnreIcmsQueryParams, enabled = true) {
  return useQuery({
    queryKey: [...GNRE_ICMS_KEY, params],
    queryFn: () => apiService.getGnreIcms(params),
    enabled,
  });
}

export function useCreateGnreIcms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<GnreIcmsOcorrencia, 'id'>) => apiService.createGnreIcms(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GNRE_ICMS_KEY }),
  });
}

export function useUpdateGnreIcms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Omit<GnreIcmsOcorrencia, 'id'>> }) =>
      apiService.updateGnreIcms(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GNRE_ICMS_KEY }),
  });
}

export function useDeleteGnreIcms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiService.deleteGnreIcms(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GNRE_ICMS_KEY }),
  });
}

export function useNotasPagas(params: NotaPagaQueryParams, enabled = true) {
  return useQuery({
    queryKey: [...NOTAS_PAGAS_KEY, params],
    queryFn: () => apiService.getNotasPagas(params),
    enabled,
  });
}

export function useCreateNotaPaga() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<NotaPagaSemLancamento, 'id'>) => apiService.createNotaPaga(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTAS_PAGAS_KEY }),
  });
}

export function useUpdateNotaPaga() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Omit<NotaPagaSemLancamento, 'id'>> }) =>
      apiService.updateNotaPaga(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTAS_PAGAS_KEY }),
  });
}

export function useDeleteNotaPaga() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiService.deleteNotaPaga(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTAS_PAGAS_KEY }),
  });
}
