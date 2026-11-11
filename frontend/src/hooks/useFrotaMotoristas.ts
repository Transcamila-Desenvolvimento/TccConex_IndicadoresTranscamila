import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { getFrotaErrorMessage } from './useFrotaOlhoVivo';

const MOTORISTAS_KEY = ['frota', 'motoristas'] as const;

export function useUsuariosMotorista(params: {
  search?: string;
  page?: number;
  pageSize?: number;
  status?: 'ativo' | 'inativo';
}) {
  const { selectedFilial } = useAuth();
  return useQuery({
    queryKey: [...MOTORISTAS_KEY, 'usuarios', selectedFilial, params],
    queryFn: () => apiService.getUsuariosMotorista(params),
    placeholderData: (anterior) => anterior,
  });
}

export function useMotoristasElegiveis(enabled: boolean) {
  const { selectedFilial } = useAuth();
  return useQuery({
    queryKey: [...MOTORISTAS_KEY, 'elegiveis', selectedFilial],
    queryFn: () => apiService.getMotoristasElegiveis(),
    enabled,
  });
}

function invalidarMotoristas(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: MOTORISTAS_KEY });
}

export function useCadastrarUsuarioMotorista() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { funcionarioId: string; password: string }) => apiService.cadastrarUsuarioMotorista(payload),
    onSuccess: () => invalidarMotoristas(queryClient),
  });
}

export function useDefinirSenhaUsuarioMotorista() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => apiService.definirSenhaUsuarioMotorista(id, password),
    onSuccess: () => invalidarMotoristas(queryClient),
  });
}

export function useExcluirUsuarioMotorista() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.excluirUsuarioMotorista(id),
    onSuccess: () => invalidarMotoristas(queryClient),
  });
}

export { getFrotaErrorMessage };
