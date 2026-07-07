import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type { AuditLogQueryParams } from '../types/domain';

export const AUDIT_LOGS_QUERY_KEY = ['auditLogs'] as const;
export const AUDIT_LOG_FACETS_QUERY_KEY = ['auditLogs', 'facets'] as const;

export function useAuditLogs(params: AuditLogQueryParams = {}, enabled = true) {
  return useQuery({
    queryKey: [...AUDIT_LOGS_QUERY_KEY, params],
    queryFn: () => apiService.getAuditLogs(params),
    enabled,
  });
}

export function useAuditLogFacets() {
  return useQuery({
    queryKey: AUDIT_LOG_FACETS_QUERY_KEY,
    queryFn: () => apiService.getAuditLogFacets(),
  });
}
