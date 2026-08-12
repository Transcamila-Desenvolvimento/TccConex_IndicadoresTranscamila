import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { apiService } from '../services/apiService';
import type { DriveBankFilterKind } from '../types/domain';

export const MARKETING_DRIVE_KEYS = {
  config: ['marketing', 'drive-bank', 'config'] as const,
  files: (params: { kind: DriveBankFilterKind; search: string }) =>
    ['marketing', 'drive-bank', 'files', params] as const,
  thumbnail: (fileId: string) => ['marketing', 'drive-bank', 'thumbnail', fileId] as const,
};

export function useMarketingDriveBankConfig() {
  return useQuery({
    queryKey: MARKETING_DRIVE_KEYS.config,
    queryFn: () => apiService.getMarketingDriveBankConfig(),
    staleTime: 60_000,
  });
}

export function useMarketingDriveBank(
  params: { kind?: DriveBankFilterKind; search?: string; enabled?: boolean } = {},
) {
  const kind = params.kind ?? 'all';
  const search = (params.search ?? '').trim();
  const enabled = params.enabled ?? true;

  return useInfiniteQuery({
    queryKey: MARKETING_DRIVE_KEYS.files({ kind, search }),
    queryFn: ({ pageParam }) =>
      apiService.getMarketingDriveBank({
        kind,
        search: search || undefined,
        pageToken: pageParam,
        pageSize: 24,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
    enabled,
  });
}

export function useMarketingDriveBankThumbnail(fileId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: MARKETING_DRIVE_KEYS.thumbnail(fileId ?? ''),
    queryFn: async () => {
      const blob = await apiService.getMarketingDriveBankThumbnailBlob(fileId!);
      return URL.createObjectURL(blob);
    },
    enabled: Boolean(fileId) && enabled,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}
