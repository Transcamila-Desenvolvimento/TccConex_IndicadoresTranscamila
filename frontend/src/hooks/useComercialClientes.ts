import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import type {
  ClienteComercialPayload,
  ClienteComercialQueryParams,
  PropostaComercialFormDraft,
  PropostaComercialPayload,
  PropostaComercialQueryParams,
  PropostaComercialTipo,
  PropostaCondicaoComercial,
  TipoGeneralidadeComercial,
  TabelaFreteConfig,
  TabelaFreteLinhaPayload,
  TabelaFretePayload,
  TabelaFreteQueryParams,
  IcmsUfAliquotas,
  ParametrosComercialPayload,
  ProdutoComercialPayload,
  ProdutoComercialLotePayload,
  ProdutoComercialQueryParams,
  RotaDistanciaPayload,
} from '../types/domain';
import { tiposGeneralidadeDaProposta } from '../types/domain';

export const COMERCIAL_ENDERECOS_KEY = ['comercial', 'enderecos'] as const;

export const COMERCIAL_CLIENTES_KEY = ['comercial', 'clientes'] as const;
export const COMERCIAL_PROPOSTAS_KEY = ['comercial', 'propostas'] as const;
export const COMERCIAL_PROPOSTA_DRAFT_KEY = ['comercial', 'propostas', 'draft'] as const;
const COMERCIAL_PROPOSTA_DRAFT_GEN_KEY = ['comercial', 'propostas', 'draft', 'gen'] as const;

function propostaDraftGen(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.getQueryData<number>(COMERCIAL_PROPOSTA_DRAFT_GEN_KEY) ?? 0;
}

export function bumpPropostaDraftGen(queryClient: ReturnType<typeof useQueryClient>) {
  const next = propostaDraftGen(queryClient) + 1;
  queryClient.setQueryData(COMERCIAL_PROPOSTA_DRAFT_GEN_KEY, next);
  return next;
}

export const COMERCIAL_TABELA_FRETE_KEY = ['comercial', 'tabela-frete'] as const;
export const COMERCIAL_GENERALIDADES_KEY = ['comercial', 'generalidades'] as const;
export const COMERCIAL_ICMS_UFS_KEY = ['comercial', 'icms-ufs'] as const;
export const COMERCIAL_PARAMETROS_KEY = ['comercial', 'parametros'] as const;
export const COMERCIAL_PRODUTOS_KEY = ['comercial', 'produtos'] as const;

export function useClienteComercial(id: string | null) {
  return useQuery({
    queryKey: [...COMERCIAL_CLIENTES_KEY, 'detail', id],
    queryFn: () => apiService.getClienteComercial(id as string),
    enabled: Boolean(id),
  });
}

export function useClientesComercial(params: ClienteComercialQueryParams) {
  return useQuery({
    queryKey: [...COMERCIAL_CLIENTES_KEY, params],
    queryFn: () => apiService.getClientesComercial(params),
    placeholderData: (prev) => prev,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

export function useValidacaoResumoComercial(search?: string) {
  return useQuery({
    queryKey: [...COMERCIAL_CLIENTES_KEY, 'validacao-resumo', search || ''],
    queryFn: () => apiService.getValidacaoResumoComercial(search),
    placeholderData: (prev) => prev,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

export function useConsultarCnpjComercial() {
  return useMutation({
    mutationFn: (cnpj: string) => apiService.consultarCnpjComercial(cnpj),
  });
}

export function useClienteProdutosSugestoesComercial(enabled = true) {
  return useQuery({
    queryKey: [...COMERCIAL_CLIENTES_KEY, 'produtos-sugestoes'],
    queryFn: () => apiService.getClienteProdutosSugestoesComercial(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateClienteComercial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ClienteComercialPayload) => apiService.createClienteComercial(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_CLIENTES_KEY }),
  });
}

export function useUpdateClienteComercial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ClienteComercialPayload> }) =>
      apiService.updateClienteComercial(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_CLIENTES_KEY }),
  });
}

export function useDeleteClienteComercial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteClienteComercial(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_CLIENTES_KEY }),
  });
}

export function useClienteComercialHistorico(clienteId: string | null) {
  return useQuery({
    queryKey: [...COMERCIAL_CLIENTES_KEY, 'historico', clienteId],
    queryFn: () => apiService.getHistoricoClienteComercial(clienteId!),
    enabled: Boolean(clienteId),
  });
}

