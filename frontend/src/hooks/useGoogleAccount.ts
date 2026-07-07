import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiService } from '../services/apiService';
import { AUTH_PROFILE_QUERY_KEY } from './useAuthProfile';

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
}

export function useGoogleAccount() {
  const queryClient = useQueryClient();

  const linkMutation = useMutation({
    mutationFn: () => apiService.getGoogleLinkUrl(),
    onSuccess: (authUrl) => {
      window.location.href = authUrl;
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ code, state }: { code: string; state: string }) =>
      apiService.completeGoogleLink(code, state),
    onSuccess: (user) => {
      queryClient.setQueryData(AUTH_PROFILE_QUERY_KEY, user);
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: () => apiService.unlinkGoogleAccount(),
    onSuccess: (user) => {
      queryClient.setQueryData(AUTH_PROFILE_QUERY_KEY, user);
    },
  });

  return {
    linkGoogle: linkMutation.mutate,
    completeGoogleLink: completeMutation.mutateAsync,
    unlinkGoogle: unlinkMutation.mutate,
    isLinking: linkMutation.isPending,
    isUnlinking: unlinkMutation.isPending,
    isCompleting: completeMutation.isPending,
    linkError: linkMutation.error
      ? getApiErrorMessage(linkMutation.error, 'Não foi possível iniciar a vinculação Google.')
      : null,
    unlinkError: unlinkMutation.error
      ? getApiErrorMessage(unlinkMutation.error, 'Não foi possível desvincular a conta Google.')
      : null,
    completeError: completeMutation.error
      ? getApiErrorMessage(completeMutation.error, 'Não foi possível concluir a vinculação Google.')
      : null,
  };
}
