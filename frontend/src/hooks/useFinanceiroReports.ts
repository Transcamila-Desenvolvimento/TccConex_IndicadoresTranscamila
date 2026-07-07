import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type { ReportQueryParams, ReportImportType, PagarDiffQueryParams } from '../types/domain';

export const FINANCEIRO_KEYS = {
  batches: ['financeiro', 'batches'] as const,
  pagar: ['financeiro', 'pagar'] as const,
  receber: ['financeiro', 'receber'] as const,
  aging: ['financeiro', 'aging'] as const,
  prAnalysis: ['financeiro', 'pr-analysis'] as const,
  pagarDiff: (params: PagarDiffQueryParams) => ['financeiro', 'pagar-diff', params] as const,
  facets: (type: string) => ['financeiro', 'facets', type] as const,
};

export function useReportBatches() {
  return useQuery({
    queryKey: FINANCEIRO_KEYS.batches,
    queryFn: () => apiService.getReportBatches(),
  });
}

export function usePagarReport(params: ReportQueryParams, enabled = true) {
  return useQuery({
    queryKey: [...FINANCEIRO_KEYS.pagar, params],
    queryFn: () => apiService.getPagarReport(params),
    enabled,
  });
}

export function useReceberReport(params: ReportQueryParams, enabled = true) {
  return useQuery({
    queryKey: [...FINANCEIRO_KEYS.receber, params],
    queryFn: () => apiService.getReceberReport(params),
    enabled,
  });
}

export function useAgingReport(params: ReportQueryParams, enabled = true) {
  return useQuery({
    queryKey: [...FINANCEIRO_KEYS.aging, params],
    queryFn: () => apiService.getAgingReport(params),
    enabled,
  });
}

export function useReportFacets(reportType: 'pagar' | 'receber' | 'aging') {
  return useQuery({
    queryKey: FINANCEIRO_KEYS.facets(reportType),
    queryFn: () => apiService.getReportFacets(reportType),
  });
}

export function useImportReport() {
  return useMutation({
    mutationFn: ({ batchId, type, file }: { batchId: string; type: ReportImportType; file: File }) =>
      apiService.importReport(batchId, type, file),
  });
}

export function usePrepareReportImport() {
  return useMutation({
    mutationFn: () => apiService.prepareReportImport(),
  });
}

export function useFinalizeReportBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => apiService.finalizeReportBatch(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro'] });
    },
  });
}

export function invalidateFinanceiroReports(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['financeiro'] });
}

export function usePrAnalysis(enabled: boolean) {
  return useQuery({
    queryKey: FINANCEIRO_KEYS.prAnalysis,
    queryFn: () => apiService.getPrAnalysis(),
    enabled,
  });
}

export function usePrAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { ids: number[]; action: 'ignore' | 'restore' }) => apiService.prAction(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeiro'] });
      queryClient.invalidateQueries({ queryKey: ['indicadores', 'cashflow'] });
    },
  });
}

export function usePagarDiffAnalysis(params: PagarDiffQueryParams, enabled: boolean) {
  return useQuery({
    queryKey: FINANCEIRO_KEYS.pagarDiff(params),
    queryFn: () => apiService.getPagarDiffAnalysis(params),
    enabled,
  });
}