export function usePropostasComerciais(params: PropostaComercialQueryParams) {
  return useQuery({
    queryKey: [...COMERCIAL_PROPOSTAS_KEY, params],
    queryFn: () => apiService.getPropostasComerciais(params),
    placeholderData: (prev) => prev,
  });
}

export function usePropostasComerciaisDashboard(clienteId?: string | null, enabled = true) {
  return useQuery({
    queryKey: [...COMERCIAL_PROPOSTAS_KEY, 'dashboard', clienteId || 'todos'],
    queryFn: () => apiService.getPropostasComerciaisDashboard(clienteId),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function usePropostaComercialDraft(enabled = true) {
  return useQuery({
    queryKey: COMERCIAL_PROPOSTA_DRAFT_KEY,
    queryFn: () => apiService.getPropostaComercialDraft(),
    enabled,
    staleTime: 15_000,
    retry: 0,
  });
}

export function useSavePropostaComercialDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Pick<PropostaComercialFormDraft, 'abaOperacao' | 'form'>) =>
      apiService.savePropostaComercialDraft(payload),
    onMutate: () => ({ gen: propostaDraftGen(queryClient) }),
    onSuccess: (data, _vars, ctx) => {
      if (ctx && propostaDraftGen(queryClient) !== ctx.gen) return;
      queryClient.setQueryData(COMERCIAL_PROPOSTA_DRAFT_KEY, data);
    },
  });
}

export function useDeletePropostaComercialDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiService.deletePropostaComercialDraft(),
    onMutate: () => {
      bumpPropostaDraftGen(queryClient);
    },
    onSuccess: () => {
      queryClient.setQueryData(COMERCIAL_PROPOSTA_DRAFT_KEY, {
        version: 1,
        updatedAt: null,
        hasDraft: false,
        abaOperacao: 'transferencia',
        form: {
          tipo: 'transporte_rodoviario',
          status: 'rascunho',
          clienteId: '',
          clienteNome: '',
          titulo: '',
          subtitulo: '',
          revisao: '',
          dataProposta: '',
          propostaReferente: '',
          responsavel: '',
          reajuste: '',
          att: '',
          validade: '',
          vigencia: '',
          faturamento: '',
          localEmissao: '',
          valorEstimado: '',
          observacoes: '',
          incluiTransferencia: false,
          incluiDistribuicao: false,
          incluiArmazenagem: false,
          condicoes: [],
          condicoesTransferencia: [],
          condicoesDistribuicao: [],
          tabelaArmazenagem: { codigo: 'AG', local: 'RONDONÓPOLIS-MT', periodoInicio: '', periodoFim: '', unidade: 'MT', itens: [], horaExtraTitulo: '', horaExtra: [], expediente: '' },
          linhas: [],
        },
      } satisfies PropostaComercialFormDraft);
    },
  });
}

export function useCreatePropostaComercial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PropostaComercialPayload) => apiService.createPropostaComercial(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMERCIAL_PROPOSTAS_KEY });
      queryClient.invalidateQueries({ queryKey: COMERCIAL_CLIENTES_KEY });
      queryClient.invalidateQueries({ queryKey: COMERCIAL_GENERALIDADES_KEY });
    },
  });
}

export function useUpdatePropostaComercial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<PropostaComercialPayload> }) =>
      apiService.updatePropostaComercial(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMERCIAL_PROPOSTAS_KEY });
      queryClient.invalidateQueries({ queryKey: COMERCIAL_CLIENTES_KEY });
      queryClient.invalidateQueries({ queryKey: COMERCIAL_GENERALIDADES_KEY });
    },
  });
}

export function useNovaRevisaoPropostaComercial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.novaRevisaoPropostaComercial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMERCIAL_PROPOSTAS_KEY });
    },
  });
}

export function useCalcularTrechoProposta() {
  return useMutation({
    mutationFn: (payload: {
      clienteId?: string | null;
      origem: string;
      destino: string;
      veiculoKey: string;
      km: string | number;
      margensVeiculo?: Array<{ bandaKey: string; margem: string }>;
    }) => apiService.calcularTrechoProposta(payload),
  });
}

export function usePreviewDistribuicaoProposta() {
  return useMutation({
    mutationFn: (payload: {
      clienteId?: string | null;
      margensVeiculo?: Array<{ bandaKey: string; margem: string }>;
    }) => apiService.previewDistribuicaoProposta(payload),
  });
}

