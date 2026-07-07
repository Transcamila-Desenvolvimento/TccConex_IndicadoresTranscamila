import { useMutation, useQuery } from '@tanstack/react-query';
import { apiService } from '../services/apiService';

export const AUTH_PROFILE_QUERY_KEY = ['auth', 'profile'] as const;

export function useAuthProfile(enabled: boolean) {
  return useQuery({
    queryKey: AUTH_PROFILE_QUERY_KEY,
    queryFn: () => apiService.getProfile(),
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      apiService.login(username, password),
  });
}
