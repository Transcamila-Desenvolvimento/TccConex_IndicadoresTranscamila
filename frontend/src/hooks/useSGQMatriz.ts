import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';

const CHAVES = {
  documentos: ['sgq', 'matriz', 'documentos'] as const,
  pastas: ['sgq', 'matriz', 'pastas'] as const,
};

export function useDocumentosSGQ() {
  return useQuery({
    queryKey: CHAVES.documentos,
    queryFn: () => apiService.getDocumentosSGQ(),
  });
}

export function usePastasMatrizSGQ() {
  return useQuery({
    queryKey: CHAVES.pastas,
    queryFn: () => apiService.getPastasMatrizSGQ(),
  });
}

export function useCreatePastaMatrizSGQ() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ nome, parentId }: { nome: string; parentId?: string | null }) =>
      apiService.createPastaMatrizSGQ(nome, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVES.pastas });
    },
  });
}

export function useRenomearPastaMatrizSGQ() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nome }: { id: string; nome: string }) => apiService.renomearPastaMatrizSGQ(id, nome),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVES.pastas });
    },
  });
}

export function useDeletePastaMatrizSGQ() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deletePastaMatrizSGQ(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVES.pastas });
    },
  });
}

export function useCreateDocumentoSGQ() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ titulo, driveFileId, pastaId }: { titulo: string; driveFileId: string; pastaId?: string | null }) =>
      apiService.createDocumentoSGQ(titulo, driveFileId, pastaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVES.documentos });
    },
  });
}

export function useRenomearDocumentoSGQ() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, titulo }: { id: string; titulo: string }) => apiService.renomearDocumentoSGQ(id, titulo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVES.documentos });
    },
  });
}

export function useSubstituirDocumentoSGQ() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, titulo, driveFileId }: { id: string; titulo: string; driveFileId: string }) =>
      apiService.substituirDocumentoSGQ(id, titulo, driveFileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVES.documentos });
    },
  });
}

export function useDeleteDocumentoSGQ() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteDocumentoSGQ(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVES.documentos });
    },
  });
}

export function useDownloadDocumentoSGQ() {
  return useMutation({
    mutationFn: (id: string) => apiService.downloadDocumentoSGQ(id),
  });
}

export function useMoverDocumentoSGQ() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pastaId }: { id: string; pastaId: string | null }) => apiService.moverDocumentoSGQ(id, pastaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVES.documentos });
    },
  });
}

export function useSGQDriveStatus(enabled = true) {
  return useQuery({
    queryKey: ['sgq', 'drive', 'status'],
    queryFn: () => apiService.getSGQDriveStatus(),
    staleTime: 60_000,
    enabled,
  });
}

export function useSGQDriveBrowse(folderId: string, enabled = true, driveId?: string | null) {
  return useInfiniteQuery({
    queryKey: ['sgq', 'drive', 'browse', folderId, driveId ?? null],
    queryFn: ({ pageParam }) =>
      apiService.browseSGQDrive({
        folderId,
        pageToken: pageParam,
        driveId: driveId ?? undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
    enabled: enabled && Boolean(folderId),
  });
}
