import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiService } from '../services/apiService';
import type { RegistrarCompraPayload, RegistrarSaidaPayload } from '../types/domain';

export function getComprasErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export const COMPRAS_KEYS = {
  unidades: ['compras', 'unidades'] as const,
  setores: ['compras', 'setores'] as const,
  colaboradores: ['compras', 'colaboradores'] as const,
  fornecedores: ['compras', 'fornecedores'] as const,
  itens: ['compras', 'itens'] as const,
  entradas: ['compras', 'entradas'] as const,
  saidas: ['compras', 'saidas'] as const,
};

// ─── Unidades de Medida ─────────────────────────────────────────────────────

export function useUnidadesMedida() {
  return useQuery({
    queryKey: COMPRAS_KEYS.unidades,
    queryFn: () => apiService.getUnidadesMedida(),
  });
}

export function useCreateUnidadeMedida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nome: string) => apiService.createUnidadeMedida(nome),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.unidades }),
  });
}

export function useUpdateUnidadeMedida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nome }: { id: string; nome: string }) => apiService.updateUnidadeMedida(id, nome),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.unidades }),
  });
}

export function useDeleteUnidadeMedida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteUnidadeMedida(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.unidades }),
  });
}

// ─── Setores ────────────────────────────────────────────────────────────────

export function useSetoresCompras() {
  return useQuery({
    queryKey: COMPRAS_KEYS.setores,
    queryFn: () => apiService.getSetoresCompras(),
  });
}

export function useCreateSetorCompras() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nome: string) => apiService.createSetorCompras(nome),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.setores }),
  });
}

export function useUpdateSetorCompras() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nome }: { id: string; nome: string }) => apiService.updateSetorCompras(id, nome),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.setores }),
  });
}

export function useDeleteSetorCompras() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteSetorCompras(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.setores }),
  });
}

// ─── Colaboradores ──────────────────────────────────────────────────────────

export function useColaboradoresCompras() {
  return useQuery({
    queryKey: COMPRAS_KEYS.colaboradores,
    queryFn: () => apiService.getColaboradoresCompras(),
  });
}

export function useCreateColaboradorCompras() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nome: string) => apiService.createColaboradorCompras(nome),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.colaboradores }),
  });
}

export function useUpdateColaboradorCompras() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nome }: { id: string; nome: string }) => apiService.updateColaboradorCompras(id, nome),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.colaboradores }),
  });
}

export function useDeleteColaboradorCompras() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteColaboradorCompras(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.colaboradores }),
  });
}

// ─── Fornecedores ───────────────────────────────────────────────────────────

export function useFornecedores() {
  return useQuery({
    queryKey: COMPRAS_KEYS.fornecedores,
    queryFn: () => apiService.getFornecedores(),
  });
}

export function useCreateFornecedor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nome: string) => apiService.createFornecedor(nome),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.fornecedores }),
  });
}

export function useUpdateFornecedor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nome }: { id: string; nome: string }) => apiService.updateFornecedor(id, nome),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.fornecedores }),
  });
}

export function useDeleteFornecedor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteFornecedor(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.fornecedores }),
  });
}

// ─── Itens de Estoque ───────────────────────────────────────────────────────

export function useItensEstoque() {
  return useQuery({
    queryKey: COMPRAS_KEYS.itens,
    queryFn: () => apiService.getItensEstoque(),
  });
}

export function useCreateItemEstoque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: { nome: string; unidade: string; qtdAtual: number; qtdMinima: number }) =>
      apiService.createItemEstoque(item),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.itens }),
  });
}

export function useUpdateItemEstoque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, item }: { id: string; item: Partial<{ nome: string; unidade: string; qtdAtual: number; qtdMinima: number }> }) =>
      apiService.updateItemEstoque(id, item),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.itens }),
  });
}

export function useDeleteItemEstoque() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteItemEstoque(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.itens }),
  });
}

// ─── Entradas (Compras) / Saídas (Protocolo) ───────────────────────────────

export function useEntradasEstoque() {
  return useQuery({
    queryKey: COMPRAS_KEYS.entradas,
    queryFn: () => apiService.getEntradasEstoque(),
  });
}

export function useRegistrarCompra() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegistrarCompraPayload) => apiService.registrarCompra(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.entradas });
      queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.itens });
    },
  });
}

export function useSaidasEstoque() {
  return useQuery({
    queryKey: COMPRAS_KEYS.saidas,
    queryFn: () => apiService.getSaidasEstoque(),
  });
}

export function useRegistrarSaida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegistrarSaidaPayload) => apiService.registrarSaida(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.saidas });
      queryClient.invalidateQueries({ queryKey: COMPRAS_KEYS.itens });
    },
  });
}
