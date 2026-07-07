import React, { useMemo, useState } from 'react';
import { usePrAction, usePrAnalysis } from '../../hooks/useFinanceiroReports';
import type { PrDuplicateRow } from '../../types/domain';
import QueryDataPanel from '../../components/QueryDataPanel';

interface PrAnalysisModalProps {
  onClose: () => void;
}

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PrAnalysisModal: React.FC<PrAnalysisModalProps> = ({ onClose }) => {
  const [tab, setTab] = useState<'pendentes' | 'ignoradas'>('pendentes');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState<string | null>(null);

  const prAnalysisQuery = usePrAnalysis(true);
  const { data, refetch } = prAnalysisQuery;
  const { mutateAsync, isPending } = usePrAction();

  const duplicates = data?.duplicates ?? [];
  const ignored = data?.ignored ?? [];

  const allSelected = duplicates.length > 0 && selected.size === duplicates.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(duplicates.map((row) => row.id)));
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runAction = async (ids: number[], action: 'ignore' | 'restore') => {
    if (ids.length === 0) return;
    const label = action === 'ignore' ? 'desconsiderar' : 'restaurar';
    if (!window.confirm(`Deseja ${label} ${ids.length} item(ns)?`)) return;

    setFeedback(null);
    try {
      const result = await mutateAsync({ ids, action });
      setFeedback(result.message);
      setSelected(new Set());
      await refetch();
      if (action === 'ignore') setTab('ignoradas');
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? `Não foi possível ${label} a(s) PR(s).`;
      setFeedback(detail);
    }
  };

  const summary = useMemo(() => ({
    duplicates: data?.totalDuplicates ?? 0,
    ignored: ignored.length,
    totalPrs: data?.totalPrs ?? 0,
  }), [data, ignored.length]);

  const renderMatches = (row: PrDuplicateRow) => {
    if (!expanded.has(row.id)) return null;
    return (
      <tr className="pr-analysis-detail-row">
        <td colSpan={6}>
          <div className="pr-analysis-matches">
            <span className="pr-analysis-matches-title">Correspondências encontradas</span>
            <table className="erp-table reports-table">
              <tbody>
                {row.matches.map((match) => (
                  <tr key={match.id}>
                    <td>{match.titulo}</td>
                    <td>{match.tipo}</td>
                    <td>{match.vencimentoReal}</td>
                    <td className="num">{formatCurrency(match.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div
      className="search-backdrop cashflow-detail-backdrop"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div className="search-modal-card pr-analysis-modal">
        <header className="cashflow-detail-header pr-analysis-header">
          <div>
            <h2>Análise de Duplicidades (PR vs Título Real)</h2>
            <p>Lote {data?.batchLabel ?? '—'} · {summary.totalPrs} PR(s) ativa(s)</p>
          </div>
          <button type="button" className="cashflow-detail-close" onClick={onClose} disabled={isPending} aria-label="Fechar">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="pr-analysis-summary">
          <div>
            <strong>{summary.duplicates}</strong>
            <span>Duplicidades</span>
          </div>
          <div>
            <strong>{summary.ignored}</strong>
            <span>Desconsideradas</span>
          </div>
        </div>

        <div className="pr-analysis-tabs">
          <button
            type="button"
            className={`pr-analysis-tab${tab === 'pendentes' ? ' active' : ''}`}
            onClick={() => setTab('pendentes')}
          >
            Pendentes
          </button>
          <button
            type="button"
            className={`pr-analysis-tab${tab === 'ignoradas' ? ' active' : ''}`}
            onClick={() => setTab('ignoradas')}
          >
            Desconsideradas
          </button>
        </div>

        {feedback && <div className="pr-analysis-feedback">{feedback}</div>}

        <QueryDataPanel
          className="pr-analysis-body"
          query={prAnalysisQuery}
          variant="compact"
          loadingMessage="Analisando PRs do lote..."
          refreshingMessage="Atualizando análise..."
          errorMessage="Não foi possível carregar a análise de PR."
        >
          {tab === 'pendentes' && (
            <>
              {duplicates.length > 0 ? (
                <>
                  <div className="pr-analysis-toolbar">
                    <label className="pr-analysis-select-all">
                      <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} disabled={isPending} />
                      Selecionar todos
                    </label>
                    <span className="pr-analysis-selected-count">{selected.size} selecionado(s)</span>
                    <button
                      type="button"
                      className="reports-action-btn primary"
                      disabled={selected.size === 0 || isPending}
                      onClick={() => runAction(Array.from(selected), 'ignore')}
                    >
                      Desconsiderar selecionados
                    </button>
                  </div>

                  <div className="pr-analysis-table-wrap">
                    <table className="erp-table reports-table">
                      <thead>
                        <tr>
                          <th className="checkbox-cell" />
                          <th>Fornecedor</th>
                          <th>Título</th>
                          <th>Vencimento Real</th>
                          <th className="num">Saldo</th>
                          <th className="num">Duplicidades</th>
                        </tr>
                      </thead>
                      <tbody>
                        {duplicates.map((row) => (
                          <React.Fragment key={row.id}>
                            <tr>
                              <td className="checkbox-cell">
                                <input
                                  type="checkbox"
                                  checked={selected.has(row.id)}
                                  onChange={() => toggleSelect(row.id)}
                                  disabled={isPending}
                                />
                              </td>
                              <td>{row.fornecedor}</td>
                              <td>{row.titulo}</td>
                              <td>{row.vencimentoReal}</td>
                              <td className="num">{formatCurrency(row.saldo)}</td>
                              <td className="num">
                                <button
                                  type="button"
                                  className="pr-analysis-expand-btn"
                                  onClick={() => toggleExpanded(row.id)}
                                >
                                  {row.matches.length} {expanded.has(row.id) ? '▲' : '▼'}
                                </button>
                              </td>
                            </tr>
                            {renderMatches(row)}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="pr-analysis-empty">
                  <strong>Tudo limpo!</strong>
                  <p>Não encontramos duplicidade entre PRs e títulos reais neste lote.</p>
                </div>
              )}
            </>
          )}

          {tab === 'ignoradas' && (
            ignored.length > 0 ? (
              <div className="pr-analysis-table-wrap">
                <table className="erp-table reports-table">
                  <thead>
                    <tr>
                      <th>Fornecedor</th>
                      <th>Título</th>
                      <th>Vencimento</th>
                      <th className="num">Saldo</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {ignored.map((row) => (
                      <tr key={row.id}>
                        <td>{row.fornecedor}</td>
                        <td>{row.titulo}</td>
                        <td>{row.vencimentoReal}</td>
                        <td className="num">{formatCurrency(row.saldo)}</td>
                        <td className="pr-analysis-action-cell">
                          <button
                            type="button"
                            className="reports-action-btn secondary"
                            disabled={isPending}
                            onClick={() => runAction([row.id], 'restore')}
                          >
                            Restaurar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="pr-analysis-empty">
                <strong>Lista vazia</strong>
                <p>Nenhuma PR desconsiderada neste lote.</p>
              </div>
            )
          )}
        </QueryDataPanel>

        <footer className="pr-analysis-footer">
          <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={isPending}>
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
};

export default PrAnalysisModal;
