import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiService } from '../services/apiService';
import { downloadSgqAuditoriaAnaliticoPdf } from '../workspaces/SGQ/sgqAuditoriaAnaliticoPdf';
import { downloadSgqAuditoriaRegistroPdf } from '../workspaces/SGQ/sgqAuditoriaRegistroPdf';
import type {
  SgqAuditoriaExecucao,
  SgqAuditoriaPayload,
  SgqAuditoriaQueryParams,
  SgqAuditoriaResposta,
  SgqAuditoriaRespostaPayload,
} from '../types/domain';

// A filial da sessão entra na queryKey: o escopo é aplicado no backend pelo
// header X-Prothon-Filial, então cada filial precisa do próprio cache.
export const SGQ_AUDITORIAS_KEYS = {
  all: ['sgq', 'auditorias'] as const,
  lista: (filial: string | null, params: SgqAuditoriaQueryParams) => ['sgq', 'auditorias', 'lista', filial, params] as const,
  resumo: (filial: string | null) => ['sgq', 'auditorias', 'resumo', filial] as const,
  visao: (filial: string | null) => ['sgq', 'auditorias', 'visao', filial] as const,
  sugestoes: (filial: string | null) => ['sgq', 'auditorias', 'sugestoes', filial] as const,
};

export function useSgqAuditorias(filial: string | null, params: SgqAuditoriaQueryParams) {
  return useQuery({
    queryKey: SGQ_AUDITORIAS_KEYS.lista(filial, params),
    queryFn: () => apiService.getSgqAuditorias(params),
    placeholderData: keepPreviousData,
  });
}

export function useSgqAuditoriasResumo(filial: string | null) {
  return useQuery({
    queryKey: SGQ_AUDITORIAS_KEYS.resumo(filial),
    queryFn: () => apiService.getSgqAuditoriasResumo(),
  });
}

export function useSgqAuditoriasVisao(filial: string | null) {
  return useQuery({
    queryKey: SGQ_AUDITORIAS_KEYS.visao(filial),
    queryFn: () => apiService.getSgqAuditoriasVisao(),
  });
}

export function useSgqAuditoriasSugestoes(filial: string | null, enabled: boolean) {
  return useQuery({
    queryKey: SGQ_AUDITORIAS_KEYS.sugestoes(filial),
    queryFn: () => apiService.getSgqAuditoriasSugestoes(),
    enabled,
    staleTime: 60_000,
  });
}

export function useSaveSgqAuditoria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: SgqAuditoriaPayload }) => (
      id ? apiService.updateSgqAuditoria(id, payload) : apiService.createSgqAuditoria(payload)
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SGQ_AUDITORIAS_KEYS.all }),
  });
}

export function useDeleteSgqAuditorias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => apiService.deleteSgqAuditorias(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SGQ_AUDITORIAS_KEYS.all }),
  });
}

// Fora de SGQ_AUDITORIAS_KEYS.all: salvar uma resposta atualiza o cache da execução sem recarregar todas as perguntas.
export const SGQ_AUDITORIA_EXECUCAO_KEY = (filial: string | null, id: string) => ['sgq', 'auditoria-execucao', filial, id] as const;

export function useBaixarRelatorioSgqAuditoria(filial: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tipo }: { id: string; tipo: 'detalhado' | 'analitico' }) => {
      const dados = await queryClient.fetchQuery({
        queryKey: SGQ_AUDITORIA_EXECUCAO_KEY(filial, id),
        queryFn: () => apiService.getSgqAuditoriaExecucao(id),
      });
      if (tipo === 'analitico') await downloadSgqAuditoriaAnaliticoPdf(dados);
      else await downloadSgqAuditoriaRegistroPdf(dados);
    },
  });
}

export function useSgqAuditoriaExecucao(filial: string | null, id: string) {
  return useQuery({
    queryKey: SGQ_AUDITORIA_EXECUCAO_KEY(filial, id),
    queryFn: () => apiService.getSgqAuditoriaExecucao(id),
    enabled: Boolean(id),
  });
}

function useAplicarResposta(filial: string | null, id: string) {
  const queryClient = useQueryClient();
  return (resposta: SgqAuditoriaResposta) => {
    const chave = SGQ_AUDITORIA_EXECUCAO_KEY(filial, id);
    const atual = queryClient.getQueryData<SgqAuditoriaExecucao>(chave);
    if (atual) {
      const outras = atual.respostas.filter((r) => r.itemId !== resposta.itemId);
      queryClient.setQueryData<SgqAuditoriaExecucao>(chave, { ...atual, respostas: [...outras, resposta] });
    }
    // A primeira resposta coloca a auditoria em execução no servidor.
    if (atual?.auditoria.status === 'planejamento') queryClient.invalidateQueries({ queryKey: chave });
    queryClient.invalidateQueries({ queryKey: SGQ_AUDITORIAS_KEYS.all });
  };
}

export function useResponderSgqAuditoria(filial: string | null, id: string) {
  const aplicar = useAplicarResposta(filial, id);
  return useMutation({
    mutationFn: (payload: SgqAuditoriaRespostaPayload) => apiService.responderSgqAuditoriaItem(id, payload),
    onSuccess: aplicar,
  });
}

export function useAnexarSgqAuditoria(filial: string | null, id: string) {
  const aplicar = useAplicarResposta(filial, id);
  return useMutation({
    mutationFn: ({ itemId, arquivo }: { itemId: string; arquivo: File }) => apiService.anexarSgqAuditoriaItem(id, itemId, arquivo),
    onSuccess: aplicar,
  });
}

export function useExcluirSgqAuditoriaAnexo(filial: string | null, id: string) {
  const aplicar = useAplicarResposta(filial, id);
  return useMutation({
    mutationFn: (anexoId: string) => apiService.excluirSgqAuditoriaAnexo(id, anexoId),
    onSuccess: aplicar,
  });
}

export function getSgqAuditoriaErrorMessage(
  err: unknown,
  fallback = 'Não foi possível salvar a auditoria. Tente novamente.',
): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | undefined;
    if (data) {
      if (typeof data.detail === 'string') return data.detail;
      const primeiro = Object.values(data).flat()[0];
      if (typeof primeiro === 'string') return primeiro;
    }
  }
  return fallback;
}
