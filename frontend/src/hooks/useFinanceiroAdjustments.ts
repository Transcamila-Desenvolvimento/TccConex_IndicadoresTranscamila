import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type { AdjustmentQueryParams } from '../types/domain';
import type { CashAdjustment } from '../types/domain';

export const ADJUSTMENTS_KEY = ['financeiro', 'adjustments'] as const;

export function useCashAdjustments(params: AdjustmentQueryParams, enabled = true) {
  return useQuery({
    queryKey: [...ADJUSTMENTS_KEY, params],
    queryFn: () => apiService.getCashAdjustments(params),
    enabled,
  });
}

export function useCreateCashAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<CashAdjustment, 'id'>) => apiService.createCashAdjustment(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADJUSTMENTS_KEY }),
  });
}

export function useUpdateCashAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Omit<CashAdjustment, 'id'>> }) =>
      apiService.updateCashAdjustment(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADJUSTMENTS_KEY }),
  });
}

export function useDeleteCashAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiService.deleteCashAdjustment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADJUSTMENTS_KEY }),
  });
}
