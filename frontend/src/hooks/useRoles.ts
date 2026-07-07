import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/apiService';

export const ROLES_QUERY_KEY = ['roles'] as const;

export function useRoles() {
  return useQuery({
    queryKey: ROLES_QUERY_KEY,
    queryFn: () => apiService.getRoles(),
  });
}
