import { useQuery, useMutation } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type {
  CashflowDayDetailParams,
  CashflowQueryParams,
  GnreIndicadoresGuiasQueryParams,
  OcorrenciasIndicadoresQueryParams,
  SendGerencialEmailParams,
} from '../types/domain';

export const INDICADORES_KPIS_KEY = ['indicadores', 'kpis'] as const;
export const INDICADORES_FILIAIS_KEY = ['indicadores', 'filiais'] as const;
export const INDICADORES_CASHFLOW_KEY = ['indicadores', 'cashflow'] as const;
export const INDICADORES_CASHFLOW_DAY_KEY = ['indicadores', 'cashflow', 'day'] as const;
export const INDICADORES_CASHFLOW_ACTIVITY_KEY = ['indicadores', 'cashflow', 'activity'] as const;
export const INDICADORES_OPS_KEY = ['indicadores', 'ocorrencias', 'ops'] as const;
export const INDICADORES_GNRE_KEY = ['indicadores', 'ocorrencias', 'gnre'] as const;
export const INDICADORES_GNRE_GUIAS_KEY = ['indicadores', 'ocorrencias', 'gnre', 'guias'] as const;

// Sistema multiusuário: o Fluxo de Caixa precisa refletir alterações feitas por
// outra pessoa no Financeiro sem exigir refresh manual. Em vez de recarregar o
// payload pesado do fluxo de caixa em intervalo fixo, fazemos polling barato
// desse "marcador de versão" e só invalidamos a query pesada quando ele muda
// (ver CashFlowActivityView / get_financeiro_activity_version no backend).
const CASHFLOW_ACTIVITY_POLL_INTERVAL_MS = 20_000;

export function useIndicadorKpis() {
  return useQuery({
    queryKey: INDICADORES_KPIS_KEY,
    queryFn: () => apiService.getIndicadorKpis(),
  });
}

export function useIndicadorFiliais() {
  return useQuery({
    queryKey: INDICADORES_FILIAIS_KEY,
    queryFn: () => apiService.getIndicadorFiliais(),
  });
}

export function useIndicadorCashflow(params: CashflowQueryParams) {
  return useQuery({
    queryKey: [...INDICADORES_CASHFLOW_KEY, params],
    queryFn: () => apiService.getIndicadorCashflow(params),
    placeholderData: (prev) => prev,
    retry: 1,
  });
}

export function useIndicadorCashflowDayDetail(
  params: CashflowDayDetailParams | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [...INDICADORES_CASHFLOW_DAY_KEY, params],
    queryFn: () => apiService.getIndicadorCashflowDayDetail(params!),
    enabled: enabled && !!params?.date,
  });
}

export function useSendGerencialEmail() {
  return useMutation({
    mutationFn: (params: SendGerencialEmailParams) => apiService.sendGerencialEmail(params),
  });
}

/**
 * Faz polling leve de um marcador de versão para detectar, entre múltiplos
 * usuários, quando alguém atualizou dados do Financeiro que afetam o Fluxo de
 * Caixa. `enabled` deve ficar `false` quando a tela não está visível (ex.: aba
 * "Gerencial" quando o usuário está em outra aba do navegador) para não gerar
 * requisições desnecessárias — o TanStack Query também pausa o polling
 * automaticamente quando a aba do navegador perde o foco.
 */
export function useCashflowActivityVersion(enabled = true) {
  return useQuery({
    queryKey: INDICADORES_CASHFLOW_ACTIVITY_KEY,
    queryFn: () => apiService.getCashflowActivityVersion(),
    enabled,
    refetchInterval: CASHFLOW_ACTIVITY_POLL_INTERVAL_MS,
    staleTime: 0,
    retry: 1,
  });
}

export function useOpsIndicadores(params: OcorrenciasIndicadoresQueryParams = {}, enabled = true) {
  return useQuery({
    queryKey: [...INDICADORES_OPS_KEY, params],
    queryFn: () => apiService.getOpsIndicadores(params),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useGnreIndicadores(params: OcorrenciasIndicadoresQueryParams = {}, enabled = true) {
  return useQuery({
    queryKey: [...INDICADORES_GNRE_KEY, params],
    queryFn: () => apiService.getGnreIndicadores(params),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useGnreIndicadoresGuias(params: GnreIndicadoresGuiasQueryParams = {}, enabled = true) {
  return useQuery({
    queryKey: [...INDICADORES_GNRE_GUIAS_KEY, params],
    queryFn: () => apiService.getGnreIndicadoresGuias(params),
    enabled,
    placeholderData: (prev) => prev,
  });
}
