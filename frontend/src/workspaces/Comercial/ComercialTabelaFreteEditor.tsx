import React, { useEffect, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  getComercialErrorMessage,
  useArquivarTabelaFrete,
  useDeleteTabelaFrete,
  useClientesComercial,
  useCreateTabelaFreteLinha,
  useDeleteTabelaFreteLinha,
  useExportarTabelaFrete,
  useNovaRevisaoTabelaFrete,
  usePreviewTabelaFrete,
  usePublicarTabelaFrete,
  useTabelaFreteDetalhe,
  useUpdateTabelaFrete,
  useUpdateTabelaFreteLinha,
} from '../../hooks/useComercialClientes';
import type {
  TabelaFreteBanda,
  TabelaFreteBandaCalculo,
  TabelaFreteColunaCalculo,
  TabelaFreteColunaExtra,
  TabelaFreteConfig,
  TabelaFreteFaixa,
  TabelaFreteLinha,
  TabelaFreteLinhaPayload,
  TabelaFreteModoTarifa,
  TabelaFretePassoKm,
  TabelaFretePrazoRegra,
  TabelaFreteStatus,
} from '../../types/domain';
import ComercialTabelaFreteSimulador from './ComercialTabelaFreteSimulador';
import ComercialTabelaFreteStatusBadge from './ComercialTabelaFreteStatusBadge';
import ComercialTabelaFreteHistoricoRevisoesPanel from './ComercialTabelaFreteHistoricoRevisoesPanel';
import ComercialTabelaFreteClientesPicker from './ComercialTabelaFreteClientesPicker';
import { downloadBlobAsFile } from '../../hooks/useFaturamentoProtocolos';
import {
  formatColunaExtraValor,
  formatTabelaAmount,
  formatTabelaPercentFator,
  fatorToPercentualInput,
  isGrisAdvUnificado,
  isTarifaVeiculo,
  nomeBaseTabelaFrete,
  percentualToFator,
} from './formatTabelaFrete';

const MODO_TARIFA_LABEL: Record<TabelaFreteModoTarifa, string> = {
  incremento_primeira_faixa: 'Base + incremento por km',
  linear_km_ate: 'Tarifa fixa + valor por km',
};

const CALCULO_BANDA_LABEL: Record<TabelaFreteBandaCalculo, string> = {
  multiplicador: 'K × fator',
  divisor: 'K ÷ valor',
  referencia: 'K (referência)',
  mult_anterior: 'Anterior × valor',
  mult_referencia: 'K × valor',
};

const CALCULO_BANDA_OPTIONS: TabelaFreteBandaCalculo[] = [
  'multiplicador',
  'divisor',
  'referencia',
  'mult_anterior',
  'mult_referencia',
];

const CALCULO_COLUNA_LABEL: Record<TabelaFreteColunaCalculo, string> = {
  fixo: 'Valor fixo (R$)',
  percentual_nf: '% sobre NF',
  percentual_frete: '% sobre frete',
  por_tonelada: 'R$ por tonelada',
  por_km: 'R$ por km',
};

const CALCULO_COLUNA_OPTIONS: TabelaFreteColunaCalculo[] = [
  'fixo',
  'percentual_nf',
  'percentual_frete',
  'por_tonelada',
  'por_km',
];

type FreteForm = {
  origem: string;
  entrega: string;
  veiculo: string;
  tarifaFrete: string;
  pedagio: string;
  gris: string;
  adValorem: string;
  icms: string;
  prazoDias: string;
};

const emptyLinha = (): FreteForm => ({
  origem: '',
  entrega: '',
  veiculo: '',
  tarifaFrete: '',
  pedagio: '',
  gris: '',
  adValorem: '',
  icms: 'Não incluso',
  prazoDias: '',
});

const moneyOrNull = (value: string) => {
  const trimmed = value.trim().replace(/\s/g, '').replace(',', '.');
  return trimmed || null;
};

const faixaKey = (faixa: TabelaFreteFaixa) => `${faixa.kmDe}-${faixa.kmAte}`;

const compactBandaNumero = (value?: string | null) => {
  const raw = (value ?? '').trim();
  if (!/^-?\d+[.,]\d{8,}$/.test(raw)) return raw;
  const amount = Number(raw.replace(',', '.'));
  if (!Number.isFinite(amount)) return raw;
  return String(Number(amount.toFixed(4)));
};

const nomeArquivoTabelaFrete = (codigoTabela: string, nomeTabela: string, revisaoAtual: number) => {
  const base = (codigoTabela || nomeBaseTabelaFrete(nomeTabela) || 'tabela-frete')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/^[._]+|[._]+$/g, '') || 'tabela-frete';
  return `${base}_rev${revisaoAtual}.xlsx`;
};

const ParamsField: React.FC<{
  label: string;
  size?: 'clientes' | 'km' | 'modo' | 'valor' | 'num' | 'gris';
  children: React.ReactNode;
}> = ({ label, size = 'num', children }) => (
  <div className={`tabela-frete-params-field tabela-frete-params-field--${size}`}>
    <span>{label}</span>
    {children}
  </div>
);

const PercentFatorInput: React.FC<{
  disabled?: boolean;
  fator?: string | null;
  onFatorChange: (fator: string) => void;
}> = ({ disabled, fator, onFatorChange }) => {
  const [rascunho, setRascunho] = useState<string | null>(null);
  return (
    <input
      disabled={disabled}
      placeholder="0,15"
      value={rascunho ?? fatorToPercentualInput(fator)}
      onChange={(e) => {
        setRascunho(e.target.value);
        onFatorChange(percentualToFator(e.target.value));
      }}
      onBlur={() => setRascunho(null)}
    />
  );
};

type Props = {
  tabelaId: string;
  canManage: boolean;
  onBack: () => void;
  onOpenTabela?: (id: string) => void;
};

