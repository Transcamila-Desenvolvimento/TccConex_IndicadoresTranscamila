import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiService } from '../services/apiService';

import type { CampanhaPayload, CampanhaStatus, CampanhaMarketing } from '../types/domain';

import { syncMarketingQueriesSilently } from './marketingSilentSync';



export const MARKETING_KEYS = {

  directory: ['marketing', 'directory'] as const,

  campanhas: (params: { start?: string; end?: string }) => ['marketing', 'campanhas', params] as const,

  campanha: (id: string) => ['marketing', 'campanha', id] as const,

  quadro: ['marketing', 'campanhas', 'quadro'] as const,
};

export function useMarketingDirectory() {
  return useQuery({
    queryKey: MARKETING_KEYS.directory,
    queryFn: () => apiService.getUserDirectory('Marketing'),
    staleTime: 60_000,
  });
}

export function useCampanhas(params: { start?: string; end?: string; search?: string } = {}) {
  return useQuery({
    queryKey: MARKETING_KEYS.campanhas(params),
    queryFn: () => apiService.getCampanhas(params),
  });
}

export function useCampanha(id: string | null) {

  return useQuery({

    queryKey: MARKETING_KEYS.campanha(id ?? ''),

    queryFn: () => apiService.getCampanha(id!),

    enabled: Boolean(id),

  });

}



export function useCampanhaQuadro() {

  return useQuery({

    queryKey: MARKETING_KEYS.quadro,

    queryFn: () => apiService.getCampanhaQuadro(),

  });

}



function refreshMarketing(qc: ReturnType<typeof useQueryClient>, campanhaId?: string, event?: string) {
  void syncMarketingQueriesSilently(qc, { campanhaId, event });
}



export function useCreateCampanha() {

  const qc = useQueryClient();

  return useMutation({

    mutationFn: (payload: CampanhaPayload) => apiService.createCampanha(payload),

    onSuccess: () => refreshMarketing(qc),

  });

}



export function useUpdateCampanha() {

  const qc = useQueryClient();

  return useMutation({

    mutationFn: ({ id, payload }: { id: string; payload: Partial<CampanhaPayload> }) =>

      apiService.updateCampanha(id, payload),

    onSuccess: (_data, vars) => refreshMarketing(qc, vars.id),

  });

}



export function useDeleteCampanha() {

  const qc = useQueryClient();

  return useMutation({

    mutationFn: (id: string) => apiService.deleteCampanha(id),

    onSuccess: (_data, id) => refreshMarketing(qc, id, 'deleted'),

  });

}



export function useMoveCampanhaStatus() {

  const qc = useQueryClient();

  return useMutation({

    mutationFn: ({ id, status, ordemKanban }: { id: string; status: CampanhaStatus; ordemKanban?: number }) =>

      apiService.moveCampanhaStatus(id, { status, ordemKanban }),

    onSuccess: () => refreshMarketing(qc),

  });

}



export function useCreateCampanhaComentario(campanhaId: string) {

  const qc = useQueryClient();

  return useMutation({

    mutationFn: (payload: { texto: string; mencoes?: string[] }) =>

      apiService.createCampanhaComentario(campanhaId, payload),

    onSuccess: () => refreshMarketing(qc, campanhaId),

  });

}



export function useAddCampanhaMembro(campanhaId: string) {

  const qc = useQueryClient();

  return useMutation({

    mutationFn: (userId: string) => apiService.addCampanhaMembro(campanhaId, userId),

    onSuccess: () => refreshMarketing(qc, campanhaId),

  });

}



export function useRemoveCampanhaMembro(campanhaId: string) {

  const qc = useQueryClient();

  return useMutation({

    mutationFn: (userId: string) => apiService.removeCampanhaMembro(campanhaId, userId),

    onSuccess: () => refreshMarketing(qc, campanhaId),

  });

}



export function useAtribuirCampanhaAMim(campanhaId: string) {

  const qc = useQueryClient();

  return useMutation({

    mutationFn: () => apiService.atribuirCampanhaAMim(campanhaId),

    onSuccess: () => refreshMarketing(qc, campanhaId),

  });

}



export function useParticiparCampanha(campanhaId: string) {

  const qc = useQueryClient();

  return useMutation({

    mutationFn: () => apiService.participarCampanha(campanhaId),

    onSuccess: () => refreshMarketing(qc, campanhaId),

  });

}



export function useAddCampanhaMidia(campanhaId: string) {

  const qc = useQueryClient();

  return useMutation({

    mutationFn: (driveFileId: string) => apiService.addCampanhaMidia(campanhaId, driveFileId),

    onSuccess: (newMidia) => {
      qc.setQueryData<CampanhaMarketing | undefined>(
        MARKETING_KEYS.campanha(campanhaId),
        (prev) => {
          if (!prev) return prev;
          const midias = prev.midias ?? [];
          if (midias.some((item) => item.driveFileId === newMidia.driveFileId)) return prev;
          return {
            ...prev,
            midias: [...midias, newMidia],
            midiasCount: (prev.midiasCount ?? midias.length) + 1,
          };
        },
      );
      refreshMarketing(qc, campanhaId, 'midia');
    },

  });

}



export function useRemoveCampanhaMidia(campanhaId: string) {

  const qc = useQueryClient();

  return useMutation({

    mutationFn: (driveFileId: string) => apiService.removeCampanhaMidia(campanhaId, driveFileId),

    onSuccess: (_data, driveFileId) => {
      qc.setQueryData<CampanhaMarketing | undefined>(
        MARKETING_KEYS.campanha(campanhaId),
        (prev) => {
          if (!prev) return prev;
          const midias = (prev.midias ?? []).filter((item) => item.driveFileId !== driveFileId);
          return {
            ...prev,
            midias,
            midiasCount: Math.max(0, midias.length),
          };
        },
      );
      refreshMarketing(qc, campanhaId, 'midia');
    },

  });

}

