import React from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState, type QueryResultLike } from '../../hooks/useAsyncQueryState';
import type { PaginatedResponse, SgqAvaliacao, SgqSatisfacaoDetalhe } from '../../types/domain';
import { SGQ_CRITERIOS } from '../../types/domain';

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const AVALIACAO_META: Record<SgqAvaliacao, { label: string; badgeClass: string; icon: string }> = {
  ruim: { label: 'Ruim', badgeClass: 'is-ruim', icon: 'bi bi-x-lg' },
  regular: { label: 'Regular', badgeClass: 'is-regular', icon: 'bi bi-exclamation-lg' },
  bom: { label: 'Bom', badgeClass: 'is-bom', icon: 'bi bi-check-lg' },
  otimo: { label: 'Ótimo', badgeClass: 'is-otimo', icon: 'bi bi-check-lg' },
};

function formatDateBr(isoDate: string | null): string {
  if (!isoDate) return '—';
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function AvaliacaoBadge({ value }: { value: SgqAvaliacao | '' }) {
  if (!value) return <span>—</span>;
  const meta = AVALIACAO_META[value];
  if (!meta) return <span>—</span>;
  return (
    <span
      className={`sgq-avaliacao-badge ${meta.badgeClass}`}
      title={meta.label}
    >
      <i className={meta.icon} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

type Props = {
  query: QueryResultLike<PaginatedResponse<SgqSatisfacaoDetalhe>>;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

const SgqSatisfacaoDetalhesTable: React.FC<Props> = ({
  query,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) => {
  const listState = useAsyncQueryState(query);
  const rows = query.data?.results ?? [];
  const total = query.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);

  const isEmpty = listState.canShowEmpty && rows.length === 0;

  const navBtnStyle = (disabled: boolean): React.CSSProperties => ({
    height: '32px',
    padding: '0 12px',
    fontSize: '12px',
    gap: '6px',
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  });

  return (
    <div className="erp-card reports-table-card cashflow-table-card sgq-ind-detalhes-card">
      <QueryDataPanel
        query={query}
        variant="page"
        className="sgq-ind-detalhes-query"
        loadingMessage="Carregando pesquisas..."
        errorMessage="Não foi possível carregar o detalhe das pesquisas."
      >
        {isEmpty ? (
          <div className="sgq-ind-detalhes-empty" role="status">
            Nenhuma pesquisa no período selecionado.
          </div>
        ) : (
        <div className="table-container sgq-ind-detalhes-scroll">
          <table className="erp-table reports-table sgq-ind-detalhes-table">
            <thead>
              <tr>
                <th className="sgq-ind-col-data">Entrega</th>
                <th className="sgq-ind-col-filial">Filial</th>
                <th className="sgq-ind-col-cliente">Cliente</th>
                <th className="sgq-ind-col-motorista">Motorista</th>
                <th className="sgq-ind-col-cte">CT-e</th>
                {SGQ_CRITERIOS.map((criterio) => (
                  <th key={criterio.key} title={criterio.label} className="sgq-col-avaliacao">
                    {criterio.shortLabel}
                  </th>
                ))}
                <th className="sgq-ind-col-analise" title="Análise, Tratativa e Justificativa">Análise</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((pesquisa: SgqSatisfacaoDetalhe) => {
                  const semAvaliacao = pesquisa.clienteRecusouAssinar
                    || SGQ_CRITERIOS.every((criterio) => !pesquisa[criterio.key]);
                  return (
                    <tr key={pesquisa.id}>
                      <td className="sgq-ind-col-data">{formatDateBr(pesquisa.dataEntrega)}</td>
                      <td className="sgq-ind-col-filial sgq-cell-ellipsis" title={pesquisa.filial}>{pesquisa.filial.replace(' (Matriz)', '')}</td>
                      <td className="sgq-ind-col-cliente sgq-cell-ellipsis" title={pesquisa.cliente}>{pesquisa.cliente}</td>
                      <td className="sgq-ind-col-motorista sgq-cell-ellipsis" title={pesquisa.motorista}>{pesquisa.motorista}</td>
                      <td className="sgq-ind-col-cte sgq-cell-ellipsis" title={pesquisa.cte}>{pesquisa.cte}</td>
                      {semAvaliacao ? (
                        <td
                          colSpan={SGQ_CRITERIOS.length}
                          style={{ textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '12.5px' }}
                        >
                          Não avaliou
                        </td>
                      ) : (
                        SGQ_CRITERIOS.map((criterio) => (
                          <td key={criterio.key} className="sgq-col-avaliacao">
                            <AvaliacaoBadge value={pesquisa[criterio.key]} />
                          </td>
                        ))
                      )}
                      <td
                        className="sgq-ind-col-analise sgq-ind-detalhes-analise"
                        title={pesquisa.escopoAnaliseTexto || pesquisa.analise || undefined}
                      >
                        {pesquisa.analise || '—'}
                      </td>
                    </tr>
                  );
              })}
            </tbody>
          </table>
        </div>
        )}

        <div className="erp-pagination-bar">
          <div className="erp-pagination-page-size">
            <label htmlFor="sgq-ind-detalhes-page-size">Itens por página</label>
            <select
              id="sgq-ind-detalhes-page-size"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
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
            onClick={() => onPageChange(1)}
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
            onClick={() => onPageChange(clampedPage - 1)}
            style={navBtnStyle(clampedPage <= 1)}
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
            onClick={() => onPageChange(clampedPage + 1)}
            style={navBtnStyle(clampedPage >= totalPages)}
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
            onClick={() => onPageChange(totalPages)}
            style={{ height: '32px', width: '32px', padding: 0, fontSize: '12px', opacity: clampedPage >= totalPages ? 0.5 : 1, cursor: clampedPage >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5M12.75 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </QueryDataPanel>
    </div>
  );
};

export default SgqSatisfacaoDetalhesTable;
