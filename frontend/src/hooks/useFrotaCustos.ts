import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type { CustoFrotaReportType, ReportQueryParams } from '../types/domain';

export const FROTA_CUSTOS_KEYS = {
  lotes: ['frota', 'custos', 'lotes'] as const,
  relatorio: (type: CustoFrotaReportType, params: ReportQueryParams) =>
    ['frota', 'custos', 'relatorio', type, params] as const,
};

export function useCustoFrotaLotes() {
  return useQuery({
    queryKey: FROTA_CUSTOS_KEYS.lotes,
    queryFn: () => apiService.getCustoFrotaLotes(),
  });
}

export function useCustoFrotaRelatorio(type: CustoFrotaReportType, params: ReportQueryParams, enabled = true) {
  return useQuery({
    queryKey: FROTA_CUSTOS_KEYS.relatorio(type, params),
    queryFn: () => apiService.getCustoFrotaRelatorio(type, params),
    enabled,
  });
}

export function useImportCustoFrota() {
  return useMutation({
    mutationFn: ({ type, file }: { type: CustoFrotaReportType; file: File }) =>
      apiService.importCustoFrota(type, file),
  });
}

export function useFinalizeCustoFrotaLote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => apiService.finalizeCustoFrotaLote(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['frota', 'custos'] });
    },
  });
}

export function invalidateCustoFrota(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['frota', 'custos'] });
}
