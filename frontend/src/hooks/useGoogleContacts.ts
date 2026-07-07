import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/apiService';

export const GOOGLE_CONTACTS_QUERY_KEY = ['auth', 'google', 'contacts'] as const;

export function useGoogleContacts(enabled = true) {
  return useQuery({
    queryKey: GOOGLE_CONTACTS_QUERY_KEY,
    queryFn: () => apiService.getGoogleContacts(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