export function useDeletePropostaComercial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deletePropostaComercial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMERCIAL_PROPOSTAS_KEY });
      queryClient.invalidateQueries({ queryKey: COMERCIAL_CLIENTES_KEY });
    },
  });
}

export function useEnviarEmailPropostaComercial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, to, cc, pdfs }: { ids: string[]; to?: string[]; cc?: string[]; pdfs: Blob[] }) =>
      apiService.enviarEmailPropostasComerciais(ids, { to, cc, pdfs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMERCIAL_PROPOSTAS_KEY });
      queryClient.invalidateQueries({ queryKey: COMERCIAL_CLIENTES_KEY });
    },
  });
}

export function useTabelasFrete(params: TabelaFreteQueryParams) {
  return useQuery({
    queryKey: [...COMERCIAL_TABELA_FRETE_KEY, 'list', params],
    queryFn: () => apiService.getTabelasFrete(params),
    placeholderData: (prev) => prev,
  });
}

export function useTabelaFreteDetalhe(id: string | null) {
  return useQuery({
    queryKey: [...COMERCIAL_TABELA_FRETE_KEY, 'detalhe', id],
    queryFn: () => apiService.getTabelaFrete(id!),
    enabled: Boolean(id),
  });
}

export function useTabelaFreteHistoricoRevisoes(tabelaId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...COMERCIAL_TABELA_FRETE_KEY, 'historico-revisoes', tabelaId],
    queryFn: () => apiService.getTabelaFreteHistoricoRevisoes(tabelaId!),
    enabled: Boolean(tabelaId) && enabled,
  });
}

export function useTabelaFreteDistribuicaoCliente(clienteId: string | null, enabled = true) {
  const listQuery = useQuery({
    queryKey: [...COMERCIAL_TABELA_FRETE_KEY, 'distribuicao-cliente', clienteId],
    queryFn: () => apiService.getTabelasFrete({
      page: 1,
      pageSize: 1,
      tipo: 'distribuicao',
      cliente: clienteId!,
      vigente: true,
    }),
    enabled: Boolean(clienteId) && enabled,
  });
  const tabelaId = listQuery.data?.results[0]?.id ?? null;
  const detalheQuery = useTabelaFreteDetalhe(enabled ? tabelaId : null);
  return { listQuery, detalheQuery, tabela: detalheQuery.data ?? null };
}

export function useCreateTabelaFrete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TabelaFretePayload) => apiService.createTabelaFrete(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_TABELA_FRETE_KEY }),
  });
}

export function useUpdateTabelaFrete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<TabelaFretePayload> }) =>
      apiService.updateTabelaFrete(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_TABELA_FRETE_KEY }),
  });
}

export function useDeleteTabelaFrete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteTabelaFrete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_TABELA_FRETE_KEY }),
  });
}

export function usePreviewTabelaFrete() {
  return useMutation({
    mutationFn: (config: Partial<TabelaFreteConfig>) => apiService.previewTabelaFreteDistribuicao(config),
  });
}

export function usePublicarTabelaFrete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.publicarTabelaFrete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_TABELA_FRETE_KEY }),
  });
}

export function useArquivarTabelaFrete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.arquivarTabelaFrete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_TABELA_FRETE_KEY }),
  });
}

export function useReativarTabelaFrete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.reativarTabelaFrete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_TABELA_FRETE_KEY }),
  });
}

export function useNovaRevisaoTabelaFrete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.novaRevisaoTabelaFrete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_TABELA_FRETE_KEY }),
  });
}

export function useDescartarRevisaoTabelaFrete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.descartarRevisaoTabelaFrete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_TABELA_FRETE_KEY }),
  });
}

export function useExportarTabelaFrete() {
  return useMutation({
    mutationFn: (id: string) => apiService.exportarTabelaFrete(id),
  });
}

export function useSimularTabelaFrete() {
  return useMutation({
    mutationFn: ({ id, payload }: {
      id: string;
      payload: {
        km: number;
        pesoKg: number;
        modalidade?: string;
        valorNf?: string | null;
        ufOrigem?: string;
        ufDestino?: string;
      };
    }) => apiService.simularTabelaFrete(id, payload),
  });
}

export function useCalcularRotaDistancia() {
  return useMutation({
    mutationFn: (payload: RotaDistanciaPayload) => apiService.calcularRotaDistanciaComercial(payload),
  });
}

