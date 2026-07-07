import { useMutation, useQuery } from '@tanstack/react-query';
import { apiService } from '../services/apiService';

export const FS_HOME_KEY = ['filesystem', 'home'] as const;

export function useFsHomeDir(enabled = true) {
  return useQuery({
    queryKey: FS_HOME_KEY,
    queryFn: () => apiService.fsGetHomeDir(),
    enabled,
    staleTime: Infinity,
  });
}

export function useFsListDirectory() {
  return useMutation({
    mutationFn: (path: string) => apiService.fsListDirectory(path),
  });
}

export function useFsWriteFile() {
  return useMutation({
    mutationFn: ({ filePath, content }: { filePath: string; content: string }) =>
      apiService.fsWriteFile(filePath, content),
  });
}
