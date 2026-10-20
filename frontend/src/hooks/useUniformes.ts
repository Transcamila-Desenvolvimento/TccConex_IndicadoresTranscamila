import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type {
  ColaboradorUniformesFiltros,
  DevolucaoTotalUniformePayload,
  EntregaUniformeFiltros,
  MovimentacaoUniformeFiltros,
  MovimentoEstoqueUniformePayload,
  MovimentoEstoqueUniformeTipo,
  RegistrarDevolucaoUniformePayload,
  RegistrarEntregaUniformePayload,
  UniformeLotePayload,
  UniformePayload,
} from '../types/domain';

export const UNIFORMES_KEYS = {
  all: ['compras', 'uniformes'] as const,
  lista: ['compras', 'uniformes', 'lista'] as const,
  resumo: ['compras', 'uniformes', 'resumo'] as const,
  entregas: ['compras', 'uniformes', 'entregas'] as const,
  emPosse: ['compras', 'uniformes', 'em-posse'] as const,
  movimentacoes: ['compras', 'uniformes', 'movimentacoes'] as const,
};

function useInvalidarUniformes() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: UNIFORMES_KEYS.all });
}

export function useUniformes() {
  return useQuery({
    queryKey: UNIFORMES_KEYS.lista,
    queryFn: () => apiService.getUniformes(),
  });
}

export function useResumoUniformes() {
  return useQuery({
    queryKey: UNIFORMES_KEYS.resumo,
    queryFn: () => apiService.getResumoUniformes(),
  });
}

export function useCreateUniforme() {
  const invalidar = useInvalidarUniformes();
  return useMutation({
    mutationFn: (payload: UniformePayload) => apiService.createUniforme(payload),
    onSuccess: invalidar,
  });
}

export function useCreateUniformesLote() {
  const invalidar = useInvalidarUniformes();
  return useMutation({
    mutationFn: (payload: UniformeLotePayload) => apiService.createUniformesLote(payload),
    onSuccess: invalidar,
  });
}

export function useUpdateUniforme() {
  const invalidar = useInvalidarUniformes();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<UniformePayload> & { id: string }) => apiService.updateUniforme(id, payload),
    onSuccess: invalidar,
  });
}

export function useDeleteUniforme() {
  const invalidar = useInvalidarUniformes();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteUniforme(id),
    onSuccess: invalidar,
  });
}

export function useMovimentarEstoqueUniforme() {
  const invalidar = useInvalidarUniformes();
  return useMutation({
    mutationFn: ({ id, tipo, ...payload }: MovimentoEstoqueUniformePayload & { id: string; tipo: MovimentoEstoqueUniformeTipo }) =>
      apiService.movimentarEstoqueUniforme(id, tipo, payload),
    onSuccess: invalidar,
  });
}

export function useEntregasUniforme(filtros: EntregaUniformeFiltros, enabled = true) {
  return useQuery({
    queryKey: [...UNIFORMES_KEYS.entregas, filtros],
    queryFn: () => apiService.getEntregasUniforme(filtros),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRegistrarEntregaUniforme() {
  const invalidar = useInvalidarUniformes();
  return useMutation({
    mutationFn: (payload: RegistrarEntregaUniformePayload) => apiService.registrarEntregaUniforme(payload),
    onSuccess: invalidar,
  });
}

export function useRegistrarDevolucaoUniforme() {
  const invalidar = useInvalidarUniformes();
  return useMutation({
    mutationFn: ({ entregaId, ...payload }: RegistrarDevolucaoUniformePayload & { entregaId: string }) =>
      apiService.registrarDevolucaoUniforme(entregaId, payload),
    onSuccess: invalidar,
  });
}

export function useRegistrarDevolucaoTotalUniforme() {
  const invalidar = useInvalidarUniformes();
  return useMutation({
    mutationFn: (payload: DevolucaoTotalUniformePayload) => apiService.registrarDevolucaoTotalUniforme(payload),
    onSuccess: invalidar,
  });
}

export function useColaboradoresUniformes(filtros: ColaboradorUniformesFiltros) {
  return useQuery({
    queryKey: [...UNIFORMES_KEYS.entregas, 'por-colaborador', filtros],
    queryFn: () => apiService.getColaboradoresUniformes(filtros),
    placeholderData: keepPreviousData,
  });
}

export function useUniformesEmPosse(colaboradorId: string) {
  return useQuery({
    queryKey: [...UNIFORMES_KEYS.emPosse, colaboradorId],
    queryFn: () => apiService.getUniformesEmPosse(colaboradorId),
    enabled: Boolean(colaboradorId),
  });
}

export function useMovimentacoesUniforme(filtros: MovimentacaoUniformeFiltros, enabled = true) {
  return useQuery({
    queryKey: [...UNIFORMES_KEYS.movimentacoes, filtros],
    queryFn: () => apiService.getMovimentacoesUniforme(filtros),
    placeholderData: keepPreviousData,
    enabled,
  });
}
