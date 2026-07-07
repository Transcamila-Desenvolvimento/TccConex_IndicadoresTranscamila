import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiService } from '../services/apiService';
import type { ColaboradorPJ, CargoMapping } from '../types/domain';

export function getRHErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export const RH_KEYS = {
  lotes: ['rh', 'lotes'] as const,
  dashboard: ['rh', 'dashboard'] as const,
  movimentacoes: ['rh', 'movimentacoes'] as const,
  buscarComparar: ['rh', 'buscar-comparar'] as const,
  comparacao: ['rh', 'comparacao'] as const,
  pjs: ['rh', 'pjs'] as const,
  cargos: ['rh', 'cargos'] as const,
  colaboradores: ['rh', 'colaboradores'] as const,
  historicoSalarial: ['rh', 'historico-salarial'] as const,
};

function invalidateRHData(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: RH_KEYS.dashboard });
  queryClient.invalidateQueries({ queryKey: RH_KEYS.movimentacoes });
  queryClient.invalidateQueries({ queryKey: RH_KEYS.lotes });
  queryClient.invalidateQueries({ queryKey: RH_KEYS.colaboradores });
}

// ─── Lotes / Dashboard ──────────────────────────────────────────────────────

export function useLotesRH() {
  return useQuery({
    queryKey: RH_KEYS.lotes,
    queryFn: () => apiService.getLotesRH(),
  });
}

export function useRHDashboardSummary(params: { mes?: number; ano?: number; loteId?: string }) {
  return useQuery({
    queryKey: [...RH_KEYS.dashboard, params],
    queryFn: () => apiService.getRHDashboardSummary(params),
    placeholderData: (prev) => prev,
  });
}

export function useMovimentacoesRH(
  params: { loteId?: string; filial?: string; categoria?: string; situacao?: string; search?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: [...RH_KEYS.movimentacoes, params],
    queryFn: () => apiService.getMovimentacoesRH(params),
    enabled: enabled && !!params.loteId,
    placeholderData: (prev) => prev,
  });
}

export function usePrepareLoteRH() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mes, ano }: { mes: number; ano: number }) => apiService.prepareLoteRH(mes, ano),
    onSuccess: () => invalidateRHData(queryClient),
  });
}

export function useImportarArquivoRH() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mes, ano, file }: { mes: number; ano: number; file: File }) =>
      apiService.importarArquivoRH(mes, ano, file),
    onSuccess: () => invalidateRHData(queryClient),
  });
}

export function useImportarLoteRH() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => apiService.importarLoteRH(file),
    onSuccess: () => invalidateRHData(queryClient),
  });
}

export function useEnviarEmailRH() {
  return useMutation({
    mutationFn: ({ loteId, to, cc }: { loteId: string; to: string[]; cc?: string[] }) =>
      apiService.enviarEmailRH(loteId, to, cc),
  });
}

export function useExportarModeloRH() {
  return useMutation({
    mutationFn: () => apiService.exportarModeloRH(),
  });
}

export function useExportarRelatorioMovimentacoesRH() {
  return useMutation({
    mutationFn: (loteId: string) => apiService.exportarRelatorioMovimentacoesRH(loteId),
  });
}

// ─── Comparação salarial ────────────────────────────────────────────────────

export function useBuscarCompararRH(term: string, enabled: boolean) {
  return useQuery({
    queryKey: [...RH_KEYS.buscarComparar, term],
    queryFn: () => apiService.buscarCompararRH(term),
    enabled: enabled && term.trim().length >= 2,
  });
}

export function useComparacaoDadosRH(cpfs: string[], enabled: boolean) {
  return useQuery({
    queryKey: [...RH_KEYS.comparacao, cpfs],
    queryFn: () => apiService.getComparacaoDadosRH(cpfs),
    enabled: enabled && cpfs.length === 2,
  });
}

// ─── PJs ────────────────────────────────────────────────────────────────────

export function usePjsRH(params: { search?: string } = {}) {
  return useQuery({
    queryKey: [...RH_KEYS.pjs, params],
    queryFn: () => apiService.getPjsRH(params),
  });
}

export function useCreatePjRH() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pj: Omit<ColaboradorPJ, 'id' | 'dataCriacao'>) => apiService.createPjRH(pj),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RH_KEYS.pjs });
    },
  });
}

export function useUpdatePjRH() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pj }: { id: string; pj: Partial<ColaboradorPJ> }) => apiService.updatePjRH(id, pj),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RH_KEYS.pjs });
    },
  });
}

export function useDeletePjRH() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deletePjRH(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RH_KEYS.pjs });
    },
  });
}

// ─── Mapeamento de cargos ───────────────────────────────────────────────────

export function useCargosRH(params: { status?: 'pendente' | 'definido'; search?: string } = {}) {
  return useQuery({
    queryKey: [...RH_KEYS.cargos, params],
    queryFn: () => apiService.getCargosRH(params),
  });
}

export function useUpdateCargoRH() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, categoria }: { id: string; categoria?: CargoMapping['categoria'] }) =>
      apiService.updateCargoRH(id, categoria),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RH_KEYS.cargos });
      queryClient.invalidateQueries({ queryKey: RH_KEYS.colaboradores });
      invalidateRHData(queryClient);
    },
  });
}

export function useDeleteCargoMappingRH() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteCargoMappingRH(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RH_KEYS.cargos });
    },
  });
}

// ─── Colaboradores / desconsiderados ────────────────────────────────────────

export function useColaboradoresRH(params: { search?: string; desconsiderados?: boolean } = {}) {
  return useQuery({
    queryKey: [...RH_KEYS.colaboradores, params],
    queryFn: () => apiService.getColaboradoresRH(params),
  });
}

export function useToggleDesconsiderarRH() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.toggleDesconsiderarRH(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RH_KEYS.colaboradores });
      invalidateRHData(queryClient);
    },
  });
}

// ─── Histórico salarial ─────────────────────────────────────────────────────

export function useHistoricoSalarialRH(params: { search?: string } = {}) {
  return useQuery({
    queryKey: [...RH_KEYS.historicoSalarial, params],
    queryFn: () => apiService.getHistoricoSalarialRH(params),
  });
}

export function useImportarHistoricoSalarialRH() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => apiService.importarHistoricoSalarialRH(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RH_KEYS.historicoSalarial });
      invalidateRHData(queryClient);
    },
  });
}

export function useSalvarJustificativaAlteracao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, justificativa }: { id: string; justificativa: string }) =>
      apiService.salvarJustificativaAlteracao(id, justificativa),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RH_KEYS.dashboard });
    },
  });
}
