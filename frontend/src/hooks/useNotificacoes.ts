import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import {
  cancelarInscricaoNavegador,
  inscreverNavegador,
  lerEstadoPushNavegador,
} from '../services/webPush';

export const NOTIFICACOES_KEY = ['notificacoes'] as const;
export const NOTIFICACOES_NAO_LIDAS_KEY = ['notificacoes', 'nao-lidas'] as const;
export const NOTIFICACOES_LISTA_KEY = ['notificacoes', 'lista'] as const;
export const NOTIFICACOES_PUSH_CONFIG_KEY = ['notificacoes', 'push', 'config'] as const;
export const NOTIFICACOES_PUSH_NAVEGADOR_KEY = ['notificacoes', 'push', 'navegador'] as const;

const NOTIFICACOES_POLL_INTERVAL_MS = 30_000;

export function useNotificacoesNaoLidas(enabled = true) {
  return useQuery({
    queryKey: NOTIFICACOES_NAO_LIDAS_KEY,
    queryFn: () => apiService.getNotificacoesNaoLidas(),
    enabled,
    refetchInterval: NOTIFICACOES_POLL_INTERVAL_MS,
    staleTime: 0,
    retry: 1,
  });
}

export function useNotificacoes(enabled = true) {
  return useQuery({
    queryKey: NOTIFICACOES_LISTA_KEY,
    queryFn: () => apiService.getNotificacoes({ pageSize: 20 }),
    enabled,
    refetchInterval: enabled ? NOTIFICACOES_POLL_INTERVAL_MS : false,
    staleTime: 0,
    retry: 1,
  });
}

export function useMarcarNotificacaoLida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.marcarNotificacaoLida(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICACOES_KEY }),
  });
}

export function usePushNotificacoesConfig() {
  return useQuery({
    queryKey: NOTIFICACOES_PUSH_CONFIG_KEY,
    queryFn: () => apiService.getPushNotificacoesConfig(),
    staleTime: 10 * 60_000,
    retry: 1,
  });
}

/** Estado local do navegador (permissão e inscrição), não vem da API. */
export function usePushNavegador() {
  return useQuery({
    queryKey: NOTIFICACOES_PUSH_NAVEGADOR_KEY,
    queryFn: () => lerEstadoPushNavegador(),
    staleTime: Infinity,
    retry: false,
  });
}

export function useAtivarPushNotificacoes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (publicKey: string) => {
      const inscricao = await inscreverNavegador(publicKey);
      await apiService.inscreverPushNotificacoes(inscricao);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICACOES_PUSH_NAVEGADOR_KEY }),
  });
}

export function useDesativarPushNotificacoes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const endpoint = await cancelarInscricaoNavegador();
      if (endpoint) await apiService.cancelarPushNotificacoes(endpoint);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICACOES_PUSH_NAVEGADOR_KEY }),
  });
}

/** Vincula a inscrição já existente deste navegador ao usuário logado (troca de login na mesma máquina). */
export function useSincronizarPushNotificacoes() {
  return useMutation({
    mutationFn: apiService.inscreverPushNotificacoes,
  });
}

export function useMarcarTodasNotificacoesLidas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiService.marcarTodasNotificacoesLidas(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICACOES_KEY }),
  });
}