export default function ComercialTabelaFreteEditor({ tabelaId, canManage, onBack, onOpenTabela }: Props) {
  const detalheQuery = useTabelaFreteDetalhe(tabelaId);
  const { canShowEmpty } = useAsyncQueryState(detalheQuery);
  const clientesQuery = useClientesComercial({ page: 1, pageSize: 200 });
  const updateTabela = useUpdateTabelaFrete();
  const preview = usePreviewTabelaFrete();
  const publicar = usePublicarTabelaFrete();
  const arquivar = useArquivarTabelaFrete();
  const deleteTabela = useDeleteTabelaFrete();
  const novaRevisao = useNovaRevisaoTabelaFrete();
  const exportarTabela = useExportarTabelaFrete();
  const createLinha = useCreateTabelaFreteLinha();
  const updateLinha = useUpdateTabelaFreteLinha();
  const deleteLinha = useDeleteTabelaFreteLinha();

  const tabela = detalheQuery.data;
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [revisao, setRevisao] = useState(1);
  const [observacoes, setObservacoes] = useState('');
  const [status, setStatus] = useState<TabelaFreteStatus>('rascunho');
  const [clienteIds, setClienteIds] = useState<string[]>([]);
  const [config, setConfig] = useState<TabelaFreteConfig | null>(null);
  const [faixas, setFaixas] = useState<TabelaFreteFaixa[]>([]);
  const [gradeOpen, setGradeOpen] = useState(true);
  const [paramsOpen, setParamsOpen] = useState(true);
  const [simuladorOpen, setSimuladorOpen] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [regrasOpen, setRegrasOpen] = useState(false);
  const [bandasOpen, setBandasOpen] = useState(false);
  const [colunasOpen, setColunasOpen] = useState(false);
  const [linhaModal, setLinhaModal] = useState(false);
  const [editingLinhaId, setEditingLinhaId] = useState<string | null>(null);
  const [linhaForm, setLinhaForm] = useState<FreteForm>(emptyLinha());

  useEffect(() => {
    if (!tabela) return;
    setNome(nomeBaseTabelaFrete(tabela.nome));
    setCodigo(tabela.codigo ?? '');
    setRevisao(tabela.revisao ?? 1);
    setObservacoes(tabela.observacoes ?? '');
    setStatus(tabela.status ?? 'rascunho');
    setClienteIds(tabela.clienteIds ?? []);
    if (tabela.config) setConfig(tabela.config);
    setFaixas(tabela.faixas ?? []);
    setParamsOpen(tabela.status === 'rascunho');
    setGradeOpen(true);
  }, [tabela]);

  const isLocked = status !== 'rascunho';
  const canEditTarifa = canManage && !isLocked;

  const clientes = clientesQuery.data?.results ?? [];
  const linhas = tabela?.linhas ?? [];
  const bandas = (config?.bandas && config.bandas.length > 0)
    ? config.bandas
    : (faixas[0]?.tarifas ?? []);
  const extras = (config?.colunasExtras && config.colunasExtras.length > 0)
    ? config.colunasExtras
    : (faixas[0]?.extras ?? []);

  const modoLinear = config?.modoTarifa === 'linear_km_ate';
  const grisAdvUnificado = isGrisAdvUnificado(config);

  const setModoTarifa = (modo: TabelaFreteModoTarifa) => {
    if (!config) return;
    setConfig({ ...config, modoTarifa: modo });
  };

  const setGrisAdvModo = (unificado: boolean) => {
    if (!config) return;
    if (unificado) {
      const valor = config.grisAdvPercent || config.grisPercent;
      setConfig({
        ...config,
        grisAdvUnificado: true,
        grisAdvPercent: valor,
        grisPercent: valor,
        advPercent: valor,
      });
      return;
    }
    setConfig({
      ...config,
      grisAdvUnificado: false,
      grisAdvPercent: '',
    });
  };

  const setGrisAdvUnificado = (valor: string) => {
    if (!config) return;
    setConfig({
      ...config,
      grisAdvUnificado: true,
      grisAdvPercent: valor,
      grisPercent: valor,
      advPercent: valor,
    });
  };

  const setBanda = (index: number, patch: Partial<TabelaFreteBanda>) => {
    if (!config) return;
    const lista = config.bandas.map((item, i) => (i === index ? { ...item, ...patch } : item));
    setConfig({ ...config, bandas: lista });
  };

  const addBanda = () => {
    if (!config) return;
    const ordem = config.bandas.length + 1;
    setConfig({
      ...config,
      bandas: [
        ...config.bandas,
        {
          key: `banda_${ordem}`,
          rotulo: `Faixa ${ordem}`,
          unidade: 'ton',
          calculo: 'multiplicador',
          fator: '1',
        },
      ],
    });
  };

  const removeBanda = (index: number) => {
    if (!config || config.bandas.length <= 1) return;
    setConfig({ ...config, bandas: config.bandas.filter((_, i) => i !== index) });
  };

  const setColunaExtra = (index: number, patch: Partial<TabelaFreteColunaExtra>) => {
    if (!config) return;
    const lista = (config.colunasExtras ?? []).map((item, i) => (i === index ? { ...item, ...patch } : item));
    setConfig({ ...config, colunasExtras: lista });
  };

  const addColunaExtra = () => {
    if (!config) return;
    const ordem = (config.colunasExtras ?? []).length + 1;
    setConfig({
      ...config,
      colunasExtras: [
        ...(config.colunasExtras ?? []),
        {
          key: `extra_${ordem}`,
          rotulo: ordem === 1 ? 'Tx emissão CTe' : `Coluna ${ordem}`,
          calculo: 'fixo',
          valor: '',
          incluirNoTotal: true,
          formato: 'moeda',
        },
      ],
    });
  };

  const removeColunaExtra = (index: number) => {
    if (!config) return;
    setConfig({ ...config, colunasExtras: (config.colunasExtras ?? []).filter((_, i) => i !== index) });
  };

  const setPasso = (index: number, patch: Partial<TabelaFretePassoKm>) => {
    if (!config) return;
    const passos = config.passos.map((item, i) => (i === index ? { ...item, ...patch } : item));
    setConfig({ ...config, passos });
  };

  const setPrazo = (campo: 'prazosFracionado' | 'prazosFechado', index: number, patch: Partial<TabelaFretePrazoRegra>) => {
    if (!config) return;
    const lista = config[campo].map((item, i) => (i === index ? { ...item, ...patch } : item));
    setConfig({ ...config, [campo]: lista });
  };

  const patchOverride = (faixa: TabelaFreteFaixa, campo: string, valor: string | number) => {
    if (!config) return;
    const key = faixaKey(faixa);
    const overrides = { ...(config.overrides || {}) };
    overrides[key] = { ...(overrides[key] || {}), [campo]: valor };
    setConfig({ ...config, overrides });
    setFaixas((atual) => atual.map((row) => (
      row.kmDe === faixa.kmDe && row.kmAte === faixa.kmAte ? { ...row, [campo]: valor } : row
    )));
  };

  const patchExtra = (faixa: TabelaFreteFaixa, extraKey: string, valor: string) => {
    if (!config) return;
    const key = faixaKey(faixa);
    const overrides = { ...(config.overrides || {}) };
    const atual = { ...(overrides[key] || {}) } as Record<string, unknown>;
    const extrasMap = { ...((atual.extras as Record<string, string> | undefined) || {}) };
    extrasMap[extraKey] = valor;
    atual.extras = extrasMap;
    overrides[key] = atual;
    setConfig({ ...config, overrides });
    setFaixas((rows) => rows.map((row) => {
      if (row.kmDe !== faixa.kmDe || row.kmAte !== faixa.kmAte) return row;
      return {
        ...row,
        extras: (row.extras || []).map((item) => (item.key === extraKey ? { ...item, valor } : item)),
      };
    }));
  };

  const payloadBase = () => ({
    nome: nomeBaseTabelaFrete(nome.trim()) || nome.trim(),
    codigo: codigo.trim(),
    revisao,
    observacoes: observacoes.trim(),
    clienteIds,
  });

  const handleSave = () => {
    if (!nome.trim()) {
      alert('Informe o nome da tabela.');
      return;
    }
    if (isLocked) {
      updateTabela.mutate(
        { id: tabelaId, payload: { observacoes: observacoes.trim() } },
        { onError: (err) => alert(getComercialErrorMessage(err)) },
      );
      return;
    }
    updateTabela.mutate(
      {
        id: tabelaId,
        payload: tabela?.tipo === 'distribuicao'
          ? { ...payloadBase(), tipo: 'distribuicao', config: config || undefined }
          : { ...payloadBase(), tipo: 'transferencia' },
      },
      { onError: (err) => alert(getComercialErrorMessage(err)) },
    );
  };

  const handlePublicar = () => {
    publicar.mutate(tabelaId, {
      onSuccess: (data) => {
        setStatus(data.status);
        detalheQuery.refetch();
      },
      onError: (err) => alert(getComercialErrorMessage(err)),
    });
  };

  const handleArquivar = () => {
    if (!window.confirm('Arquivar esta tabela? Ela deixará de aparecer em novas propostas.')) return;
    arquivar.mutate(tabelaId, {
      onSuccess: (data) => setStatus(data.status),
      onError: (err) => alert(getComercialErrorMessage(err)),
    });
  };

  const handleExcluir = () => {
    const rotulo = nomeBaseTabelaFrete(nome) || nome || 'esta tabela';
    if (!window.confirm(`Excluir definitivamente a tabela "${rotulo}" e todas as revisões? Esta ação não pode ser desfeita.`)) return;
    deleteTabela.mutate(tabelaId, {
      onSuccess: () => onBack(),
      onError: (err) => alert(getComercialErrorMessage(err)),
    });
  };

  const handleNovaRevisao = () => {
    novaRevisao.mutate(tabelaId, {
      onSuccess: (data) => {
        if (onOpenTabela) onOpenTabela(data.id);
      },
      onError: (err) => alert(getComercialErrorMessage(err)),
    });
  };

  const handleExportar = () => {
    exportarTabela.mutate(tabelaId, {
      onSuccess: (blob) => {
        downloadBlobAsFile(blob, nomeArquivoTabelaFrete(codigo, nome, revisao));
      },
      onError: (err) => alert(getComercialErrorMessage(err)),
    });
  };

  const handleRecalcular = () => {
    if (!config) return;
    preview.mutate(config, {
      onSuccess: (data) => {
        setConfig(data.config);
        setFaixas(data.faixas);
      },
      onError: (err) => alert(getComercialErrorMessage(err)),
    });
  };

  const openNewLinha = () => {
    setEditingLinhaId(null);
    setLinhaForm(emptyLinha());
    setLinhaModal(true);
  };

  const startEditLinha = (linha: TabelaFreteLinha) => {
    setEditingLinhaId(linha.id);
    setLinhaForm({
      origem: linha.origem,
      entrega: linha.entrega,
      veiculo: linha.veiculo,
      tarifaFrete: linha.tarifaFrete ?? '',
      pedagio: linha.pedagio ?? '',
      gris: linha.gris,
      adValorem: linha.adValorem,
      icms: linha.icms,
      prazoDias: linha.prazoDias,
    });
    setLinhaModal(true);
  };

  const linhaPayload = (): TabelaFreteLinhaPayload => ({
    tabelaId,
    origem: linhaForm.origem.trim(),
    entrega: linhaForm.entrega.trim(),
    veiculo: linhaForm.veiculo.trim(),
    tarifaFrete: moneyOrNull(linhaForm.tarifaFrete),
    pedagio: moneyOrNull(linhaForm.pedagio),
    gris: linhaForm.gris.trim(),
    adValorem: linhaForm.adValorem.trim(),
    icms: linhaForm.icms.trim(),
    prazoDias: linhaForm.prazoDias.trim(),
  });

  const saveLinha = (event: React.FormEvent) => {
    event.preventDefault();
    const onSuccess = () => setLinhaModal(false);
    const onError = (err: unknown) => alert(getComercialErrorMessage(err));
    if (editingLinhaId) {
      updateLinha.mutate({ id: editingLinhaId, payload: linhaPayload() }, { onSuccess, onError });
      return;
    }
    createLinha.mutate(linhaPayload(), { onSuccess, onError });
  };

  const saving = updateTabela.isPending || preview.isPending || publicar.isPending || arquivar.isPending || novaRevisao.isPending || deleteTabela.isPending;
  const linhaPending = createLinha.isPending || updateLinha.isPending;

  return (
    <div className="fat-list-compact tabela-frete-editor" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 4px 4px' }}>
      <header className="tabela-frete-page-head">
        <div className="tabela-frete-page-head-left">
          <button type="button" className="tabela-frete-back" onClick={onBack} title="Voltar à lista" aria-label="Voltar à lista">
            <i className="bi bi-chevron-left" aria-hidden />
          </button>
          <div className="tabela-frete-page-head-copy">
            <div className="tabela-frete-page-head-title-row">
              <div className="tabela-frete-page-head-accent" aria-hidden />
              {canManage && !isLocked ? (
                <input
                  className="view-page-title tabela-frete-title-input"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  aria-label="Nome da tabela"
                  placeholder="Nome da tabela"
                  style={{ width: `${Math.max(18, (nome || 'Nome da tabela').length + 2)}ch` }}
                />
              ) : (
                <h1 className="view-page-title">{nomeBaseTabelaFrete(nome) || nomeBaseTabelaFrete(tabela?.nome) || 'Tabela frete'}</h1>
              )}
            </div>
            {tabela ? (
              <div className="tabela-frete-page-head-identity">
                {canManage && !isLocked ? (
                  <>
                    <label className="tabela-frete-identity-field">
                      <span>Código</span>
                      <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="—" />
                    </label>
                    <label className="tabela-frete-identity-field tabela-frete-identity-field--short">
                      <span>Rev.</span>
                      <input type="number" min={1} value={revisao} onChange={(e) => setRevisao(Number(e.target.value))} />
                    </label>
                  </>
                ) : (
                  <p className="tabela-frete-identity-text">
                    <span>{codigo || '—'}</span>
                    <span aria-hidden className="tabela-frete-identity-dot">·</span>
                    <span>Rev. {revisao}</span>
                  </p>
                )}
                <button
                  type="button"
                  className={`tabela-frete-identity-historico${historicoOpen ? ' is-active' : ''}`}
                  title="Histórico de revisões"
                  aria-label="Histórico de revisões"
                  aria-pressed={historicoOpen}
                  onClick={() => setHistoricoOpen((open) => !open)}
                >
                  <i className="bi bi-clock-history" aria-hidden />
                  Histórico
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {tabela ? (
          <div className="tabela-frete-page-head-actions">
            <ComercialTabelaFreteStatusBadge status={status} />
            {canManage && isLocked ? (
              <>
                <span className="tabela-frete-meta-readonly">Somente leitura</span>
                {(status === 'publicada' || status === 'expirada') ? (
                  <>
                    <button type="button" className="reports-action-btn secondary tabela-frete-meta-action-btn" disabled={saving} onClick={handleNovaRevisao}>
                      {novaRevisao.isPending ? 'Criando...' : 'Nova revisão'}
                    </button>
                    <button type="button" className="reports-action-btn secondary tabela-frete-meta-action-btn" disabled={saving} onClick={handleArquivar}>
                      Arquivar
                    </button>
                  </>
                ) : null}
                <button type="button" className="reports-action-btn secondary tabela-frete-meta-action-btn" disabled={saving} onClick={handleExcluir}>
                  {deleteTabela.isPending ? 'Excluindo...' : 'Excluir'}
                </button>
              </>
            ) : null}
            {canManage && !isLocked ? (
              <>
                {status === 'rascunho' && (
                  <button type="button" className="reports-action-btn secondary" disabled={saving} onClick={handlePublicar}>
                    {publicar.isPending ? 'Publicando...' : 'Publicar'}
                  </button>
                )}
                <button type="button" className="reports-action-btn primary" style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }} disabled={saving} onClick={handleSave}>
                  {updateTabela.isPending ? 'Salvando...' : 'Salvar'}
                </button>
                <button type="button" className="reports-action-btn secondary tabela-frete-meta-action-btn" disabled={saving} onClick={handleExcluir}>
                  {deleteTabela.isPending ? 'Excluindo...' : 'Excluir'}
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </header>

      <QueryDataPanel
        className="tabela-frete-query"
        query={detalheQuery}
        loadingMessage="Carregando tabela de frete..."
        refreshingMessage="Atualizando tabela de frete..."
        errorMessage="Não foi possível carregar a tabela de frete."
      >
        {!tabela ? (
          canShowEmpty ? <p className="muted">Tabela não encontrada.</p> : null
        ) : (
          <div className="tabela-frete-editor-body">
            <div className={`erp-card tabela-frete-params-card${paramsOpen ? ' is-open' : ''}`}>
              <div className="tabela-frete-fold-bar tabela-frete-params-fold">
                <button type="button" className="tabela-frete-fold-trigger" aria-expanded={paramsOpen} onClick={() => setParamsOpen((open) => !open)}>
                  <i className={`bi ${paramsOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`} aria-hidden />
                  <span className="tabela-frete-fold-title">Parâmetros</span>
                </button>
                {paramsOpen && tabela.tipo === 'distribuicao' && canEditTarifa ? (
                  <div className="tabela-frete-section-actions">
                    <button type="button" className="reports-action-btn secondary tabela-frete-meta-action-btn" onClick={() => setRegrasOpen(true)}>Faixas de km e prazos</button>
                    <button type="button" className="reports-action-btn secondary tabela-frete-meta-action-btn" onClick={() => setBandasOpen(true)}>Bandas de peso</button>
                    <button type="button" className="reports-action-btn secondary tabela-frete-meta-action-btn" onClick={() => setColunasOpen(true)}>Colunas extras</button>
                    <button type="button" className="reports-action-btn primary tabela-frete-meta-action-btn" style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }} disabled={saving} onClick={handleRecalcular}>
                      {preview.isPending ? 'Calculando...' : 'Recalcular faixas'}
                    </button>
                  </div>
                ) : null}
              </div>
              {paramsOpen ? (
              <div className="tabela-frete-params-body">
                <div className="tabela-frete-params-panel">
                  <div className="tabela-frete-params-row">
                    <ParamsField label="Clientes vinculados" size="clientes">
                      <ComercialTabelaFreteClientesPicker
                        clientes={clientes}
                        selectedIds={clienteIds}
                        disabled={!canManage || isLocked}
                        onChange={setClienteIds}
                      />
                    </ParamsField>
                  </div>
                  {tabela.tipo === 'distribuicao' && config ? (
                    <>
                      <div className="tabela-frete-params-row">
                        <ParamsField label="Km inicial" size="km">
                          <input
                            type="number"
                            disabled={!canEditTarifa}
                            value={config.kmInicio}
                            onChange={(e) => setConfig({ ...config, kmInicio: Number(e.target.value) })}
                          />
                        </ParamsField>
                        <ParamsField label="Km final" size="km">
                          <input
                            type="number"
                            disabled={!canEditTarifa}
                            value={config.kmFim}
                            onChange={(e) => setConfig({ ...config, kmFim: Number(e.target.value) })}
                          />
                        </ParamsField>
                        <ParamsField label="Modo de tarifação" size="modo">
                          <select
                            aria-label="Modo de tarifação"
                            disabled={!canEditTarifa}
                            value={config.modoTarifa || 'incremento_primeira_faixa'}
                            onChange={(e) => setModoTarifa(e.target.value as TabelaFreteModoTarifa)}
                          >
                            {(Object.keys(MODO_TARIFA_LABEL) as TabelaFreteModoTarifa[]).map((modo) => (
                              <option key={modo} value={modo}>{MODO_TARIFA_LABEL[modo]}</option>
                            ))}
                          </select>
                        </ParamsField>
                      </div>
                      <div className="tabela-frete-params-row">
                      {modoLinear ? (
                        <>
                          <ParamsField label="Tarifa fixa (R$)" size="valor">
                            <input disabled={!canEditTarifa} value={config.tarifaFixa ?? ''} onChange={(e) => setConfig({ ...config, tarifaFixa: e.target.value })} />
                          </ParamsField>
                          <ParamsField label="Valor por km" size="valor">
                            <input disabled={!canEditTarifa} value={config.tarifaPorKm ?? ''} onChange={(e) => setConfig({ ...config, tarifaPorKm: e.target.value })} />
                          </ParamsField>
                        </>
                      ) : (
                        <>
                          <ParamsField label="Tarifa base" size="valor">
                            <input disabled={!canEditTarifa} value={config.tarifaBase} onChange={(e) => setConfig({ ...config, tarifaBase: e.target.value })} />
                          </ParamsField>
                          <ParamsField label="Incremento por km" size="valor">
                            <input disabled={!canEditTarifa} value={config.incrementoPorKm} onChange={(e) => setConfig({ ...config, incrementoPorKm: e.target.value })} />
                          </ParamsField>
                        </>
                      )}
                      <ParamsField label="Fator frete mínimo" size="num">
                        <input disabled={!canEditTarifa} value={config.fatorFreteMinimo ?? '0.499'} onChange={(e) => setConfig({ ...config, fatorFreteMinimo: e.target.value })} />
                      </ParamsField>
                      <ParamsField label="Pedágio base" size="num">
                        <input disabled={!canEditTarifa} value={config.pedagioBase} onChange={(e) => setConfig({ ...config, pedagioBase: e.target.value })} />
                      </ParamsField>
                      <ParamsField label="Fator pedágio" size="num">
                        <input disabled={!canEditTarifa} value={config.pedagioFator} onChange={(e) => setConfig({ ...config, pedagioFator: e.target.value })} />
                      </ParamsField>
                      <ParamsField label="GRIS e ADV" size="gris">
                        <div className="tabela-frete-gris-adv-options">
                          <label>
                            <input
                              type="radio"
                              name="gris-adv-modo"
                              disabled={!canEditTarifa}
                              checked={grisAdvUnificado}
                              onChange={() => setGrisAdvModo(true)}
                            />
                            Agregado
                          </label>
                          <label>
                            <input
                              type="radio"
                              name="gris-adv-modo"
                              disabled={!canEditTarifa}
                              checked={!grisAdvUnificado}
                              onChange={() => setGrisAdvModo(false)}
                            />
                            Discriminado
                          </label>
                        </div>
                      </ParamsField>
                      {grisAdvUnificado ? (
                        <ParamsField label="GRIS + ADV %" size="num">
                          <PercentFatorInput
                            disabled={!canEditTarifa}
                            fator={config.grisAdvPercent ?? config.grisPercent}
                            onFatorChange={setGrisAdvUnificado}
                          />
                        </ParamsField>
                      ) : (
                        <>
                          <ParamsField label="GRIS %" size="num">
                            <PercentFatorInput
                              disabled={!canEditTarifa}
                              fator={config.grisPercent}
                              onFatorChange={(valor) => setConfig({ ...config, grisPercent: valor })}
                            />
                          </ParamsField>
                          <ParamsField label="ADV %" size="num">
                            <PercentFatorInput
                              disabled={!canEditTarifa}
                              fator={config.advPercent}
                              onFatorChange={(valor) => setConfig({ ...config, advPercent: valor })}
                            />
                          </ParamsField>
                        </>
                      )}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
              ) : null}
            </div>

            <div className={`erp-card reports-table-card tabela-frete-grade-card${gradeOpen ? ' is-open' : ''}`}>
              <div className="tabela-frete-fold-bar">
                <button type="button" className="tabela-frete-fold-trigger" aria-expanded={gradeOpen} onClick={() => setGradeOpen((open) => !open)}>
                  <i className={`bi ${gradeOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`} aria-hidden />
                  <span className="tabela-frete-fold-title">{tabela.tipo === 'distribuicao' ? 'Grade de faixas' : 'Trechos'}</span>
                  <span className="reports-records-count">
                    {tabela.tipo === 'distribuicao'
                      ? `${faixas.length} faixa${faixas.length === 1 ? '' : 's'}`
                      : `${linhas.length} trecho${linhas.length === 1 ? '' : 's'}`}
                  </span>
                </button>
                <button
                  type="button"
                  className="tabela-frete-export-btn"
                  title={exportarTabela.isPending ? 'Exportando...' : 'Exportar tabela'}
                  aria-label="Exportar tabela"
                  disabled={exportarTabela.isPending}
                  onClick={handleExportar}
                >
                  <i className={`bi ${exportarTabela.isPending ? 'bi-hourglass-split' : 'bi-download'}`} aria-hidden />
                </button>
                {tabela.tipo === 'transferencia' && canEditTarifa ? (
                  <button type="button" className="reports-action-btn secondary" onClick={openNewLinha}>Adicionar trecho</button>
                ) : null}
              </div>
              {gradeOpen && tabela.tipo === 'transferencia' ? (
                <div className="table-container tabela-frete-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Origem</th>
                        <th>Destino</th>
                        <th>Veículo</th>
                        <th>Frete</th>
                        <th>Pedágio</th>
                        <th>GRIS</th>
                        <th>Ad-VL</th>
                        <th>Prazo</th>
                        {canManage ? <th /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.length === 0 ? (
                        <tr>
                          <td colSpan={canEditTarifa ? 9 : 8} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                            Nenhum trecho cadastrado.
                          </td>
                        </tr>
                      ) : linhas.map((linha) => (
                        <tr key={linha.id}>
                          <td>{linha.origem || '—'}</td>
                          <td>{linha.entrega || '—'}</td>
                          <td>{linha.veiculo || '—'}</td>
                          <td>{linha.tarifaFrete || '—'}</td>
                          <td>{linha.pedagio || '—'}</td>
                          <td>{linha.gris || '—'}</td>
                          <td>{linha.adValorem || '—'}</td>
                          <td>{linha.prazoDias || '—'}</td>
                          {canEditTarifa ? (
                            <td>
                              <button type="button" className="btn-icon" title="Editar" onClick={() => startEditLinha(linha)}><i className="bi bi-pencil" /></button>
                              <button type="button" className="btn-icon" title="Excluir" onClick={() => {
                                if (window.confirm('Excluir este trecho?')) deleteLinha.mutate(linha.id, { onError: (err) => alert(getComercialErrorMessage(err)) });
                              }}><i className="bi bi-trash" /></button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {gradeOpen && tabela.tipo === 'distribuicao' ? (
                <div className="table-container tabela-frete-scroll">
                  <table className="data-table tabela-frete-grade">
                    <thead>
                      <tr>
                        <th className="is-km">De</th>
                        <th className="is-km">Até</th>
                        <th className="is-money">Frete mín.</th>
                        {bandas.map((banda) => (
                          <th
                            key={banda.key || banda.rotulo}
                            className={`is-banda${isTarifaVeiculo(banda) ? ' is-veiculo' : ' is-ton'}`}
                          >
                            {banda.rotulo}
                          </th>
                        ))}
                        <th className="is-extra is-group-start">Pedágio/t</th>
                        {grisAdvUnificado ? (
                          <th className="is-extra">GRIS/ADV %</th>
                        ) : (
                          <>
                            <th className="is-extra">GRIS %</th>
                            <th className="is-extra">ADV %</th>
                          </>
                        )}
                        {extras.map((coluna) => (
                          <th key={coluna.key || coluna.rotulo} className="is-extra">{coluna.rotulo}</th>
                        ))}
                        <th className="is-prazo is-group-start">Prazo frac.</th>
                        <th className="is-prazo">Prazo fechado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {faixas.length === 0 ? (
                        <tr>
                          <td colSpan={8 + bandas.length + extras.length} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                            Clique em Recalcular faixas para gerar a tabela.
                          </td>
                        </tr>
                      ) : faixas.map((faixa) => (
                        <tr key={faixaKey(faixa)}>
                          <td className="is-km">{faixa.kmDe}</td>
                          <td className="is-km">{faixa.kmAte}</td>
                          <td className="is-money">{formatTabelaAmount(faixa.freteMinimo)}</td>
                          {faixa.tarifas.map((tarifa) => (
                            <td key={tarifa.key} className={`is-banda${isTarifaVeiculo(tarifa) ? ' is-veiculo' : ' is-ton'}`}>
                              {formatTabelaAmount(tarifa.valor)}
                            </td>
                          ))}
                          <td className="is-extra is-group-start">
                            {canEditTarifa ? (
                              <input className="proposta-destinos-input" value={faixa.pedagioTon} onChange={(e) => patchOverride(faixa, 'pedagioTon', e.target.value)} />
                            ) : formatTabelaAmount(faixa.pedagioTon)}
                          </td>
                          {grisAdvUnificado ? (
                            <td className="is-extra">{formatTabelaPercentFator(faixa.grisPercent)}</td>
                          ) : (
                            <>
                              <td className="is-extra">{formatTabelaPercentFator(faixa.grisPercent)}</td>
                              <td className="is-extra">{formatTabelaPercentFator(faixa.advPercent)}</td>
                            </>
                          )}
                          {extras.map((coluna) => {
                            const extra = (faixa.extras || []).find((item) => item.key === coluna.key);
                            const valor = extra?.valor ?? coluna.valor ?? '';
                            const formato = extra?.formato || coluna.formato;
                            return (
                              <td key={coluna.key} className="is-extra">
                                {canEditTarifa ? (
                                  <input
                                    className="proposta-destinos-input"
                                    value={valor}
                                    onChange={(e) => patchExtra(faixa, coluna.key, e.target.value)}
                                  />
                                ) : formatColunaExtraValor({ valor, formato })}
                              </td>
                            );
                          })}
                          <td className="is-prazo is-group-start">
                            {canEditTarifa ? (
                              <input className="proposta-destinos-input" type="number" value={faixa.prazoFracionado} onChange={(e) => patchOverride(faixa, 'prazoFracionado', Number(e.target.value))} />
                            ) : faixa.prazoFracionado}
                          </td>
                          <td className="is-prazo">
                            {canEditTarifa ? (
                              <input className="proposta-destinos-input" type="number" value={faixa.prazoFechado} onChange={(e) => patchOverride(faixa, 'prazoFechado', Number(e.target.value))} />
                            ) : faixa.prazoFechado}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>

            {tabela.tipo === 'distribuicao' && (
              <div className={`erp-card tabela-frete-simulador-card${simuladorOpen ? ' is-open' : ''}`}>
                <div className="tabela-frete-fold-bar">
                  <button type="button" className="tabela-frete-fold-trigger" aria-expanded={simuladorOpen} onClick={() => setSimuladorOpen((open) => !open)}>
                    <i className={`bi ${simuladorOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`} aria-hidden />
                    <span className="tabela-frete-fold-title">Simulador de cotação</span>
                  </button>
                </div>
                {simuladorOpen ? <ComercialTabelaFreteSimulador tabelaId={tabelaId} disabled={faixas.length === 0} /> : null}
              </div>
            )}
          </div>

        )}
      </QueryDataPanel>

      {bandasOpen && config && (
        <div className="search-backdrop tabela-frete-modal-backdrop" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) setBandasOpen(false); }}>
          <div className="modal-card tabela-frete-bandas-modal">
            <div className="modal-header">
              <h3>Bandas de peso / veículo</h3>
              <button type="button" className="btn-icon" onClick={() => setBandasOpen(false)} aria-label="Fechar"><i className="bi bi-x-lg" /></button>
            </div>
            <div className="modal-body">
              <p className="tabela-frete-hint">Cada coluna da grade usa a tarifa de referência (K) e o cálculo da banda.</p>
              <div className="table-container tabela-frete-bandas-wrap">
                <table className="data-table tabela-frete-mini tabela-frete-bandas-table">
                  <colgroup>
                    <col className="tabela-frete-bandas-col-rotulo" />
                    <col className="tabela-frete-bandas-col-unidade" />
                    <col className="tabela-frete-bandas-col-calculo" />
                    <col className="tabela-frete-bandas-col-fator" />
                    {canManage ? <col className="tabela-frete-bandas-col-acoes" /> : null}
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Rótulo</th>
                      <th>Unidade</th>
                      <th>Cálculo</th>
                      <th>Fator / valor</th>
                      {canManage ? <th aria-label="Ações" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {config.bandas.map((banda, index) => {
                      const calculo = (banda.calculo || 'multiplicador') as TabelaFreteBandaCalculo;
                      const usaFator = calculo === 'multiplicador';
                      const usaValor = calculo !== 'multiplicador' && calculo !== 'referencia';
                      return (
                        <tr key={banda.key || `banda-${index}`}>
                          <td>
                            <input
                              disabled={!canEditTarifa}
                              value={banda.rotulo}
                              onChange={(e) => setBanda(index, { rotulo: e.target.value })}
                            />
                          </td>
                          <td>
                            <select disabled={!canEditTarifa} value={banda.unidade} onChange={(e) => setBanda(index, { unidade: e.target.value })}>
                              <option value="ton">ton</option>
                              <option value="veiculo">veículo</option>
                            </select>
                          </td>
                          <td>
                            <select
                              disabled={!canEditTarifa}
                              value={calculo}
                              onChange={(e) => setBanda(index, { calculo: e.target.value as TabelaFreteBandaCalculo })}
                            >
                              {CALCULO_BANDA_OPTIONS.map((opcao) => (
                                <option key={opcao} value={opcao}>{CALCULO_BANDA_LABEL[opcao]}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {calculo === 'referencia' ? (
                              <span className="muted">—</span>
                            ) : (
                              <input
                                disabled={!canEditTarifa}
                                inputMode="decimal"
                                value={compactBandaNumero(usaFator ? banda.fator : banda.valor)}
                                onChange={(e) => setBanda(index, usaFator ? { fator: e.target.value } : { valor: e.target.value })}
                                placeholder={usaValor ? 'Valor' : 'Fator'}
                              />
                            )}
                          </td>
                          {canManage ? (
                            <td>
                              <button type="button" className="btn-icon" title="Remover" disabled={!canEditTarifa || config.bandas.length <= 1} onClick={() => removeBanda(index)}>
                                <i className="bi bi-trash" />
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer tabela-frete-bandas-footer">
              {canManage && canEditTarifa ? (
                <button type="button" className="reports-action-btn secondary" onClick={addBanda}>Adicionar banda</button>
              ) : <span />}
              <div className="tabela-frete-bandas-footer-actions">
                <button type="button" className="reports-action-btn secondary" onClick={() => setBandasOpen(false)}>Fechar</button>
                {canEditTarifa ? (
                  <button
                    type="button"
                    className="reports-action-btn primary"
                    style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
                    disabled={saving}
                    onClick={() => {
                      handleRecalcular();
                      setBandasOpen(false);
                    }}
                  >
                    {preview.isPending ? 'Calculando...' : 'Recalcular faixas'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {colunasOpen && config && (
        <div className="search-backdrop tabela-frete-modal-backdrop" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) setColunasOpen(false); }}>
          <div className="modal-card tabela-frete-bandas-modal">
            <div className="modal-header">
              <h3>Colunas extras</h3>
              <button type="button" className="btn-icon" onClick={() => setColunasOpen(false)} aria-label="Fechar"><i className="bi bi-x-lg" /></button>
            </div>
            <div className="modal-body">
              <p className="tabela-frete-hint">
                Inclua taxas personalizadas na grade (ex.: Tx emissão CTe). Percentual: informe 0,15 para 0,15%.
              </p>
              <div className="table-container tabela-frete-bandas-wrap">
                <table className="data-table tabela-frete-mini tabela-frete-bandas-table">
                  <thead>
                    <tr>
                      <th>Rótulo</th>
                      <th>Cálculo</th>
                      <th>Valor</th>
                      <th>No total</th>
                      {canManage ? <th aria-label="Ações" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {(config.colunasExtras ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={canManage ? 5 : 4} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '16px' }}>
                          Nenhuma coluna extra. Adicione taxas como emissão de CTe.
                        </td>
                      </tr>
                    ) : (config.colunasExtras ?? []).map((coluna, index) => {
                      const percentual = coluna.calculo === 'percentual_nf' || coluna.calculo === 'percentual_frete';
                      return (
                        <tr key={coluna.key || `extra-${index}`}>
                          <td>
                            <input
                              disabled={!canEditTarifa}
                              value={coluna.rotulo}
                              onChange={(e) => setColunaExtra(index, { rotulo: e.target.value })}
                            />
                          </td>
                          <td>
                            <select
                              disabled={!canEditTarifa}
                              value={coluna.calculo}
                              onChange={(e) => setColunaExtra(index, { calculo: e.target.value as TabelaFreteColunaCalculo })}
                            >
                              {CALCULO_COLUNA_OPTIONS.map((opcao) => (
                                <option key={opcao} value={opcao}>{CALCULO_COLUNA_LABEL[opcao]}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              disabled={!canEditTarifa}
                              inputMode="decimal"
                              value={coluna.valor}
                              onChange={(e) => setColunaExtra(index, { valor: e.target.value })}
                              placeholder={percentual ? '0,15' : '25,00'}
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              disabled={!canEditTarifa}
                              checked={coluna.incluirNoTotal !== false}
                              onChange={(e) => setColunaExtra(index, { incluirNoTotal: e.target.checked })}
                              aria-label="Incluir no total da cotação"
                            />
                          </td>
                          {canManage ? (
                            <td>
                              <button type="button" className="btn-icon" title="Remover" disabled={!canEditTarifa} onClick={() => removeColunaExtra(index)}>
                                <i className="bi bi-trash" />
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer tabela-frete-bandas-footer">
              {canManage && canEditTarifa ? (
                <button type="button" className="reports-action-btn secondary" onClick={addColunaExtra}>Adicionar coluna</button>
              ) : <span />}
              <div className="tabela-frete-bandas-footer-actions">
                <button type="button" className="reports-action-btn secondary" onClick={() => setColunasOpen(false)}>Fechar</button>
                {canEditTarifa ? (
                  <button
                    type="button"
                    className="reports-action-btn primary"
                    style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
                    disabled={saving}
                    onClick={() => {
                      handleRecalcular();
                      setColunasOpen(false);
                    }}
                  >
                    {preview.isPending ? 'Calculando...' : 'Recalcular faixas'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {regrasOpen && config && (
        <div className="search-backdrop tabela-frete-modal-backdrop" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) setRegrasOpen(false); }}>
          <div className="modal-card tabela-frete-regras-modal">
            <div className="modal-header">
              <h3>Faixas de km e prazos</h3>
              <button type="button" className="btn-icon" onClick={() => setRegrasOpen(false)} aria-label="Fechar"><i className="bi bi-x-lg" /></button>
            </div>
            <div className="modal-body tabela-frete-regras-body">
              <section className="tabela-frete-regras-panel">
                <h4>Espaçamento de faixas</h4>
                <p className="tabela-frete-hint">Até determinado km, a grade avança de quanto em quanto (passo).</p>
                <table className="tabela-frete-mini">
                  <thead>
                    <tr><th>Até km</th><th>Passo</th></tr>
                  </thead>
                  <tbody>
                    {config.passos.map((passo, index) => (
                      <tr key={`passo-${index}`}>
                        <td><input type="number" disabled={!canEditTarifa} value={passo.ateKm} onChange={(e) => setPasso(index, { ateKm: Number(e.target.value) })} /></td>
                        <td><input type="number" disabled={!canEditTarifa} value={passo.passo} onChange={(e) => setPasso(index, { passo: Number(e.target.value) })} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <div className="tabela-frete-regras-prazos">
                <section className="tabela-frete-regras-panel">
                  <h4>Prazo fracionado</h4>
                  <p className="tabela-frete-hint">Dias úteis até o km informado.</p>
                  <table className="tabela-frete-mini">
                    <thead>
                      <tr><th>Até km</th><th>Dias</th></tr>
                    </thead>
                    <tbody>
                      {config.prazosFracionado.map((regra, index) => (
                        <tr key={`pf-${index}`}>
                          <td><input type="number" disabled={!canEditTarifa} value={regra.ateKm} onChange={(e) => setPrazo('prazosFracionado', index, { ateKm: Number(e.target.value) })} /></td>
                          <td><input type="number" disabled={!canEditTarifa} value={regra.dias} onChange={(e) => setPrazo('prazosFracionado', index, { dias: Number(e.target.value) })} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
                <section className="tabela-frete-regras-panel">
                  <h4>Prazo fechado</h4>
                  <p className="tabela-frete-hint">Dias úteis até o km informado.</p>
                  <table className="tabela-frete-mini">
                    <thead>
                      <tr><th>Até km</th><th>Dias</th></tr>
                    </thead>
                    <tbody>
                      {config.prazosFechado.map((regra, index) => (
                        <tr key={`pc-${index}`}>
                          <td><input type="number" disabled={!canEditTarifa} value={regra.ateKm} onChange={(e) => setPrazo('prazosFechado', index, { ateKm: Number(e.target.value) })} /></td>
                          <td><input type="number" disabled={!canEditTarifa} value={regra.dias} onChange={(e) => setPrazo('prazosFechado', index, { dias: Number(e.target.value) })} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </div>
            </div>
            <div className="modal-footer tabela-frete-bandas-footer">
              <span />
              <div className="tabela-frete-bandas-footer-actions">
                <button type="button" className="reports-action-btn secondary" onClick={() => setRegrasOpen(false)}>Fechar</button>
                {canEditTarifa ? (
                  <button
                    type="button"
                    className="reports-action-btn primary"
                    style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
                    disabled={saving}
                    onClick={() => {
                      handleRecalcular();
                      setRegrasOpen(false);
                    }}
                  >
                    {preview.isPending ? 'Calculando...' : 'Recalcular faixas'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {linhaModal && (
        <div className="search-backdrop tabela-frete-modal-backdrop" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) setLinhaModal(false); }}>
          <form className="modal-card" style={{ width: 'min(640px, 96vw)' }} onSubmit={saveLinha}>
            <div className="modal-header">
              <h3>{editingLinhaId ? 'Editar trecho' : 'Novo trecho'}</h3>
              <button type="button" className="btn-icon" onClick={() => setLinhaModal(false)} aria-label="Fechar"><i className="bi bi-x-lg" /></button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>Origem<input className="proposta-include-input" value={linhaForm.origem} onChange={(e) => setLinhaForm({ ...linhaForm, origem: e.target.value })} /></label>
              <label>Destino<input className="proposta-include-input" value={linhaForm.entrega} onChange={(e) => setLinhaForm({ ...linhaForm, entrega: e.target.value })} /></label>
              <label>Veículo<input className="proposta-include-input" value={linhaForm.veiculo} onChange={(e) => setLinhaForm({ ...linhaForm, veiculo: e.target.value })} /></label>
              <label>Prazo<input className="proposta-include-input" value={linhaForm.prazoDias} onChange={(e) => setLinhaForm({ ...linhaForm, prazoDias: e.target.value })} /></label>
              <label>Frete<input className="proposta-include-input" value={linhaForm.tarifaFrete} onChange={(e) => setLinhaForm({ ...linhaForm, tarifaFrete: e.target.value })} /></label>
              <label>Pedágio<input className="proposta-include-input" value={linhaForm.pedagio} onChange={(e) => setLinhaForm({ ...linhaForm, pedagio: e.target.value })} /></label>
              <label>GRIS<input className="proposta-include-input" value={linhaForm.gris} onChange={(e) => setLinhaForm({ ...linhaForm, gris: e.target.value })} /></label>
              <label>Ad-VL<input className="proposta-include-input" value={linhaForm.adValorem} onChange={(e) => setLinhaForm({ ...linhaForm, adValorem: e.target.value })} /></label>
              <label style={{ gridColumn: '1 / -1' }}>ICMS<input className="proposta-include-input" value={linhaForm.icms} onChange={(e) => setLinhaForm({ ...linhaForm, icms: e.target.value })} /></label>
            </div>
            <div className="modal-footer">
              <button type="button" className="reports-action-btn secondary" onClick={() => setLinhaModal(false)}>Cancelar</button>
              <button type="submit" className="reports-action-btn primary" disabled={linhaPending}>{linhaPending ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </div>
      )}

      {historicoOpen && tabela ? (
        <ComercialTabelaFreteHistoricoRevisoesPanel
          tabelaId={tabelaId}
          tabelaNome={nome || tabela.nome}
          onClose={() => setHistoricoOpen(false)}
          onOpenRevisao={onOpenTabela}
        />
      ) : null}

    </div>
  );
}
