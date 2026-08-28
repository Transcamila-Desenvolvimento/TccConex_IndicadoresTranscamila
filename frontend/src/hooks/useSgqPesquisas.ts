import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiService } from '../services/apiService';
import { INDICADORES_SGQ_SATISFACAO_KEY } from './useIndicadores';
import type {
  SgqFormDraft,
  SgqLoteDraftRow,
  SgqPesquisaBulkErrors,
  SgqPesquisaPayload,
  SgqPesquisaQueryParams,
  SendSgqResumoEmailParams,
} from '../types/domain';
import { catalogFromSgqEscopos, SGQ_ESCOPO_ANALISE_CATALOG } from '../types/domain';

// A filial da sessão entra na queryKey (não é enviada como filtro à API — o
// escopo real é aplicado no backend via header X-Prothon-Filial). Sem isso, o
// cache do TanStack Query é compartilhado entre filiais: ao trocar de filial
// sem reload de página, a tela mostrava as pesquisas da filial anterior até o
// staleTime expirar, já que a queryKey continuava idêntica.
export const SGQ_KEYS = {
  pesquisas: (filial: string | null, params: SgqPesquisaQueryParams) =>
    ['sgq', 'pesquisas', filial, params] as const,
  stats: (filial: string | null, params: SgqPesquisaQueryParams) =>
    ['sgq', 'pesquisas-stats', filial, params] as const,
  motoristas: ['sgq', 'motoristas'] as const,
  lancadores: (filial: string | null) => ['sgq', 'lancadores', filial] as const,
  clientes: (incluirHistorico: boolean) => ['sgq', 'clientes', incluirHistorico] as const,
  loteDraft: (filial: string | null) => ['sgq', 'lote-draft', filial] as const,
  formDraft: (filial: string | null) => ['sgq', 'form-draft', filial] as const,
  escoposAnalise: (incluirInativos = false) => ['sgq', 'escopos-analise', incluirInativos] as const,
  userDirectory: ['sgq', 'user-directory'] as const,
  all: ['sgq'] as const,
};

function invalidateSgqAndIndicador(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: SGQ_KEYS.all });
  // Atualiza o indicador de Satisfação na mesma sessão (polling cobre outros usuários).
  queryClient.invalidateQueries({ queryKey: INDICADORES_SGQ_SATISFACAO_KEY });
}

export function useSgqPesquisas(filial: string | null, params: SgqPesquisaQueryParams) {
  return useQuery({
    queryKey: SGQ_KEYS.pesquisas(filial, params),
    queryFn: () => apiService.getSgqPesquisas(params),
  });
}

export function useSgqPesquisaStats(filial: string | null, params: SgqPesquisaQueryParams) {
  return useQuery({
    queryKey: SGQ_KEYS.stats(filial, params),
    queryFn: () => apiService.getSgqPesquisaStats(params),
  });
}

/** Sugestões de nomes de motoristas já usados em qualquer filial, para o
 * autocomplete do formulário (ver `motoristas` em `apps/sgq/views.py`). */
export function useSgqMotoristas(filial: string | null) {
  return useQuery({
    queryKey: SGQ_KEYS.motoristas,
    queryFn: () => apiService.getSgqMotoristas(),
    enabled: Boolean(filial),
    staleTime: 60_000,
  });
}

/** Usuários que já lançaram pesquisa na filial — filtro "Lançado por". */
export function useSgqLancadores(filial: string | null) {
  return useQuery({
    queryKey: SGQ_KEYS.lancadores(filial),
    queryFn: () => apiService.getSgqLancadores(),
    staleTime: 60_000,
  });
}

export function useSgqClientes(incluirHistorico = false) {
  return useQuery({
    queryKey: SGQ_KEYS.clientes(incluirHistorico),
    queryFn: () => apiService.getSgqClientes({ incluirHistorico }),
    staleTime: 5 * 60_000,
  });
}

export function useCreateSgqPesquisa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SgqPesquisaPayload) => apiService.createSgqPesquisa(payload),
    onSuccess: () => invalidateSgqAndIndicador(queryClient),
  });
}

export function useBulkCreateSgqPesquisas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payloads: SgqPesquisaPayload[]) => apiService.bulkCreateSgqPesquisas(payloads),
    onSuccess: () => invalidateSgqAndIndicador(queryClient),
  });
}

/** Rascunho server-side da inclusão em tabela — isolado por usuário + filial. */
export function useSgqLoteDraft(filial: string | null) {
  return useQuery({
    queryKey: SGQ_KEYS.loteDraft(filial),
    queryFn: () => apiService.getSgqLoteDraft(),
    enabled: Boolean(filial),
    staleTime: 15_000,
  });
}

export function useSaveSgqLoteDraft(filial: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rows: SgqLoteDraftRow[]) => apiService.saveSgqLoteDraft(rows),
    onSuccess: (data) => {
      queryClient.setQueryData(SGQ_KEYS.loteDraft(filial), data);
    },
  });
}

export function useDeleteSgqLoteDraft(filial: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiService.deleteSgqLoteDraft(),
    onSuccess: () => {
      queryClient.setQueryData(SGQ_KEYS.loteDraft(filial), {
        version: 1,
        updatedAt: null,
        filial: filial ?? '',
        hasDraft: false,
        rows: [],
      });
      queryClient.invalidateQueries({ queryKey: SGQ_KEYS.loteDraft(filial) });
    },
  });
}

