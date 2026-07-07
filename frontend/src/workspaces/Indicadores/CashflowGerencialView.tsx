import React from 'react';
import type { CashflowGerencialPanel } from '../../types/domain';

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface CashflowGerencialViewProps {
  data: CashflowGerencialPanel;
}

const CashflowGerencialView: React.FC<CashflowGerencialViewProps> = ({ data }) => (
  <div className="cashflow-gerencial">
    <p className="cashflow-gerencial-ref">
      Posição referente a <strong>{data.referenceDate}</strong>
    </p>

    <div className="cashflow-gerencial-groups">
      {data.groups.map(group => (
        <section key={group.title} className="cashflow-gerencial-group erp-card">
          <h3 className="cashflow-gerencial-group-title">{group.title}</h3>
          <div className="cashflow-gerencial-group-items">
            {group.items.map(item => (
              <div key={item.label} className="cashflow-gerencial-metric">
                <span className="cashflow-gerencial-metric-label">{item.label}</span>
                <strong className="cashflow-gerencial-metric-value">{formatCurrency(item.value)}</strong>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>

    <div className="cashflow-gerencial-highlights">
      {data.highlights.map(card => (
        <article
          key={card.title}
          className={`cashflow-gerencial-highlight cashflow-gerencial-highlight--${card.variant}`}
        >
          <span className="cashflow-gerencial-highlight-title">{card.title}</span>
          <strong className="cashflow-gerencial-highlight-value">{formatCurrency(card.value)}</strong>
          <span className="cashflow-gerencial-highlight-sub">{card.subtitle}</span>
        </article>
      ))}
    </div>

    <section className="erp-card cashflow-gerencial-table-card">
      <header className="cashflow-gerencial-table-header">
        <h2>Cronograma de Recebimento Futuro</h2>
        <span className="cashflow-gerencial-table-total">{formatCurrency(data.scheduleTotal)}</span>
      </header>
      <div className="table-container">
        <table className="erp-table reports-table cashflow-gerencial-schedule-table">
          <thead>
            <tr>
              {data.schedule.map(bucket => (
                <th key={bucket.label} className="num">{bucket.label}</th>
              ))}
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {data.schedule.map(bucket => (
                <td key={bucket.label} className="num">{formatCurrency(bucket.value)}</td>
              ))}
              <td className="num cashflow-gerencial-total-cell">{formatCurrency(data.scheduleTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section className="erp-card cashflow-gerencial-table-card">
      <h2 className="cashflow-gerencial-table-title">Aging e Atrasos em Aberto</h2>
      <div className="table-container">
        <table className="erp-table reports-table cashflow-gerencial-aging-table">
          <thead>
            <tr>
              <th>Categoria</th>
              {data.aging.buckets.map(bucket => (
                <th key={bucket} className="num">{bucket}</th>
              ))}
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.aging.rows.map(row => (
              <tr key={row.category}>
                <td className={`cashflow-gerencial-category cashflow-gerencial-category--${row.variant}`}>
                  {row.category}
                </td>
                {row.buckets.map((value, index) => (
                  <td key={`${row.category}-${index}`} className="num">{formatCurrency(value)}</td>
                ))}
                <td className={`num cashflow-gerencial-total-cell cashflow-gerencial-total-cell--${row.variant}`}>
                  {formatCurrency(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  </div>
);

export default CashflowGerencialView;
