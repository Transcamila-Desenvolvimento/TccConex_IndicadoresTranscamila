import React from 'react';

const FinanceiroCalendar: React.FC = () => {
  return (
    <section id="financeiro-calendar-view" className="view active" style={{ display: 'block' }}>
      <header className="view-header">
        <h1>Calendário</h1>
        <p>Ambiente não configurado para esta filial ou em desenvolvimento.</p>
      </header>
      <div className="erp-card" style={{ marginTop: '20px', fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center', padding: '40px 20px' }}>
        Aguardando inicialização do calendário financeiro.
      </div>
    </section>
  );
};

export default FinanceiroCalendar;
