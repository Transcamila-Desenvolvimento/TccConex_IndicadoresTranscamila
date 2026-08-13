import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiService } from '../services/apiService';

export const GOOGLE_DRIVE_KEYS = {
  status: ['marketing', 'drive', 'status'] as const,
  browse: (folderId: string, driveId?: string | null) =>
    ['marketing', 'drive', 'browse', folderId, driveId ?? null] as const,
};

export function useGoogleDriveStatus(enabled = true) {
  return useQuery({
    queryKey: GOOGLE_DRIVE_KEYS.status,
    queryFn: () => apiService.getGoogleDriveStatus(),
    staleTime: 60_000,
    enabled,
  });
}

export function useGoogleDriveBrowse(
  folderId: string,
  enabled = true,
  driveId?: string | null,
) {
  return useInfiniteQuery({
    queryKey: GOOGLE_DRIVE_KEYS.browse(folderId, driveId),
    queryFn: ({ pageParam }) =>
      apiService.browseGoogleDrive({
        folderId,
        pageToken: pageParam,
        driveId: driveId ?? undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
    enabled: enabled && Boolean(folderId),
  });
}
