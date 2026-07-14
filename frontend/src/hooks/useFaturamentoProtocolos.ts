import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type {
  ClienteProtocoloPayload,
  CreateProtocoloPayload,
  UpdateProtocoloPayload,
  ProtocoloImportParams,
  ProtocoloQueryParams,
} from '../types/domain';

export const PROTOCOLO_CLIENTES_KEY = ['faturamento', 'protocolo-clientes'] as const;
export const PROTOCOLOS_ENVIO_KEY = ['faturamento', 'protocolos'] as const;

export function useProtocoloClientes(enabled = true) {
  return useQuery({
    queryKey: PROTOCOLO_CLIENTES_KEY,
    queryFn: () => apiService.getProtocoloClientes(),
    enabled,
  });
}

export function useCreateProtocoloCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ClienteProtocoloPayload) => apiService.createProtocoloCliente(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROTOCOLO_CLIENTES_KEY }),
  });
}

export function useUpdateProtocoloCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ClienteProtocoloPayload> }) =>
      apiService.updateProtocoloCliente(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROTOCOLO_CLIENTES_KEY }),
  });
}

export function useDeleteProtocoloCliente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteProtocoloCliente(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROTOCOLO_CLIENTES_KEY }),
  });
}

export function useCreateFilial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clienteId, nome }: { clienteId: string; nome: string }) =>
      apiService.createFilial(clienteId, nome),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROTOCOLO_CLIENTES_KEY }),
  });
}

export function useDeleteFilial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clienteId, filialId }: { clienteId: string; filialId: string }) =>
      apiService.deleteFilial(clienteId, filialId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROTOCOLO_CLIENTES_KEY }),
  });
}

export function useProtocolosEnvio(params: ProtocoloQueryParams, enabled = true) {
  return useQuery({
    queryKey: [...PROTOCOLOS_ENVIO_KEY, params],
    queryFn: () => apiService.getProtocolosEnvio(params),
    enabled,
  });
}

export function useCreateProtocoloEnvio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProtocoloPayload) => apiService.createProtocoloEnvio(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROTOCOLOS_ENVIO_KEY }),
  });
}

export function useUpdateProtocoloEnvio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProtocoloPayload }) =>
      apiService.updateProtocoloEnvio(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROTOCOLOS_ENVIO_KEY }),
  });
}

export function useDeleteProtocoloEnvio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteProtocoloEnvio(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROTOCOLOS_ENVIO_KEY }),
  });
}

export function useBulkDeleteProtocolos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => apiService.bulkDeleteProtocolos(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROTOCOLOS_ENVIO_KEY }),
  });
}

export function useDownloadProtocoloPdf() {
  return useMutation({
    mutationFn: (id: string) => apiService.downloadProtocoloPdf(id),
  });
}

export function useDownloadProtocolosBulkPdf() {
  return useMutation({
    mutationFn: (ids: number[]) => apiService.downloadProtocolosBulkPdf(ids),
  });
}

/** Abre aba vazia no gesto do clique — evita bloqueio de popup após o fetch assíncrono. */
export function openPdfPreviewPlaceholder(): Window | null {
  const previewWindow = window.open('about:blank', '_blank');
  if (!previewWindow) return null;

  previewWindow.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Gerando PDF...</title></head>
     <body style="margin:0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;color:#334155">
       <p>Gerando PDF do protocolo...</p>
     </body></html>`,
  );
  previewWindow.document.close();
  return previewWindow;
}

/**
 * Entrega o PDF em nova aba (ou na aba já aberta no clique).
 * Nunca navega a aba do ERP — se o popup for bloqueado, avisa o usuário.
 */
export function openPdfPreviewInNewTab(blob: Blob, previewWindow?: Window | null) {
  const pdfBlob =
    blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
  const url = URL.createObjectURL(pdfBlob);

  const target =
    previewWindow && !previewWindow.closed
      ? previewWindow
      : window.open(url, '_blank');

  if (target) {
    try {
      target.opener = null;
    } catch {
      /* ignore */
    }
    if (previewWindow && !previewWindow.closed) {
      target.location.href = url;
    }
    target.focus();
  } else {
    alert(
      'Não foi possível abrir a visualização do PDF em outra aba. Permita pop-ups para este site e tente novamente.',
    );
  }

  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

export function useImportProtocolosSpreadsheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: ProtocoloImportParams) => apiService.importProtocolosSpreadsheet(params),
    onSuccess: (result) => {
      if (result.success && !result.dryRun && result.created > 0) {
        queryClient.invalidateQueries({ queryKey: PROTOCOLOS_ENVIO_KEY });
      }
    },
  });
}

export function useExportarModeloProtocolos() {
  return useMutation({
    // Gera localmente (exceljs) — evita falha do proxy/API só para baixar o modelo estático.
    mutationFn: async () => {
      const { buildProtocoloImportTemplateBlob } = await import('../utils/protocoloImportTemplate');
      return buildProtocoloImportTemplateBlob();
    },
  });
}

export function getFaturamentoErrorMessage(error: unknown): string {
  if (error instanceof Error && !('response' in error) && error.message) {
    return error.message;
  }
  const err = error as {
    response?: {
      data?: { detail?: string; error?: string; notaFiscal?: string[]; non_field_errors?: string[] } | Blob;
    };
    message?: string;
  };
  const data = err.response?.data;
  if (!data) {
    return err.message || 'Não foi possível concluir a operação.';
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return err.message || 'Não foi possível gerar o PDF do protocolo.';
  }
  if (typeof data === 'object' && data !== null) {
    const payload = data as {
      detail?: string;
      error?: string;
      notaFiscal?: string[];
      non_field_errors?: string[];
    };
    if (typeof payload.detail === 'string') return payload.detail;
    if (typeof payload.error === 'string') return payload.error;
    if (Array.isArray(payload.notaFiscal) && payload.notaFiscal[0]) return payload.notaFiscal[0];
    if (Array.isArray(payload.non_field_errors) && payload.non_field_errors[0]) {
      return payload.non_field_errors[0];
    }
  }
  return 'Não foi possível concluir a operação.';
}

/** Lê body blob de erros axios (responseType: 'blob') para exibir o detail real. */
export async function resolveFaturamentoErrorMessage(error: unknown): Promise<string> {
  const err = error as {
    response?: { data?: unknown };
    message?: string;
  };
  const data = err.response?.data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const text = await data.text();
      try {
        const json = JSON.parse(text) as { detail?: string; error?: string };
        if (typeof json.detail === 'string' && json.detail) return json.detail;
        if (typeof json.error === 'string' && json.error) return json.error;
      } catch {
        if (text.trim()) return text.slice(0, 240);
      }
    } catch {
      /* ignore */
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return getFaturamentoErrorMessage(error);
}
