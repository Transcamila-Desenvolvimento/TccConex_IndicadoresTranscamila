import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import type { SgqSipocEsquema } from '../types/domain';

const chave = ['sgq', 'sipoc'] as const;

export function useSgqSipocSetores() {
  const { selectedFilial } = useAuth();
  return useQuery({
    queryKey: [...chave, 'setores', selectedFilial],
    queryFn: () => apiService.getSgqSipocSetores(),
  });
}

export function useSgqSipocProcedimentos(setor: number | '', search: string) {
  const { selectedFilial } = useAuth();
  return useQuery({
    queryKey: [...chave, 'procedimentos', selectedFilial, setor, search],
    queryFn: () => apiService.getSgqSipocProcedimentos({ setor, search }),
  });
}

export function useSgqSipocProcedimento(id: number | null) {
  const { selectedFilial } = useAuth();
  return useQuery({
    queryKey: [...chave, 'procedimento', selectedFilial, id],
    queryFn: () => apiService.getSgqSipocProcedimento(id as number),
    enabled: id != null,
  });
}

export function useCriarSgqSipocSetor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nome: string) => apiService.criarSgqSipocSetor(nome),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chave }),
  });
}

export function useExcluirSgqSipocSetor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiService.excluirSgqSipocSetor(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chave }),
  });
}

export function useCriarSgqSipocProcedimento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { nome: string; setorId: number; descricao?: string }) => apiService.criarSgqSipocProcedimento(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chave }),
  });
}

export function useSalvarSgqSipocProcedimento() {
  const queryClient = useQueryClient();
  const { selectedFilial } = useAuth();
  return useMutation({
    mutationFn: ({ id, nome, descricao, setorId }: { id: number; nome: string; descricao: string; setorId: number }) => (
      apiService.atualizarSgqSipocProcedimento(id, { nome, descricao, setorId })
    ),
    onSuccess: (data) => {
      queryClient.setQueryData([...chave, 'procedimento', selectedFilial, data.id], data);
      queryClient.invalidateQueries({ queryKey: [...chave, 'procedimentos'] });
    },
  });
}

export function useExcluirSgqSipocProcedimento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiService.excluirSgqSipocProcedimento(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chave }),
  });
}

export function useAtualizarSgqSipocProcedimento(id: number) {
  const queryClient = useQueryClient();
  const { selectedFilial } = useAuth();
  return useMutation({
    mutationFn: (payload: { nome?: string; descricao?: string }) => apiService.atualizarSgqSipocProcedimento(id, payload),
    onSuccess: (data) => {
      queryClient.setQueryData([...chave, 'procedimento', selectedFilial, id], data);
      queryClient.invalidateQueries({ queryKey: [...chave, 'procedimentos'] });
    },
  });
}

export function useSalvarEsquemaSipoc(id: number) {
  const queryClient = useQueryClient();
  const { selectedFilial } = useAuth();
  return useMutation({
    mutationFn: (esquema: SgqSipocEsquema) => apiService.atualizarSgqSipocProcedimento(id, { esquema }),
    onSuccess: (data) => {
      queryClient.setQueryData([...chave, 'procedimento', selectedFilial, id], data);
      queryClient.invalidateQueries({ queryKey: [...chave, 'procedimentos'] });
    },
  });
}