export function useBuscarEnderecosComercial(q: string, enabled = true, tipo: 'endereco' | 'cidade' = 'endereco') {
  const termo = q.trim();
  return useQuery({
    queryKey: [...COMERCIAL_ENDERECOS_KEY, tipo, termo],
    queryFn: () => apiService.buscarEnderecosComercial(termo, tipo),
    enabled: enabled && termo.length >= 3,
        staleTime: 5 * 60_000,
  });
}

export function useReversoEnderecoComercial() {
  return useMutation({
    mutationFn: ({ lat, lon }: { lat: number; lon: number }) => apiService.reversoEnderecoComercial(lat, lon),
  });
}

export function useGoogleMapsConfigComercial(enabled = false) {
  return useQuery({
    queryKey: [...COMERCIAL_ENDERECOS_KEY, 'maps-config'],
    queryFn: () => apiService.getGoogleMapsConfigComercial(),
    enabled,
    staleTime: Infinity,
  });
}

export function useCreateTabelaFreteLinha() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TabelaFreteLinhaPayload) => apiService.createTabelaFreteLinha(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_TABELA_FRETE_KEY }),
  });
}

export function useUpdateTabelaFreteLinha() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<TabelaFreteLinhaPayload> }) =>
      apiService.updateTabelaFreteLinha(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_TABELA_FRETE_KEY }),
  });
}

export function useDeleteTabelaFreteLinha() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteTabelaFreteLinha(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_TABELA_FRETE_KEY }),
  });
}

export function useComercialGeneralidades(
  clienteId: string | null,
  tipo: TipoGeneralidadeComercial | null,
  options?: { enabled?: boolean; permitirPadrao?: boolean },
) {
  const permitirPadrao = options?.permitirPadrao ?? false;
  return useQuery({
    queryKey: [...COMERCIAL_GENERALIDADES_KEY, clienteId ?? 'padrao', tipo],
    queryFn: () => apiService.getGeneralidadesComercial(clienteId, tipo!),
    enabled: Boolean(tipo) && (options?.enabled ?? true) && (Boolean(clienteId) || permitirPadrao),
  });
}

export function useComercialGeneralidadesProposta(
  clienteId: string | null,
  tipoProposta: PropostaComercialTipo,
  incluiTransferencia: boolean,
  incluiDistribuicao: boolean,
  incluiArmazenagem = false,
  incluiOpPortuaria = false,
) {
  const tipos = tiposGeneralidadeDaProposta(
    tipoProposta,
    incluiTransferencia,
    incluiDistribuicao,
    incluiArmazenagem,
    incluiOpPortuaria,
  );
  const primeiro = useComercialGeneralidades(clienteId, tipos[0] ?? null);
  const segundo = useComercialGeneralidades(clienteId, tipos[1] ?? null);
  const items = mergeGeneralidades(primeiro.data?.items, segundo.data?.items, tipos.length);
  const isFetching = primeiro.isFetching || (tipos.length > 1 && segundo.isFetching);
  const isPending = tipos.length === 0
    ? false
    : tipos.length > 1
      ? primeiro.isPending || segundo.isPending
      : primeiro.isPending;
  return {
    tipos,
    items,
    isPending,
    isFetching,
    isSuccess: tipos.length === 0 ? false : tipos.length > 1 ? Boolean(primeiro.isSuccess && segundo.isSuccess) : primeiro.isSuccess,
  };
}

