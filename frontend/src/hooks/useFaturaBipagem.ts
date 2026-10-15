import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';

export function useBaseBipagem(params: { page: number; pageSize: number; search: string; codCliente: string }) {
  return useQuery({
    queryKey: ['faturamento', 'bipagem', 'base', params],
    queryFn: () => apiService.listarBaseBipagem(params),
    placeholderData: (anterior) => anterior,
  });
}

export function useBuscarDocumentoBipagem() {
  return useMutation({
    mutationFn: (params: { codigo: string; codCliente?: string }) => apiService.buscarDocumentoBipagem(params),
  });
}

export function useImportarBaseBipagem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => apiService.importarBaseBipagem(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['faturamento', 'bipagem', 'base'] }),
  });
}
