import React, { useEffect, useMemo, useState } from 'react';
import { useIndicadorCashflowDayDetail } from '../../hooks/useIndicadores';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import QueryDataPanel from '../../components/QueryDataPanel';
import type { CashflowDayDetailParams, CashflowDayPagarRow, CashflowDayReceberRow } from '../../types/domain';

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function matchesFilter(values: string[], query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => value.toLowerCase().includes(normalized));
}

function filterPagarRows(rows: CashflowDayPagarRow[], query: string) {
  return rows.filter((row) =>
    matchesFilter([row.filial, row.fornecedor, row.titulo, row.tipo], query),
  );
}

function filterReceberRows(rows: CashflowDayReceberRow[], query: string) {
  return rows.filter((row) =>
    matchesFilter([row.filial, row.cliente, row.titulo, row.natureza], query),
  );
}

interface CashflowDayDetailModalProps {
  params: CashflowDayDetailParams;
  onClose: () => void;
}

const CashflowDayDetailModal: React.FC<CashflowDayDetailModalProps> = ({ params, onClose }) => {
  const detailQuery = useIndicadorCashflowDayDetail(params, true);
  const { data } = detailQuery;
  const { canShowEmpty } = useAsyncQueryState(detailQuery);
  const [pagarFilter, setPagarFilter] = useState('');
  const [receberFilter, setReceberFilter] = useState('');

  useEffect(() => {
    setPagarFilter('');
    setReceberFilter('');
  }, [params.date, params.position, params.filial, params.accounts, params.includeLimit]);

  const filteredPagar = useMemo(
    () => (data ? filterPagarRows(data.pagar, pagarFilter) : []),
    [data, pagarFilter],
  );

  const filteredReceber = useMemo(
    () => (data ? filterReceberRows(data.receber, receberFilter) : []),
    [data, receberFilter],
  );

  const pagarTotal = useMemo(
    () => filteredPagar.reduce((sum, row) => sum + row.saldo, 0),
    [filteredPagar],
  );

  const receberTotal = useMemo(
    () => filteredReceber.reduce((sum, row) => sum + row.saldo, 0),
    [filteredReceber],
  );

  return (
    <div
      className="search-backdrop cashflow-detail-backdrop"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="search-modal-card cashflow-detail-modal">
        <header className="cashflow-detail-header">
          <div>
            <h2>Detalhes do dia</h2>
            <p>{data?.date ?? params.date}</p>
          </div>
          <button type="button" className="cashflow-detail-close" onClick={onClose} aria-label="Fechar">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <QueryDataPanel
          query={detailQuery}
          variant="compact"
          loadingMessage="Carregando lançamentos..."
          refreshingMessage="Atualizando lançamentos..."
          errorMessage="Não foi possível carregar os detalhes deste dia."
        >
          {data && (
            <>
              <div className="cashflow-detail-kpi-grid">
                <div className="cashflow-kpi-card">
                  <span className="cashflow-kpi-label">Saldo Anterior</span>
                  <strong className="cashflow-kpi-value">{formatCurrency(data.summary.saldoAnterior)}</strong>
                </div>
                <div className="cashflow-kpi-card cashflow-kpi-card--in">
                  <span className="cashflow-kpi-label">Entradas</span>
                  <strong className="cashflow-kpi-value">{formatCurrency(data.summary.entradas)}</strong>
                </div>
                <div className="cashflow-kpi-card cashflow-kpi-card--out">
                  <span className="cashflow-kpi-label">Saídas</span>
                  <strong className="cashflow-kpi-value">{formatCurrency(data.summary.saidas)}</strong>
                </div>
                <div className="cashflow-kpi-card">
                  <span className="cashflow-kpi-label">Saldo Previsto</span>
                  <strong className="cashflow-kpi-value">{formatCurrency(data.summary.saldoPrevisto)}</strong>
                </div>
              </div>

              <div className="cashflow-detail-tables">
                <div className="cashflow-detail-table-panel">
                  <div className="cashflow-detail-panel-head">
                    <h3>Contas a Pagar</h3>
                    <div className="reports-search-wrapper cashflow-detail-search">
                      <i className="bi bi-search search-icon" aria-hidden="true" />
                      <input
                        type="search"
                        placeholder="Buscar..."
                        value={pagarFilter}
                        onChange={(e) => setPagarFilter(e.target.value)}
                        aria-label="Filtrar contas a pagar"
                      />
                    </div>
                  </div>
                  <div className="cashflow-detail-table-wrap">
                    <table className="erp-table reports-table cashflow-detail-table cashflow-detail-table--pagar">
                      <colgroup>
                        <col className="col-filial" />
                        <col className="col-party" />
                        <col className="col-titulo" />
                        <col className="col-tipo" />
                        <col className="col-saldo" />
                      </colgroup>
                      <thead>
                        <tr>
                          {['Filial', 'Fornecedor', 'Título', 'Tipo', 'Saldo'].map((col) => (
                            <th key={col} className={col === 'Saldo' ? 'num' : undefined}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {canShowEmpty && data.pagar.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="cashflow-detail-empty">Sem lançamentos.</td>
                          </tr>
                        ) : filteredPagar.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="cashflow-detail-empty">Nenhum resultado para o filtro.</td>
                          </tr>
                        ) : (
                          filteredPagar.map((row) => (
                            <tr key={`${row.filial}-${row.titulo}-${row.tipo}`}>
                              <td className="cashflow-detail-cell-clip" title={row.filial}>{row.filial}</td>
                              <td className="cashflow-detail-cell-clip" title={row.fornecedor}>{row.fornecedor}</td>
                              <td className="cashflow-detail-cell-clip cashflow-detail-cell-doc" title={row.titulo}>{row.titulo}</td>
                              <td className="cashflow-detail-cell-tipo" title={row.tipo}>{row.tipo}</td>
                              <td className="num cashflow-detail-value--out cashflow-detail-cell-saldo">{formatCurrency(row.saldo)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="cashflow-detail-table-total cashflow-detail-table-total--out">
                    <span>Total</span>
                    <strong>{formatCurrency(pagarTotal)}</strong>
                  </div>
                </div>

                <div className="cashflow-detail-table-panel">
                  <div className="cashflow-detail-panel-head">
                    <h3>Contas a Receber</h3>
                    <div className="reports-search-wrapper cashflow-detail-search">
                      <i className="bi bi-search search-icon" aria-hidden="true" />
                      <input
                        type="search"
                        placeholder="Buscar..."
                        value={receberFilter}
                        onChange={(e) => setReceberFilter(e.target.value)}
                        aria-label="Filtrar contas a receber"
                      />
                    </div>
                  </div>
                  <div className="cashflow-detail-table-wrap">
                    <table className="erp-table reports-table cashflow-detail-table cashflow-detail-table--receber">
                      <colgroup>
                        <col className="col-filial" />
                        <col className="col-party" />
                        <col className="col-titulo" />
                        <col className="col-saldo" />
                      </colgroup>
                      <thead>
                        <tr>
                          {['Filial', 'Cliente', 'Título', 'Saldo'].map((col) => (
                            <th key={col} className={col === 'Saldo' ? 'num' : undefined}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {canShowEmpty && data.receber.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="cashflow-detail-empty">Sem lançamentos.</td>
                          </tr>
                        ) : filteredReceber.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="cashflow-detail-empty">Nenhum resultado para o filtro.</td>
                          </tr>
                        ) : (
                          filteredReceber.map((row) => (
                            <tr key={`${row.filial}-${row.titulo}`}>
                              <td className="cashflow-detail-cell-clip" title={row.filial}>{row.filial}</td>
                              <td className="cashflow-detail-cell-clip" title={row.cliente}>{row.cliente}</td>
                              <td className="cashflow-detail-cell-clip cashflow-detail-cell-doc" title={row.titulo}>{row.titulo}</td>
                              <td className="num cashflow-detail-value--in cashflow-detail-cell-saldo">{formatCurrency(row.saldo)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="cashflow-detail-table-total cashflow-detail-table-total--in">
                    <span>Total</span>
                    <strong>{formatCurrency(receberTotal)}</strong>
                  </div>
                </div>
              </div>
            </>
          )}
        </QueryDataPanel>
      </div>
    </div>
  );
};

export default CashflowDayDetailModal;
