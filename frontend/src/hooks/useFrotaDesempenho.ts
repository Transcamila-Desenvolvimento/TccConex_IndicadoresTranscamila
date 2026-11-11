import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import type { CriterioDesempenho, ParametroBonificacao } from '../types/domain';
import { getFrotaErrorMessage } from './useFrotaOlhoVivo';

const DESEMPENHO_KEY = ['frota', 'desempenho'] as const;

export function useParametrosDesempenho() {
  const { selectedFilial } = useAuth();
  return useQuery({
    queryKey: [...DESEMPENHO_KEY, 'parametros', selectedFilial],
    queryFn: () => apiService.getParametrosDesempenho(),
  });
}

export function useCriteriosDesempenho() {
  const { selectedFilial } = useAuth();
  return useQuery({
    queryKey: [...DESEMPENHO_KEY, 'criterios', selectedFilial],
    queryFn: () => apiService.getCriteriosDesempenho(),
  });
}

export function useApuracaoDesempenho(params: { ano: number; mes: number; search?: string; page: number; pageSize: number }) {
  const { selectedFilial } = useAuth();
  return useQuery({
    queryKey: [...DESEMPENHO_KEY, 'apuracao', selectedFilial, params],
    queryFn: () => apiService.getApuracaoDesempenho(params),
    placeholderData: (anterior) => anterior,
  });
}

export function useOcorrenciasDesempenho(params: { ano: number; mes: number; funcionarioId?: string }, enabled: boolean) {
  const { selectedFilial } = useAuth();
  return useQuery({
    queryKey: [...DESEMPENHO_KEY, 'ocorrencias', selectedFilial, params],
    queryFn: () => apiService.getOcorrenciasDesempenho(params),
    enabled,
  });
}

function invalidar(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: DESEMPENHO_KEY });
}

export function useSalvarParametrosDesempenho() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ParametroBonificacao) => apiService.salvarParametrosDesempenho(payload),
    onSuccess: () => invalidar(queryClient),
  });
}

export function useCriarGrupoDesempenho() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { nome: string }) => apiService.criarGrupoDesempenho(payload),
    onSuccess: () => invalidar(queryClient),
  });
}

export function useSalvarGrupoDesempenho() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; nome: string; ativo: boolean }) =>
      apiService.salvarGrupoDesempenho(payload.id, payload),
    onSuccess: () => invalidar(queryClient),
  });
}

export function useExcluirGrupoDesempenho() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.excluirGrupoDesempenho(id),
    onSuccess: () => invalidar(queryClient),
  });
}

export function useCriarCriterioDesempenho() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { grupoId: string; nome: string; descricao: string; pontos: string; zeraBonus: boolean }) =>
      apiService.criarCriterioDesempenho(payload),
    onSuccess: () => invalidar(queryClient),
  });
}

export function useSalvarCriterioDesempenho() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; dados: Partial<CriterioDesempenho> }) =>
      apiService.salvarCriterioDesempenho(payload.id, payload.dados),
    onSuccess: () => invalidar(queryClient),
  });
}

export function useExcluirCriterioDesempenho() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.excluirCriterioDesempenho(id),
    onSuccess: () => invalidar(queryClient),
  });
}

export function useCriarOcorrenciaDesempenho() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { funcionarioId: string; criterioId: string; data: string; quantidade: number; observacao?: string }) =>
      apiService.criarOcorrenciaDesempenho(payload),
    onSuccess: () => invalidar(queryClient),
  });
}

export function useExcluirOcorrenciaDesempenho() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.excluirOcorrenciaDesempenho(id),
    onSuccess: () => invalidar(queryClient),
  });
}

export { getFrotaErrorMessage };
