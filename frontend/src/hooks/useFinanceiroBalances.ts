import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type { BalanceHistoryQueryParams } from '../types/domain';
import type { BankAccount, BalanceHistoryEntry } from '../types/domain';

export const BANK_ACCOUNTS_KEY = ['financeiro', 'bankAccounts'] as const;
export const BALANCE_HISTORY_KEY = ['financeiro', 'balanceHistory'] as const;

function invalidateBalances(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: BANK_ACCOUNTS_KEY });
  queryClient.invalidateQueries({ queryKey: BALANCE_HISTORY_KEY });
}

export function useBankAccounts() {
  return useQuery({
    queryKey: BANK_ACCOUNTS_KEY,
    queryFn: () => apiService.getBankAccounts(),
  });
}

export function useBalanceHistory(params: BalanceHistoryQueryParams, enabled = true) {
  return useQuery({
    queryKey: [...BALANCE_HISTORY_KEY, params],
    queryFn: () => apiService.getBalanceHistory(params),
    enabled,
  });
}

export function useCreateBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<BankAccount, 'id'>) => apiService.createBankAccount(payload),
    onSuccess: () => invalidateBalances(queryClient),
  });
}

export function useUpdateBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Omit<BankAccount, 'id'>> }) =>
      apiService.updateBankAccount(id, payload),
    onSuccess: () => invalidateBalances(queryClient),
  });
}

export function useDeleteBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiService.deleteBankAccount(id),
    onSuccess: () => invalidateBalances(queryClient),
  });
}

export function useCreateBalanceHistoryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<BalanceHistoryEntry, 'id'>) => apiService.createBalanceHistoryEntry(payload),
    onSuccess: () => invalidateBalances(queryClient),
  });
}

export function useUpdateBalanceHistoryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Omit<BalanceHistoryEntry, 'id'>> }) =>
      apiService.updateBalanceHistoryEntry(id, payload),
    onSuccess: () => invalidateBalances(queryClient),
  });
}

export function useDeleteBalanceHistoryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiService.deleteBalanceHistoryEntry(id),
    onSuccess: () => invalidateBalances(queryClient),
  });
}
