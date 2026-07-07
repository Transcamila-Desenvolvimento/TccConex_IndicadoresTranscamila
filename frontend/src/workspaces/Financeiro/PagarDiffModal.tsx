import React, { useEffect, useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { usePagarDiffAnalysis } from '../../hooks/useFinanceiroReports';
import type { PagarDiffBatchRef, PagarDiffDay, PagarDiffTituloRef, ReportBatch } from '../../types/domain';
import { exportPagarDiffToExcel } from '../../utils/pagarDiffExport';

interface PagarDiffModalProps {
  activeBatch: ReportBatch | null;
  onClose: () => void;
}

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatSignedCurrency = (value: number) => {
  const formatted = formatCurrency(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
};

const diffClass = (value: number) => {
  if (value > 0) return 'report-diff-value--up';
  if (value < 0) return 'report-diff-value--down';
  return 'report-diff-value--neutral';
};

const positionLabel = (batch?: PagarDiffBatchRef | null) => {
  if (!batch) return '—';
  const parts = batch.referenceDateLabel.split('/');
  if (parts.length >= 2) {
    return `Posição - ${parts[0]}/${parts[1]}`;
  }
  return `Posição - ${batch.referenceDateLabel}`;
};

const brDateToIso = (br: string) => {
  const parts = br.split('/');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

const addOneMonthIso = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return '';
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const lastDay = new Date(nextYear, nextMonth, 0).getDate();
  const safeDay = Math.min(day, lastDay);
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
};

const PagarDiffModal: React.FC<PagarDiffModalProps> = ({ activeBatch, onClose }) => {
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<{ start?: string; end?: string }>({});
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const query = usePagarDiffAnalysis(
    {
      batchId: activeBatch?.id,
      start: appliedFilters.start,
      end: appliedFilters.end,
    },
    Boolean(activeBatch),
  );

  useEffect(() => {
    if (!activeBatch) return;
    const start = brDateToIso(activeBatch.date);
    const end = addOneMonthIso(start);
    setDateStart(start);
    setDateEnd(end);
    setAppliedFilters({});
    setExpandedDays(new Set());
  }, [activeBatch?.id]);

  useEffect(() => {
    if (!query.data) return;
    setDateStart(query.data.dateStart ?? '');
    setDateEnd(query.data.dateEnd ?? '');
  }, [query.data]);

  const summaryCards = useMemo(() => {
    const data = query.data;
    if (!data) return [];
    return [
      {
        label: `Total ${positionLabel(data.currentBatch)}`,
        value: data.totalCurrent,
        tone: 'primary' as const,
      },
      {
        label: `Total ${positionLabel(data.previousBatch)}`,
        value: data.totalPrevious,
        tone: 'muted' as const,
      },
      {
        label: 'Diferença consolidada',
        value: data.totalDiff,
        tone: 'diff' as const,
      },
    ];
  }, [query.data]);

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setAppliedFilters({
      start: dateStart || undefined,
      end: dateEnd || undefined,
    });
    setExpandedDays(new Set());
  };

  const canExportExcel = Boolean(
    query.data?.previousBatch && query.data.days.length > 0 && !query.isFetching,
  );

  const handleExportExcel = async () => {
    if (!query.data?.previousBatch) return;
    await exportPagarDiffToExcel(query.data);
  };

  const renderTituloList = (
    items: PagarDiffTituloRef[],
    badge: string,
    sign: '+' | '-',
    tone: 'up' | 'down',
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="report-diff-detail-card">
        <div className="report-diff-detail-card__header">{badge}</div>
        <div className="report-diff-detail-card__body">
          {items.map((item) => (
            <div key={`${item.id}-${item.titulo}`} className="report-diff-detail-item">
              <div>
                <div className="report-diff-detail-item__title">
                  <span className="report-diff-doc-badge">{item.tipo}</span>
                  <span>{item.codForn} · {item.fornecedor}</span>
                </div>
                <div className="report-diff-detail-item__meta">Doc: {item.titulo}</div>
              </div>
              <span className={`report-diff-detail-item__value report-diff-value--${tone}`}>
                {sign}{formatCurrency(item.saldo)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDayDetails = (day: PagarDiffDay) => {
    const hasDetails =
      day.novosTitulos.length > 0
      || day.novasNfs.length > 0
      || day.titulosBaixados.length > 0
      || day.reprogramados.length > 0;

    if (!hasDetails) {
      return (
        <div className="report-diff-empty-detail">
          A diferença decorre de alterações de valores em títulos que já existiam na posição anterior.
        </div>
      );
    }

    return (
      <div className="report-diff-detail-grid">
        {renderTituloList(day.novosTitulos, 'Inclusões — Títulos', '+', 'down')}
        {renderTituloList(day.novasNfs, 'Inclusões — NFs', '+', 'down')}
        {renderTituloList(day.titulosBaixados, 'Baixas / Remoções', '-', 'up')}
        {day.reprogramados.length > 0 && (
          <div className="report-diff-detail-card report-diff-detail-card--wide">
            <div className="report-diff-detail-card__header report-diff-detail-card__header--accent">
              Reprogramados
            </div>
            <div className="report-diff-detail-card__body">
              {day.reprogramados.map((item, index) => (
                <div key={`${item.titulo.id}-${item.tipoReprogramacao}-${index}`} className="report-diff-detail-item">
                  <div>
                    <div className="report-diff-detail-item__title">
                      <span className="report-diff-doc-badge">REP</span>
                      <span>{item.titulo.codForn} · {item.titulo.fornecedor}</span>
                    </div>
                    <div className="report-diff-detail-item__meta">
                      Doc: {item.titulo.titulo} ·{' '}
                      {item.tipoReprogramacao === 'reprogramado_de'
                        ? `Reprogramado de ${item.dataAnterior}`
                        : `Reprogramado para ${item.dataNova}`}
                    </div>
                  </div>
                  <span className={`report-diff-detail-item__value ${diffClass(
                    item.tipoReprogramacao === 'reprogramado_de' ? item.saldo : -item.saldo,
                  )}`}>
                    {item.tipoReprogramacao === 'reprogramado_de' ? '+' : '-'}
                    {formatCurrency(item.saldo)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="search-backdrop cashflow-detail-backdrop report-diff-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="search-modal-card report-diff-modal">
        <header className="cashflow-detail-header report-diff-header">
          <div>
            <h2>Novos Títulos</h2>
            <p>
              Comparação de Contas a Pagar entre{' '}
              {query.data
                ? `${positionLabel(query.data.currentBatch)} e ${positionLabel(query.data.previousBatch)}`
                : 'as duas últimas posições'}
            </p>
          </div>
          <button type="button" className="cashflow-detail-close" onClick={onClose} aria-label="Fechar">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <form className="report-diff-filters" onSubmit={applyFilters}>
          <label>
            <span>Período início</span>
            <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
          </label>
          <label>
            <span>Período fim</span>
            <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
          </label>
          <button type="submit" className="reports-action-btn primary" disabled={query.isFetching}>
            Filtrar
          </button>
          <div className="report-diff-filters__actions">
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={!canExportExcel}
              onClick={handleExportExcel}
            >
              Exportar Excel
            </button>
          </div>
        </form>

        <div className="report-diff-body">
          <QueryDataPanel
            query={query}
            loadingMessage="Comparando lançamentos entre posições..."
            errorMessage="Não foi possível carregar a comparação de lançamentos."
            variant="compact"
          >
          {query.data && !query.data.previousBatch && (
            <div className="report-diff-empty">
              <strong>Sem posição anterior</strong>
              <span>Não há posição anterior para comparar com a posição atual.</span>
            </div>
          )}

          {query.data?.previousBatch && (
            <>
              <div className="report-diff-summary">
                {summaryCards.map((card) => (
                  <div
                    key={card.label}
                    className={`report-diff-summary-card report-diff-summary-card--${card.tone}`}
                  >
                    <span>{card.label}</span>
                    <strong className={card.tone === 'diff' ? diffClass(card.value) : undefined}>
                      {formatCurrency(card.value)}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="report-diff-mini-summary">
                <div>
                  <span>Novos títulos</span>
                  <strong>{formatCurrency(query.data.summary.novosTitulos)}</strong>
                </div>
                <div>
                  <span>Novas NFs</span>
                  <strong>{formatCurrency(query.data.summary.novasNfs)}</strong>
                </div>
                <div>
                  <span>Baixados</span>
                  <strong>{formatCurrency(query.data.summary.titulosBaixados)}</strong>
                </div>
              </div>

              <div className="report-diff-table-wrap">
                <table className="erp-table reports-table report-diff-table">
                  <thead>
                    <tr>
                      <th style={{ width: 48 }} />
                      <th>Data vencimento</th>
                      <th className="num">{positionLabel(query.data.currentBatch)}</th>
                      <th className="num">{positionLabel(query.data.previousBatch)}</th>
                      <th className="num">Variação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.days.map((day) => {
                      const expanded = expandedDays.has(day.date);
                      return (
                        <React.Fragment key={day.date}>
                          <tr
                            className={`report-diff-row ${expanded ? 'is-expanded' : ''}`}
                            onClick={() => toggleDay(day.date)}
                          >
                            <td className="report-diff-expand-cell">
                              <span className={`report-diff-chevron ${expanded ? 'is-open' : ''}`} aria-hidden="true">
                                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </span>
                            </td>
                            <td>{day.dateLabel}</td>
                            <td className="num">{formatCurrency(day.totalCurrent)}</td>
                            <td className="num">{formatCurrency(day.totalPrevious)}</td>
                            <td className={`num ${diffClass(day.diff)}`}>{formatSignedCurrency(day.diff)}</td>
                          </tr>
                          {expanded && (
                            <tr className="report-diff-detail-row">
                              <td colSpan={5}>
                                <div className="report-diff-detail-panel">
                                  {renderDayDetails(day)}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>

                {query.data.days.length === 0 && (
                  <div className="report-diff-empty">
                    <strong>Nenhum registro no período</strong>
                    <span>Ajuste o filtro de vencimento para visualizar as diferenças.</span>
                  </div>
                )}
              </div>
            </>
          )}
          </QueryDataPanel>
        </div>
      </div>
    </div>
  );
};

export default PagarDiffModal;
