import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';

const CHAVES = {
  documentos: ['camilo', 'matriz-empresarial', 'documentos'] as const,
  pastas: ['camilo', 'matriz-empresarial', 'pastas'] as const,
};

export function useCamiloMatrizDocumentos() {
  return useQuery({
    queryKey: CHAVES.documentos,
    queryFn: () => apiService.getCamiloMatrizDocumentos(),
  });
}

export function useCamiloMatrizPastas() {
  return useQuery({
    queryKey: CHAVES.pastas,
    queryFn: () => apiService.getCamiloMatrizPastas(),
  });
}

export function useCreateCamiloMatrizPasta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ nome, parentId }: { nome: string; parentId?: string | null }) =>
      apiService.createCamiloMatrizPasta(nome, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVES.pastas });
    },
  });
}

export function useRenomearCamiloMatrizPasta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nome }: { id: string; nome: string }) => apiService.renomearCamiloMatrizPasta(id, nome),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVES.pastas });
    },
  });
}

export function useDeleteCamiloMatrizPasta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteCamiloMatrizPasta(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVES.pastas });
    },
  });
}

export function useCreateCamiloMatrizDocumento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ titulo, driveFileId, pastaId }: { titulo: string; driveFileId: string; pastaId?: string | null }) =>
      apiService.createCamiloMatrizDocumento(titulo, driveFileId, pastaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVES.documentos });
    },
  });
}

export function useRenomearCamiloMatrizDocumento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, titulo }: { id: string; titulo: string }) => apiService.renomearCamiloMatrizDocumento(id, titulo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVES.documentos });
    },
  });
}

export function useSubstituirCamiloMatrizDocumento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, titulo, driveFileId }: { id: string; titulo: string; driveFileId: string }) =>
      apiService.substituirCamiloMatrizDocumento(id, titulo, driveFileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVES.documentos });
    },
  });
}

export function useDeleteCamiloMatrizDocumento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteCamiloMatrizDocumento(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVES.documentos });
    },
  });
}

export function useDownloadCamiloMatrizDocumento() {
  return useMutation({
    mutationFn: (id: string) => apiService.downloadCamiloMatrizDocumento(id),
  });
}

export function useMoverCamiloMatrizDocumento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pastaId }: { id: string; pastaId: string | null }) => apiService.moverCamiloMatrizDocumento(id, pastaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAVES.documentos });
    },
  });
}

export function useCamiloMatrizDriveStatus(enabled = true) {
  return useQuery({
    queryKey: ['camilo', 'matriz-empresarial', 'drive', 'status'],
    queryFn: () => apiService.getCamiloMatrizDriveStatus(),
    staleTime: 60_000,
    enabled,
  });
}

export function useCamiloMatrizDriveBrowse(folderId: string, enabled = true, driveId?: string | null) {
  return useInfiniteQuery({
    queryKey: ['camilo', 'matriz-empresarial', 'drive', 'browse', folderId, driveId ?? null],
    queryFn: ({ pageParam }) =>
      apiService.browseCamiloMatrizDrive({
        folderId,
        pageToken: pageParam,
        driveId: driveId ?? undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
    enabled: enabled && Boolean(folderId),
  });
}