function mergeGeneralidades(
  primeiro?: PropostaCondicaoComercial[],
  segundo?: PropostaCondicaoComercial[],
  quantidadeTipos = 1,
) {
  const lists = quantidadeTipos > 1 ? [primeiro ?? [], segundo ?? []] : [primeiro ?? []];
  const merged: PropostaCondicaoComercial[] = [];
  const seen = new Set<string>();
  lists.forEach((list) => {
    list.forEach((item) => {
      const key = `${item.rotulo}\0${item.valor}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push({ ...item });
    });
  });
  return merged;
}

export function useSaveComercialGeneralidades() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      clienteId,
      tipo,
      items,
      aplicar,
    }: {
      clienteId: string | null;
      tipo: TipoGeneralidadeComercial;
      items: PropostaCondicaoComercial[];
      aplicar?: 'todos' | 'novos';
    }) => apiService.saveGeneralidadesComercial(clienteId, tipo, items, aplicar),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_GENERALIDADES_KEY }),
  });
}

export function useDeleteComercialGeneralidades() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clienteId, tipo }: { clienteId: string; tipo: TipoGeneralidadeComercial }) =>
      apiService.deleteGeneralidadesComercial(clienteId, tipo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_GENERALIDADES_KEY }),
  });
}

export function useComercialIcmsUfs() {
  return useQuery({
    queryKey: COMERCIAL_ICMS_UFS_KEY,
    queryFn: () => apiService.getIcmsUfsComercial(),
  });
}

export function useSaveComercialIcmsUfs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (aliquotas: IcmsUfAliquotas) => apiService.saveIcmsUfsComercial(aliquotas),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_ICMS_UFS_KEY }),
  });
}

export function useRestaurarComercialIcmsUfs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiService.restaurarIcmsUfsComercial(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMERCIAL_ICMS_UFS_KEY }),
  });
}

export function useComercialParametros() {
  return useQuery({
    queryKey: COMERCIAL_PARAMETROS_KEY,
    queryFn: () => apiService.getParametrosComercial(),
  });
}

export function useSaveComercialParametros() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ParametrosComercialPayload) => apiService.saveParametrosComercial(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(COMERCIAL_PARAMETROS_KEY, data);
      queryClient.invalidateQueries({ queryKey: COMERCIAL_PARAMETROS_KEY });
    },
  });
}

export function useRestaurarComercialParametros() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiService.restaurarParametrosComercial(),
    onSuccess: (data) => {
      queryClient.setQueryData(COMERCIAL_PARAMETROS_KEY, data);
      queryClient.invalidateQueries({ queryKey: COMERCIAL_PARAMETROS_KEY });
    },
  });
}

export function useProdutosComercial(params: ProdutoComercialQueryParams) {
  return useQuery({
    queryKey: [...COMERCIAL_PRODUTOS_KEY, params],
    queryFn: () => apiService.getProdutosComercial(params),
    placeholderData: (prev) => prev,
  });
}

export function useCreateProdutoComercial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProdutoComercialPayload) => apiService.createProdutoComercial(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMERCIAL_PRODUTOS_KEY });
      queryClient.invalidateQueries({ queryKey: COMERCIAL_CLIENTES_KEY });
    },
  });
}

export function useCreateProdutosComercialLote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProdutoComercialLotePayload) => apiService.createProdutosComercialLote(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMERCIAL_PRODUTOS_KEY });
      queryClient.invalidateQueries({ queryKey: COMERCIAL_CLIENTES_KEY });
    },
  });
}

export function useUpdateProdutoComercial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ProdutoComercialPayload> }) =>
      apiService.updateProdutoComercial(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMERCIAL_PRODUTOS_KEY });
      queryClient.invalidateQueries({ queryKey: COMERCIAL_CLIENTES_KEY });
    },
  });
}

export function useDeleteProdutoComercial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiService.deleteProdutoComercial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMERCIAL_PRODUTOS_KEY });
      queryClient.invalidateQueries({ queryKey: COMERCIAL_CLIENTES_KEY });
    },
  });
}

export function useHomologarClienteComercial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decisao, justificativa }: { id: string; decisao: 'homologado' | 'reprovado'; justificativa?: string }) =>
      apiService.homologarClienteComercial(id, { decisao, justificativa }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMERCIAL_CLIENTES_KEY });
      queryClient.invalidateQueries({ queryKey: COMERCIAL_PRODUTOS_KEY });
    },
  });
}

export function useHomologacaoHistoricoCliente(clienteId: string | null) {
  return useQuery({
    queryKey: [...COMERCIAL_CLIENTES_KEY, 'homologacao-historico', clienteId],
    queryFn: () => apiService.getHomologacaoHistoricoClienteComercial(clienteId!),
    enabled: Boolean(clienteId),
  });
}

export function getComercialErrorMessage(error: unknown): string {
  if (error instanceof Error && !('response' in error) && error.message) {
    return error.message;
  }
  const err = error as {
    response?: { data?: Record<string, unknown> | string };
    message?: string;
  };
  const data = err.response?.data;
  if (!data) return err.message || 'Não foi possível concluir a operação.';
  if (typeof data === 'string') return data;
  if (typeof data.detail === 'string') return data.detail;
  for (const value of Object.values(data)) {
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
    if (typeof value === 'string') return value;
  }
  return 'Não foi possível concluir a operação.';
}
