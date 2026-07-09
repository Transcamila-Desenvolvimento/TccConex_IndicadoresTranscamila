import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type { BillingQueryParams } from '../types/domain';
import type { BillingRecord } from '../types/domain';
import { INDICADORES_CASHFLOW_KEY } from './useIndicadores';

export const BILLING_KEY = ['financeiro', 'billing'] as const;

function invalidateBillingQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: BILLING_KEY });
  queryClient.invalidateQueries({ queryKey: INDICADORES_CASHFLOW_KEY });
}

export function useBillingRecords(params: BillingQueryParams, enabled = true) {
  return useQuery({
    queryKey: [...BILLING_KEY, params],
    queryFn: () => apiService.getBillingRecords(params),
    enabled,
  });
}

export function useExportBillingRecords() {
  return useMutation({
    mutationFn: (params: BillingQueryParams) => apiService.getBillingRecords({ ...params, export: true }),
  });
}

export function useImportBillingXml() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => apiService.importBillingXml(file),
    onSuccess: () => invalidateBillingQueries(queryClient),
  });
}

export function useCreateBillingRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<BillingRecord, 'id' | 'trend'>) => apiService.createBillingRecord(payload),
    onSuccess: () => invalidateBillingQueries(queryClient),
  });
}

export function useUpdateBillingRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Omit<BillingRecord, 'id'>> }) =>
      apiService.updateBillingRecord(id, payload),
    onSuccess: () => invalidateBillingQueries(queryClient),
  });
}

export function useDeleteBillingRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiService.deleteBillingRecord(id),
    onSuccess: () => invalidateBillingQueries(queryClient),
  });
}
