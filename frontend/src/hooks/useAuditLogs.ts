import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type { AuditLogQueryParams, ReciclarLogsPayload } from '../types/domain';

export const AUDIT_LOGS_QUERY_KEY = ['auditLogs'] as const;
export const AUDIT_LOG_FACETS_QUERY_KEY = ['auditLogs', 'facets'] as const;

export function useAuditLogs(params: AuditLogQueryParams = {}, enabled = true) {
  return useQuery({
    queryKey: [...AUDIT_LOGS_QUERY_KEY, params],
    queryFn: () => apiService.getAuditLogs(params),
    enabled,
  });
}

export function useReciclarLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReciclarLogsPayload) => apiService.reciclarLogs(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUDIT_LOGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: AUDIT_LOG_FACETS_QUERY_KEY });
    },
  });
}

export function useAuditLogFacets() {
  return useQuery({
    queryKey: AUDIT_LOG_FACETS_QUERY_KEY,
    queryFn: () => apiService.getAuditLogFacets(),
  });
}