const EMPTY_FORM_DRAFT: SgqLoteDraftRow = {
  dataEntrega: '',
  cliente: '',
  motorista: '',
  cte: '',
  notaFiscal: '',
  clienteRecusouAssinar: false,
  prazoEntrega: '',
  condicoesMercadoria: '',
  condicoesVeiculo: '',
  apresentacaoMotorista: '',
  atendimentoDispensado: '',
  analise: '',
  escopoAnalise: {},
};

/** Rascunho server-side do formulário de lançamento — isolado por usuário + filial. */
export function useSgqFormDraft(filial: string | null) {
  return useQuery({
    queryKey: SGQ_KEYS.formDraft(filial),
    queryFn: () => apiService.getSgqFormDraft(),
    enabled: Boolean(filial),
    staleTime: 15_000,
  });
}

export function useSaveSgqFormDraft(filial: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: SgqLoteDraftRow) => apiService.saveSgqFormDraft(form),
    onSuccess: (data: SgqFormDraft) => {
      queryClient.setQueryData(SGQ_KEYS.formDraft(filial), data);
    },
  });
}

export function useDeleteSgqFormDraft(filial: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiService.deleteSgqFormDraft(),
    onSuccess: () => {
      queryClient.setQueryData(SGQ_KEYS.formDraft(filial), {
        version: 1,
        updatedAt: null,
        filial: filial ?? '',
        hasDraft: false,
        form: { ...EMPTY_FORM_DRAFT },
      } satisfies SgqFormDraft);
      queryClient.invalidateQueries({ queryKey: SGQ_KEYS.formDraft(filial) });
    },
  });
}

export function useUpdateSgqPesquisa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SgqPesquisaPayload> }) =>
      apiService.updateSgqPesquisa(id, payload),
    onSuccess: () => invalidateSgqAndIndicador(queryClient),
  });
}

export function useDeleteSgqPesquisa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteSgqPesquisa(id),
    onSuccess: () => invalidateSgqAndIndicador(queryClient),
  });
}

export function useExportSgqPesquisaImportTemplate() {
  return useMutation({
    mutationFn: () => apiService.exportSgqPesquisaImportTemplate(),
  });
}

export function usePreviewSgqPesquisasSpreadsheet() {
  return useMutation({
    mutationFn: (file: File) => apiService.previewSgqPesquisasSpreadsheet(file),
  });
}

export function useSgqUserDirectory(enabled = true) {
  return useQuery({
    queryKey: SGQ_KEYS.userDirectory,
    queryFn: () => apiService.getUserDirectory('SGQ'),
    enabled,
    staleTime: 60_000,
  });
}

export function useImportSgqPesquisasSpreadsheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, criadoPorUserId }: { file: File; criadoPorUserId?: string }) =>
      apiService.importSgqPesquisasSpreadsheet(file, criadoPorUserId),
    onSuccess: (result) => {
      if (result.success) {
        invalidateSgqAndIndicador(queryClient);
      }
    },
  });
}

export function useEnviarResumoSgqPesquisas() {
  return useMutation({
    mutationFn: (payload: SendSgqResumoEmailParams) => apiService.enviarResumoSgqPesquisas(payload),
  });
}

export function useSgqEscoposAnaliseCatalog(enabled = true) {
  return useQuery({
    queryKey: SGQ_KEYS.escoposAnalise(false),
    queryFn: () => apiService.getSgqEscoposAnalise(),
    enabled,
    staleTime: 30_000,
    select: (items) => {
      const catalog = catalogFromSgqEscopos(items);
      return catalog.length > 0 ? catalog : SGQ_ESCOPO_ANALISE_CATALOG;
    },
  });
}

export function useSgqEscoposAnaliseCadastro(enabled = true) {
  return useQuery({
    queryKey: SGQ_KEYS.escoposAnalise(true),
    queryFn: () => apiService.getSgqEscoposAnalise({ incluirInativos: true }),
    enabled,
  });
}

function invalidateEscoposAnalise(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['sgq', 'escopos-analise'] });
}

export function useCreateSgqEscopoAnalise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { label: string }) => apiService.createSgqEscopoAnalise(payload),
    onSuccess: () => invalidateEscoposAnalise(queryClient),
  });
}

export function useUpdateSgqEscopoAnalise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { label?: string; ordem?: number; ativo?: boolean };
    }) => apiService.updateSgqEscopoAnalise(id, payload),
    onSuccess: () => invalidateEscoposAnalise(queryClient),
  });
}

export function useDeleteSgqEscopoAnalise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteSgqEscopoAnalise(id),
    onSuccess: () => invalidateEscoposAnalise(queryClient),
  });
}

export function useCreateSgqEscopoAnaliseOpcao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { escopoId: string; label: string }) => apiService.createSgqEscopoAnaliseOpcao(payload),
    onSuccess: () => invalidateEscoposAnalise(queryClient),
  });
}

export function useUpdateSgqEscopoAnaliseOpcao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { label?: string; ordem?: number; ativo?: boolean };
    }) => apiService.updateSgqEscopoAnaliseOpcao(id, payload),
    onSuccess: () => invalidateEscoposAnalise(queryClient),
  });
}

export function useDeleteSgqEscopoAnaliseOpcao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteSgqEscopoAnaliseOpcao(id),
    onSuccess: () => invalidateEscoposAnalise(queryClient),
  });
}

/** Extrai os erros por linha/campo de uma falha do bulk_create (400 com { errors: {...} }). */
export function getSgqBulkErrors(error: unknown): SgqPesquisaBulkErrors | null {
  if (axios.isAxiosError(error) && error.response?.status === 400) {
    const errors = error.response.data?.errors;
    if (errors && typeof errors === 'object') return errors as SgqPesquisaBulkErrors;
  }
  return null;
}
