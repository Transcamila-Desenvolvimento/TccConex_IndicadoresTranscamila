import React, { useEffect, useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import { useNdPagadores, useNdTitulos, useSalvarNdPagadores } from '../../hooks/useControleNds';
import type { NdPagadorDisponivel, NdPagadorSelecionado, NdTituloCampoOrdem, NdTituloOrdering, NdTituloSituacao } from '../../types/domain';

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const SITUACAO: Record<NdTituloSituacao, { label: string; classe: string }> = {
  vencido: { label: 'Vencido', classe: 'danger' },
  a_vencer: { label: 'Em dia', classe: 'success' },
  baixado: { label: 'Baixado', classe: 'inativo' },
};

const COLUNAS: { id: string; label: string; align?: 'right'; ordena?: NdTituloCampoOrdem }[] = [
  { id: 'cod', label: 'Cód. cliente' },
  { id: 'cliente', label: 'Cliente', ordena: 'cliente' },
  { id: 'titulo', label: 'Título' },
  { id: 'natureza', label: 'Natureza' },
  { id: 'emissao', label: 'Emissão', ordena: 'emissao' },
  { id: 'vencimento', label: 'Vencimento real', ordena: 'vencimento' },
  { id: 'saldo', label: 'Saldo', align: 'right' },
  { id: 'historico', label: 'Histórico' },
  { id: 'situacao', label: 'Situação' },
];

function nextOrdering(field: NdTituloCampoOrdem, current: NdTituloOrdering): NdTituloOrdering {
  return current === `${field}_asc` ? `${field}_desc` : `${field}_asc`;
}

function SortIcon({ field, ordering }: { field: NdTituloCampoOrdem; ordering: NdTituloOrdering }) {
  const isActive = ordering === `${field}_asc` || ordering === `${field}_desc`;
  const isAsc = ordering === `${field}_asc`;
  return (
    <span style={{ marginLeft: 6, display: 'inline-flex', flexDirection: 'column', gap: 0, verticalAlign: 'middle', lineHeight: 1 }}>
      <i className="bi bi-caret-up-fill" style={{ fontSize: 11, display: 'block', color: isActive && isAsc ? '#0f85c1' : '#c8d3e0' }} />
      <i className="bi bi-caret-down-fill" style={{ fontSize: 11, display: 'block', color: isActive && !isAsc ? '#0f85c1' : '#c8d3e0' }} />
    </span>
  );
}

function mensagemErro(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' && detail.trim() ? detail : 'Não foi possível salvar os pagadores.';
}

const FaturamentoControleNds: React.FC = () => {
  const pagadoresQuery = useNdPagadores();
  const salvar = useSalvarNdPagadores();
  const selecionados = pagadoresQuery.data?.selecionados ?? [];
  const lote = pagadoresQuery.data?.lote ?? null;
  const temPagadores = selecionados.length > 0;

  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [ordering, setOrdering] = useState<NdTituloOrdering>('cliente_asc');
  const [modalAberto, setModalAberto] = useState(false);

  const titulosQuery = useNdTitulos(
    { page, pageSize, search: busca, ordering },
    temPagadores,
  );
  const painelQuery = temPagadores ? titulosQuery : pagadoresQuery;
  const { canShowEmpty } = useAsyncQueryState(painelQuery);
  const titulos = titulosQuery.data?.results ?? [];
  const total = temPagadores ? (titulosQuery.data?.count ?? 0) : 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== clampedPage) setPage(clampedPage);
  }, [page, clampedPage]);

  return (
    <div className="fat-list-compact" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 4px 4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Controle de NDs</h1>
        </div>
        <button
          type="button"
          className="reports-action-btn primary"
          style={{ backgroundColor: '#118CC4', borderColor: '#118CC4', display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}
          disabled={pagadoresQuery.isLoading}
          onClick={() => setModalAberto(true)}
        >
          <i className="bi bi-people" aria-hidden="true" />
          <span>Selecionar pagadores{selecionados.length > 0 ? ` (${selecionados.length})` : ''}</span>
        </button>
      </header>

      <div className="reports-filters-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
        <div className="reports-filter-left" style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="reports-search-wrapper" style={{ minWidth: '220px' }}>
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input
              type="search"
              placeholder="Título, cliente ou histórico..."
              value={busca}
              aria-label="Buscar títulos"
              disabled={!temPagadores}
              onChange={(event) => {
                setBusca(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count">
            <strong>{total}</strong> {total === 1 ? 'Título' : 'Títulos'}
            {lote ? ` · ${lote.label}` : ''}
          </span>
        </div>
      </div>

      <QueryDataPanel
        query={painelQuery}
        loadingMessage="Carregando títulos..."
        refreshingMessage="Atualizando títulos..."
        errorMessage="Não foi possível carregar os títulos. Tente novamente."
      >
        <div className="erp-card reports-table-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {COLUNAS.map((coluna) => (
                    <th
                      key={coluna.id}
                      style={coluna.ordena
                        ? { cursor: 'pointer', userSelect: 'none', textAlign: coluna.align }
                        : { textAlign: coluna.align }}
                      onClick={coluna.ordena ? () => {
                        setOrdering((atual) => nextOrdering(coluna.ordena as NdTituloCampoOrdem, atual));
                        setPage(1);
                      } : undefined}
                    >
                      {coluna.label}
                      {coluna.ordena && <SortIcon field={coluna.ordena} ordering={ordering} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && titulos.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '32px' }}>
                      {temPagadores
                        ? 'Nenhum título encontrado.'
                        : lote
                          ? 'Selecione os pagadores para acompanhar os títulos a receber.'
                          : 'Importe o Contas a Receber no fluxo de caixa para escolher os pagadores.'}
                    </td>
                  </tr>
                ) : (
                  titulos.map((row) => {
                    const situacao = SITUACAO[row.situacao] ?? SITUACAO.a_vencer;
                    return (
                      <tr key={row.id}>
                        <td>{row.codCliente}</td>
                        <td>{row.cliente}</td>
                        <td><strong>{row.titulo}</strong></td>
                        <td>{row.natureza || '—'}</td>
                        <td>{row.emissao || '—'}</td>
                        <td>{row.vencimentoReal || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(row.saldo)}</td>
                        <td
                          style={{ color: 'var(--text-secondary)', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={row.historico || undefined}
                        >
                          {row.historico || '—'}
                        </td>
                        <td>
                          <span className={`status-badge ${situacao.classe}`}>{situacao.label}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-pagination-bar">
          <div className="erp-pagination-page-size">
            <label htmlFor="nds-page-size">Itens por página</label>
            <select
              id="nds-page-size"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <span style={{ fontWeight: 500, marginRight: '4px' }}>
            Página <span className="erp-pagination-current">{clampedPage}</span> de{' '}
            <span className="erp-pagination-current">{totalPages}</span>
            <span className="erp-pagination-meta">({total} registros)</span>
          </span>

          <button
            type="button"
            className="reports-action-btn secondary"
            title="Primeira página"
            aria-label="Primeira página"
            disabled={clampedPage <= 1}
            onClick={() => setPage(1)}
            style={{ height: '32px', width: '32px', padding: 0, fontSize: '12px', opacity: clampedPage <= 1 ? 0.5 : 1, cursor: clampedPage <= 1 ? 'not-allowed' : 'pointer' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 4.5l-7.5 7.5 7.5 7.5M11.25 4.5l-7.5 7.5 7.5 7.5" />
            </svg>
          </button>
          <button
            type="button"
            className="reports-action-btn secondary"
            disabled={clampedPage <= 1}
            onClick={() => setPage(clampedPage - 1)}
            style={{ height: '32px', padding: '0 12px', fontSize: '12px', gap: '6px', opacity: clampedPage <= 1 ? 0.5 : 1, cursor: clampedPage <= 1 ? 'not-allowed' : 'pointer' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Anterior
          </button>
          <button
            type="button"
            className="reports-action-btn secondary"
            disabled={clampedPage >= totalPages}
            onClick={() => setPage(clampedPage + 1)}
            style={{ height: '32px', padding: '0 12px', fontSize: '12px', gap: '6px', opacity: clampedPage >= totalPages ? 0.5 : 1, cursor: clampedPage >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            Próximo
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          <button
            type="button"
            className="reports-action-btn secondary"
            title="Última página"
            aria-label="Última página"
            disabled={clampedPage >= totalPages}
            onClick={() => setPage(totalPages)}
            style={{ height: '32px', width: '32px', padding: 0, fontSize: '12px', opacity: clampedPage >= totalPages ? 0.5 : 1, cursor: clampedPage >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5M12.75 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </QueryDataPanel>

      {modalAberto && (
        <SelecionarPagadoresModal
          disponiveis={pagadoresQuery.data?.disponiveis ?? []}
          selecionados={selecionados}
          loteLabel={lote?.label ?? ''}
          pending={salvar.isPending}
          erro={salvar.isError ? mensagemErro(salvar.error) : ''}
          onClose={() => {
            salvar.reset();
            setModalAberto(false);
          }}
          onSave={async (codigos) => {
            await salvar.mutateAsync(codigos);
            setPage(1);
            setModalAberto(false);
          }}
        />
      )}
    </div>
  );
};

function SelecionarPagadoresModal({
  disponiveis,
  selecionados,
  loteLabel,
  pending,
  erro,
  onClose,
  onSave,
}: {
  disponiveis: NdPagadorDisponivel[];
  selecionados: NdPagadorSelecionado[];
  loteLabel: string;
  pending: boolean;
  erro: string;
  onClose: () => void;
  onSave: (codigos: string[]) => Promise<void>;
}) {
  const [marcados, setMarcados] = useState<string[]>(selecionados.map((item) => item.codCliente));
  const [filtro, setFiltro] = useState('');

  const lista = useMemo(() => {
    const porCodigo = new Map(disponiveis.map((item) => [item.codCliente, item]));
    selecionados.forEach((item) => {
      if (!porCodigo.has(item.codCliente)) {
        porCodigo.set(item.codCliente, { ...item, titulos: 0 });
      }
    });
    return [...porCodigo.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.codCliente.localeCompare(b.codCliente));
  }, [disponiveis, selecionados]);

  const visiveis = useMemo(() => {
    const termo = filtro.trim().toLowerCase();
    if (!termo) return lista;
    return lista.filter((item) => item.nome.toLowerCase().includes(termo) || item.codCliente.toLowerCase().includes(termo));
  }, [lista, filtro]);

  const alternar = (codCliente: string) => {
    setMarcados((atual) => (
      atual.includes(codCliente) ? atual.filter((item) => item !== codCliente) : [...atual, codCliente]
    ));
  };

  return (
    <div
      className="search-backdrop admin-user-modal-backdrop"
      style={{ display: 'flex', zIndex: 3000 }}
      onClick={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}
    >
      <form
        className="search-modal-card"
        style={{ width: '640px', maxWidth: '96vw', padding: '24px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(marcados);
        }}
      >
        <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Pagadores do contas a receber</h3>
          <button type="button" className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px', background: 'none', border: 0 }} onClick={onClose}>
            Fechar (X)
          </button>
        </div>

        <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#64748b' }}>
          {loteLabel
            ? `Clientes do fluxo de caixa (${loteLabel}). A atualização dos títulos fica amarrada ao código.`
            : 'Nenhum Contas a Receber ativo no fluxo de caixa.'}
        </p>

        <div className="reports-search-wrapper" style={{ marginBottom: '12px' }}>
          <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
          </svg>
          <input
            type="search"
            placeholder="Buscar código ou cliente"
            value={filtro}
            aria-label="Buscar pagador"
            onChange={(event) => setFiltro(event.target.value)}
          />
        </div>

        <div className="erp-card" style={{ overflowY: 'auto', minHeight: '180px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }} />
                <th>Código</th>
                <th>Cliente</th>
                <th style={{ textAlign: 'right' }}>Títulos</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '32px' }}>
                    Nenhum pagador encontrado neste relatório.
                  </td>
                </tr>
              ) : (
                visiveis.map((item) => (
                  <tr key={item.codCliente}>
                    <td>
                      <input
                        type="checkbox"
                        checked={marcados.includes(item.codCliente)}
                        onChange={() => alternar(item.codCliente)}
                        aria-label={`Selecionar ${item.nome} código ${item.codCliente}`}
                      />
                    </td>
                    <td>{item.codCliente}</td>
                    <td>{item.nome || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{item.titulos}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {erro && (
          <div style={{ marginTop: '12px', padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12.5px' }}>
            {erro}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <span style={{ fontSize: '12.5px', color: '#475569' }}>{marcados.length} selecionado(s)</span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={pending}>
              Cancelar
            </button>
            <button type="submit" className="reports-action-btn primary" disabled={pending || !loteLabel}>
              {pending ? 'Salvando...' : 'Usar estes pagadores'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default FaturamentoControleNds;
