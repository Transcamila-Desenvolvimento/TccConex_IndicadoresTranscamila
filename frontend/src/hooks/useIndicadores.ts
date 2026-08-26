import { useQuery, useMutation } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type {
  CashflowDayDetailParams,
  CashflowQueryParams,
  MetaFaturamentoQueryParams,
  RHIndicadorQueryParams,
  SendGerencialEmailParams,
  SgqSatisfacaoIndicadorQueryParams,
} from '../types/domain';

export const INDICADORES_KPIS_KEY = ['indicadores', 'kpis'] as const;
export const INDICADORES_FILIAIS_KEY = ['indicadores', 'filiais'] as const;
export const INDICADORES_CASHFLOW_KEY = ['indicadores', 'cashflow'] as const;
export const INDICADORES_CASHFLOW_DAY_KEY = ['indicadores', 'cashflow', 'day'] as const;
export const INDICADORES_CASHFLOW_ACTIVITY_KEY = ['indicadores', 'cashflow', 'activity'] as const;
export const INDICADORES_RH_MOVIMENTACAO_KEY = ['indicadores', 'rh', 'movimentacao'] as const;
export const INDICADORES_META_FATURAMENTO_KEY = ['indicadores', 'logistica', 'meta-faturamento'] as const;
export const INDICADORES_SGQ_SATISFACAO_KEY = ['indicadores', 'sgq', 'satisfacao'] as const;
export const INDICADORES_SGQ_ACTIVITY_KEY = ['indicadores', 'sgq', 'activity'] as const;

// Sistema multiusuário: o Fluxo de Caixa precisa refletir alterações feitas por
// outra pessoa no Financeiro sem exigir refresh manual. Em vez de recarregar o
// payload pesado do fluxo de caixa em intervalo fixo, fazemos polling barato
// desse "marcador de versão" e só invalidamos a query pesada quando ele muda
// (ver CashFlowActivityView / get_financeiro_activity_version no backend).
// O indicador de Satisfação usa o mesmo intervalo para pesquisas do SGQ.
const CASHFLOW_ACTIVITY_POLL_INTERVAL_MS = 20_000;
const SGQ_ACTIVITY_POLL_INTERVAL_MS = 20_000;

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

export function useIndicadorRHMovimentacao(params: RHIndicadorQueryParams) {
  return useQuery({
    queryKey: [...INDICADORES_RH_MOVIMENTACAO_KEY, params],
    queryFn: () => apiService.getIndicadorRHMovimentacao(params),
    retry: 1,
  });
}

export function useExportarIndicadorRHMovimentacao() {
  return useMutation({
    mutationFn: (referencia: string) => apiService.exportarIndicadorRHMovimentacao(referencia),
  });
}

export function useIndicadorSgqSatisfacao(params: SgqSatisfacaoIndicadorQueryParams) {
  return useQuery({
    queryKey: [...INDICADORES_SGQ_SATISFACAO_KEY, params],
    queryFn: () => apiService.getIndicadorSgqSatisfacao(params),
    placeholderData: (prev) => prev,
    retry: 1,
  });
}

export function useIndicadorSgqSatisfacaoDetalhes(
  params: SgqSatisfacaoIndicadorQueryParams,
  enabled = true,
) {
  return useQuery({
    queryKey: [...INDICADORES_SGQ_SATISFACAO_KEY, 'detalhes', params],
    queryFn: () => apiService.getIndicadorSgqSatisfacaoDetalhes(params),
    enabled,
    placeholderData: (prev) => prev,
    retry: 1,
  });
}

export function useIndicadorMetaFaturamento(params: MetaFaturamentoQueryParams) {
  return useQuery({
    queryKey: [...INDICADORES_META_FATURAMENTO_KEY, params],
    queryFn: () => apiService.getIndicadorMetaFaturamento(params),
    placeholderData: (prev) => prev,
    retry: 1,
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

/**
 * Polling leve do marcador de versão das pesquisas SGQ. Quando outra pessoa
 * lança/altera/exclui pesquisas com o indicador de Satisfação aberto, a query
 * pesada é invalidada só após a versão mudar (mesmo padrão do Fluxo de Caixa).
 */
export function useSgqSatisfacaoActivityVersion(enabled = true) {
  return useQuery({
    queryKey: INDICADORES_SGQ_ACTIVITY_KEY,
    queryFn: () => apiService.getSgqSatisfacaoActivityVersion(),
    enabled,
    refetchInterval: SGQ_ACTIVITY_POLL_INTERVAL_MS,
    staleTime: 0,
    retry: 1,
  });
}
